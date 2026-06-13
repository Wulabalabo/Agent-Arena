import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPredictClient } from "./client";

describe("createPredictClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches status from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await expect(client.getStatus()).resolves.toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledWith("https://predict.example/status");
  });

  it("fetches predict state from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "predict-state" })
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await expect(client.getPredictState("0xpredict")).resolves.toEqual({ id: "predict-state" });

    expect(fetcher).toHaveBeenCalledWith("https://predict.example/predicts/0xpredict/state");
  });

  it("fetches predict oracles from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ oracleId: "0xoracle" }]
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await client.getPredictOracles("0xpredict");

    expect(fetcher).toHaveBeenCalledWith("https://predict.example/predicts/0xpredict/oracles");
  });

  it("fetches oracle state from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ oracleId: "0xoracle" })
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await client.getOracleState("0xoracle");

    expect(fetcher).toHaveBeenCalledWith("https://predict.example/oracles/0xoracle/state");
  });

  it("fetches manager read models from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ managerId: "0xmanager" })
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await client.getManagers();
    await client.getManagerSummary("0xmanager");
    await client.getManagerPositionsSummary("0xmanager");
    await client.getManagerPnl("0xmanager");

    expect(fetcher).toHaveBeenNthCalledWith(1, "https://predict.example/managers");
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://predict.example/managers/0xmanager/summary");
    expect(fetcher).toHaveBeenNthCalledWith(3, "https://predict.example/managers/0xmanager/positions/summary");
    expect(fetcher).toHaveBeenNthCalledWith(4, "https://predict.example/managers/0xmanager/pnl?range=ALL");
  });

  it("fetches oracle trades from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await client.getOracleTrades("0xoracle");

    expect(fetcher).toHaveBeenCalledWith("https://predict.example/trades/0xoracle");
  });

  it("fetches mint and redeem history endpoints from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await client.getMintedPositions();
    await client.getRedeemedPositions();
    await client.getMintedRanges();
    await client.getRedeemedRanges();

    expect(fetcher).toHaveBeenNthCalledWith(1, "https://predict.example/positions/minted");
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://predict.example/positions/redeemed");
    expect(fetcher).toHaveBeenNthCalledWith(3, "https://predict.example/ranges/minted");
    expect(fetcher).toHaveBeenNthCalledWith(4, "https://predict.example/ranges/redeemed");
  });

  it("strips a trailing slash from the configured server URL", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "predict-state" })
    });
    const client = createPredictClient({ serverUrl: "https://predict.example/", fetcher });

    await client.getPredictState("0xpredict");

    expect(fetcher).toHaveBeenCalledWith("https://predict.example/predicts/0xpredict/state");
  });

  it("throws a readable error when the server returns a non-OK response", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error"
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });

    await expect(client.getOracleState("0xoracle")).rejects.toThrow(
      "Predict server request failed: 500 Server Error"
    );
  });
});
