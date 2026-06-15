import { describe, expect, it } from "bun:test";
import { agentActions, createMockCompetition, isAgentAction } from "./types";

describe("platform types", () => {
  it("recognizes the MVP Agent actions", () => {
    expect(isAgentAction("open_directional")).toBe(true);
    expect(isAgentAction("adjust_range")).toBe(true);
    expect(isAgentAction("transfer")).toBe(false);
  });

  it("keeps the action catalog immutable while returning fixture copies", () => {
    const first = createMockCompetition("btc-15m-001");
    const second = createMockCompetition("btc-15m-002");

    expect(Object.isFrozen(agentActions)).toBe(true);
    expect(Object.isFrozen(first.allowedActions)).toBe(false);
    expect(() => {
      (first.allowedActions as string[]).push("transfer");
    }).not.toThrow();
    expect(second.allowedActions).not.toContain("transfer");
  });

  it("creates the BTC 15m competition shape used by API fixtures", () => {
    const competition = createMockCompetition("btc-15m-001");

    expect(competition.gameType).toBe("DeepBookPredictBtc15m");
    expect(competition.allowedActions).toContain("open_directional");
    expect(competition.allowedActions).toContain("hold");
  });
});
