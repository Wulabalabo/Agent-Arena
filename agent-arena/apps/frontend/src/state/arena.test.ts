import { describe, expect, it } from "vitest";
import { mockArenaMatch } from "../mock/arena";
import {
  advancePhase,
  confirmPrediction,
  createInitialArenaState,
  selectAgent,
  settleMatch
} from "./arena";

describe("arena state", () => {
  it("starts with the top ranked agent selected", () => {
    const state = createInitialArenaState(mockArenaMatch);

    expect(state.selectedAgentId).toBe(mockArenaMatch.agents[0].id);
    expect(state.phase).toBe("live");
  });

  it("selects an agent without mutating match data", () => {
    const state = createInitialArenaState(mockArenaMatch);
    const next = selectAgent(state, "mean-reversion-monk");

    expect(next.selectedAgentId).toBe("mean-reversion-monk");
    expect(state.selectedAgentId).toBe(mockArenaMatch.agents[0].id);
  });

  it("confirms a prediction and records a user position", () => {
    const state = createInitialArenaState(mockArenaMatch);
    const next = confirmPrediction(state, "volatility-sniper", 50);

    expect(next.userPosition).toMatchObject({
      agentId: "volatility-sniper",
      amount: 50,
      status: "confirmed"
    });
    expect(next.match.agents.find((agent) => agent.id === "volatility-sniper")?.audienceBacking).toBeGreaterThan(
      mockArenaMatch.agents.find((agent) => agent.id === "volatility-sniper")?.audienceBacking ?? 0
    );
  });

  it("advances demo phases in order", () => {
    const state = createInitialArenaState(mockArenaMatch);
    const next = advancePhase(state);

    expect(next.phase).toBe("final-minute");
  });

  it("settles to the highest battle score winner", () => {
    const state = createInitialArenaState(mockArenaMatch);
    const settled = settleMatch(state);

    expect(settled.phase).toBe("settled");
    expect(settled.winnerId).toBe(mockArenaMatch.agents[0].id);
  });
});

