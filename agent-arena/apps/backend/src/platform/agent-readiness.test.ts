import { describe, expect, it } from "bun:test";
import { createMarketSnapshot } from "./market-snapshot";
import { createAgentReadiness } from "./agent-readiness";
import {
  type AgentAction,
  type AgentPositionSnapshot,
  createMockCompetition,
  type MarketSnapshot,
  type TradingWallet
} from "./types";

const fundedReadyWallet: TradingWallet = {
  id: "wallet_1",
  agentId: "agent_1",
  address: "0xwallet",
  status: "active",
  testnetSuiBalance: "1000000000",
  quoteBalance: "10000000",
  predictManagerStatus: "ready",
  predictManagerId: "0xmanager",
  createdAt: "2026-06-15T00:00:00.000Z"
};

describe("createAgentReadiness", () => {
  it("blocks open_range when no executable range market is published", () => {
    const competition = createMockCompetition("btc-15m-001");
    const marketState = {
      ...createMarketSnapshot(competition, Date.parse("2026-06-15T10:05:00.000Z")),
      lateWindow: {
        isFinalMinute: false,
        openAllowedByPlatform: true,
        openMayFailOnPredictQuote: false
      }
    };

    const readiness = createAgentReadiness({
      agentId: "agent_1",
      competition,
      marketState,
      wallet: fundedReadyWallet,
      positions: [],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-15T10:05:00.000Z")
    });

    expect(competition.allowedActions).toContain("open_range");
    expect(readiness.actions.open_range.status).toBe("blocked");
    expect(readiness.actions.open_range.reasons.map((reason) => reason.code))
      .toContain("NO_EXECUTABLE_RANGE_MARKET");
  });

  it("blocks exposure-changing open actions when quote balance is below 10000000 raw DUSDC", () => {
    const competition = createMockCompetition("btc-15m-001");
    const marketState = createOpenExecutableMarketState(competition);
    const lowBalanceWallet = {
      ...fundedReadyWallet,
      quoteBalance: "9999999"
    };

    const readiness = createAgentReadiness({
      agentId: "agent_1",
      competition,
      marketState,
      wallet: lowBalanceWallet,
      positions: [],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-15T10:05:00.000Z")
    });

    expect(readiness.actions.open_directional.status).toBe("blocked");
    expect(readiness.actions.open_directional.reasons.map((reason) => reason.code))
      .toContain("WALLET_NOT_FUNDED");
    expect(readiness.actions.open_range.status).toBe("blocked");
    expect(readiness.actions.open_range.reasons.map((reason) => reason.code))
      .toContain("WALLET_NOT_FUNDED");
  });

  it("blocks open actions when the trading wallet is detached", () => {
    const competition = createMockCompetition("btc-15m-001");
    const marketState = createOpenExecutableMarketState(competition);
    const detachedWallet: TradingWallet = {
      ...fundedReadyWallet,
      status: "detached",
      quoteBalance: "10000000",
      predictManagerStatus: "ready"
    };

    const readiness = createAgentReadiness({
      agentId: "agent_1",
      competition,
      marketState,
      wallet: detachedWallet,
      positions: [],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-15T10:05:00.000Z")
    });

    expect(readiness.actions.open_directional.status).toBe("blocked");
    expect(readiness.actions.open_directional.reasons.map((reason) => reason.code))
      .toContain("WALLET_NOT_BOUND");
    expect(readiness.actions.open_range.status).toBe("blocked");
    expect(readiness.actions.open_range.reasons.map((reason) => reason.code))
      .toContain("WALLET_NOT_BOUND");
  });

  it("blocks open_directional when the action is not allowed", () => {
    const allowedActions: AgentAction[] = ["hold", "open_range", "reduce", "close"];
    const competition = {
      ...createMockCompetition("btc-15m-001"),
      allowedActions
    };

    const readiness = createAgentReadiness({
      agentId: "agent_1",
      competition,
      marketState: createOpenExecutableMarketState(competition),
      wallet: fundedReadyWallet,
      positions: [],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-15T10:05:00.000Z")
    });

    expect(readiness.actions.open_directional.status).toBe("blocked");
    expect(readiness.actions.open_directional.reasons.map((reason) => reason.code))
      .toContain("ACTION_NOT_ALLOWED");
  });

  it("blocks reduce and close when those actions are not allowed even with actionable positions", () => {
    const allowedActions: AgentAction[] = ["hold", "open_directional", "open_range"];
    const competition = {
      ...createMockCompetition("btc-15m-001"),
      allowedActions
    };

    const readiness = createAgentReadiness({
      agentId: "agent_1",
      competition,
      marketState: createOpenExecutableMarketState(competition),
      wallet: fundedReadyWallet,
      positions: [
        createPositionSnapshot("open"),
        createPositionSnapshot("reduced")
      ],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-15T10:05:00.000Z")
    });

    expect(readiness.actions.reduce.status).toBe("blocked");
    expect(readiness.actions.reduce.reasons.map((reason) => reason.code))
      .toContain("ACTION_NOT_ALLOWED");
    expect(readiness.actions.close.status).toBe("blocked");
    expect(readiness.actions.close.reasons.map((reason) => reason.code))
      .toContain("ACTION_NOT_ALLOWED");
  });
});

function createOpenExecutableMarketState(competition = createMockCompetition("btc-15m-001")): MarketSnapshot {
  return {
    ...createMarketSnapshot(competition, Date.parse("2026-06-15T10:05:00.000Z")),
    executableMarkets: {
      directional: {
        oracleId: "0xbtc15m",
        expiry: "1781518500000",
        strike: "65000000000000"
      },
      range: {
        oracleId: "0xbtc15m",
        expiry: "1781518500000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000"
      }
    },
    lateWindow: {
      isFinalMinute: false,
      openAllowedByPlatform: true,
      openMayFailOnPredictQuote: false
    }
  };
}

function createPositionSnapshot(status: "open" | "reduced"): AgentPositionSnapshot {
  return {
    agentId: "agent_1",
    competitionId: "btc-15m-001",
    positionRef: {
      kind: "directional",
      marketKey: `btc-directional-${status}`,
      openExecutionId: `exec_${status}`
    },
    oracleId: "0xbtc15m",
    expiryMs: "1781518500000",
    strikeRaw: "65000000000000",
    direction: "up",
    quantityRaw: "500000",
    status,
    updatedAt: "2026-06-15T10:05:00.000Z"
  };
}
