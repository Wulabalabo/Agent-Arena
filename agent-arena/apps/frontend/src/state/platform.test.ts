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
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(state.activeView).toBe("competition");
    expect(getSelectedCompetition(state).id).toBe("btc-15m-001");
    expect(getSelectedAgent(state).id).toBe("agent_1");
  });

  it("switches platform views without clearing selected Agent", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);
    const next = selectPlatformView(selectAgent(state, "agent_2"), "leaderboard");

    expect(next.activeView).toBe("leaderboard");
    expect(next.selectedAgentId).toBe("agent_2");
  });
});
