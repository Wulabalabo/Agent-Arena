import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";
import {
  buildPredictOperationPlan,
  buildPredictTransactionFromPlan,
  type BuildPredictTransactionOptions,
  type PredictOperationPlan
} from "./transactions";
import type { InternalTradingWallet, PredictConfig } from "./types";
import type { MemoryWalletStore } from "./wallet-store";

interface SetupExecutorInput {
  wallet: InternalTradingWallet;
}

interface DepositExecutorInput extends SetupExecutorInput {
  managerId: string;
  amountRaw: string;
}

export interface PredictSetupTransactionSummary {
  operation: "create_manager" | "deposit_dusdc";
  mode: "dry_run" | "submit";
  status: "dry_run_ok" | "submitted" | "failed";
  txDigest?: string;
  managerId?: string;
  quoteCoinObjectId?: string;
  amountRaw?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PredictSetupExecutor {
  dryRunCreateManager?: (input: SetupExecutorInput) => Promise<PredictSetupTransactionSummary>;
  submitCreateManager?: (input: SetupExecutorInput) => Promise<PredictSetupTransactionSummary>;
  dryRunDeposit?: (input: DepositExecutorInput) => Promise<PredictSetupTransactionSummary>;
  submitDeposit?: (input: DepositExecutorInput) => Promise<PredictSetupTransactionSummary>;
}

interface CreatePredictSetupExecutorOptions {
  config: PredictConfig;
  walletStore: MemoryWalletStore;
  client?: SuiJsonRpcClient;
}

export function createPredictSetupExecutor({
  config,
  walletStore,
  client = new SuiJsonRpcClient({
    network: "testnet",
    url: config.suiRpcUrl
  })
}: CreatePredictSetupExecutorOptions): PredictSetupExecutor {
  const transactionOptions: BuildPredictTransactionOptions = {
    predictPackageId: config.predictPackageId,
    predictObjectId: config.predictObjectId,
    quoteAssetType: config.quoteAssetType,
    clockObjectId: config.suiClockObjectId
  };

  return {
    async dryRunCreateManager({ wallet }) {
      const plan = buildPredictOperationPlan({
        operation: "create_manager"
      });
      return await dryRunSetupTransaction({
        client,
        wallet,
        plan,
        transactionOptions
      });
    },

    async submitCreateManager({ wallet }) {
      const plan = buildPredictOperationPlan({
        operation: "create_manager"
      });
      return await submitSetupTransaction({
        client,
        walletStore,
        wallet,
        plan,
        transactionOptions
      });
    },

    async dryRunDeposit({ wallet, managerId, amountRaw }) {
      const plan = buildPredictOperationPlan({
        operation: "deposit_dusdc",
        managerId,
        quantityRaw: amountRaw
      });
      return await dryRunSetupTransaction({
        client,
        wallet,
        plan,
        transactionOptions,
        managerId,
        amountRaw
      });
    },

    async submitDeposit({ wallet, managerId, amountRaw }) {
      const plan = buildPredictOperationPlan({
        operation: "deposit_dusdc",
        managerId,
        quantityRaw: amountRaw
      });
      return await submitSetupTransaction({
        client,
        walletStore,
        wallet,
        plan,
        transactionOptions,
        managerId,
        amountRaw
      });
    }
  };
}

async function dryRunSetupTransaction(input: {
  client: SuiJsonRpcClient;
  wallet: InternalTradingWallet;
  plan: PredictOperationPlan;
  transactionOptions: BuildPredictTransactionOptions;
  managerId?: string;
  amountRaw?: string;
}): Promise<PredictSetupTransactionSummary> {
  const tx = buildSetupTransaction(input);
  tx.setSenderIfNotSet(input.wallet.address);
  const transactionBlock = await tx.build({ client: input.client });
  const dryRun = await input.client.dryRunTransactionBlock({ transactionBlock });
  const summary = summarizeDryRun(input.plan, dryRun, input);
  if (summary.status !== "dry_run_ok") {
    throw new Error(`PREDICT_DRY_RUN_FAILED: ${summary.errorMessage ?? "unknown error"}`);
  }

  return summary;
}

async function submitSetupTransaction(input: {
  client: SuiJsonRpcClient;
  walletStore: MemoryWalletStore;
  wallet: InternalTradingWallet;
  plan: PredictOperationPlan;
  transactionOptions: BuildPredictTransactionOptions;
  managerId?: string;
  amountRaw?: string;
}): Promise<PredictSetupTransactionSummary> {
  await dryRunSetupTransaction(input);

  const signer = await input.walletStore.getSigner(input.wallet.id);
  const tx = buildSetupTransaction(input);
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
  const summary = summarizeSubmit(input.plan, response, input);
  if (summary.status !== "submitted") {
    throw new Error(`PREDICT_SUBMIT_FAILED: ${summary.errorMessage ?? "unknown error"}`);
  }

  return summary;
}

function buildSetupTransaction(input: {
  plan: PredictOperationPlan;
  transactionOptions: BuildPredictTransactionOptions;
}): Transaction {
  return buildPredictTransactionFromPlan(input.plan, input.transactionOptions);
}

function summarizeDryRun(
  plan: PredictOperationPlan,
  response: unknown,
  input: { managerId?: string; amountRaw?: string }
): PredictSetupTransactionSummary {
  const status = transactionStatus(response);
  return {
    operation: setupOperation(plan),
    mode: "dry_run",
    status: status.ok ? "dry_run_ok" : "failed",
    txDigest: digestFromResponse(response),
    managerId: input.managerId,
    amountRaw: input.amountRaw,
    errorCode: status.ok ? undefined : "PREDICT_DRY_RUN_FAILED",
    errorMessage: status.error
  };
}

function summarizeSubmit(
  plan: PredictOperationPlan,
  response: SuiTransactionBlockResponse,
  input: { transactionOptions: BuildPredictTransactionOptions; managerId?: string; amountRaw?: string }
): PredictSetupTransactionSummary {
  const status = transactionStatus(response);
  const managerId = setupOperation(plan) === "create_manager"
    ? extractCreatedManagerId(response, input.transactionOptions.predictPackageId)
    : input.managerId;

  return {
    operation: setupOperation(plan),
    mode: "submit",
    status: status.ok ? "submitted" : "failed",
    txDigest: response.digest,
    managerId,
    amountRaw: input.amountRaw,
    errorCode: status.ok ? undefined : "PREDICT_SUBMIT_FAILED",
    errorMessage: status.error
  };
}

export function extractCreatedManagerId(
  response: Pick<SuiTransactionBlockResponse, "events" | "objectChanges">,
  predictPackageId: string
): string | undefined {
  const eventTypeSuffix = "::predict_manager::PredictManagerCreated";
  for (const event of response.events ?? []) {
    if (typeof event.type === "string" && event.type.endsWith(eventTypeSuffix)) {
      const managerId = objectIdString((event.parsedJson as Record<string, unknown> | undefined)?.manager_id);
      if (managerId) {
        return managerId;
      }
    }
  }

  const managerType = `${predictPackageId}::predict_manager::PredictManager`;
  for (const change of response.objectChanges ?? []) {
    if (
      change.type === "created" &&
      change.objectType === managerType &&
      typeof change.objectId === "string"
    ) {
      return change.objectId;
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

function setupOperation(plan: PredictOperationPlan): "create_manager" | "deposit_dusdc" {
  if (plan.operation === "create_manager" || plan.operation === "deposit_dusdc") {
    return plan.operation;
  }

  throw new Error("PREDICT_SETUP_OPERATION_REQUIRED");
}

function digestFromResponse(response: unknown): string | undefined {
  if (!isRecord(response)) {
    return undefined;
  }

  return firstString(response.digest, recordValue(response.effects)?.transactionDigest);
}

function objectIdString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (isRecord(value) && typeof value.id === "string" && value.id.trim() !== "") {
    return value.id.trim();
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
