import { describe, expect, it } from "vitest";
import { getAgentById, getRoundById, mockAgents, mockArenaRounds } from "../../mock/arena";
import { buildCreateAttributionInput } from "./payload";

describe("buildCreateAttributionInput", () => {
  it("builds a directional attribution payload from arena context", () => {
    const round = getRoundById(mockArenaRounds, "round-eth-30m");
    const agent = getAgentById(mockAgents, "volatility-sniper");

    expect(
      buildCreateAttributionInput({
        round,
        agent,
        amount: 100,
        digest: "0xdigest",
        userAddress: "0xuser",
        managerId: "0xmanager"
      })
    ).toMatchObject({
      userAddress: "0xuser",
      managerId: "0xmanager",
      roundId: round.id,
      agentId: agent.id,
      oracleId: round.predictOracleId,
      digest: "0xdigest",
      predictPositionType: "directional",
      marketKey: "ETH_30m_LOCAL_DIRECTION",
      rangeKey: null,
      amount: 100,
      strategySnapshot: expect.stringContaining("Volatility Sniper")
    });
  });

  it("builds a range attribution payload when the agent supports ranges", () => {
    const round = getRoundById(mockArenaRounds, "round-eth-30m");
    const agent = getAgentById(mockAgents, "mean-reversion-monk");

    const payload = buildCreateAttributionInput({
      round,
      agent,
      amount: 150,
      digest: "0xrange-digest",
      userAddress: "0xuser",
      managerId: "0xmanager"
    });

    expect(payload).toMatchObject({
      predictPositionType: "range",
      marketKey: null,
      rangeKey: "ETH_30m_LOCAL_RANGE"
    });
    expect(payload.strategySnapshot).toContain(round.id);
    expect(payload.strategySnapshot).toContain("150");
  });

  it("rejects missing digests and non-positive amounts", () => {
    const round = getRoundById(mockArenaRounds, "round-eth-30m");
    const agent = getAgentById(mockAgents, "volatility-sniper");

    expect(() =>
      buildCreateAttributionInput({
        round,
        agent,
        amount: 0,
        digest: "0xdigest",
        userAddress: "0xuser",
        managerId: "0xmanager"
      })
    ).toThrow("amount must be a positive number");
    expect(() =>
      buildCreateAttributionInput({
        round,
        agent,
        amount: 100,
        digest: "",
        userAddress: "0xuser",
        managerId: "0xmanager"
      })
    ).toThrow("digest is required");
  });
});
