import type { AgentMarketDataResult } from "./api";

export type MarketSnapshotSource = "predict_server" | "mock" | "unavailable";
export type RuntimeMode = "mock" | "real";
export type HealthStatus = "ok" | "warning" | "blocked";

export interface MarketSnapshotMetadata {
  competitionId: string;
  source: MarketSnapshotSource;
  fetchedAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface MarketFreshnessSummary {
  status: HealthStatus;
  summary: string;
  source: MarketSnapshotSource;
  ageMs: number | null;
  lastErrorCode: string | null;
}

export function createMarketDataTracker({
  source,
  now = Date.now,
  provider
}: {
  source: MarketSnapshotSource;
  now?: () => number;
  provider: () => Promise<AgentMarketDataResult>;
}) {
  let metadata: MarketSnapshotMetadata | null = null;

  return {
    async getMarketData(): Promise<AgentMarketDataResult> {
      try {
        const result = await provider();
        const localFetchedAt = new Date(now()).toISOString();
        const snapshotFetchedAt = result.marketState.fetchedAt;
        const lastSuccessAt = isValidTimestamp(snapshotFetchedAt)
          ? snapshotFetchedAt
          : localFetchedAt;
        metadata = {
          competitionId: result.competition.id,
          source,
          fetchedAt: snapshotFetchedAt,
          lastSuccessAt,
          lastErrorAt: null,
          lastErrorCode: null,
          lastErrorMessage: null
        };

        return result;
      } catch (error) {
        const failedAt = new Date(now()).toISOString();
        metadata = {
          competitionId: metadata?.competitionId ?? "unknown",
          source: "unavailable",
          fetchedAt: metadata?.fetchedAt ?? failedAt,
          lastSuccessAt: metadata?.lastSuccessAt ?? null,
          lastErrorAt: failedAt,
          lastErrorCode: marketErrorCode(error),
          lastErrorMessage: marketErrorMessage(error)
        };

        throw error;
      }
    },

    getMetadata(): MarketSnapshotMetadata | null {
      return metadata ? { ...metadata } : null;
    }
  };
}

export function evaluateMarketFreshness({
  metadata,
  nowMs,
  staleThresholdMs,
  runtimeMode
}: {
  metadata: MarketSnapshotMetadata | null;
  nowMs: number;
  staleThresholdMs: number;
  runtimeMode: RuntimeMode;
}): MarketFreshnessSummary {
  const lastSuccessMs = metadata?.lastSuccessAt ? Date.parse(metadata.lastSuccessAt) : Number.NaN;
  if (!metadata?.lastSuccessAt || !Number.isFinite(lastSuccessMs)) {
    return {
      status: runtimeMode === "real" ? "blocked" : "warning",
      summary: "No successful market snapshot is available.",
      source: metadata?.source ?? "unavailable",
      ageMs: null,
      lastErrorCode: metadata?.lastErrorCode ?? "MARKET_SNAPSHOT_MISSING"
    };
  }

  const ageMs = Math.max(0, nowMs - lastSuccessMs);
  if (runtimeMode === "real" && ageMs > staleThresholdMs) {
    return {
      status: "blocked",
      summary: "Market snapshot is stale.",
      source: metadata.source,
      ageMs,
      lastErrorCode: metadata.lastErrorCode
    };
  }

  return {
    status: "ok",
    summary: metadata.source === "mock"
      ? "Mock market snapshot is available."
      : "Market snapshot is fresh.",
    source: metadata.source,
    ageMs,
    lastErrorCode: metadata.lastErrorCode
  };
}

function marketErrorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === "string" && error.code.trim()) {
    return error.code.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "MARKET_PROVIDER_FAILED";
}

function marketErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Market provider failed.";
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
