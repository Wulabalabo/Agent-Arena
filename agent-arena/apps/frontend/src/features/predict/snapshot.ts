import { getPredictQuoteAssetLabel, predictConfig } from "./config";
import type { PredictConfig, PredictOracleState, PredictOracleSummary, PredictStatus } from "./types";

type SnapshotOracleStatus = "active" | "settled" | "inactive" | "unknown";

interface PredictSnapshotClient {
  getStatus: () => Promise<PredictStatus>;
  getPredictOracles: (predictId: string) => Promise<PredictOracleSummary[]>;
  getOracleState: (oracleId: string) => Promise<PredictOracleState>;
}

interface LoadPredictTestnetSnapshotOptions {
  client: PredictSnapshotClient;
  config?: PredictConfig;
}

export interface PredictTestnetOracle {
  oracleId: string;
  underlyingAsset: string;
  expiryMs: number | null;
  status: SnapshotOracleStatus;
}

export interface PredictTestnetSnapshot {
  health: "ready" | "degraded";
  serverStatus: string;
  predictId: string;
  quoteAssetLabel: string;
  oracleCounts: {
    active: number;
    settled: number;
    total: number;
  };
  activeOracle: PredictTestnetOracle | null;
  activeOracleState: PredictOracleState | null;
  updatedAt: string;
}

export async function loadPredictTestnetSnapshot({
  client,
  config = predictConfig
}: LoadPredictTestnetSnapshotOptions): Promise<PredictTestnetSnapshot> {
  const [serverStatus, oracleResults] = await Promise.all([
    client.getStatus(),
    client.getPredictOracles(config.predictObjectId)
  ]);
  const oracles = oracleResults.map(normalizeOracle);
  const activeOracle = oracles.find((oracle) => oracle.status === "active") ?? null;
  const activeOracleState = activeOracle ? await client.getOracleState(activeOracle.oracleId) : null;

  return {
    health: activeOracle ? "ready" : "degraded",
    serverStatus: getServerStatusLabel(serverStatus),
    predictId: config.predictObjectId,
    quoteAssetLabel: getPredictQuoteAssetLabel(config),
    oracleCounts: {
      active: oracles.filter((oracle) => oracle.status === "active").length,
      settled: oracles.filter((oracle) => oracle.status === "settled").length,
      total: oracles.length
    },
    activeOracle,
    activeOracleState,
    updatedAt: getUpdatedAt(serverStatus)
  };
}

function normalizeOracle(oracle: PredictOracleSummary): PredictTestnetOracle {
  const rawOracle = oracle as PredictOracleSummary & {
    oracle_id?: string;
    underlying_asset?: string;
    expiry?: number;
  };

  return {
    oracleId: rawOracle.oracle_id ?? rawOracle.oracleId ?? "unknown",
    underlyingAsset: rawOracle.underlying_asset ?? rawOracle.symbol ?? "UNKNOWN",
    expiryMs: typeof rawOracle.expiry === "number" ? rawOracle.expiry : null,
    status: normalizeOracleStatus(rawOracle.status)
  };
}

function normalizeOracleStatus(status: unknown): SnapshotOracleStatus {
  return status === "active" || status === "settled" || status === "inactive" ? status : "unknown";
}

function getServerStatusLabel(status: PredictStatus): string {
  return typeof status.status === "string" ? status.status : "unknown";
}

function getUpdatedAt(status: PredictStatus): string {
  const timestamp = status.current_time_ms;

  if (typeof timestamp === "number") {
    return new Date(timestamp).toISOString();
  }

  return new Date(0).toISOString();
}
