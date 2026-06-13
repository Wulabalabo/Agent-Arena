import { describe, expect, it, vi } from "vitest";
import { predictConfig } from "./config";
import type { PredictStatus } from "./types";
import { loadPredictTestnetSnapshot } from "./snapshot";

describe("loadPredictTestnetSnapshot", () => {
  it("loads server status, selects an active oracle, and fetches its state", async () => {
    const client = {
      getStatus: vi.fn(async (): Promise<PredictStatus> => ({
        status: "OK",
        latest_onchain_checkpoint: 346282315,
        current_time_ms: 1780999006403
      })),
      getPredictOracles: vi.fn(async () => [
        {
          predict_id: predictConfig.predictObjectId,
          oracle_id: "0xsettled",
          underlying_asset: "BTC",
          expiry: 1780669800000,
          status: "settled"
        },
        {
          predict_id: predictConfig.predictObjectId,
          oracle_id: "0xactive",
          underlying_asset: "BTC",
          expiry: 1783065600000,
          status: "active"
        }
      ]),
      getOracleState: vi.fn(async () => ({
        oracle_id: "0xactive",
        mid: 61234
      }))
    };

    const snapshot = await loadPredictTestnetSnapshot({ client, config: predictConfig });

    expect(client.getPredictOracles).toHaveBeenCalledWith(predictConfig.predictObjectId);
    expect(client.getOracleState).toHaveBeenCalledWith("0xactive");
    expect(snapshot.serverStatus).toBe("OK");
    expect(snapshot.predictId).toBe(predictConfig.predictObjectId);
    expect(snapshot.quoteAssetLabel).toBe("DUSDC");
    expect(snapshot.oracleCounts).toEqual({ active: 1, settled: 1, total: 2 });
    expect(snapshot.activeOracle).toEqual({
      oracleId: "0xactive",
      underlyingAsset: "BTC",
      expiryMs: 1783065600000,
      status: "active"
    });
    expect(snapshot.activeOracleState).toEqual({
      oracle_id: "0xactive",
      mid: 61234
    });
    expect(snapshot.updatedAt).toBe("2026-06-09T09:56:46.403Z");
  });

  it("returns a degraded snapshot when no active oracle is available", async () => {
    const client = {
      getStatus: vi.fn(async (): Promise<PredictStatus> => ({
        status: "OK"
      })),
      getPredictOracles: vi.fn(async () => [
        {
          oracle_id: "0xsettled",
          underlying_asset: "BTC",
          expiry: 1780669800000,
          status: "settled"
        }
      ]),
      getOracleState: vi.fn()
    };

    const snapshot = await loadPredictTestnetSnapshot({ client, config: predictConfig });

    expect(client.getOracleState).not.toHaveBeenCalled();
    expect(snapshot.health).toBe("degraded");
    expect(snapshot.activeOracle).toBeNull();
    expect(snapshot.activeOracleState).toBeNull();
  });
});
