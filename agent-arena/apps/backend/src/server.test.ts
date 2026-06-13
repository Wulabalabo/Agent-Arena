import { describe, expect, it } from "bun:test";
import { createAttributionFetchHandler, getDefaultAttributionDbPath } from "./server";
import { AttributionStore, type CreateAttributionInput } from "./attribution";

const input: CreateAttributionInput = {
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

describe("createAttributionFetchHandler", () => {
  it("keeps attribution records in one backend instance", async () => {
    const fetch = createAttributionFetchHandler(new AttributionStore());

    await fetch(
      new Request("http://localhost/attributions", {
        method: "POST",
        body: JSON.stringify(input)
      })
    );

    const response = await fetch(new Request("http://localhost/attributions?userAddress=0xuser"));

    await expect(response.json()).resolves.toMatchObject({
      records: [
        {
          digest: "0xdigest",
          agentId: "volatility-sniper"
        }
      ]
    });
  });
});

describe("getDefaultAttributionDbPath", () => {
  it("defaults attribution persistence to a local SQLite data file", () => {
    expect(getDefaultAttributionDbPath()).toMatch(/data[/\\]agent-arena\.sqlite$/);
  });
});
