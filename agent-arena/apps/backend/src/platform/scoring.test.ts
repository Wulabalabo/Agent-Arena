import { describe, expect, it } from "bun:test";
import { calculateMvpScore, createLedgerLeaderboardEntries, sortLeaderboard } from "./scoring";

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

  it("aggregates ledger-backed leaderboard metrics by agent id across wallet replacements", () => {
    const entries = createLedgerLeaderboardEntries({
      agents: [{
        id: "agent_1",
        displayName: "Ledger Agent",
        normalizedName: "ledger agent",
        twitterHandle: "Ledger_Agent",
        normalizedTwitterHandle: "ledger_agent",
        twitterVerified: false,
        ownerAddress: "0xowner",
        tradingWalletAddress: "0xwallet2",
        tradingWalletId: "wallet_2",
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-15T00:00:00.000Z"
      }],
      ledger: [
        {
          kind: "execution",
          agentDraftId: "draft_1",
          registrationCodeHash: "sha256:abc",
          agentId: "agent_1",
          ownerAddress: "0xowner",
          tradingWalletId: "wallet_1",
          walletAddress: "0xwallet1",
          predictManagerId: "0xmanager1",
          competitionId: "btc-15m-001",
          oracleId: "0xbtc15m",
          expiryMs: "1781701200000",
          intentId: "intent_1",
          riskDecisionId: "risk_1",
          executionId: "exec_1",
          txDigest: "0xdigest1",
          action: "open_directional",
          positionKind: "directional",
          quantityRaw: "10",
          costRaw: "100",
          proceedsRaw: null,
          status: "confirmed",
          errorCode: null,
          policyDrift: "none",
          createdAt: "2026-06-15T10:04:00.000Z",
          serverReceivedAt: "2026-06-15T10:04:00.100Z"
        },
        {
          kind: "execution",
          agentDraftId: "draft_1",
          registrationCodeHash: "sha256:abc",
          agentId: "agent_1",
          ownerAddress: "0xowner",
          tradingWalletId: "wallet_2",
          walletAddress: "0xwallet2",
          predictManagerId: "0xmanager2",
          competitionId: "btc-15m-001",
          oracleId: "0xbtc15m",
          expiryMs: "1781701200000",
          intentId: "intent_2",
          riskDecisionId: "risk_2",
          executionId: "exec_2",
          txDigest: "0xdigest2",
          action: "close",
          positionKind: "directional",
          quantityRaw: "10",
          costRaw: null,
          proceedsRaw: "120",
          status: "confirmed",
          errorCode: null,
          policyDrift: "none",
          createdAt: "2026-06-15T10:10:00.000Z",
          serverReceivedAt: "2026-06-15T10:10:00.100Z"
        },
        {
          kind: "intent",
          agentDraftId: "draft_1",
          registrationCodeHash: "sha256:abc",
          agentId: "agent_1",
          ownerAddress: "0xowner",
          tradingWalletId: "wallet_2",
          walletAddress: "0xwallet2",
          predictManagerId: "0xmanager2",
          competitionId: "btc-15m-001",
          oracleId: "0xbtc15m",
          expiryMs: "1781701200000",
          intentId: "intent_3",
          riskDecisionId: "risk_3",
          executionId: null,
          txDigest: null,
          action: "open_range",
          positionKind: "range",
          quantityRaw: "10",
          costRaw: null,
          proceedsRaw: null,
          status: "rejected",
          errorCode: "RISK_LIMIT_EXCEEDED",
          policyDrift: "none",
          createdAt: "2026-06-15T10:11:00.000Z",
          serverReceivedAt: "2026-06-15T10:11:00.100Z"
        }
      ],
      competitionId: "btc-15m-001"
    });

    expect(entries).toMatchObject([{
      rank: 1,
      agentId: "agent_1",
      displayName: "Ledger Agent",
      twitterHandle: "Ledger_Agent",
      executionCount: 2,
      invalidIntentCount: 1,
      finalExecutionAt: "2026-06-15T10:10:00.000Z"
    }]);
  });
});
