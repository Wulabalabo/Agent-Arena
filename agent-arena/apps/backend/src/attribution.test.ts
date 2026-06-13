import { describe, expect, it } from "bun:test";
import {
  AttributionStore,
  createAttributionRecord,
  handleAttributionRequest,
  type CreateAttributionInput
} from "./attribution";

const baseInput: CreateAttributionInput = {
  userAddress: "0xuser",
  managerId: "0xmanager",
  roundId: "round-btc-15m",
  agentId: "volatility-sniper",
  oracleId: "0xoracle",
  digest: "0xdigest",
  predictPositionType: "directional",
  marketKey: "BTC_UP_60000",
  rangeKey: null,
  amount: 100,
  strategySnapshot: "Breakout after spread compression"
};

describe("AttributionStore", () => {
  it("stores Agent Arena attribution keyed by Predict transaction digest", () => {
    const record = createAttributionRecord(baseInput, "2026-06-10T00:00:00.000Z");

    expect(record).toMatchObject({
      id: "attr_0xdigest_volatility-sniper",
      userAddress: "0xuser",
      managerId: "0xmanager",
      agentId: "volatility-sniper",
      digest: "0xdigest",
      status: "submitted"
    });
  });

  it("rejects duplicate digest and agent attribution records", () => {
    const store = new AttributionStore();

    store.create(baseInput);

    expect(() => store.create(baseInput)).toThrow(/already exists/i);
  });

  it("lists attribution records by user address without indexing chain events", () => {
    const store = new AttributionStore();
    store.create(baseInput);
    store.create({
      ...baseInput,
      userAddress: "0xother",
      digest: "0xotherdigest"
    });

    expect(store.listByUser("0xuser")).toHaveLength(1);
    expect(store.listByUser("0xuser")[0]?.digest).toBe("0xdigest");
  });
});

describe("handleAttributionRequest", () => {
  it("handles browser CORS preflight requests", async () => {
    const response = await handleAttributionRequest(
      new Request("http://localhost/attributions", {
        method: "OPTIONS"
      }),
      new AttributionStore()
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("exposes health as a lightweight backend rather than an indexer", async () => {
    const response = await handleAttributionRequest(new Request("http://localhost/health"), new AttributionStore());

    await expect(response.json()).resolves.toEqual({
      service: "agent-arena-attribution",
      ok: true,
      indexer: false
    });
  });

  it("creates and lists attribution records over HTTP", async () => {
    const store = new AttributionStore();
    const created = await handleAttributionRequest(
      new Request("http://localhost/attributions", {
        method: "POST",
        body: JSON.stringify(baseInput)
      }),
      store
    );

    expect(created.status).toBe(201);

    const listed = await handleAttributionRequest(
      new Request("http://localhost/attributions?userAddress=0xuser"),
      store
    );

    await expect(listed.json()).resolves.toMatchObject({
      records: [
        {
          userAddress: "0xuser",
          digest: "0xdigest",
          agentId: "volatility-sniper"
        }
      ]
    });
  });

  it("returns 500 for backend persistence failures", async () => {
    const failingStore = {
      create: () => {
        throw new Error("database locked");
      },
      listByUser: () => []
    };
    const response = await handleAttributionRequest(
      new Request("http://localhost/attributions", {
        method: "POST",
        body: JSON.stringify(baseInput)
      }),
      failingStore
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Attribution backend error" });
  });
});
