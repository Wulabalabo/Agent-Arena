import type {
  PredictIntentExecutionAdapterInput,
  PredictIntentExecutionAdapterResult,
  PredictIntentExecutionPayload
} from "./execution";
import type { PositionKind, PositionRef } from "./types";

export type InternalPredictExecutionRequest =
  | {
    walletId: string;
    operation: "mint_directional";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    strikeRaw: string;
    isUp: boolean;
    quantityRaw: string;
    maxCostRaw: string;
    dryRunOnly: false;
  }
  | {
    walletId: string;
    operation: "mint_range";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    lowerStrikeRaw: string;
    higherStrikeRaw: string;
    quantityRaw: string;
    maxCostRaw: string;
    dryRunOnly: false;
  }
  | {
    walletId: string;
    operation: "redeem_directional";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    strikeRaw: string;
    isUp: boolean;
    quantityRaw: string;
    minProceedsRaw?: string;
    dryRunOnly: false;
  }
  | {
    walletId: string;
    operation: "redeem_range";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    lowerStrikeRaw: string;
    higherStrikeRaw: string;
    quantityRaw: string;
    minProceedsRaw?: string;
    dryRunOnly: false;
  }
  | {
    walletId: string;
    operation: "close_directional";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    strikeRaw: string;
    isUp: boolean;
    minProceedsRaw?: string;
    dryRunOnly: false;
  }
  | {
    walletId: string;
    operation: "close_range";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    lowerStrikeRaw: string;
    higherStrikeRaw: string;
    minProceedsRaw?: string;
    dryRunOnly: false;
  };

export type ResolvedPositionForAdapter =
  | {
    kind: "directional";
    oracleId: string;
    expiryMs: string;
    strikeRaw: string;
    isUp: boolean;
    quantityRaw: string;
  }
  | {
    kind: "range";
    oracleId: string;
    expiryMs: string;
    lowerStrikeRaw: string;
    higherStrikeRaw: string;
    quantityRaw: string;
  };

export interface PredictAdapterMappingOptions {
  managerId: string;
  resolvePosition?: (positionRef: PositionRef, expectedKind: PositionKind) => ResolvedPositionForAdapter;
}

export interface CreatePredictExecutionAdapterOptions extends PredictAdapterMappingOptions {
  executeInternalPredict: (request: InternalPredictExecutionRequest) => Promise<InternalPredictExecutionResponse>;
}

export type InternalPredictExecutionResponse =
  | {
    execution: {
      status: string;
      txDigest?: string | null;
      predictTxDigest?: string | null;
      actualCostRaw?: string | null;
      actualProceedsRaw?: string | null;
    };
  }
  | {
    error: {
      code: string;
      message: string;
    };
  };

export function createPredictExecutionAdapter(options: CreatePredictExecutionAdapterOptions) {
  return async function executeAgentPredictIntent(
    input: PredictIntentExecutionAdapterInput
  ): Promise<PredictIntentExecutionAdapterResult> {
    const request = mapPredictIntentToInternalRequest(input, options);
    const response = await options.executeInternalPredict(request);
    if ("error" in response) {
      return {
        status: "failed",
        predictTxDigest: null,
        errorCode: response.error.code,
        errorMessage: response.error.message
      };
    }

    return {
      status: executionStatusFromInternal(response.execution.status),
      predictTxDigest: response.execution.predictTxDigest ?? response.execution.txDigest ?? null,
      actualCostRaw: response.execution.actualCostRaw ?? null,
      actualProceedsRaw: response.execution.actualProceedsRaw ?? null
    };
  };
}

export function mapPredictIntentToInternalRequest(
  input: PredictIntentExecutionAdapterInput,
  options: PredictAdapterMappingOptions
): InternalPredictExecutionRequest {
  const payload = input.predictPayload;
  switch (payload.operation) {
    case "mint_directional":
      return {
        walletId: input.walletId,
        operation: "mint_directional",
        managerId: options.managerId,
        oracleId: payload.market.oracleId,
        expiryMs: payload.market.expiry,
        strikeRaw: payload.market.strike,
        isUp: payload.market.isUp,
        quantityRaw: payload.quantity,
        maxCostRaw: payload.maxCost,
        dryRunOnly: false
      };
    case "mint_range":
      return {
        walletId: input.walletId,
        operation: "mint_range",
        managerId: options.managerId,
        oracleId: payload.market.oracleId,
        expiryMs: payload.market.expiry,
        lowerStrikeRaw: payload.market.lowerStrike,
        higherStrikeRaw: payload.market.higherStrike,
        quantityRaw: payload.quantity,
        maxCostRaw: payload.maxCost,
        dryRunOnly: false
      };
    case "redeem_directional":
      return mapDirectionalRedeem(input.walletId, payload, options);
    case "redeem_range":
      return mapRangeRedeem(input.walletId, payload, options);
    case "close_directional":
      return mapDirectionalClose(input.walletId, payload, options);
    case "close_range":
      return mapRangeClose(input.walletId, payload, options);
  }
}

function mapDirectionalRedeem(
  walletId: string,
  payload: Extract<PredictIntentExecutionPayload, { operation: "redeem_directional" }>,
  options: PredictAdapterMappingOptions
): InternalPredictExecutionRequest {
  const position = resolveDirectionalPosition(payload.positionRef, options);
  return {
    walletId,
    operation: "redeem_directional",
    managerId: options.managerId,
    oracleId: position.oracleId,
    expiryMs: position.expiryMs,
    strikeRaw: position.strikeRaw,
    isUp: position.isUp,
    quantityRaw: payload.quantity,
    ...(payload.minProceeds ? { minProceedsRaw: payload.minProceeds } : {}),
    dryRunOnly: false
  };
}

function mapRangeRedeem(
  walletId: string,
  payload: Extract<PredictIntentExecutionPayload, { operation: "redeem_range" }>,
  options: PredictAdapterMappingOptions
): InternalPredictExecutionRequest {
  const position = resolveRangePosition(payload.positionRef, options);
  return {
    walletId,
    operation: "redeem_range",
    managerId: options.managerId,
    oracleId: position.oracleId,
    expiryMs: position.expiryMs,
    lowerStrikeRaw: position.lowerStrikeRaw,
    higherStrikeRaw: position.higherStrikeRaw,
    quantityRaw: payload.quantity,
    ...(payload.minProceeds ? { minProceedsRaw: payload.minProceeds } : {}),
    dryRunOnly: false
  };
}

function mapDirectionalClose(
  walletId: string,
  payload: Extract<PredictIntentExecutionPayload, { operation: "close_directional" }>,
  options: PredictAdapterMappingOptions
): InternalPredictExecutionRequest {
  const position = resolveDirectionalPosition(payload.positionRef, options);
  return {
    walletId,
    operation: "close_directional",
    managerId: options.managerId,
    oracleId: position.oracleId,
    expiryMs: position.expiryMs,
    strikeRaw: position.strikeRaw,
    isUp: position.isUp,
    ...(payload.minProceeds ? { minProceedsRaw: payload.minProceeds } : {}),
    dryRunOnly: false
  };
}

function mapRangeClose(
  walletId: string,
  payload: Extract<PredictIntentExecutionPayload, { operation: "close_range" }>,
  options: PredictAdapterMappingOptions
): InternalPredictExecutionRequest {
  const position = resolveRangePosition(payload.positionRef, options);
  return {
    walletId,
    operation: "close_range",
    managerId: options.managerId,
    oracleId: position.oracleId,
    expiryMs: position.expiryMs,
    lowerStrikeRaw: position.lowerStrikeRaw,
    higherStrikeRaw: position.higherStrikeRaw,
    ...(payload.minProceeds ? { minProceedsRaw: payload.minProceeds } : {}),
    dryRunOnly: false
  };
}

function resolveDirectionalPosition(
  positionRef: PositionRef,
  options: PredictAdapterMappingOptions
): Extract<ResolvedPositionForAdapter, { kind: "directional" }> {
  const position = options.resolvePosition?.(positionRef, "directional");
  if (!position || position.kind !== "directional") {
    throw new Error("DIRECTIONAL_POSITION_RESOLUTION_REQUIRED");
  }

  return position;
}

function resolveRangePosition(
  positionRef: PositionRef,
  options: PredictAdapterMappingOptions
): Extract<ResolvedPositionForAdapter, { kind: "range" }> {
  const position = options.resolvePosition?.(positionRef, "range");
  if (!position || position.kind !== "range") {
    throw new Error("RANGE_POSITION_RESOLUTION_REQUIRED");
  }

  return position;
}

function executionStatusFromInternal(status: string): PredictIntentExecutionAdapterResult["status"] {
  if (status === "failed") {
    return "failed";
  }

  if (status === "partial") {
    return "partial";
  }

  return "confirmed";
}
