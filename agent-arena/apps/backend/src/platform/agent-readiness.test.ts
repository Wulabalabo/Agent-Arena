import { describe, expect, it } from "bun:test";
import { createMarketSnapshot } from "./market-snapshot";
import { createAgentReadiness } from "./agent-readiness";
import {
  createMockCompetition,
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
    const marketState = {
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
});
