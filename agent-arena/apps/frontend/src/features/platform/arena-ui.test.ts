import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "./mock";
import type { AgentAction, AgentIntent, ExecutionRecord, IntentStatus } from "./types";
import {
  agentArenaJoinPrompt,
  createArenaChartMarketReference,
  createPublicActionFeedItems,
  createUserAgentArenaProfile
} from "./arena-ui";

describe("arena UI contracts", () => {
  it("provides the full Agent join prompt", () => {
    expect(agentArenaJoinPrompt).toBe(
      "Read http://127.0.0.1:8787/skills/agent-arena.md and follow the instructions to join the BTC 15m Agent Arena."
    );
  });

  it("derives the current user's Agent arena profile from platform state", () => {
    const profile = createUserAgentArenaProfile({
      agent: mockPlatformSnapshot.agents[0],
      tradingWallet: mockPlatformSnapshot.tradingWallet,
      positions: mockPlatformSnapshot.positions,
      intents: mockPlatformSnapshot.intents,
      executions: mockPlatformSnapshot.executions,
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(profile.accountState).toBe("open_exposure");
    expect(profile.displayName).toBe("Trend Ranger");
    expect(profile.twitterHandle).toBe("Sui_Agent");
    expect(profile.twitterVerified).toBe(false);
    expect(profile.positionLabel).toBe("UP $65,000.00");
    expect(profile.realizedPnlPct).toBe(0.1842);
    expect(profile.walletBalanceLabel).toBe("125.00 DUSDC / 4.20 SUI");
    expect(profile.quoteBalance).toBe("125.00");
    expect(profile.testnetSuiBalance).toBe("4.20");
    expect(profile.latestIntentId).toBe("intent_1");
    expect(profile.latestExecutionId).toBe("exec_1");
    expect(profile.latestPredictTxDigest).toBe("0xmock_exec_1");
  });

  it("derives the arena chart strike from the latest open position", () => {
    const marketReference = createArenaChartMarketReference({
      competitionId: mockPlatformSnapshot.competitions[0].id,
      intents: mockPlatformSnapshot.intents,
      positions: mockPlatformSnapshot.positions
    });

    expect(marketReference).toEqual({
      kind: "directional",
      strike: 65_000,
      strikeRaw: "65000000000000"
    });
  });

  it("uses executable market-state strike before position fallbacks", () => {
    const marketReference = createArenaChartMarketReference({
      competitionId: mockPlatformSnapshot.competitions[0].id,
      intents: mockPlatformSnapshot.intents,
      marketState: {
        allowedActions: ["hold", "open_directional"],
        allowedOperations: {
          canClose: true,
          canHold: true,
          canOpen: true,
          canReduce: true
        },
        competitionId: mockPlatformSnapshot.competitions[0].id,
        executableMarkets: {
          directional: {
            expiry: "1781622900000",
            oracleId: "0xfuture-nearest",
            strike: "65700000000000"
          }
        },
        expiryMs: "1781622900000",
        fetchedAt: "2026-06-16T15:00:55.000Z",
        forwardPriceRaw: "65611186326705",
        lateWindow: {
          isFinalMinute: false,
          openAllowedByPlatform: true,
          openMayFailOnPredictQuote: true
        },
        oracleId: "0xfuture-nearest",
        oracleStatus: "active",
        priceDecimals: 9,
        serverTimeMs: "1781622000000",
        spotPriceRaw: "65611517258518",
        status: "live",
        strikeGrid: {
          maxStrikeRaw: "80000000000000",
          minStrikeRaw: "50000000000000",
          strikeStepRaw: "1000000000"
        },
        timeToExpiryMs: "900000",
        underlyingAsset: "BTC"
      },
      positions: mockPlatformSnapshot.positions
    });

    expect(marketReference).toEqual({
      kind: "directional",
      strike: 65_700,
      strikeRaw: "65700000000000"
    });
  });

  it("ignores inactive market-state strikes and keeps the position fallback", () => {
    const marketReference = createArenaChartMarketReference({
      competitionId: mockPlatformSnapshot.competitions[0].id,
      intents: mockPlatformSnapshot.intents,
      marketState: {
        allowedActions: ["hold", "open_directional"],
        allowedOperations: {
          canClose: true,
          canHold: true,
          canOpen: false,
          canReduce: true
        },
        competitionId: mockPlatformSnapshot.competitions[0].id,
        executableMarkets: {
          directional: {
            expiry: "1781622900000",
            oracleId: "0xfuture-nearest",
            strike: "65700000000000"
          }
        },
        expiryMs: "1781622900000",
        fetchedAt: "2026-06-16T15:00:55.000Z",
        forwardPriceRaw: "65611186326705",
        lateWindow: {
          isFinalMinute: false,
          openAllowedByPlatform: false,
          openMayFailOnPredictQuote: false
        },
        oracleId: "0xfuture-nearest",
        oracleStatus: "expired",
        priceDecimals: 9,
        serverTimeMs: "1781622900000",
        spotPriceRaw: "65611517258518",
        status: "expired",
        strikeGrid: {
          maxStrikeRaw: "80000000000000",
          minStrikeRaw: "50000000000000",
          strikeStepRaw: "1000000000"
        },
        timeToExpiryMs: "0",
        underlyingAsset: "BTC"
      },
      positions: mockPlatformSnapshot.positions
    });

    expect(marketReference).toEqual({
      kind: "directional",
      strike: 65_000,
      strikeRaw: "65000000000000"
    });
  });

  it("falls back to executable range intent strikes when there is no open position", () => {
    const marketReference = createArenaChartMarketReference({
      competitionId: mockPlatformSnapshot.competitions[0].id,
      intents: [
        {
          ...mockPlatformSnapshot.intents[1],
          status: "accepted"
        }
      ],
      positions: []
    });

    expect(marketReference).toEqual({
      higherStrike: 66_000,
      higherStrikeRaw: "66000000000000",
      kind: "range",
      lowerStrike: 64_000,
      lowerStrikeRaw: "64000000000000"
    });
  });

  it("derives an explicit no-claimed-Agent profile state", () => {
    const profile = createUserAgentArenaProfile({
      agent: null,
      tradingWallet: null,
      positions: [],
      intents: [],
      executions: [],
      leaderboard: []
    });

    expect(profile.accountState).toBe("no_claimed_agent");
    expect(profile.displayName).toBe("No claimed Agent");
    expect(profile.positionLabel).toBe("No active Agent");
    expect(profile.tradingWalletAddress).toBeNull();
  });

  it("does not attach another Agent's trading wallet to the selected profile", () => {
    const profile = createUserAgentArenaProfile({
      agent: mockPlatformSnapshot.agents[1],
      tradingWallet: mockPlatformSnapshot.tradingWallet,
      positions: [],
      intents: [],
      executions: [],
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(profile.accountState).toBe("claimed_no_runtime");
    expect(profile.displayName).toBe("Range Cartographer");
    expect(profile.tradingWalletAddress).toBe(mockPlatformSnapshot.agents[1].tradingWalletAddress);
    expect(profile.tradingWalletAddress).toBe("0xagentwallet_agent_2");
    expect(profile.tradingWalletAddress).not.toBe(mockPlatformSnapshot.tradingWallet.address);
    expect(profile.walletBalanceLabel).toBe("not available");
  });

  it("formats range position strikes as chart-aligned USD prices", () => {
    const profile = createUserAgentArenaProfile({
      agent: mockPlatformSnapshot.agents[1],
      tradingWallet: null,
      positions: [{
        agentId: "agent_2",
        competitionId: mockPlatformSnapshot.competitions[0].id,
        expiryMs: "1781622900000",
        higherStrikeRaw: "66000000000000",
        lowerStrikeRaw: "64000000000000",
        oracleId: "0xfuture-nearest",
        positionRef: {
          kind: "range",
          openExecutionId: "exec_range",
          quantity: "500000",
          rangeKey: "btc-range-test"
        },
        quantityRaw: "500000",
        status: "open",
        updatedAt: "2026-06-16T10:10:00.000Z"
      }],
      intents: [],
      executions: [],
      leaderboard: []
    });

    expect(profile.positionLabel).toBe("Range $64,000.00-$66,000.00");
  });

  it("formats raw DUSDC quote balances for the user Agent profile display", () => {
    const profile = createUserAgentArenaProfile({
      agent: mockPlatformSnapshot.agents[0],
      tradingWallet: {
        ...mockPlatformSnapshot.tradingWallet,
        quoteBalance: "10254850",
        testnetSuiBalance: "0.976797716"
      },
      positions: [],
      intents: [],
      executions: [],
      leaderboard: []
    });

    expect(profile.quoteBalance).toBe("10.25485");
    expect(profile.walletBalanceLabel).toBe("10.25485 DUSDC / 0.976797716 SUI");
  });

  it("marks the selected Agent profile as attention when its latest intent failed", () => {
    const failedIntent: AgentIntent = {
      ...mockPlatformSnapshot.intents[0],
      id: "intent_failed_latest",
      agentId: "agent_2",
      status: "failed",
      createdAt: "2026-06-16T10:20:00.000Z"
    };

    const profile = createUserAgentArenaProfile({
      agent: mockPlatformSnapshot.agents[1],
      tradingWallet: null,
      positions: [],
      intents: [failedIntent],
      executions: [],
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(profile.accountState).toBe("attention");
    expect(profile.latestIntentId).toBe("intent_failed_latest");
  });

  it("derives public action feed items from intents and executions", () => {
    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents: mockPlatformSnapshot.intents,
      executions: mockPlatformSnapshot.executions,
      leaderboard: mockPlatformSnapshot.leaderboard,
      ownerAgentId: "agent_1"
    });

    expect(items.map((item) => item.timestamp)).toEqual(
      [...items.map((item) => item.timestamp)].sort((left, right) => right.localeCompare(left))
    );
    expect(items.map((item) => item.id)).toEqual([
      "score:agent_1:2026-06-16T10:14:00.000Z",
      "score:agent_2:2026-06-16T10:13:00.000Z",
      "score:agent_3:2026-06-16T10:12:00.000Z",
      "intent:intent_2",
      "execution:exec_1",
      "intent:intent_1"
    ]);

    expect(items.find((item) => item.id === "score:agent_1:2026-06-16T10:14:00.000Z")).toEqual(expect.objectContaining({
      action: "score_update",
      agentDisplayName: "Trend Ranger",
      pnlDeltaPct: 0.1842,
      scoreDelta: 28.49,
      walletScope: "owner",
      status: "info"
    }));

    expect(items.find((item) => item.id === "intent:intent_1")).toEqual(expect.objectContaining({
      action: "open_directional",
      direction: "UP",
      quantity: "10",
      maxCost: "5.00",
      walletScope: "owner",
      status: "executed"
    }));
    expect(items.find((item) => item.id === "intent:intent_2")).toEqual(expect.objectContaining({
      action: "rejected",
      lowerStrike: "64000000000000",
      higherStrike: "66000000000000",
      rejectionCode: "RISK_LIMIT_EXCEEDED",
      walletScope: "public",
      status: "rejected"
    }));
    expect(items.find((item) => item.id === "execution:exec_1")).toEqual(expect.objectContaining({
      action: "executed",
      agentDisplayName: "Trend Ranger",
      predictTxDigest: "0xmock_exec_1",
      walletScope: "owner",
      status: "executed"
    }));
  });

  it("maps execution feed statuses without marking pending records as executed", () => {
    const executions: ExecutionRecord[] = [
      { ...mockPlatformSnapshot.executions[0], id: "exec_queued", status: "queued", createdAt: "2026-06-16T10:05:00.000Z" },
      { ...mockPlatformSnapshot.executions[0], id: "exec_signed", status: "signed", createdAt: "2026-06-16T10:06:00.000Z" },
      { ...mockPlatformSnapshot.executions[0], id: "exec_submitted", status: "submitted", createdAt: "2026-06-16T10:07:00.000Z" },
      { ...mockPlatformSnapshot.executions[0], id: "exec_partial", status: "partial", createdAt: "2026-06-16T10:08:00.000Z" },
      { ...mockPlatformSnapshot.executions[0], id: "exec_confirmed", status: "confirmed", createdAt: "2026-06-16T10:09:00.000Z" },
      { ...mockPlatformSnapshot.executions[0], id: "exec_failed", status: "failed", createdAt: "2026-06-16T10:10:00.000Z" }
    ];

    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents: [],
      executions,
      leaderboard: []
    });

    expect(items.map((item) => [item.id, item.status])).toEqual([
      ["execution:exec_failed", "failed"],
      ["execution:exec_confirmed", "executed"],
      ["execution:exec_partial", "partial"],
      ["execution:exec_submitted", "queued"],
      ["execution:exec_signed", "queued"],
      ["execution:exec_queued", "queued"]
    ]);
  });

  it("marks all owner Agent ids in the public feed as owner wallet scope", () => {
    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents: [
        { ...mockPlatformSnapshot.intents[0], agentId: "agent_1", id: "intent_owner_current" },
        { ...mockPlatformSnapshot.intents[1], agentId: "agent_2", id: "intent_owner_previous" },
        { ...mockPlatformSnapshot.intents[1], agentId: "agent_3", id: "intent_public" }
      ],
      executions: [],
      leaderboard: [],
      ownerAgentIds: ["agent_1", "agent_2"]
    });

    expect(items.find((item) => item.id === "intent:intent_owner_current")).toMatchObject({ walletScope: "owner" });
    expect(items.find((item) => item.id === "intent:intent_owner_previous")).toMatchObject({ walletScope: "owner" });
    expect(items.find((item) => item.id === "intent:intent_public")).toMatchObject({ walletScope: "public" });
  });

  it("maps every intent feed status explicitly", () => {
    const expectedStatuses: Array<[IntentStatus, "accepted" | "rejected" | "executed" | "failed" | "partial"]> = [
      ["accepted", "accepted"],
      ["rejected", "rejected"],
      ["executed", "executed"],
      ["partial", "partial"],
      ["failed", "failed"]
    ];
    const intents: AgentIntent[] = expectedStatuses.map(([status], index) => ({
      ...mockPlatformSnapshot.intents[0],
      id: `intent_status_${status}`,
      status,
      rejectionCode: status === "rejected" ? "RISK_LIMIT_EXCEEDED" : null,
      createdAt: `2026-06-16T10:${String(index).padStart(2, "0")}:00.000Z`
    }));

    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents,
      executions: [],
      leaderboard: []
    });

    expect(items.map((item) => [item.id, item.status])).toEqual([
      ["intent:intent_status_failed", "failed"],
      ["intent:intent_status_partial", "partial"],
      ["intent:intent_status_executed", "executed"],
      ["intent:intent_status_rejected", "rejected"],
      ["intent:intent_status_accepted", "accepted"]
    ]);
  });

  it("preserves valid non-opening Agent actions in the public feed", () => {
    const expectedActions: AgentAction[] = ["add", "switch_direction", "adjust_range"];
    const intents: AgentIntent[] = expectedActions.map((action, index) => ({
      ...mockPlatformSnapshot.intents[0],
      id: `intent_${action}`,
      action,
      status: "accepted",
      createdAt: `2026-06-16T10:${String(index).padStart(2, "0")}:00.000Z`
    }));

    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents,
      executions: [],
      leaderboard: []
    });

    expect(items.map((item) => [item.id, item.action])).toEqual([
      ["intent:intent_adjust_range", "adjust_range"],
      ["intent:intent_switch_direction", "switch_direction"],
      ["intent:intent_add", "add"]
    ]);
  });
});
