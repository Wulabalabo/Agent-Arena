import { describe, expect, it } from "vitest";
import {
  getAgentById,
  getMarketStatement,
  getSortedAgents,
  mockArenaMatch
} from "./arena";

describe("mock arena data", () => {
  it("defines a six-agent match for the arena demo", () => {
    expect(mockArenaMatch.agents).toHaveLength(6);
    expect(mockArenaMatch.candles.length).toBeGreaterThan(12);
    expect(mockArenaMatch.events.length).toBeGreaterThan(6);
  });

  it("sorts agents by battle score in descending order", () => {
    const sorted = getSortedAgents(mockArenaMatch.agents, "leaderboard");

    expect(sorted[0].battleScore).toBeGreaterThanOrEqual(sorted[1].battleScore);
    expect(sorted[0].rank).toBe(1);
  });

  it("sorts agents by audience backing for crowd pick mode", () => {
    const sorted = getSortedAgents(mockArenaMatch.agents, "crowd");

    expect(sorted[0].audienceBacking).toBeGreaterThanOrEqual(sorted[1].audienceBacking);
  });

  it("returns a binary winner market statement for an agent", () => {
    expect(getMarketStatement(mockArenaMatch.agents[0])).toBe(
      `Will ${mockArenaMatch.agents[0].name} finish rank 1?`
    );
  });

  it("finds an agent by id", () => {
    const agent = getAgentById(mockArenaMatch, "volatility-sniper");

    expect(agent.name).toBe("Volatility Sniper");
  });
});

