import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  buildPredictOperationPlan,
  buildPredictTransactionFromPlan,
  type BuildPredictTransactionOptions,
  type DirectionalMarketSide,
  type PredictOperationPlan
} from "./transactions";
import type { InternalTradingWallet, PredictConfig } from "./types";
import type { MemoryWalletStore } from "./wallet-store";

type DirectionalTradeOperation = "mint_directional" | "redeem_directional" | "close_directional";
type RangeTradeOperation = "mint_range" | "redeem_range" | "close_range";
type PredictTradeOperation = DirectionalTradeOperation | RangeTradeOperation;

interface DirectionalPositionInput {
  wallet: InternalTradingWallet;
  managerId: string;
  oracleId: string;
  expiryMs: string;
  strikeRaw: string;
  direction: DirectionalMarketSide;
}

interface MintDirectionalExecutorInput extends DirectionalPositionInput {
  quantityRaw: string;
  maxCostRaw: string;
}

interface RedeemDirectionalExecutorInput extends DirectionalPositionInput {
  operation: "redeem_directional" | "close_directional";
  quantityRaw: string;
  minProceedsRaw: string;
}

interface RangePositionInput {
  wallet: InternalTradingWallet;
  managerId: string;
  oracleId: string;
  expiryMs: string;
  lowerStrikeRaw: string;
  higherStrikeRaw: string;
}

interface MintRangeExecutorInput extends RangePositionInput {
  operation: "mint_range";
  quantityRaw: string;
  maxCostRaw: string;
}

interface RedeemRangeExecutorInput extends RangePositionInput {
  operation: "redeem_range" | "close_range";
  quantityRaw: string;
  minProceedsRaw: string;
}

export interface DirectionalPositionResolution extends DirectionalPositionInput {
  quantityRaw: string;
}

export interface RangePositionResolution extends RangePositionInput {
  quantityRaw: string;
}

export interface PredictTradeTransactionSummary {
  operation: PredictTradeOperation;
  mode: "dry_run" | "submit";
  status: "dry_run_ok" | "submitted" | "failed";
  txDigest?: string;
  managerId: string;
  oracleId: string;
  expiryMs: string;
  strikeRaw?: string;
  direction?: DirectionalMarketSide;
  lowerStrikeRaw?: string;
  higherStrikeRaw?: string;
  quantityRaw: string;
  maxCostRaw?: string;
  minProceedsRaw?: string;
  actualCostRaw?: string;
  actualProceedsRaw?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PredictTradeExecutor {
  resolveDirectionalPosition?: (input: DirectionalPositionInput) => Promise<DirectionalPositionResolution>;
  resolveRangePosition?: (input: RangePositionInput) => Promise<RangePositionResolution>;
  dryRunMintDirectional?: (input: MintDirectionalExecutorInput) => Promise<PredictTradeTransactionSummary>;
  submitMintDirectional?: (input: MintDirectionalExecutorInput) => Promise<PredictTradeTransactionSummary>;
  dryRunRedeemDirectional?: (input: RedeemDirectionalExecutorInput) => Promise<PredictTradeTransactionSummary>;
  submitRedeemDirectional?: (input: RedeemDirectionalExecutorInput) => Promise<PredictTradeTransactionSummary>;
  dryRunMintRange?: (input: MintRangeExecutorInput) => Promise<PredictTradeTransactionSummary>;
  submitMintRange?: (input: MintRangeExecutorInput) => Promise<PredictTradeTransactionSummary>;
  dryRunRedeemRange?: (input: RedeemRangeExecutorInput) => Promise<PredictTradeTransactionSummary>;
  submitRedeemRange?: (input: RedeemRangeExecutorInput) => Promise<PredictTradeTransactionSummary>;
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
    async resolveDirectionalPosition(input) {
      return await resolveDirectionalPosition({
        client,
        transactionOptions,
        ...input
      });
    },

    async resolveRangePosition(input) {
      return await resolveRangePosition({
        client,
        transactionOptions,
        ...input
      });
    },

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
    },

    async dryRunRedeemDirectional(input) {
      const plan = buildRedeemDirectionalPlan(input);
      return await dryRunTradeTransaction({
        client,
        plan,
        transactionOptions,
        ...input
      });
    },

    async submitRedeemDirectional(input) {
      const plan = buildRedeemDirectionalPlan(input);
      return await submitTradeTransaction({
        client,
        walletStore,
        plan,
        transactionOptions,
        ...input
      });
    },

    async dryRunMintRange(input) {
      const plan = buildMintRangePlan(input);
      return await dryRunTradeTransaction({
        client,
        plan,
        transactionOptions,
        ...input
      });
    },

    async submitMintRange(input) {
      const plan = buildMintRangePlan(input);
      return await submitTradeTransaction({
        client,
        walletStore,
        plan,
        transactionOptions,
        ...input
      });
    },

    async dryRunRedeemRange(input) {
      const plan = buildRedeemRangePlan(input);
      return await dryRunTradeTransaction({
        client,
        plan,
        transactionOptions,
        ...input
      });
    },

    async submitRedeemRange(input) {
      const plan = buildRedeemRangePlan(input);
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

async function resolveDirectionalPosition(input: {
  client: SuiJsonRpcClient;
  transactionOptions: BuildPredictTransactionOptions;
} & DirectionalPositionInput): Promise<DirectionalPositionResolution> {
  const tx = buildDirectionalPositionReadTransaction(input);
  tx.setSenderIfNotSet(input.wallet.address);
  const response = await input.client.devInspectTransactionBlock({
    sender: input.wallet.address,
    transactionBlock: tx
  });
  const status = transactionStatus(response);
  if (!status.ok) {
    throw new Error(`PREDICT_POSITION_RESOLUTION_FAILED: ${status.error ?? "unknown error"}`);
  }

  const quantityRaw = extractFirstU64ReturnValue(response);
  if (quantityRaw === undefined) {
    throw new Error("PREDICT_POSITION_RESOLUTION_FAILED: missing u64 return value");
  }

  return {
    wallet: input.wallet,
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: input.strikeRaw,
    direction: input.direction,
    quantityRaw
  };
}

async function resolveRangePosition(input: {
  client: SuiJsonRpcClient;
  transactionOptions: BuildPredictTransactionOptions;
} & RangePositionInput): Promise<RangePositionResolution> {
  const tx = buildRangePositionReadTransaction(input);
  tx.setSenderIfNotSet(input.wallet.address);
  const response = await input.client.devInspectTransactionBlock({
    sender: input.wallet.address,
    transactionBlock: tx
  });
  const status = transactionStatus(response);
  if (!status.ok) {
    throw new Error(`PREDICT_RANGE_POSITION_RESOLUTION_FAILED: ${status.error ?? "unknown error"}`);
  }

  const quantityRaw = extractFirstU64ReturnValue(response);
  if (quantityRaw === undefined) {
    throw new Error("PREDICT_RANGE_POSITION_RESOLUTION_FAILED: missing u64 return value");
  }

  return {
    wallet: input.wallet,
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    lowerStrikeRaw: input.lowerStrikeRaw,
    higherStrikeRaw: input.higherStrikeRaw,
    quantityRaw
  };
}

async function dryRunTradeTransaction(input: {
  client: SuiJsonRpcClient;
  plan: PredictOperationPlan;
  transactionOptions: BuildPredictTransactionOptions;
} & (MintDirectionalExecutorInput | RedeemDirectionalExecutorInput | MintRangeExecutorInput | RedeemRangeExecutorInput)): Promise<PredictTradeTransactionSummary> {
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
} & (MintDirectionalExecutorInput | RedeemDirectionalExecutorInput | MintRangeExecutorInput | RedeemRangeExecutorInput)): Promise<PredictTradeTransactionSummary> {
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

function buildRedeemDirectionalPlan(input: RedeemDirectionalExecutorInput): PredictOperationPlan {
  return buildPredictOperationPlan({
    operation: input.operation,
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: input.strikeRaw,
    direction: input.direction,
    quantityRaw: input.operation === "redeem_directional" ? input.quantityRaw : undefined,
    resolvedQuantityRaw: input.operation === "close_directional" ? input.quantityRaw : undefined,
    minProceedsRaw: input.minProceedsRaw
  });
}

function buildMintRangePlan(input: MintRangeExecutorInput): PredictOperationPlan {
  return buildPredictOperationPlan({
    operation: "mint_range",
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    lowerStrikeRaw: input.lowerStrikeRaw,
    higherStrikeRaw: input.higherStrikeRaw,
    quantityRaw: input.quantityRaw,
    maxCostRaw: input.maxCostRaw
  });
}

function buildRedeemRangePlan(input: RedeemRangeExecutorInput): PredictOperationPlan {
  return buildPredictOperationPlan({
    operation: input.operation,
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    lowerStrikeRaw: input.lowerStrikeRaw,
    higherStrikeRaw: input.higherStrikeRaw,
    quantityRaw: input.operation === "redeem_range" ? input.quantityRaw : undefined,
    resolvedQuantityRaw: input.operation === "close_range" ? input.quantityRaw : undefined,
    minProceedsRaw: input.minProceedsRaw
  });
}

function buildDirectionalPositionReadTransaction(input: {
  transactionOptions: BuildPredictTransactionOptions;
} & DirectionalPositionInput) {
  const tx = new Transaction();
  const marketKey = tx.moveCall({
    target: `${input.transactionOptions.predictPackageId}::market_key::new`,
    arguments: [
      tx.pure.id(input.oracleId),
      tx.pure.u64(input.expiryMs),
      tx.pure.u64(input.strikeRaw),
      tx.pure.bool(input.direction === "up")
    ]
  });

  tx.moveCall({
    target: `${input.transactionOptions.predictPackageId}::predict_manager::position`,
    arguments: [
      tx.object(input.managerId),
      marketKey
    ]
  });

  return tx;
}

function buildRangePositionReadTransaction(input: {
  transactionOptions: BuildPredictTransactionOptions;
} & RangePositionInput) {
  const tx = new Transaction();
  const rangeKey = tx.moveCall({
    target: `${input.transactionOptions.predictPackageId}::range_key::new`,
    arguments: [
      tx.pure.id(input.oracleId),
      tx.pure.u64(input.expiryMs),
      tx.pure.u64(input.lowerStrikeRaw),
      tx.pure.u64(input.higherStrikeRaw)
    ]
  });

  tx.moveCall({
    target: `${input.transactionOptions.predictPackageId}::predict_manager::range_position`,
    arguments: [
      tx.object(input.managerId),
      rangeKey
    ]
  });

  return tx;
}

function summarizeDryRun(
  response: unknown,
  input: MintDirectionalExecutorInput | RedeemDirectionalExecutorInput | MintRangeExecutorInput | RedeemRangeExecutorInput
): PredictTradeTransactionSummary {
  const status = transactionStatus(response);
  const operation = "operation" in input ? input.operation : "mint_directional";
  return {
    operation,
    mode: "dry_run",
    status: status.ok ? "dry_run_ok" : "failed",
    txDigest: digestFromResponse(response),
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: "strikeRaw" in input ? input.strikeRaw : undefined,
    direction: "direction" in input ? input.direction : undefined,
    lowerStrikeRaw: "lowerStrikeRaw" in input ? input.lowerStrikeRaw : undefined,
    higherStrikeRaw: "higherStrikeRaw" in input ? input.higherStrikeRaw : undefined,
    quantityRaw: input.quantityRaw,
    maxCostRaw: "maxCostRaw" in input ? input.maxCostRaw : undefined,
    minProceedsRaw: "minProceedsRaw" in input ? input.minProceedsRaw : undefined,
    actualCostRaw: extractActualCostRawForOperation(response, operation, ""),
    actualProceedsRaw: extractActualProceedsRawForOperation(response, operation, ""),
    errorCode: status.ok ? undefined : "PREDICT_DRY_RUN_FAILED",
    errorMessage: status.error
  };
}

function summarizeSubmit(
  response: SuiTransactionBlockResponse,
  input: (MintDirectionalExecutorInput | RedeemDirectionalExecutorInput | MintRangeExecutorInput | RedeemRangeExecutorInput) & { transactionOptions: BuildPredictTransactionOptions }
): PredictTradeTransactionSummary {
  const status = transactionStatus(response);
  const operation = "operation" in input ? input.operation : "mint_directional";
  return {
    operation,
    mode: "submit",
    status: status.ok ? "submitted" : "failed",
    txDigest: response.digest,
    managerId: input.managerId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    strikeRaw: "strikeRaw" in input ? input.strikeRaw : undefined,
    direction: "direction" in input ? input.direction : undefined,
    lowerStrikeRaw: "lowerStrikeRaw" in input ? input.lowerStrikeRaw : undefined,
    higherStrikeRaw: "higherStrikeRaw" in input ? input.higherStrikeRaw : undefined,
    quantityRaw: input.quantityRaw,
    maxCostRaw: "maxCostRaw" in input ? input.maxCostRaw : undefined,
    minProceedsRaw: "minProceedsRaw" in input ? input.minProceedsRaw : undefined,
    actualCostRaw: extractActualCostRawForOperation(response, operation, input.transactionOptions.predictPackageId),
    actualProceedsRaw: extractActualProceedsRawForOperation(response, operation, input.transactionOptions.predictPackageId),
    errorCode: status.ok ? undefined : "PREDICT_SUBMIT_FAILED",
    errorMessage: status.error
  };
}

function extractActualCostRawForOperation(
  response: Pick<SuiTransactionBlockResponse, "events">,
  operation: PredictTradeOperation,
  predictPackageId: string
): string | undefined {
  if (operation === "mint_directional") {
    return extractMintActualCostRaw(response, predictPackageId);
  }

  if (operation === "mint_range") {
    return extractRangeMintActualCostRaw(response, predictPackageId);
  }

  return undefined;
}

function extractActualProceedsRawForOperation(
  response: Pick<SuiTransactionBlockResponse, "events">,
  operation: PredictTradeOperation,
  predictPackageId: string
): string | undefined {
  if (operation === "redeem_directional" || operation === "close_directional") {
    return extractRedeemActualProceedsRaw(response, predictPackageId);
  }

  if (operation === "redeem_range" || operation === "close_range") {
    return extractRangeRedeemActualProceedsRaw(response, predictPackageId);
  }

  return undefined;
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

export function extractRangeMintActualCostRaw(
  response: Pick<SuiTransactionBlockResponse, "events">,
  predictPackageId: string
): string | undefined {
  const expectedType = predictPackageId ? `${predictPackageId}::predict::RangeMinted` : undefined;
  for (const event of response.events ?? []) {
    if (typeof event.type !== "string") {
      continue;
    }
    if (expectedType ? event.type !== expectedType : !event.type.endsWith("::predict::RangeMinted")) {
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

export function extractRedeemActualProceedsRaw(
  response: Pick<SuiTransactionBlockResponse, "events">,
  predictPackageId: string
): string | undefined {
  const expectedType = predictPackageId ? `${predictPackageId}::predict::PositionRedeemed` : undefined;
  for (const event of response.events ?? []) {
    if (typeof event.type !== "string") {
      continue;
    }
    if (expectedType ? event.type !== expectedType : !event.type.endsWith("::predict::PositionRedeemed")) {
      continue;
    }

    const parsedJson = event.parsedJson as Record<string, unknown> | undefined;
    const payout = rawIntegerValue(parsedJson?.payout);
    if (payout !== undefined) {
      return payout;
    }
  }

  return undefined;
}

export function extractRangeRedeemActualProceedsRaw(
  response: Pick<SuiTransactionBlockResponse, "events">,
  predictPackageId: string
): string | undefined {
  const expectedType = predictPackageId ? `${predictPackageId}::predict::RangeRedeemed` : undefined;
  for (const event of response.events ?? []) {
    if (typeof event.type !== "string") {
      continue;
    }
    if (expectedType ? event.type !== expectedType : !event.type.endsWith("::predict::RangeRedeemed")) {
      continue;
    }

    const parsedJson = event.parsedJson as Record<string, unknown> | undefined;
    const payout = rawIntegerValue(parsedJson?.payout);
    if (payout !== undefined) {
      return payout;
    }
  }

  return undefined;
}

export function extractFirstU64ReturnValue(response: unknown): string | undefined {
  if (!isRecord(response) || !Array.isArray(response.results)) {
    return undefined;
  }

  for (const result of response.results) {
    const returnValues = isRecord(result) && Array.isArray(result.returnValues)
      ? result.returnValues
      : [];
    for (const returnValue of returnValues) {
      if (!Array.isArray(returnValue)) {
        continue;
      }

      const bytes = Array.isArray(returnValue[0]) ? returnValue[0] : undefined;
      const typeTag = typeof returnValue[1] === "string" ? returnValue[1] : "";
      if (!bytes || (typeTag !== "u64" && !typeTag.endsWith("::u64") && bytes.length !== 8)) {
        continue;
      }

      return u64BytesToString(bytes);
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

function u64BytesToString(bytes: unknown[]): string | undefined {
  if (bytes.length !== 8 || !bytes.every((byte) => Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255)) {
    return undefined;
  }

  let value = 0n;
  for (let index = 0; index < bytes.length; index += 1) {
    value += BigInt(Number(bytes[index])) << (8n * BigInt(index));
  }
  return value.toString();
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
