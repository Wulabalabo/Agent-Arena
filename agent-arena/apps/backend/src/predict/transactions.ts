import { assertRawIntegerString, compareRawIntegers } from "./guardrails";

export type PredictOperation =
  | "preview_directional"
  | "preview_range"
  | "mint_directional"
  | "redeem_directional"
  | "close_directional"
  | "mint_range"
  | "redeem_range"
  | "deposit_dusdc"
  | "create_manager";

export type DirectionalMarketSide = "up" | "down";

export interface BuildPredictOperationPlanInput {
  operation: PredictOperation;
  direction?: DirectionalMarketSide;
  strikeRaw?: string;
  lowerStrikeRaw?: string;
  higherStrikeRaw?: string;
  expiryMs?: string;
  quantityRaw?: string;
  resolvedQuantityRaw?: string;
  maxCostRaw?: string;
  minProceedsRaw?: string;
  predictObjectId?: string;
  managerId?: string;
  oracleId?: string;
  marketId?: string;
  positionId?: string;
  quoteCoinObjectId?: string;
  clockObjectId?: string;
}

export interface PredictOperationPlan {
  operation: PredictOperation;
  moveTargets: string[];
  keyInputs: {
    direction?: DirectionalMarketSide;
    strikeRaw?: string;
    lowerStrikeRaw?: string;
    higherStrikeRaw?: string;
    expiryMs?: string;
  };
  objectIds: Record<string, string>;
  expiryMs?: string;
  quantityRaw?: string;
  maxCostRaw?: string;
  minProceedsRaw?: string;
}

const predictOperations = new Set<string>([
  "preview_directional",
  "preview_range",
  "mint_directional",
  "redeem_directional",
  "close_directional",
  "mint_range",
  "redeem_range",
  "deposit_dusdc",
  "create_manager"
]);

const disallowedTargetInputKeys = new Set([
  "moveTarget",
  "moveTargets",
  "target",
  "targets",
  "functionTarget"
]);

const objectIdInputKeys = [
  "predictObjectId",
  "managerId",
  "oracleId",
  "marketId",
  "positionId",
  "quoteCoinObjectId",
  "clockObjectId"
] as const;

export function buildPredictOperationPlan(input: BuildPredictOperationPlanInput): PredictOperationPlan {
  assertNoCallerTargets(input);

  if (!predictOperations.has(input.operation)) {
    throw new Error(`UNKNOWN_PREDICT_OPERATION: ${String(input.operation)}`);
  }

  switch (input.operation) {
    case "preview_directional":
      return buildDirectionalPlan(input, ["predict::get_trade_amounts"]);
    case "preview_range":
      return buildRangePlan(input, ["range_key::new", "predict::get_range_trade_amounts"]);
    case "mint_directional":
      return buildDirectionalPlan(input, [
        `market_key::${assertDirection(input.direction)}`,
        "predict::mint"
      ], { requiredMaxCost: true });
    case "redeem_directional":
      return buildDirectionalPlan(input, [
        "market_key::new",
        "predict::redeem"
      ], { requiredMinProceeds: true });
    case "close_directional":
      return buildCloseDirectionalPlan(input);
    case "mint_range":
      return buildRangePlan(input, [
        "range_key::new",
        "predict::mint_range"
      ], { requiredMaxCost: true });
    case "redeem_range":
      return buildRangePlan(input, [
        "range_key::new",
        "predict::redeem_range"
      ], { requiredMinProceeds: true });
    case "deposit_dusdc":
      return {
        operation: input.operation,
        moveTargets: ["predict_manager::deposit"],
        keyInputs: {},
        objectIds: collectObjectIds(input),
        quantityRaw: assertRawIntegerString(input.quantityRaw, "quantityRaw")
      };
    case "create_manager":
      return {
        operation: input.operation,
        moveTargets: ["predict::create_manager"],
        keyInputs: {},
        objectIds: collectObjectIds(input)
      };
  }
}

export function buildPredictTransactionFromPlan(_plan: PredictOperationPlan): never {
  throw new Error("PREDICT_PTB_BUILDER_NOT_WIRED");
}

function buildDirectionalPlan(
  input: BuildPredictOperationPlanInput,
  moveTargets: string[],
  options: { requiredMaxCost?: boolean; requiredMinProceeds?: boolean } = {}
): PredictOperationPlan {
  const expiryMs = assertRawIntegerString(input.expiryMs, "expiryMs");
  const plan: PredictOperationPlan = {
    operation: input.operation,
    moveTargets,
    keyInputs: {
      direction: assertDirection(input.direction),
      strikeRaw: assertRawIntegerString(input.strikeRaw, "strikeRaw"),
      expiryMs
    },
    objectIds: collectObjectIds(input),
    expiryMs,
    quantityRaw: assertRawIntegerString(input.quantityRaw, "quantityRaw")
  };

  addGuardValues(plan, input, options);
  return plan;
}

function buildCloseDirectionalPlan(input: BuildPredictOperationPlanInput): PredictOperationPlan {
  if (input.quantityRaw !== undefined) {
    throw new Error("CLOSE_QUANTITY_MUST_BE_BACKEND_RESOLVED");
  }

  const expiryMs = assertRawIntegerString(input.expiryMs, "expiryMs");
  const plan: PredictOperationPlan = {
    operation: input.operation,
    moveTargets: ["market_key::new", "predict::redeem"],
    keyInputs: {
      direction: assertDirection(input.direction),
      strikeRaw: assertRawIntegerString(input.strikeRaw, "strikeRaw"),
      expiryMs
    },
    objectIds: collectObjectIds(input),
    expiryMs,
    quantityRaw: assertRawIntegerString(input.resolvedQuantityRaw, "resolvedQuantityRaw")
  };

  addGuardValues(plan, input, { requiredMinProceeds: true });
  return plan;
}

function buildRangePlan(
  input: BuildPredictOperationPlanInput,
  moveTargets: string[],
  options: { requiredMaxCost?: boolean; requiredMinProceeds?: boolean } = {}
): PredictOperationPlan {
  const lowerStrikeRaw = assertRawIntegerString(input.lowerStrikeRaw, "lowerStrikeRaw");
  const higherStrikeRaw = assertRawIntegerString(input.higherStrikeRaw, "higherStrikeRaw");
  const expiryMs = assertRawIntegerString(input.expiryMs, "expiryMs");

  if (compareRawIntegers(lowerStrikeRaw, higherStrikeRaw) >= 0) {
    throw new Error("INVALID_RANGE_BOUNDS");
  }

  const plan: PredictOperationPlan = {
    operation: input.operation,
    moveTargets,
    keyInputs: {
      lowerStrikeRaw,
      higherStrikeRaw,
      expiryMs
    },
    objectIds: collectObjectIds(input),
    expiryMs,
    quantityRaw: assertRawIntegerString(input.quantityRaw, "quantityRaw")
  };

  addGuardValues(plan, input, options);
  return plan;
}

function addGuardValues(
  plan: PredictOperationPlan,
  input: BuildPredictOperationPlanInput,
  options: { requiredMaxCost?: boolean; requiredMinProceeds?: boolean }
): void {
  if (options.requiredMaxCost || input.maxCostRaw !== undefined) {
    plan.maxCostRaw = assertRawIntegerString(input.maxCostRaw, "maxCostRaw");
  }

  if (options.requiredMinProceeds || input.minProceedsRaw !== undefined) {
    plan.minProceedsRaw = assertRawIntegerString(input.minProceedsRaw, "minProceedsRaw");
  }
}

function assertDirection(direction: unknown): DirectionalMarketSide {
  if (direction === "up" || direction === "down") {
    return direction;
  }

  throw new Error("INVALID_MARKET_DIRECTION");
}

function assertNoCallerTargets(input: object): void {
  for (const key of Object.keys(input)) {
    if (disallowedTargetInputKeys.has(key)) {
      throw new Error("ARBITRARY_MOVE_TARGET_NOT_ALLOWED");
    }
  }
}

function collectObjectIds(input: BuildPredictOperationPlanInput): Record<string, string> {
  const objectIds: Record<string, string> = {};

  for (const key of objectIdInputKeys) {
    const value = input[key];
    if (typeof value === "string" && value.trim() !== "") {
      objectIds[key] = value.trim();
    }
  }

  return objectIds;
}
