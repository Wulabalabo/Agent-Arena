import { getAllowedOperations } from "./competitions";
import type { Competition, MarketSnapshot } from "./types";

const mockSpotPriceRaw = "65000000000000";
const mockForwardPriceRaw = "65030000000000";

export function createMarketSnapshot(
  competition: Competition,
  nowMs = Date.now()
): MarketSnapshot {
  const expiryMs = Date.parse(competition.expiresAt);
  const timeToExpiryMs = Math.max(0, expiryMs - nowMs);
  const allowedOperations = getAllowedOperations(competition.status);

  return {
    competitionId: competition.id,
    status: competition.status,
    serverTimeMs: String(nowMs),
    oracleId: competition.oracleId,
    oracleStatus: oracleStatusForCompetition(competition),
    expiryMs: String(expiryMs),
    timeToExpiryMs: String(timeToExpiryMs),
    underlyingAsset: "BTC",
    spotPriceRaw: mockSpotPriceRaw,
    forwardPriceRaw: mockForwardPriceRaw,
    priceDecimals: 9,
    strikeGrid: {
      minStrikeRaw: "50000000000000",
      maxStrikeRaw: "80000000000000",
      strikeStepRaw: "1000000000"
    },
    executableMarkets: {
      directional: {
        oracleId: competition.oracleId,
        expiry: String(expiryMs),
        strike: mockSpotPriceRaw
      }
    },
    allowedActions: [...competition.allowedActions],
    allowedOperations,
    lateWindow: {
      isFinalMinute: timeToExpiryMs <= 60_000 && competition.status === "live",
      openAllowedByPlatform: allowedOperations.canOpen,
      openMayFailOnPredictQuote: allowedOperations.canOpen
    },
    fetchedAt: new Date(nowMs).toISOString()
  };
}

function oracleStatusForCompetition(competition: Competition): MarketSnapshot["oracleStatus"] {
  if (competition.status === "live") {
    return "active";
  }

  if (competition.status === "expired") {
    return "expired";
  }

  if (competition.status === "settled") {
    return "settled";
  }

  return "inactive";
}
