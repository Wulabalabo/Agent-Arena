import {
  type AgentAction,
  type DirectionalMarket,
  type IntentMarket,
  type PositionRef,
  type RangeMarket,
  isAgentAction
} from "./types";

const decimalStringPattern = /^\d+(\.\d+)?$/;
const twitterHandlePattern = /^[A-Za-z0-9_]+$/;

export class PlatformInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformInputError";
  }
}

export interface NormalizedTwitterHandle {
  twitterHandle: string | null;
  normalizedTwitterHandle: string | null;
}

export interface ValidatedIntentPayload {
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  market?: IntentMarket;
  positionRef?: PositionRef;
  quantity?: string;
  maxCost?: string;
  minProceeds?: string;
  confidence: number;
  reason: string;
  createdAt: string;
}

export function normalizeTwitterHandle(value: string | null | undefined): NormalizedTwitterHandle {
  if (value == null) {
    return { twitterHandle: null, normalizedTwitterHandle: null };
  }

  const rawHandle = value.trim();
  if (rawHandle.length === 0) {
    return { twitterHandle: null, normalizedTwitterHandle: null };
  }

  const twitterHandle = rawHandle.startsWith("@") ? rawHandle.slice(1) : rawHandle;
  if (twitterHandle.length === 0) {
    return { twitterHandle: null, normalizedTwitterHandle: null };
  }

  if (twitterHandle.length > 15) {
    throw new PlatformInputError("twitterHandle must be 1 to 15 characters");
  }

  if (!twitterHandlePattern.test(twitterHandle)) {
    throw new PlatformInputError("twitterHandle can contain only letters, numbers, and underscores");
  }

  return {
    twitterHandle,
    normalizedTwitterHandle: twitterHandle.toLowerCase()
  };
}

export function validateDecimalString(value: unknown, field: string): string {
  if (typeof value !== "string" || !decimalStringPattern.test(value) || !/[1-9]/.test(value)) {
    throw new PlatformInputError(`${field} must be a positive decimal string`);
  }

  return value;
}

export function validateIntentPayload(payload: unknown): ValidatedIntentPayload {
  const record = asRecord(payload, "payload");
  const action = validateAction(record.action);
  rejectUnknownFields(record, [
    "competitionId",
    "agentId",
    "idempotencyKey",
    "action",
    "market",
    "positionRef",
    "quantity",
    "maxCost",
    "minProceeds",
    "confidence",
    "reason",
    "createdAt"
  ], "payload");
  const validated: ValidatedIntentPayload = {
    competitionId: validateNonEmptyString(record.competitionId, "competitionId"),
    agentId: validateNonEmptyString(record.agentId, "agentId"),
    idempotencyKey: validateNonEmptyString(record.idempotencyKey, "idempotencyKey"),
    action,
    confidence: validateConfidence(record.confidence),
    reason: validateReason(record.reason),
    createdAt: validateNonEmptyString(record.createdAt, "createdAt")
  };

  switch (action) {
    case "open_directional":
      rejectFields(record, ["positionRef", "minProceeds"], action);
      validated.market = validateDirectionalMarket(record.market);
      validated.quantity = validateDecimalString(record.quantity, "quantity");
      validated.maxCost = validateDecimalString(record.maxCost, "maxCost");
      break;
    case "open_range":
      rejectFields(record, ["positionRef", "minProceeds"], action);
      validated.market = validateRangeMarket(record.market);
      validated.quantity = validateDecimalString(record.quantity, "quantity");
      validated.maxCost = validateDecimalString(record.maxCost, "maxCost");
      break;
    case "reduce":
      rejectFields(record, ["market", "maxCost"], action);
      validated.positionRef = validatePositionRef(record.positionRef);
      validated.quantity = validateDecimalString(record.quantity, "quantity");
      if (record.minProceeds !== undefined) {
        validated.minProceeds = validateDecimalString(record.minProceeds, "minProceeds");
      }
      break;
    case "close":
      rejectFields(record, ["market", "quantity", "maxCost"], action);
      validated.positionRef = validatePositionRef(record.positionRef);
      if (record.minProceeds !== undefined) {
        validated.minProceeds = validateDecimalString(record.minProceeds, "minProceeds");
      }
      break;
    case "hold":
      rejectFields(record, ["market", "positionRef", "quantity", "maxCost", "minProceeds"], action);
      break;
    default:
      throw new PlatformInputError(`${action} validation is not implemented`);
  }

  return validated;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PlatformInputError(`${field} must be an object`);
  }

  return value as Record<string, unknown>;
}

export function validateNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlatformInputError(`${field} must be a non-empty string`);
  }

  return value;
}

export function validateDisplayName(value: unknown): string {
  const displayName = validateNonEmptyString(value, "displayName").trim();
  if (displayName.length > 80) {
    throw new PlatformInputError("displayName must be at most 80 characters");
  }

  return displayName;
}

function validateAction(value: unknown): AgentAction {
  if (typeof value !== "string" || !isAgentAction(value)) {
    throw new PlatformInputError("action must be a supported agent action");
  }

  return value;
}

function rejectFields(record: Record<string, unknown>, fields: string[], action: AgentAction): void {
  const found = fields.find((field) => record[field] !== undefined);
  if (found) {
    throw new PlatformInputError(`${action} does not allow ${found}`);
  }
}

function rejectUnknownFields(record: Record<string, unknown>, allowedFields: string[], field: string): void {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(record).find((key) => !allowed.has(key));
  if (unknown) {
    throw new PlatformInputError(`${field} does not allow ${unknown}`);
  }
}

function validateConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new PlatformInputError("confidence must be between 0 and 1");
  }

  return value;
}

function validateReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlatformInputError("reason must be non-empty");
  }

  if (value.length > 1_000) {
    throw new PlatformInputError("reason must be at most 1000 characters");
  }

  return value;
}

function validateDirectionalMarket(value: unknown): DirectionalMarket {
  const market = asRecord(value, "market");
  rejectUnknownFields(market, ["kind", "oracleId", "expiry", "strike", "isUp"], "market");
  if (market.kind !== "directional") {
    throw new PlatformInputError("market must be directional");
  }

  return {
    kind: "directional",
    oracleId: validateNonEmptyString(market.oracleId, "market.oracleId"),
    expiry: validateNonEmptyString(market.expiry, "market.expiry"),
    strike: validateDecimalString(market.strike, "market.strike"),
    isUp: validateBoolean(market.isUp, "market.isUp")
  };
}

function validateRangeMarket(value: unknown): RangeMarket {
  const market = asRecord(value, "market");
  rejectUnknownFields(market, ["kind", "oracleId", "expiry", "lowerStrike", "higherStrike"], "market");
  if (market.kind !== "range") {
    throw new PlatformInputError("market must be range");
  }

  return {
    kind: "range",
    oracleId: validateNonEmptyString(market.oracleId, "market.oracleId"),
    expiry: validateNonEmptyString(market.expiry, "market.expiry"),
    lowerStrike: validateDecimalString(market.lowerStrike, "market.lowerStrike"),
    higherStrike: validateDecimalString(market.higherStrike, "market.higherStrike")
  };
}

function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new PlatformInputError(`${field} must be a boolean`);
  }

  return value;
}

function validatePositionRef(value: unknown): PositionRef {
  const positionRef = asRecord(value, "positionRef");
  const kind = positionRef.kind;
  if (kind !== "directional" && kind !== "range") {
    throw new PlatformInputError("positionRef.kind must be directional or range");
  }

  rejectUnknownFields(
    positionRef,
    kind === "directional"
      ? ["kind", "marketKey", "openExecutionId", "quantity"]
      : ["kind", "rangeKey", "openExecutionId", "quantity"],
    "positionRef"
  );

  const validated: PositionRef = {
    kind,
    quantity: validateDecimalString(positionRef.quantity, "positionRef.quantity")
  };

  if (positionRef.openExecutionId !== undefined) {
    validated.openExecutionId = validateNonEmptyString(positionRef.openExecutionId, "positionRef.openExecutionId");
  }

  if (kind === "directional") {
    validated.marketKey = validateNonEmptyString(positionRef.marketKey, "positionRef.marketKey");
    return validated;
  }

  validated.rangeKey = validateNonEmptyString(positionRef.rangeKey, "positionRef.rangeKey");
  return validated;
}
