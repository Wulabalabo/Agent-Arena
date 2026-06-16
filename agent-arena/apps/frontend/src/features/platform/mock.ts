import type { PlatformSnapshot } from "./types";

export const mockPlatformSnapshot: PlatformSnapshot = {
  agents: [
    {
      id: "agent_1",
      displayName: "Trend Ranger",
      twitterHandle: "Sui_Agent",
      twitterVerified: false,
      ownerAddress: "0xowner_agent_1",
      tradingWalletAddress: "0xagentwallet_agent_1",
      runtimeStatus: "active",
      exposureStatus: "directional",
      createdAt: "2026-06-15T10:00:00.000Z"
    },
    {
      id: "agent_2",
      displayName: "Range Cartographer",
      twitterHandle: null,
      twitterVerified: false,
      ownerAddress: "0xowner_agent_2",
      tradingWalletAddress: "0xagentwallet_agent_2",
      runtimeStatus: "waiting",
      exposureStatus: "flat",
      createdAt: "2026-06-15T10:01:00.000Z"
    }
  ],
  tradingWallet: {
    id: "wallet_agent_1",
    agentId: "agent_1",
    address: "0xagentwallet_agent_1",
    testnetSuiBalance: "4.20",
    quoteBalance: "125.00",
    predictManagerStatus: "ready",
    createdAt: "2026-06-15T10:00:30.000Z"
  },
  competitions: [
    {
      id: "btc-15m-001",
      name: "BTC 15m Testnet Arena",
      marketSymbol: "BTC-USD",
      durationSeconds: 900,
      oracleId: "0xbtc15m",
      predictObjectId: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
      allowedActions: ["hold", "open_directional", "open_range", "reduce", "close"],
      status: "live",
      startsAt: "2026-06-15T10:00:00.000Z",
      expiresAt: "2026-06-15T10:15:00.000Z",
      settlesAt: null,
      registeredAgentCount: 12,
      activeAgentCount: 8,
      latestExecutionCount: 24
    }
  ],
  latestIntent: {
    id: "intent_1",
    competitionId: "btc-15m-001",
    agentId: "agent_1",
    idempotencyKey: "trend-ranger-btc-15m-001-0007",
    action: "open_directional",
    status: "executed",
    confidence: 0.72,
    reason: "Momentum remains above VWAP with rising oracle forward.",
    rejectionCode: null,
    createdAt: "2026-06-15T10:03:12.000Z",
    marketSymbol: "BTC-USD",
    quantity: "10",
    maxCost: "5.00"
  },
  intents: [
    {
      id: "intent_1",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      idempotencyKey: "trend-ranger-btc-15m-001-0007",
      action: "open_directional",
      status: "executed",
      confidence: 0.72,
      reason: "Momentum remains above VWAP with rising oracle forward.",
      rejectionCode: null,
      createdAt: "2026-06-15T10:03:12.000Z",
      marketSymbol: "BTC-USD",
      quantity: "10",
      maxCost: "5.00"
    },
    {
      id: "intent_2",
      competitionId: "btc-15m-001",
      agentId: "agent_2",
      idempotencyKey: "range-cartographer-btc-15m-001-0003",
      action: "open_range",
      status: "rejected",
      confidence: 0.61,
      reason: "Range premium looked favorable, but requested notional exceeded round policy.",
      rejectionCode: "RISK_LIMIT_EXCEEDED",
      createdAt: "2026-06-15T10:04:44.000Z",
      marketSymbol: "BTC-USD",
      quantity: "30",
      maxCost: "42.00"
    }
  ],
  riskDecisions: [
    {
      id: "risk_1",
      intentId: "intent_1",
      accepted: true,
      rejectionCode: null,
      reason: "Intent is within wallet exposure and cooldown limits.",
      createdAt: "2026-06-15T10:03:13.000Z"
    },
    {
      id: "risk_2",
      intentId: "intent_2",
      accepted: false,
      rejectionCode: "RISK_LIMIT_EXCEEDED",
      reason: "Requested max cost exceeds per-round risk budget.",
      createdAt: "2026-06-15T10:04:45.000Z"
    }
  ],
  executions: [
    {
      id: "exec_1",
      intentId: "intent_1",
      agentId: "agent_1",
      competitionId: "btc-15m-001",
      riskDecisionId: "risk_1",
      status: "confirmed",
      predictTxDigest: "0xmock_exec_1",
      action: "open_directional",
      createdAt: "2026-06-15T10:03:16.000Z"
    }
  ],
  leaderboard: [
    {
      rank: 1,
      agentId: "agent_1",
      displayName: "Trend Ranger",
      twitterHandle: "Sui_Agent",
      twitterVerified: false,
      score: 28.49,
      netPnlPct: 0.1842,
      maxDrawdownPct: 0.031,
      capitalEfficiencyPct: 0.8,
      hitRatePct: 0.6,
      executionCount: 6,
      invalidIntentCount: 0,
      finalExecutionAt: "2026-06-15T10:14:00.000Z"
    }
  ],
  replay: [
    {
      id: "replay_1",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      label: "Intent submitted",
      intentId: "intent_1",
      riskDecisionId: null,
      executionId: null,
      predictTxDigest: null,
      createdAt: "2026-06-15T10:03:12.000Z"
    },
    {
      id: "replay_2",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      label: "Risk accepted",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: null,
      predictTxDigest: null,
      createdAt: "2026-06-15T10:03:13.000Z"
    },
    {
      id: "replay_3",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      label: "Predict transaction confirmed",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: "exec_1",
      predictTxDigest: "0xmock_exec_1",
      createdAt: "2026-06-15T10:03:16.000Z"
    }
  ]
};
