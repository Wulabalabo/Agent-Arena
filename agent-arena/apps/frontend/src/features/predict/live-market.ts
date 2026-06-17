import { getPredictQuoteAssetLabel, predictConfig } from "./config";
import type {
  PredictConfig,
  PredictMintedPosition,
  PredictMintedRange,
  PredictOracleState,
  PredictOracleSummary,
  PredictOracleTrade,
  PredictRedeemedPosition,
  PredictRedeemedRange,
  PredictStatus
} from "./types";

const PRICE_SCALE = 1_000_000_000;
const QUOTE_SCALE = 1_000_000;
const EVENT_LIMIT = 12;

type LiveMarketHealth = "ready" | "degraded";
type LiveEventKind =
  | "oracle_trade"
  | "position_minted"
  | "position_redeemed"
  | "range_minted"
  | "range_redeemed";

interface LiveMarketClient {
  getStatus: () => Promise<PredictStatus>;
  getPredictOracles: (predictId: string) => Promise<PredictOracleSummary[]>;
  getOracleState: (oracleId: string) => Promise<PredictOracleState>;
  getOracleTrades: (oracleId: string) => Promise<PredictOracleTrade[]>;
  getMintedPositions: () => Promise<PredictMintedPosition[]>;
  getRedeemedPositions: () => Promise<PredictRedeemedPosition[]>;
  getMintedRanges: () => Promise<PredictMintedRange[]>;
  getRedeemedRanges: () => Promise<PredictRedeemedRange[]>;
}

interface LoadLiveBtcMarketSnapshotOptions {
  client: LiveMarketClient;
  config?: PredictConfig;
}

interface PriceRefreshClient {
  getStatus: () => Promise<PredictStatus>;
  getOracleState: (oracleId: string) => Promise<PredictOracleState>;
}

interface RefreshLiveBtcMarketPriceOptions {
  client: PriceRefreshClient;
  snapshot: LiveBtcMarketSnapshot;
}

interface NormalizedOracle {
  oracleId: string;
  underlyingAsset: string;
  expiryMs: number;
  expiresAt: string;
  secondsToExpiry: number;
  status: string;
}

export interface LiveBtcMarketPrice {
  spot: number;
  forward: number | null;
  updatedAt: string;
  checkpoint: number | null;
}

export interface LiveBtcMarketEvent {
  id: string;
  kind: LiveEventKind;
  digest: string;
  oracleId: string;
  timestampMs: number;
  timestamp: string;
  expiry: string | null;
  direction: "UP" | "DOWN" | null;
  strikeRaw: string | null;
  strike: number | null;
  lowerStrikeRaw: string | null;
  lowerStrike: number | null;
  higherStrikeRaw: string | null;
  higherStrike: number | null;
  quantityRaw: string | null;
  quoteAmount: number | null;
  probabilityPrice: number | null;
  settled: boolean | null;
}

export interface LiveBtcMarketSnapshot {
  health: LiveMarketHealth;
  serverStatus: string;
  serverTime: string;
  serverTimeMs: number;
  predictId: string;
  quoteAssetLabel: string;
  oracleCounts: {
    activeFutureBtc: number;
    activeTotal: number;
    total: number;
  };
  oracle: NormalizedOracle | null;
  price: LiveBtcMarketPrice | null;
  currentOracleTradeCount: number;
  events: LiveBtcMarketEvent[];
  fetchedAt: string;
}

export async function loadLiveBtcMarketSnapshot({
  client,
  config = predictConfig
}: LoadLiveBtcMarketSnapshotOptions): Promise<LiveBtcMarketSnapshot> {
  const [serverStatus, oracleResults] = await Promise.all([
    client.getStatus(),
    client.getPredictOracles(config.predictObjectId)
  ]);
  const serverTimeMs = getServerTimeMs(serverStatus);
  const oracles = oracleResults.map((oracle) => normalizeOracle(oracle, serverTimeMs));
  const activeFutureBtcOracles = oracles
    .filter((oracle) => oracle.status === "active")
    .filter((oracle) => oracle.underlyingAsset === "BTC")
    .filter((oracle) => oracle.expiryMs > serverTimeMs)
    .sort((left, right) => left.expiryMs - right.expiryMs);
  const activeOracle = activeFutureBtcOracles[0] ?? null;

  if (!activeOracle) {
    return {
      health: "degraded",
      serverStatus: getServerStatusLabel(serverStatus),
      serverTime: new Date(serverTimeMs).toISOString(),
      serverTimeMs,
      predictId: config.predictObjectId,
      quoteAssetLabel: getPredictQuoteAssetLabel(config),
      oracleCounts: {
        activeFutureBtc: 0,
        activeTotal: oracles.filter((oracle) => oracle.status === "active").length,
        total: oracles.length
      },
      oracle: null,
      price: null,
      currentOracleTradeCount: 0,
      events: [],
      fetchedAt: new Date().toISOString()
    };
  }

  const [oracleState, oracleTrades, mintedPositions, redeemedPositions, mintedRanges, redeemedRanges] = await Promise.all([
    client.getOracleState(activeOracle.oracleId),
    client.getOracleTrades(activeOracle.oracleId),
    client.getMintedPositions(),
    client.getRedeemedPositions(),
    client.getMintedRanges(),
    client.getRedeemedRanges()
  ]);

  return {
    health: "ready",
    serverStatus: getServerStatusLabel(serverStatus),
    serverTime: new Date(serverTimeMs).toISOString(),
    serverTimeMs,
    predictId: config.predictObjectId,
    quoteAssetLabel: getPredictQuoteAssetLabel(config),
    oracleCounts: {
      activeFutureBtc: activeFutureBtcOracles.length,
      activeTotal: oracles.filter((oracle) => oracle.status === "active").length,
      total: oracles.length
    },
    oracle: activeOracle,
    price: normalizePrice(oracleState),
    currentOracleTradeCount: oracleTrades.length,
    events: [
      ...oracleTrades.map((event) => normalizeDirectionalEvent(event, "oracle_trade")),
      ...mintedPositions.map((event) => normalizeDirectionalEvent(event, "position_minted")),
      ...redeemedPositions.map((event) => normalizeDirectionalEvent(event, "position_redeemed")),
      ...mintedRanges.map((event) => normalizeRangeEvent(event, "range_minted")),
      ...redeemedRanges.map((event) => normalizeRangeEvent(event, "range_redeemed"))
    ]
      .sort((left, right) => right.timestampMs - left.timestampMs)
      .slice(0, EVENT_LIMIT),
    fetchedAt: new Date().toISOString()
  };
}

export async function refreshLiveBtcMarketPrice({
  client,
  snapshot
}: RefreshLiveBtcMarketPriceOptions): Promise<LiveBtcMarketSnapshot> {
  if (!snapshot.oracle) {
    return snapshot;
  }

  const [serverStatus, oracleState] = await Promise.all([
    client.getStatus(),
    client.getOracleState(snapshot.oracle.oracleId)
  ]);
  const serverTimeMs = getServerTimeMs(serverStatus);

  return {
    ...snapshot,
    serverStatus: getServerStatusLabel(serverStatus),
    serverTime: new Date(serverTimeMs).toISOString(),
    serverTimeMs,
    oracle: {
      ...snapshot.oracle,
      secondsToExpiry: Math.max(0, Math.round((snapshot.oracle.expiryMs - serverTimeMs) / 1000))
    },
    price: normalizePrice(oracleState),
    fetchedAt: new Date().toISOString()
  };
}

function normalizeOracle(oracle: PredictOracleSummary, serverTimeMs: number): NormalizedOracle {
  const expiryMs = toNumber(oracle.expiry) ?? 0;

  return {
    oracleId: toStringValue(oracle.oracle_id ?? oracle.oracleId) ?? "unknown",
    underlyingAsset: toStringValue(oracle.underlying_asset ?? oracle.symbol)?.toUpperCase() ?? "UNKNOWN",
    expiryMs,
    expiresAt: expiryMs > 0 ? new Date(expiryMs).toISOString() : new Date(0).toISOString(),
    secondsToExpiry: Math.max(0, Math.round((expiryMs - serverTimeMs) / 1000)),
    status: toStringValue(oracle.status) ?? "unknown"
  };
}

function normalizePrice(oracleState: PredictOracleState): LiveBtcMarketPrice | null {
  const latestPrice = getRecord(oracleState.latest_price);
  const spot = scalePrice(latestPrice?.spot);

  if (spot === null) {
    return null;
  }

  const onchainTimestamp = toNumber(latestPrice?.onchain_timestamp ?? latestPrice?.checkpoint_timestamp_ms);

  return {
    spot,
    forward: scalePrice(latestPrice?.forward),
    updatedAt: onchainTimestamp ? new Date(onchainTimestamp).toISOString() : new Date(0).toISOString(),
    checkpoint: toNumber(latestPrice?.checkpoint)
  };
}

function normalizeDirectionalEvent(
  event: PredictOracleTrade | PredictMintedPosition | PredictRedeemedPosition,
  kind: Extract<LiveEventKind, "oracle_trade" | "position_minted" | "position_redeemed">
): LiveBtcMarketEvent {
  const timestampMs = toNumber(event.checkpoint_timestamp_ms) ?? 0;
  const quoteRaw = toNumber(event.cost ?? event.payout);
  const priceRaw = toNumber(event.ask_price ?? event.bid_price);

  return {
    id: `${kind}:${getDigest(event)}`,
    kind,
    digest: getDigest(event),
    oracleId: toStringValue(event.oracle_id) ?? "unknown",
    timestampMs,
    timestamp: timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date(0).toISOString(),
    expiry: formatMs(event.expiry),
    direction: typeof event.is_up === "boolean" ? (event.is_up ? "UP" : "DOWN") : null,
    strikeRaw: toRawString(event.strike),
    strike: scalePrice(event.strike),
    lowerStrikeRaw: null,
    lowerStrike: null,
    higherStrikeRaw: null,
    higherStrike: null,
    quantityRaw: toRawString(event.quantity),
    quoteAmount: scaleQuote(quoteRaw),
    probabilityPrice: scalePrice(priceRaw),
    settled: typeof event.is_settled === "boolean" ? event.is_settled : null
  };
}

function normalizeRangeEvent(
  event: PredictMintedRange | PredictRedeemedRange,
  kind: Extract<LiveEventKind, "range_minted" | "range_redeemed">
): LiveBtcMarketEvent {
  const timestampMs = toNumber(event.checkpoint_timestamp_ms) ?? 0;
  const quoteRaw = toNumber(event.cost ?? event.payout);
  const priceRaw = toNumber(event.ask_price ?? event.bid_price);

  return {
    id: `${kind}:${getDigest(event)}`,
    kind,
    digest: getDigest(event),
    oracleId: toStringValue(event.oracle_id) ?? "unknown",
    timestampMs,
    timestamp: timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date(0).toISOString(),
    expiry: formatMs(event.expiry),
    direction: null,
    strikeRaw: null,
    strike: null,
    lowerStrikeRaw: toRawString(event.lower_strike),
    lowerStrike: scalePrice(event.lower_strike),
    higherStrikeRaw: toRawString(event.higher_strike),
    higherStrike: scalePrice(event.higher_strike),
    quantityRaw: toRawString(event.quantity),
    quoteAmount: scaleQuote(quoteRaw),
    probabilityPrice: scalePrice(priceRaw),
    settled: typeof event.is_settled === "boolean" ? event.is_settled : null
  };
}

function getServerTimeMs(status: PredictStatus): number {
  return toNumber(status.current_time_ms) ?? Date.now();
}

function getServerStatusLabel(status: PredictStatus): string {
  return typeof status.status === "string" ? status.status : "unknown";
}

function getDigest(event: Record<string, unknown>): string {
  return toStringValue(event.event_digest ?? event.digest) ?? "unknown";
}

function formatMs(value: unknown): string | null {
  const timestamp = toNumber(value);
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function scalePrice(value: unknown): number | null {
  const numericValue = toNumber(value);
  return numericValue === null ? null : numericValue / PRICE_SCALE;
}

function scaleQuote(value: unknown): number | null {
  const numericValue = toNumber(value);
  return numericValue === null ? null : numericValue / QUOTE_SCALE;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function toRawString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }

  return null;
}
