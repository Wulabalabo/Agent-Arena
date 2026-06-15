import { describe, expect, it } from "bun:test";
import { calculateMvpScore, sortLeaderboard } from "./scoring";

describe("MVP scoring", () => {
  it("applies the fixed score formula", () => {
    const score = calculateMvpScore({
      netPnlPct: 0.1842,
      maxDrawdownPct: 0.031,
      capitalEfficiencyPct: 0.8,
      hitRatePct: 0.6,
      executionCount: 6,
      invalidIntentCount: 0
    });

    expect(score).toBeCloseTo(28.49, 2);
  });

  it("applies overtrade and invalid intent penalties", () => {
    const score = calculateMvpScore({
      netPnlPct: 0.1,
      maxDrawdownPct: 0.05,
      capitalEfficiencyPct: 0.4,
      hitRatePct: 0.5,
      executionCount: 8,
      invalidIntentCount: 2
    });

    expect(score).toBeCloseTo(8, 2);
  });

  it("breaks ties by higher pnl then lower drawdown", () => {
    const sorted = sortLeaderboard([
      { agentId: "a", score: 10, netPnlPct: 0.1, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:10:00.000Z" },
      { agentId: "b", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.04, finalExecutionAt: "2026-06-15T10:11:00.000Z" }
    ]);

    expect(sorted[0]?.agentId).toBe("b");
  });

  it("breaks ties by lower drawdown when pnl is equal", () => {
    const sorted = sortLeaderboard([
      { agentId: "a", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.04, finalExecutionAt: "2026-06-15T10:10:00.000Z" },
      { agentId: "b", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:11:00.000Z" }
    ]);

    expect(sorted[0]?.agentId).toBe("b");
  });

  it("breaks remaining ties by earlier final execution time then agent id", () => {
    const sorted = sortLeaderboard([
      { agentId: "c", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:12:00.000Z" },
      { agentId: "b", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:11:00.000Z" },
      { agentId: "a", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:11:00.000Z" }
    ]);

    expect(sorted.map((entry) => entry.agentId)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate leaderboard arrays or entries", () => {
    const first = { agentId: "a", score: 9, netPnlPct: 0.1, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:10:00.000Z" };
    const second = { agentId: "b", score: 10, netPnlPct: 0.1, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:10:00.000Z" };
    const leaderboard = [first, second];
    const snapshot = leaderboard.map((entry) => ({ ...entry }));

    const sorted = sortLeaderboard(leaderboard);

    expect(leaderboard).toEqual(snapshot);
    expect(sorted).toEqual([second, first]);
    expect(sorted[0]).not.toBe(second);
    expect(sorted[1]).not.toBe(first);
  });
});
