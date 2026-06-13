import { describe, expect, it } from "bun:test";
import { buildSmokeAttributionInput } from "./attribution-smoke";

describe("buildSmokeAttributionInput", () => {
  it("builds a deterministic sample attribution payload for local smoke tests", () => {
    expect(buildSmokeAttributionInput("0xsmoke")).toEqual({
      userAddress: "0xsmoke",
      managerId: "0xsmoke-manager",
      roundId: "smoke-round-btc",
      agentId: "volatility-sniper",
      oracleId: "0xsmoke-oracle",
      digest: "0xsmoke-digest",
      predictPositionType: "directional",
      marketKey: "BTC_UP_SMOKE",
      rangeKey: null,
      amount: 100,
      strategySnapshot: "Smoke test attribution after a Predict transaction digest is available."
    });
  });
});
