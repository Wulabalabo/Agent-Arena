import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../features/platform/mock";
import {
  createInitialPlatformState,
  getSelectedAgent,
  getSelectedCompetition,
  selectAgent,
  selectPlatformView
} from "./platform";

describe("platform state", () => {
  it("starts on the live competition view with the first competition and Agent selected", () => {
    const firstAgent = mockPlatformSnapshot.agents[0];
    const firstCompetition = mockPlatformSnapshot.competitions[0];
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(state.activeView).toBe("competition");
    expect(getSelectedCompetition(state).id).toBe(firstCompetition.id);
    expect(getSelectedAgent(state).id).toBe(firstAgent.id);
  });

  it("copies top-level collection arrays from the source snapshot", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(state.agents).not.toBe(mockPlatformSnapshot.agents);
    expect(state.competitions).not.toBe(mockPlatformSnapshot.competitions);
    expect(state.intents).not.toBe(mockPlatformSnapshot.intents);
    expect(state.riskDecisions).not.toBe(mockPlatformSnapshot.riskDecisions);
    expect(state.executions).not.toBe(mockPlatformSnapshot.executions);
    expect(state.positions).not.toBe(mockPlatformSnapshot.positions);
    expect(state.leaderboard).not.toBe(mockPlatformSnapshot.leaderboard);
    expect(state.replay).not.toBe(mockPlatformSnapshot.replay);
  });

  it("switches platform views without clearing selected Agent", () => {
    const secondAgent = mockPlatformSnapshot.agents[1];
    const state = createInitialPlatformState(mockPlatformSnapshot);
    const next = selectPlatformView(selectAgent(state, secondAgent.id), "leaderboard");

    expect(next.activeView).toBe("leaderboard");
    expect(next.selectedAgentId).toBe(secondAgent.id);
  });

  it("rejects selecting an unknown Agent", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(() => selectAgent(state, "missing")).toThrow("Agent not found: missing");
  });

  it("rejects reading an unknown selected Agent", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(() => getSelectedAgent({ ...state, selectedAgentId: "missing" })).toThrow(
      "Agent not found: missing"
    );
  });

  it("rejects reading an unknown selected competition", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(() => getSelectedCompetition({ ...state, selectedCompetitionId: "missing" })).toThrow(
      "Competition not found: missing"
    );
  });
});
