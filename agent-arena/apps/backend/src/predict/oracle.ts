export interface PredictStrikeGrid {
  minStrikeRaw?: string;
  maxStrikeRaw?: string;
  strikeStepRaw?: string;
  strikesRaw?: string[];
}

export interface NormalizedPredictOracle {
  oracleId: string;
  underlyingAsset: string;
  expiryMs: number;
  status: string;
  version?: string;
  predictId?: string;
  strikeGrid?: PredictStrikeGrid;
}

export interface SelectNearestFutureBtcOracleInput {
  serverTimeMs: number;
  oracles: unknown[];
  minTimeToExpiryMs?: number;
}

export interface ConfirmOracleExecutionRequest {
  operation?: PredictOracleExecutionOperation;
  oracleId: string;
  expiryMs: number;
  predictObjectId?: string;
  minObjectVersion?: string | number | bigint;
  strikeRaw?: string;
  lowerStrikeRaw?: string;
  higherStrikeRaw?: string;
  serverTimeMs?: number;
}

export type PredictOracleExecutionOperation =
  | "preview_directional"
  | "preview_range"
  | "mint_directional"
  | "mint_range"
  | "open_directional"
  | "open_range"
  | "redeem_directional"
  | "redeem_range"
  | "close_directional"
  | "close_range"
  | "settled_redeem"
  | "claim_settled"
  | "claim_settled_directional"
  | "claim_settled_range"
  | "redeem_permissionless";

export interface ConfirmOracleForExecutionInput {
  request: ConfirmOracleExecutionRequest;
  readOracle: (oracleId: string) => Promise<unknown | null | undefined>;
}

export type PredictOracleErrorCode =
  | "ORACLE_NOT_FOUND"
  | "ORACLE_NOT_TRADEABLE"
  | "ORACLE_MISMATCH";

export class PredictOracleError extends Error {
  readonly code: PredictOracleErrorCode;

  constructor(code: PredictOracleErrorCode) {
    super(code);
    this.name = "PredictOracleError";
    this.code = code;
  }
}

export function selectNearestFutureBtcOracle({
  serverTimeMs,
  oracles,
  minTimeToExpiryMs = 0
}: SelectNearestFutureBtcOracleInput): NormalizedPredictOracle | null {
  return oracles
    .map(normalizePredictOracle)
    .filter((oracle): oracle is NormalizedPredictOracle => oracle !== null)
    .filter((oracle) => oracle.underlyingAsset === "BTC")
    .filter((oracle) => oracle.status === "active")
    .filter((oracle) => oracle.expiryMs > serverTimeMs)
    .filter((oracle) => oracle.expiryMs - serverTimeMs >= minTimeToExpiryMs)
    .sort((left, right) => left.expiryMs - right.expiryMs)[0] ?? null;
}

export function normalizePredictOracle(raw: unknown): NormalizedPredictOracle | null {
  const source = unwrapOracleRecord(raw);
  if (!source) {
    return null;
  }

  const oracleId = toObjectIdValue(readAlias(source, [
    "oracleId",
    "oracle_id",
    "objectId",
    "object_id",
    "id"
  ]));
  const expiryMs = toNumberValue(readAlias(source, [
    "expiryMs",
    "expiry_ms",
    "expiry",
    "expiresAt",
    "expires_at",
    "expiryTimeMs",
    "expiry_time_ms"
  ]));
  const underlyingAsset = toStringValue(readAlias(source, [
    "underlyingAsset",
    "underlying_asset",
    "asset",
    "symbol",
    "baseAsset",
    "base_asset"
  ]));

  if (!oracleId || expiryMs === null || !underlyingAsset) {
    return null;
  }

  return {
    oracleId,
    underlyingAsset: underlyingAsset.toUpperCase(),
    expiryMs,
    status: normalizeStatus(source),
    version: toRawIntegerString(readAlias(source, [
      "version",
      "objectVersion",
      "object_version"
    ])) ?? undefined,
    predictId: toStringValue(readAlias(source, [
      "predictId",
      "predict_id",
      "predictObjectId",
      "predict_object_id"
    ])) ?? undefined,
    strikeGrid: normalizeStrikeGrid(source)
  };
}

export async function confirmOracleForExecution({
  request,
  readOracle
}: ConfirmOracleForExecutionInput): Promise<NormalizedPredictOracle> {
  const oracle = normalizePredictOracle(await readOracle(request.oracleId));

  if (!oracle) {
    throw new PredictOracleError("ORACLE_NOT_FOUND");
  }

  if (
    oracle.oracleId !== request.oracleId ||
    oracle.expiryMs !== request.expiryMs ||
    (request.predictObjectId !== undefined && oracle.predictId !== request.predictObjectId)
  ) {
    throw new PredictOracleError("ORACLE_MISMATCH");
  }

  if (
    oracle.underlyingAsset !== "BTC" ||
    !isTradeableForOperation(oracle, request) ||
    !hasFreshObjectVersion(oracle.version, request.minObjectVersion) ||
    !hasValidRequestedStrikeGrid(request, oracle.strikeGrid)
  ) {
    throw new PredictOracleError("ORACLE_NOT_TRADEABLE");
  }

  return oracle;
}

function normalizeStatus(source: Record<string, unknown>): string {
  const status = toStringValue(readAlias(source, ["status", "state", "lifecycleState", "lifecycle_state"]));
  if (status) {
    return status.toLowerCase();
  }

  const isActive = readAlias(source, ["isActive", "is_active", "active"]);
  if (typeof isActive === "boolean") {
    return isActive ? "active" : "inactive";
  }

  return "unknown";
}

function normalizeStrikeGrid(source: Record<string, unknown>): PredictStrikeGrid | undefined {
  const grid = getRecord(readAlias(source, ["strikeGrid", "strike_grid", "grid"])) ?? source;
  const strikesRaw = normalizeStrikeList(readAlias(grid, [
    "strikesRaw",
    "strikes_raw",
    "strikes",
    "strikeValues",
    "strike_values"
  ]));
  const strikeGrid: PredictStrikeGrid = {
    minStrikeRaw: toRawIntegerString(readAlias(grid, [
      "minStrikeRaw",
      "min_strike_raw",
      "minStrike",
      "min_strike",
      "strikeMin",
      "strike_min",
      "lowerBound",
      "lower_bound",
      "min"
    ])),
    maxStrikeRaw: toRawIntegerString(readAlias(grid, [
      "maxStrikeRaw",
      "max_strike_raw",
      "maxStrike",
      "max_strike",
      "strikeMax",
      "strike_max",
      "upperBound",
      "upper_bound",
      "max"
    ])),
    strikeStepRaw: toRawIntegerString(readAlias(grid, [
      "strikeStepRaw",
      "strike_step_raw",
      "strikeStep",
      "strike_step",
      "tickSize",
      "tick_size",
      "interval",
      "step"
    ])),
    strikesRaw
  };

  if (
    !strikeGrid.minStrikeRaw &&
    !strikeGrid.maxStrikeRaw &&
    !strikeGrid.strikeStepRaw &&
    (!strikeGrid.strikesRaw || strikeGrid.strikesRaw.length === 0)
  ) {
    return undefined;
  }

  return strikeGrid;
}

function hasValidRequestedStrikeGrid(
  request: ConfirmOracleExecutionRequest,
  grid: PredictStrikeGrid | undefined
): boolean {
  if (request.strikeRaw !== undefined) {
    return isStrikeOnGrid(request.strikeRaw, grid);
  }

  if (request.lowerStrikeRaw !== undefined || request.higherStrikeRaw !== undefined) {
    if (request.lowerStrikeRaw === undefined || request.higherStrikeRaw === undefined) {
      return false;
    }

    const lower = toBigIntValue(request.lowerStrikeRaw);
    const higher = toBigIntValue(request.higherStrikeRaw);

    return (
      lower !== null &&
      higher !== null &&
      lower < higher &&
      isStrikeOnGrid(request.lowerStrikeRaw, grid) &&
      isStrikeOnGrid(request.higherStrikeRaw, grid)
    );
  }

  return true;
}

function isTradeableForOperation(
  oracle: NormalizedPredictOracle,
  request: ConfirmOracleExecutionRequest
): boolean {
  if (isSettledOperation(request.operation)) {
    return oracle.status === "settled";
  }

  return (
    oracle.status === "active" &&
    (request.serverTimeMs === undefined || oracle.expiryMs > request.serverTimeMs)
  );
}

function isSettledOperation(operation: PredictOracleExecutionOperation | undefined): boolean {
  return (
    operation === "settled_redeem" ||
    operation === "claim_settled" ||
    operation === "claim_settled_directional" ||
    operation === "claim_settled_range" ||
    operation === "redeem_permissionless"
  );
}

function hasFreshObjectVersion(
  objectVersion: unknown,
  minObjectVersion: string | number | bigint | undefined
): boolean {
  if (minObjectVersion === undefined) {
    return true;
  }

  const version = toBigIntValue(objectVersion);
  const minimum = toBigIntValue(minObjectVersion);

  return version !== null && minimum !== null && version >= minimum;
}

function isStrikeOnGrid(value: unknown, grid: PredictStrikeGrid | undefined): boolean {
  const strikeRaw = toRawIntegerString(value);
  if (!strikeRaw || !grid) {
    return false;
  }

  if (grid.strikesRaw && grid.strikesRaw.length > 0) {
    return grid.strikesRaw.includes(strikeRaw);
  }

  const strike = toBigIntValue(strikeRaw);
  const min = toBigIntValue(grid.minStrikeRaw);
  const max = toBigIntValue(grid.maxStrikeRaw);
  const step = toBigIntValue(grid.strikeStepRaw);

  return (
    strike !== null &&
    min !== null &&
    max !== null &&
    step !== null &&
    step > 0n &&
    strike >= min &&
    strike <= max &&
    (strike - min) % step === 0n
  );
}

function normalizeStrikeList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strikes = value
    .map(toRawIntegerString)
    .filter((strike): strike is string => strike !== null);

  return strikes.length > 0 ? strikes : undefined;
}

function unwrapOracleRecord(raw: unknown): Record<string, unknown> | null {
  const root = getRecord(raw);
  if (!root) {
    return null;
  }

  const data = getRecord(root.data) ?? root;
  const content = getRecord(data.content);
  const contentFields = getRecord(content?.fields);
  const fields = contentFields ?? getRecord(data.fields) ?? getRecord(root.fields);

  if (!fields) {
    return data;
  }

  return {
    ...data,
    ...fields,
    objectId: data.objectId ?? root.objectId ?? fields.objectId,
    object_id: data.object_id ?? root.object_id ?? fields.object_id,
    version: data.version ?? root.version ?? fields.version
  };
}

function readAlias(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key];
    }
  }

  const fields = getRecord(source.fields);
  if (fields) {
    for (const key of keys) {
      if (fields[key] !== undefined) {
        return fields[key];
      }
    }
  }

  return undefined;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function toObjectIdValue(value: unknown): string | null {
  const stringValue = toStringValue(value);
  if (stringValue) {
    return stringValue;
  }

  return toStringValue(getRecord(value)?.id);
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }

  const stringValue = toStringValue(value);
  if (!stringValue) {
    return null;
  }

  const numericValue = Number(stringValue);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const timestamp = Date.parse(stringValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toRawIntegerString(value: unknown): string | null {
  if (typeof value === "bigint" && value >= 0n) {
    return value.toString();
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }

  const stringValue = toStringValue(value);
  if (stringValue && /^\d+$/.test(stringValue)) {
    return stringValue;
  }

  return null;
}

function toBigIntValue(value: unknown): bigint | null {
  const raw = toRawIntegerString(value);
  return raw ? BigInt(raw) : null;
}
