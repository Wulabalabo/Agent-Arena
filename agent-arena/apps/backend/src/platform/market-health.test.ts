import { describe, expect, it } from "bun:test";
import { createMarketDataTracker, evaluateMarketFreshness } from "./market-health";
import type { AgentMarketDataResult } from "./api";
import { createMarketSnapshot } from "./market-snapshot";
import { createMockCompetition } from "./types";

const competition = createMockCompetition("btc-15m-001");

describe("market health", () => {
  it("blocks real-mode health when provider metadata is stale", () => {
    const result = evaluateMarketFreshness({
      metadata: {
        competitionId: competition.id,
        source: "predict_server",
        fetchedAt: "2026-06-25T00:00:00.000Z",
        lastSuccessAt: "2026-06-25T00:00:00.000Z",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null
      },
      nowMs: Date.parse("2026-06-25T00:00:06.000Z"),
      staleThresholdMs: 5000,
      runtimeMode: "real"
    });

    expect(result).toMatchObject({
      status: "blocked",
      ageMs: 6000,
      source: "predict_server",
      summary: "Market snapshot is stale."
    });
  });

  it("reports mock source without pretending it is real Predict data", () => {
    const result = evaluateMarketFreshness({
      metadata: {
        competitionId: competition.id,
        source: "mock",
        fetchedAt: "2026-06-25T00:00:00.000Z",
        lastSuccessAt: "2026-06-25T00:00:00.000Z",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null
      },
      nowMs: Date.parse("2026-06-25T00:00:20.000Z"),
      staleThresholdMs: 5000,
      runtimeMode: "mock"
    });

    expect(result.status).toBe("ok");
    expect(result.source).toBe("mock");
  });

  it("tracks provider success metadata", async () => {
    const tracker = createMarketDataTracker({
      source: "predict_server",
      now: () => Date.parse("2026-06-25T00:00:00.000Z"),
      provider: async (): Promise<AgentMarketDataResult> => ({
        competition,
        marketState: createMarketSnapshot(competition, Date.parse("2026-06-25T00:00:00.000Z"))
      })
    });

    await tracker.getMarketData();
    const metadata = tracker.getMetadata();
    if (metadata) {
      metadata.lastErrorCode = "MUTATED_COPY";
    }

    expect(tracker.getMetadata()).toMatchObject({
      competitionId: competition.id,
      source: "predict_server",
      lastErrorCode: null
    });
  });
});
