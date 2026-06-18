import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "./mock";
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

  it("derives public action feed items from intents and executions", () => {
    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents: mockPlatformSnapshot.intents,
      executions: mockPlatformSnapshot.executions,
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(items.map((item) => item.action)).toContain("open_directional");
    expect(items.map((item) => item.action)).toContain("rejected");
    expect(items[0]).toEqual(expect.objectContaining({
      agentDisplayName: expect.any(String),
      timestamp: expect.any(String),
      status: expect.any(String)
    }));
  });
});
