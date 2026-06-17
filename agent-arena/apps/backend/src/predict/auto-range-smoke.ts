import { selectNearestFutureBtcOracle } from "./oracle";

type PriceSource = "forward" | "spot";

export type AutoRangeSmokeErrorCode =
  | "NO_ACTIVE_BTC_ORACLE"
  | "ORACLE_PRICE_UNAVAILABLE"
  | "RANGE_SELECTION_INVALID"
  | "SERVER_TIME_UNAVAILABLE";

interface StrikeGridInput {
  minStrikeRaw?: string;
  maxStrikeRaw?: string;
  strikeStepRaw?: string;
  strikesRaw?: string[];
}

export class AutoRangeSmokeError extends Error {
  readonly code: AutoRangeSmokeErrorCode;

  constructor(code: AutoRangeSmokeErrorCode) {
    super(code);
    this.name = "AutoRangeSmokeError";
    this.code = code;
  }
}

export interface AutoRangeSmokeClient {
  getStatus: () => Promise<unknown>;
  getPredictOracles: (predictId: string) => Promise<unknown>;
  getOracleState: (oracleId: string) => Promise<unknown>;
}

export interface AutoRangeMarketSelection {
  oracleId: string;
  expiryMs: string;
  priceSource: PriceSource;
  referencePriceRaw: string;
  referencePrice: string;
  lowerStrikeRaw: string;
  higherStrikeRaw: string;
  quantityRaw: string;
  maxCostRaw: string;
}

export function deriveAutoRangeFromPrice(input: {
  priceRaw: string;
  priceSource: PriceSource;
  priceDecimals: 9;
  bandBps: number;
  strikeGrid?: StrikeGridInput;
}): Omit<AutoRangeMarketSelection, "oracleId" | "expiryMs" | "quantityRaw" | "maxCostRaw"> {
  if (
    !Number.isSafeInteger(input.bandBps) ||
    input.bandBps <= 0 ||
    input.bandBps >= 10_000 ||
    !/^\d+$/.test(input.priceRaw)
  ) {
    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  const price = BigInt(input.priceRaw);
  if (price <= 0n) {
    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  const scale = 10n ** BigInt(input.priceDecimals);
  const wholeUnit = scale;
  const lower = (price * BigInt(10_000 - input.bandBps)) / 10_000n;
  const higher = (price * BigInt(10_000 + input.bandBps) + 9_999n) / 10_000n;
  let { lowerRounded, higherRounded } = snapRange({
    lower,
    higher,
    fallbackUnit: wholeUnit,
    strikeGrid: input.strikeGrid
  });

  if (lowerRounded >= higherRounded) {
    lowerRounded = price > wholeUnit ? ((price / wholeUnit) - 1n) * wholeUnit : 0n;
    higherRounded = ((price / wholeUnit) + 1n) * wholeUnit;
  }

  if (lowerRounded >= higherRounded) {
    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  return {
    priceSource: input.priceSource,
    referencePriceRaw: input.priceRaw,
    referencePrice: formatRawPrice(input.priceRaw, input.priceDecimals),
    lowerStrikeRaw: lowerRounded.toString(),
    higherStrikeRaw: higherRounded.toString()
  };
}

export async function selectAutoRangeMarket(input: {
  config: { predictObjectId: string; priceDecimals: 9 };
  client: AutoRangeSmokeClient;
  bandBps: number;
  quantityRaw: string;
  maxCostRaw: string;
}): Promise<AutoRangeMarketSelection> {
  if (!isRawIntegerString(input.quantityRaw) || !isRawIntegerString(input.maxCostRaw)) {
    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  const [status, rawOracles] = await Promise.all([
    input.client.getStatus(),
    input.client.getPredictOracles(input.config.predictObjectId)
  ]);
  const oracle = selectNearestFutureBtcOracle({
    serverTimeMs: serverTimeMs(status),
    oracles: Array.isArray(rawOracles) ? rawOracles : []
  });

  if (!oracle) {
    throw new AutoRangeSmokeError("NO_ACTIVE_BTC_ORACLE");
  }

  const state = readRecord(await input.client.getOracleState(oracle.oracleId));
  const latestPrice = readRecord(state?.latest_price);
  const forwardRaw = rawInteger(latestPrice?.forward);
  const spotRaw = rawInteger(latestPrice?.spot);
  const priceRaw = forwardRaw ?? spotRaw;

  if (!priceRaw) {
    throw new AutoRangeSmokeError("ORACLE_PRICE_UNAVAILABLE");
  }

  const range = deriveAutoRangeFromPrice({
    priceRaw,
    priceSource: forwardRaw ? "forward" : "spot",
    priceDecimals: input.config.priceDecimals,
    bandBps: input.bandBps,
    strikeGrid: oracle.strikeGrid
  });

  return {
    oracleId: oracle.oracleId,
    expiryMs: String(oracle.expiryMs),
    ...range,
    quantityRaw: input.quantityRaw,
    maxCostRaw: input.maxCostRaw
  };
}

function snapRange(input: {
  lower: bigint;
  higher: bigint;
  fallbackUnit: bigint;
  strikeGrid?: StrikeGridInput;
}): { lowerRounded: bigint; higherRounded: bigint } {
  const explicitStrikes = input.strikeGrid?.strikesRaw
    ?.map((strike) => rawInteger(strike))
    .filter((strike): strike is string => strike !== null)
    .map(BigInt)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);

  if (explicitStrikes && explicitStrikes.length >= 2) {
    const lowerRounded = [...explicitStrikes].reverse().find((strike) => strike <= input.lower);
    const higherRounded = explicitStrikes.find((strike) => strike >= input.higher);
    if (lowerRounded !== undefined && higherRounded !== undefined && lowerRounded < higherRounded) {
      return { lowerRounded, higherRounded };
    }

    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  const min = toBigInt(input.strikeGrid?.minStrikeRaw);
  const max = toBigInt(input.strikeGrid?.maxStrikeRaw);
  const step = toBigInt(input.strikeGrid?.strikeStepRaw);

  if (min !== null && max !== null && step !== null && step > 0n) {
    const lowerSteps = input.lower > min ? (input.lower - min) / step : 0n;
    const higherSteps = input.higher > min ? (input.higher - min + step - 1n) / step : 0n;
    const lowerRounded = min + lowerSteps * step;
    const higherRounded = min + higherSteps * step;
    if (lowerRounded >= min && higherRounded <= max && lowerRounded < higherRounded) {
      return { lowerRounded, higherRounded };
    }

    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  return {
    lowerRounded: (input.lower / input.fallbackUnit) * input.fallbackUnit,
    higherRounded: ((input.higher + input.fallbackUnit - 1n) / input.fallbackUnit) * input.fallbackUnit
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function rawInteger(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }

  return null;
}

function serverTimeMs(status: unknown): number {
  const raw = rawInteger(readRecord(status)?.current_time_ms);
  if (!raw) {
    throw new AutoRangeSmokeError("SERVER_TIME_UNAVAILABLE");
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new AutoRangeSmokeError("SERVER_TIME_UNAVAILABLE");
  }

  return value;
}

function formatRawPrice(raw: string, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const value = BigInt(raw);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");

  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

function toBigInt(value: unknown): bigint | null {
  const raw = rawInteger(value);
  return raw ? BigInt(raw) : null;
}

function isRawIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}
