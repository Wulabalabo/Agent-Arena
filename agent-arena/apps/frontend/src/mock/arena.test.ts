import { describe, expect, it } from "vitest";
import { getAgentById, getRoundById, getSortedAgents, mockAgents, mockArenaRounds, mockUserBackings } from "./arena";

describe("arena mock data", () => {
  it("provides enough deterministic data for the MVP Arena", () => {
    expect(mockArenaRounds).toHaveLength(3);
    expect(mockAgents.length).toBeGreaterThanOrEqual(6);

    for (const round of mockArenaRounds) {
      expect(round.id).toBeTruthy();
      expect(round.marketSymbol).toBeTruthy();
      expect(round.durationLabel).toBeTruthy();
      expect(round.status).toMatch(/^(upcoming|locking|live|settling|settled)$/);
      expect(round.startsAt).toBeTruthy();
      expect(round.locksAt).toBeTruthy();
      expect(round.endsAt).toBeTruthy();
      expect(round.predictOracleId).toBeTruthy();
      expect(round.predictExpiry).toBeTruthy();
      expect(round.predictExpiry).toBe(round.endsAt);
      expect(new Date(round.startsAt).getTime() - new Date(round.locksAt).getTime()).toBe(30_000);
    }

    const liveRound = mockArenaRounds[0];
    const upcomingRound = mockArenaRounds[1];
    const settledRound = mockArenaRounds[2];

    expect(liveRound.candles).toHaveLength(20);
    expect(liveRound.tradeMarkers).toHaveLength(10);
    expect(upcomingRound.candles).toHaveLength(0);
    expect(upcomingRound.tradeMarkers).toHaveLength(0);

    const isWithinWindow = (timestamp: string, round = liveRound) => {
      const value = new Date(timestamp).getTime();
      return value >= new Date(round.startsAt).getTime() && value <= new Date(round.endsAt).getTime();
    };

    for (const candle of liveRound.candles) {
      expect(isWithinWindow(candle.timestamp)).toBe(true);
    }
    for (const marker of liveRound.tradeMarkers) {
      expect(isWithinWindow(marker.timestamp)).toBe(true);
    }
    for (const candle of settledRound.candles) {
      expect(isWithinWindow(candle.timestamp, settledRound)).toBe(true);
    }
    for (const marker of settledRound.tradeMarkers) {
      expect(isWithinWindow(marker.timestamp, settledRound)).toBe(true);
    }

    expect(upcomingRound.agentStates.every((state) => state.status === "flat" && state.currentExposure === "waiting for open")).toBe(true);
    expect(mockUserBackings.some((backing) => backing.status === "live")).toBe(true);
    expect(mockUserBackings.some((backing) => backing.status === "redeemed")).toBe(true);
  });

  it("keeps the user decision object Agent-first", () => {
    for (const agent of mockAgents) {
      expect(agent.name).toBeTruthy();
      expect(agent.strategyType).toBeTruthy();
      expect(agent.supportedPositionTypes.length).toBeGreaterThan(0);
    }
  });

  it("supports the arena lookup and sort helpers", () => {
    expect(getAgentById(mockAgents, "oracle-hunter").name).toBe("Oracle Hunter");
    expect(getRoundById(mockArenaRounds, "round-sui-1h").marketSymbol).toBe("SUI");

    const winRateTieAgents = [
      { ...mockAgents[3], id: "tie-high", winRate: 0.81, popularityRank: 2 },
      { ...mockAgents[4], id: "tie-low", winRate: 0.81, popularityRank: 1 }
    ];
    expect(getSortedAgents(winRateTieAgents, "winRate").map((agent) => agent.id)).toEqual([
      "tie-low",
      "tie-high"
    ]);

    const backingVolumeTieAgents = [
      { ...mockAgents[0], id: "volume-high", backingVolume: 5000, popularityRank: 2 },
      { ...mockAgents[1], id: "volume-low", backingVolume: 5000, popularityRank: 1 }
    ];
    expect(getSortedAgents(backingVolumeTieAgents, "backingVolume").map((agent) => agent.id)).toEqual([
      "volume-low",
      "volume-high"
    ]);

    const riskAdjustedTieAgents = [
      { ...mockAgents[1], id: "risk-high", maxDrawdown: 0.05, popularityRank: 3 },
      { ...mockAgents[2], id: "risk-low", maxDrawdown: 0.05, popularityRank: 1 }
    ];
    expect(getSortedAgents(riskAdjustedTieAgents, "riskAdjusted").map((agent) => agent.id)).toEqual([
      "risk-low",
      "risk-high"
    ]);

    const leaderboardTieAgents = [
      { ...mockAgents[0], id: "leaderboard-fast", popularityRank: 7, winRate: 0.83 },
      { ...mockAgents[1], id: "leaderboard-slow", popularityRank: 7, winRate: 0.72 }
    ];
    expect(getSortedAgents(leaderboardTieAgents, "leaderboard").map((agent) => agent.id)).toEqual([
      "leaderboard-fast",
      "leaderboard-slow"
    ]);

    expect(getSortedAgents(mockAgents, "riskAdjusted").map((agent) => agent.id)).toEqual([
      "risk-shield",
      "liquidity-sense",
      "mean-reversion-monk",
      "volatility-sniper",
      "momentum-burst",
      "oracle-hunter"
    ]);

    expect(getSortedAgents(mockAgents, "recentForm").map((agent) => agent.id)).toEqual([
      "volatility-sniper",
      "liquidity-sense",
      "mean-reversion-monk",
      "momentum-burst",
      "oracle-hunter",
      "risk-shield"
    ]);

    expect(getSortedAgents(mockAgents, "leaderboard").map((agent) => agent.id)).toEqual([
      "volatility-sniper",
      "mean-reversion-monk",
      "momentum-burst",
      "liquidity-sense",
      "oracle-hunter",
      "risk-shield"
    ]);
  });
});
