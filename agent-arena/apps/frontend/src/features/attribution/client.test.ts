import { describe, expect, it, vi } from "vitest";
import { createAttributionClient, type CreateAttributionInput } from "./client";

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

describe("createAttributionClient", () => {
  it("posts a transaction attribution record to the backend", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ ...baseInput, id: "attr_0xdigest_volatility-sniper", status: "submitted" }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createAttributionClient({ baseUrl: "http://backend.test", fetcher });

    await expect(client.createAttribution(baseInput)).resolves.toMatchObject({
      id: "attr_0xdigest_volatility-sniper",
      digest: "0xdigest",
      agentId: "volatility-sniper"
    });
    expect(fetcher).toHaveBeenCalledWith("http://backend.test/attributions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseInput)
    });
  });

  it("lists attribution records by user address", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ records: [{ ...baseInput, id: "attr_0xdigest_volatility-sniper" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createAttributionClient({ baseUrl: "http://backend.test/", fetcher });

    await expect(client.listAttributions("0xuser")).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith("http://backend.test/attributions?userAddress=0xuser");
  });

  it("throws backend error messages for failed attribution writes", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Attribution already exists" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createAttributionClient({ baseUrl: "http://backend.test", fetcher });

    await expect(client.createAttribution(baseInput)).rejects.toThrow("Attribution already exists");
  });
});
