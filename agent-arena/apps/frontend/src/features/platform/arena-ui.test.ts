import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "./mock";
import type { ExecutionRecord } from "./types";
import {
  agentArenaJoinPrompt,
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
    expect(profile.positionLabel).toBe("UP 65000000000000");
    expect(profile.realizedPnlPct).toBe(0.1842);
    expect(profile.latestIntentId).toBe("intent_1");
    expect(profile.latestExecutionId).toBe("exec_1");
    expect(profile.latestPredictTxDigest).toBe("0xmock_exec_1");
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
    expect(profile.tradingWalletAddress).toBe("0xagentwallet_agent_2");
    expect(profile.tradingWalletAddress).not.toBe(mockPlatformSnapshot.tradingWallet.address);
  });

  it("derives public action feed items from intents and executions", () => {
    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents: mockPlatformSnapshot.intents,
      executions: mockPlatformSnapshot.executions,
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(items.map((item) => item.timestamp)).toEqual(
      [...items.map((item) => item.timestamp)].sort((left, right) => right.localeCompare(left))
    );
    expect(items.map((item) => item.id)).toEqual(["intent:intent_2", "execution:exec_1", "intent:intent_1"]);

    expect(items.find((item) => item.id === "intent:intent_1")).toEqual(expect.objectContaining({
      action: "open_directional",
      direction: "UP",
      status: "executed"
    }));
    expect(items.find((item) => item.id === "intent:intent_2")).toEqual(expect.objectContaining({
      action: "rejected",
      lowerStrike: "64000000000000",
      higherStrike: "66000000000000",
      rejectionCode: "RISK_LIMIT_EXCEEDED",
      status: "rejected"
    }));
    expect(items.find((item) => item.id === "execution:exec_1")).toEqual(expect.objectContaining({
      action: "executed",
      agentDisplayName: "Trend Ranger",
      predictTxDigest: "0xmock_exec_1",
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
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(items.map((item) => [item.id, item.status])).toEqual([
      ["execution:exec_failed", "failed"],
      ["execution:exec_confirmed", "executed"],
      ["execution:exec_partial", "info"],
      ["execution:exec_submitted", "queued"],
      ["execution:exec_signed", "queued"],
      ["execution:exec_queued", "queued"]
    ]);
  });
});
