import { getAllowedOperations } from "../platform/competitions";
import { createMockCompetition, type Competition, type MarketSnapshot } from "../platform/types";
import { normalizePredictOracle, selectNearestFutureBtcOracle, type PredictStrikeGrid } from "./oracle";
import type { PredictServerClient } from "./predict-server-client";
import type { PredictConfig } from "./types";

const defaultCompetitionId = "btc-15m-001";
const btc15mDurationMs = 15 * 60 * 1000;

export interface PredictMarketDataProviderResult {
  competition: Competition;
  marketState: MarketSnapshot;
}

export function createPredictMarketDataProvider({
  config,
  predictServerClient
}: {
  config: PredictConfig;
  predictServerClient: PredictServerClient;
}): () => Promise<PredictMarketDataProviderResult> {
  return async () => {
    const status = await predictServerClient.getStatus();
    const serverTimeMs = serverTimeFromStatus(status);
    const rawOracles = await predictServerClient.getPredictOracles(config.predictObjectId);
    const oracle = selectNearestFutureBtcOracle({
      serverTimeMs,
      oracles: arrayFromContainer(rawOracles)
    });

    if (!oracle) {
      throw new Error("PREDICT_MARKET_UNAVAILABLE");
    }

    const state = await predictServerClient.getOracleState(oracle.oracleId);
    const stateOracle = normalizePredictOracle(state) ?? oracle;
    const price = readRecord(state, "latest_price");
    const spotPriceRaw = rawIntegerString(price?.spot) ?? "0";
    const forwardPriceRaw = rawIntegerString(price?.forward) ?? spotPriceRaw;
    const executableDirectionalStrikeRaw = stateOracle.strikeRaw
      ?? snapPriceToStrikeGrid(forwardPriceRaw, stateOracle.strikeGrid);
    const expiryMs = stateOracle.expiryMs;
    const startsAtMs = expiryMs - btc15mDurationMs;
    const timeToExpiryMs = Math.max(0, expiryMs - serverTimeMs);
    const competition = createCompetition({
      config,
      oracleId: stateOracle.oracleId,
      startsAtMs,
      expiryMs
    });
    const allowedOperations = getAllowedOperations(competition.status);

    return {
      competition,
      marketState: {
        competitionId: competition.id,
        status: competition.status,
        serverTimeMs: String(serverTimeMs),
        oracleId: stateOracle.oracleId,
        oracleStatus: "active",
        expiryMs: String(expiryMs),
        timeToExpiryMs: String(timeToExpiryMs),
        underlyingAsset: "BTC",
        spotPriceRaw,
        forwardPriceRaw,
        priceDecimals: 9,
        strikeGrid: {
          minStrikeRaw: stateOracle.strikeGrid?.minStrikeRaw ?? "0",
          maxStrikeRaw: stateOracle.strikeGrid?.maxStrikeRaw ?? null,
          strikeStepRaw: stateOracle.strikeGrid?.strikeStepRaw ?? "1"
        },
        ...(executableDirectionalStrikeRaw
          ? {
            executableMarkets: {
              directional: {
                oracleId: stateOracle.oracleId,
                expiry: String(expiryMs),
                strike: executableDirectionalStrikeRaw
              }
            }
          }
          : {}),
        allowedActions: [...competition.allowedActions],
        allowedOperations,
        lateWindow: {
          isFinalMinute: timeToExpiryMs <= 60_000,
          openAllowedByPlatform: allowedOperations.canOpen,
          openMayFailOnPredictQuote: allowedOperations.canOpen
        },
        fetchedAt: new Date(serverTimeMs).toISOString()
      }
    };
  };
}

function createCompetition(input: {
  config: PredictConfig;
  oracleId: string;
  startsAtMs: number;
  expiryMs: number;
}): Competition {
  const base = createMockCompetition(defaultCompetitionId);

  return {
    ...base,
    predictObjectId: input.config.predictObjectId,
    oracleId: input.oracleId,
    status: "live",
    startsAt: new Date(input.startsAtMs).toISOString(),
    expiresAt: new Date(input.expiryMs).toISOString(),
    expiry: new Date(input.expiryMs).toISOString(),
    settlesAt: null
  };
}

function serverTimeFromStatus(status: unknown): number {
  const record = isRecord(status) ? status : {};
  const value = numberValue(record.current_time_ms) ?? numberValue(record.currentTimeMs) ?? numberValue(record.server_time_ms);
  return value ?? Date.now();
}

function arrayFromContainer(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.oracles)) {
    return value.oracles;
  }

  if (Array.isArray(value.data)) {
    return value.data;
  }

  return [];
}

function readRecord(source: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(source)) {
    return null;
  }

  const value = source[key];
  return isRecord(value) ? value : null;
}

function rawIntegerString(value: unknown): string | null {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  return null;
}

function snapPriceToStrikeGrid(priceRaw: string, grid: PredictStrikeGrid | undefined): string | null {
  const price = positiveBigInt(priceRaw);
  const min = positiveBigInt(grid?.minStrikeRaw);
  const step = positiveBigInt(grid?.strikeStepRaw);
  if (price === null || min === null || step === null) {
    return null;
  }

  const max = positiveBigInt(grid?.maxStrikeRaw);
  if (price <= min) {
    return min.toString();
  }
  if (max !== null && price >= max) {
    return max.toString();
  }

  const distance = price - min;
  const quotient = distance / step;
  const remainder = distance % step;
  const roundedSteps = remainder * 2n >= step ? quotient + 1n : quotient;
  const snapped = min + roundedSteps * step;

  return max !== null && snapped > max ? max.toString() : snapped.toString();
}

function positiveBigInt(raw: string | undefined | null): bigint | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    return null;
  }

  const value = BigInt(raw);
  return value > 0n ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
