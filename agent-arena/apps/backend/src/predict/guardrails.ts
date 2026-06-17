export type PredictGuardrailOperation =
  | "preview_directional"
  | "preview_range"
  | "mint_directional"
  | "redeem_directional"
  | "close_directional"
  | "mint_range"
  | "redeem_range"
  | "close_range"
  | "open_directional"
  | "open_range"
  | "deposit_dusdc"
  | "withdraw_manager_dusdc"
  | "create_manager";

export type PolicyDriftClassification =
  | "none"
  | "cost_above_pre_submit_guard"
  | "proceeds_below_pre_submit_guard"
  | "unknown";

export class PredictGuardrailError extends Error {
  constructor(
    public readonly code:
      | "INVALID_RAW_AMOUNT"
      | "MAX_COST_EXCEEDED"
      | "MIN_PROCEEDS_NOT_MET",
    public readonly fieldName?: string
  ) {
    super(fieldName ? `${code}: ${fieldName}` : code);
    this.name = "PredictGuardrailError";
  }
}

const costGuardedOperations = new Set<PredictGuardrailOperation>([
  "mint_directional",
  "mint_range",
  "open_directional",
  "open_range"
]);

const proceedsGuardedOperations = new Set<PredictGuardrailOperation>([
  "redeem_directional",
  "redeem_range",
  "close_directional",
  "close_range"
]);

export function assertRawIntegerString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new PredictGuardrailError("INVALID_RAW_AMOUNT", fieldName);
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new PredictGuardrailError("INVALID_RAW_AMOUNT", fieldName);
  }

  return normalized;
}

export function compareRawIntegers(left: unknown, right: unknown): -1 | 0 | 1 {
  const leftValue = BigInt(assertRawIntegerString(left, "left"));
  const rightValue = BigInt(assertRawIntegerString(right, "right"));

  if (leftValue > rightValue) {
    return 1;
  }
  if (leftValue < rightValue) {
    return -1;
  }
  return 0;
}

export interface PreSubmitGuardrailEvaluationInput {
  operation: PredictGuardrailOperation;
  estimatedCostRaw?: string;
  maxCostRaw?: string;
  estimatedProceedsRaw?: string;
  minProceedsRaw?: string;
}

export function evaluatePreSubmitGuardrails(input: PreSubmitGuardrailEvaluationInput): void {
  if (costGuardedOperations.has(input.operation)) {
    if (compareRawIntegers(input.estimatedCostRaw, input.maxCostRaw) > 0) {
      throw new PredictGuardrailError("MAX_COST_EXCEEDED");
    }
    return;
  }

  if (proceedsGuardedOperations.has(input.operation)) {
    if (compareRawIntegers(input.estimatedProceedsRaw, input.minProceedsRaw) < 0) {
      throw new PredictGuardrailError("MIN_PROCEEDS_NOT_MET");
    }
  }
}

export interface PolicyDriftClassificationInput {
  operation: PredictGuardrailOperation;
  actualCostRaw?: string;
  maxCostRaw?: string;
  actualProceedsRaw?: string;
  minProceedsRaw?: string;
}

export function classifyPolicyDrift(input: PolicyDriftClassificationInput): PolicyDriftClassification {
  try {
    if (costGuardedOperations.has(input.operation)) {
      if (input.actualCostRaw === undefined || input.maxCostRaw === undefined) {
        return "unknown";
      }

      return compareRawIntegers(input.actualCostRaw, input.maxCostRaw) > 0
        ? "cost_above_pre_submit_guard"
        : "none";
    }

    if (proceedsGuardedOperations.has(input.operation)) {
      if (input.actualProceedsRaw === undefined || input.minProceedsRaw === undefined) {
        return "unknown";
      }

      return compareRawIntegers(input.actualProceedsRaw, input.minProceedsRaw) < 0
        ? "proceeds_below_pre_submit_guard"
        : "none";
    }

    return "unknown";
  } catch (error) {
    if (error instanceof PredictGuardrailError && error.code === "INVALID_RAW_AMOUNT") {
      return "unknown";
    }
    throw error;
  }
}
