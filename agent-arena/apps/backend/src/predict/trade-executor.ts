import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  buildPredictOperationPlan,
  buildPredictTransactionFromPlan,
  type BuildPredictTransactionOptions,
  type DirectionalMarketSide,
  type PredictOperationPlan
} from "./transactions";
import type { InternalTradingWallet, PredictConfig } from "./types";
import type { MemoryWalletStore } from "./wallet-store";

interface MintDirectionalExecutorInput {
  wallet: InternalTradingWallet;
  managerId: string;
  oracleId: string;
  expiryMs: string;
  strikeRaw: string;
  direction: DirectionalMarketSide;
  quantityRaw: string;
  maxCostRaw: string;
}

export interface PredictTradeTransactionSummary {
  operation: "mint_directional";
  mode: "dry_run" | "submit";
  status: "dry_run_ok" | "submitted" | "failed";
  txDigest?: string;
  managerId: string;
  oracleId: string;
  expiryMs: string;
  strikeRaw: string;
  direction: DirectionalMarketSide;
  quantityRaw: string;
  maxCostRaw: string;
  actualCostRaw?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PredictTradeExecutor {
  dryRunMintDirectional?: (input: MintDirectionalExecutorInput) => Promise<PredictTradeTransactionSummary>;
  submitMintDirectional?: (input: MintDirectionalExecutorInput) => Promise<PredictTradeTransactionSummary>;
}

interface CreatePredictTradeExecutorOptions {
  config: PredictConfig;
  walletStore: MemoryWalletStore;
  client?: SuiJsonRpcClient;
}

export function createPredictTradeExecutor({
  config,
  walletStore,
  client = new SuiJsonRpcClient({
    network: "testnet",
    url: config.suiRpcUrl
  })
}: CreatePredictTradeExecutorOptions): PredictTradeExecutor {
  const transactionOptions: BuildPredictTransactionOptions = {
    predictPackageId: config.predictPackageId,
    predictObjectId: config.predictObjectId,
    quoteAssetType: config.quoteAssetType,
    clockObjectId: config.suiClockObjectId
  };

  return {
    async dryRunMintDirectional(input) {
      const plan = buildMintDirectionalPlan(input);
      return await dryRunTradeTransaction({
        client,
        plan,
        transactionOptions,
        ...input
      });
    },

    async submitMintDirectional(input) {
      const plan = buildMintDirectionalPlan(input);
      return await submitTradeTransaction({
        client,
        walletStore,
        plan,
        transactionOptions,
        ...input
      });
    }
  };
}

async function dryRunTradeTransaction(input: {
  client: SuiJsonRpcClient;
  plan: PredictOperationPlan;
  transactionOptions: BuildPredictTransactionOptions;
} & MintDirectionalExecutorInput): Promise<PredictTradeTransactionSummary> {
  const tx = buildPredictTransactionFromPlan(input.plan, input.transactionOptions);
  tx.setSenderIfNotSet(input.wallet.address);
  const transactionBlock = await tx.build({ client: input.client });
  const dryRun = await input.client.dryRunTransactionBlock({ transactionBlock });
  const summary = summarizeDryRun(dryRun, input);
  if (summary.status !== "dry_run_ok") {
    throw new Error(`PREDICT_DRY_RUN_FAILED: ${summary.errorMessage ?? "unknown error"}`);
  }

  return summary;
}

async function submitTradeTransaction(input: {
  client: SuiJsonRpcClient;
  walletStore: MemoryWalletStore;
  plan: PredictOperationPlan;
  transactionOptions: BuildPredictTransactionOptions;
} & MintDirectionalExecutorInput): Promise<PredictTradeTransactionSummary> {
  await dryRunTradeTransaction(input);

  const signer = await input.walletStore.getSigner(input.wallet.id);
  const tx = buildPredictTransactionFromPlan(input.plan, input.transactionOptions);
  tx.setSenderIfNotSet(input.wallet.address);
  const response = await input.client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true
    }
  });
  const summary = summarizeSubmit(response, input);
  if (summary.status !== "submitted") {
    throw new Error(`PREDICT_SUBMIT_FAILED: ${summary.errorMessage ?? "unknown error"}`);
  }

  return summary;
}

function buildMintDirectionalPlan(input: MintDirectionalExecutorInput): PredictOperationPlan {
  return buildPredictOperationPlan({
    operation: "mint_directional",
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: input.strikeRaw,
    direction: input.direction,
    quantityRaw: input.quantityRaw,
    maxCostRaw: input.maxCostRaw
  });
}

function summarizeDryRun(
  response: unknown,
  input: MintDirectionalExecutorInput
): PredictTradeTransactionSummary {
  const status = transactionStatus(response);
  return {
    operation: "mint_directional",
    mode: "dry_run",
    status: status.ok ? "dry_run_ok" : "failed",
    txDigest: digestFromResponse(response),
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: input.strikeRaw,
    direction: input.direction,
    quantityRaw: input.quantityRaw,
    maxCostRaw: input.maxCostRaw,
    actualCostRaw: extractMintActualCostRaw(response, ""),
    errorCode: status.ok ? undefined : "PREDICT_DRY_RUN_FAILED",
    errorMessage: status.error
  };
}

function summarizeSubmit(
  response: SuiTransactionBlockResponse,
  input: MintDirectionalExecutorInput & { transactionOptions: BuildPredictTransactionOptions }
): PredictTradeTransactionSummary {
  const status = transactionStatus(response);
  return {
    operation: "mint_directional",
    mode: "submit",
    status: status.ok ? "submitted" : "failed",
    txDigest: response.digest,
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: input.strikeRaw,
    direction: input.direction,
    quantityRaw: input.quantityRaw,
    maxCostRaw: input.maxCostRaw,
    actualCostRaw: extractMintActualCostRaw(response, input.transactionOptions.predictPackageId),
    errorCode: status.ok ? undefined : "PREDICT_SUBMIT_FAILED",
    errorMessage: status.error
  };
}

export function extractMintActualCostRaw(
  response: Pick<SuiTransactionBlockResponse, "events">,
  predictPackageId: string
): string | undefined {
  const expectedType = predictPackageId ? `${predictPackageId}::predict::PositionMinted` : undefined;
  for (const event of response.events ?? []) {
    if (typeof event.type !== "string") {
      continue;
    }
    if (expectedType ? event.type !== expectedType : !event.type.endsWith("::predict::PositionMinted")) {
      continue;
    }

    const parsedJson = event.parsedJson as Record<string, unknown> | undefined;
    const cost = rawIntegerValue(parsedJson?.cost);
    if (cost !== undefined) {
      return cost;
    }
  }

  return undefined;
}

function transactionStatus(response: unknown): { ok: boolean; error?: string } {
  if (!isRecord(response)) {
    return { ok: false, error: "Invalid transaction response" };
  }

  const effects = recordValue(response.effects);
  const status = recordValue(effects?.status);
  const statusText = firstString(status?.status, status?.Status);
  if (statusText === "success") {
    return { ok: true };
  }

  return {
    ok: false,
    error: firstString(status?.error, status?.Error) ?? "Transaction failed"
  };
}

function digestFromResponse(response: unknown): string | undefined {
  if (!isRecord(response)) {
    return undefined;
  }

  return firstString(response.digest, recordValue(response.effects)?.transactionDigest);
}

function rawIntegerValue(value: unknown): string | undefined {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
