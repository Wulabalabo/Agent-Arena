import type { Agent, AgentSortMode, ArenaMatch } from "../types/arena";

const agents: Agent[] = [
  {
    id: "volatility-sniper",
    name: "Volatility Sniper",
    avatar: "V7",
    strategyClass: "Volatility",
    strategySummary: "Trades expiry volatility expansion and reduces exposure when spreads widen.",
    color: "#4da2ff",
    rank: 1,
    battleScore: 84.7,
    pnl: 18.4,
    maxDrawdown: 4.2,
    currentPosition: "long",
    entryPrice: 0.63,
    odds: 2.4,
    audienceBacking: 138,
    predictionVolume: 4200,
    recentForm: ["W", "W", "L", "W"],
    creator: "0x9f...arena",
    creatorReputation: 92,
    reasoningFeed: [
      "Volatility expanded near expiry while spread tightened.",
      "Maintaining long exposure while downside wick remains shallow.",
      "Confidence raised after crowd odds lagged price momentum."
    ]
  },
  {
    id: "mean-reversion-monk",
    name: "Mean Reversion Monk",
    avatar: "MR",
    strategyClass: "Mean Reversion",
    strategySummary: "Fades extreme moves and favors lower drawdown over peak PnL.",
    color: "#ffb95f",
    rank: 2,
    battleScore: 78.2,
    pnl: 13.1,
    maxDrawdown: 2.8,
    currentPosition: "short",
    entryPrice: 0.69,
    odds: 3.1,
    audienceBacking: 112,
    predictionVolume: 3500,
    recentForm: ["W", "L", "W", "W"],
    creator: "0x41...zen",
    creatorReputation: 88,
    reasoningFeed: [
      "Price moved two deviations above local mean.",
      "Short entry sized smaller because orderbook depth is uneven.",
      "Risk shield active until candle closes below 0.66."
    ]
  },
  {
    id: "momentum-burst",
    name: "Momentum Burst",
    avatar: "MB",
    strategyClass: "Momentum",
    strategySummary: "Follows trend acceleration and adds when candle bodies expand.",
    color: "#5ee6a7",
    rank: 3,
    battleScore: 72.9,
    pnl: 15.7,
    maxDrawdown: 7.1,
    currentPosition: "long",
    entryPrice: 0.58,
    odds: 4.5,
    audienceBacking: 96,
    predictionVolume: 2800,
    recentForm: ["L", "W", "W", "L"],
    creator: "0xa7...run",
    creatorReputation: 81,
    reasoningFeed: [
      "Trend acceleration confirmed by three higher closes.",
      "Holding through noise because candle range remains constructive."
    ]
  },
  {
    id: "liquidity-sense",
    name: "Liquidity Sense",
    avatar: "LS",
    strategyClass: "Orderbook",
    strategySummary: "Reads depth, spread, and adverse selection before entering.",
    color: "#a2c9ff",
    rank: 4,
    battleScore: 68.4,
    pnl: 9.5,
    maxDrawdown: 1.9,
    currentPosition: "flat",
    entryPrice: null,
    odds: 5.2,
    audienceBacking: 84,
    predictionVolume: 2100,
    recentForm: ["W", "W", "W", "L"],
    creator: "0xd2...book",
    creatorReputation: 95,
    reasoningFeed: [
      "Standing down until liquidity improves near the bid.",
      "Avoiding entry because spread cost would consume expected edge."
    ]
  },
  {
    id: "oracle-hunter",
    name: "Oracle Hunter",
    avatar: "OH",
    strategyClass: "Oracle Reactive",
    strategySummary: "Targets dislocations between market odds and oracle-implied fair value.",
    color: "#c4c6cd",
    rank: 5,
    battleScore: 63.6,
    pnl: 11.2,
    maxDrawdown: 8.4,
    currentPosition: "long",
    entryPrice: 0.61,
    odds: 6.8,
    audienceBacking: 71,
    predictionVolume: 1800,
    recentForm: ["L", "L", "W", "W"],
    creator: "0x0c...seek",
    creatorReputation: 76,
    reasoningFeed: [
      "Oracle trend still above market-implied probability.",
      "Position remains valid until fair value converges below 0.60."
    ]
  },
  {
    id: "risk-shield",
    name: "Risk Shield",
    avatar: "RS",
    strategyClass: "Defensive",
    strategySummary: "Optimizes for battle score by minimizing drawdown penalties.",
    color: "#ffb4ab",
    rank: 6,
    battleScore: 59.8,
    pnl: 6.4,
    maxDrawdown: 1.2,
    currentPosition: "flat",
    entryPrice: null,
    odds: 8.2,
    audienceBacking: 53,
    predictionVolume: 1200,
    recentForm: ["W", "L", "L", "W"],
    creator: "0x72...safe",
    creatorReputation: 84,
    reasoningFeed: [
      "Flat until risk-adjusted entry improves.",
      "Protecting score while leaders take higher variance exposure."
    ]
  }
];

export const mockArenaMatch: ArenaMatch = {
  id: "deepbook-blitz-league",
  name: "DeepBook Blitz League",
  phase: "live",
  startsAt: "2026-06-06T14:50:00+08:00",
  endsAt: "2026-06-06T14:55:00+08:00",
  prizePool: 12500,
  predictionVolume: 15600,
  agents,
  candles: [
    { id: "c1", timestamp: "14:40", open: 0.54, high: 0.57, low: 0.52, close: 0.56 },
    { id: "c2", timestamp: "14:41", open: 0.56, high: 0.58, low: 0.55, close: 0.57 },
    { id: "c3", timestamp: "14:42", open: 0.57, high: 0.61, low: 0.56, close: 0.6 },
    { id: "c4", timestamp: "14:43", open: 0.6, high: 0.62, low: 0.58, close: 0.59 },
    { id: "c5", timestamp: "14:44", open: 0.59, high: 0.64, low: 0.58, close: 0.63 },
    { id: "c6", timestamp: "14:45", open: 0.63, high: 0.66, low: 0.61, close: 0.65 },
    { id: "c7", timestamp: "14:46", open: 0.65, high: 0.68, low: 0.64, close: 0.67 },
    { id: "c8", timestamp: "14:47", open: 0.67, high: 0.7, low: 0.65, close: 0.66 },
    { id: "c9", timestamp: "14:48", open: 0.66, high: 0.69, low: 0.64, close: 0.68 },
    { id: "c10", timestamp: "14:49", open: 0.68, high: 0.71, low: 0.66, close: 0.7 },
    { id: "c11", timestamp: "14:50", open: 0.7, high: 0.72, low: 0.67, close: 0.69 },
    { id: "c12", timestamp: "14:51", open: 0.69, high: 0.73, low: 0.68, close: 0.72 },
    { id: "c13", timestamp: "14:52", open: 0.72, high: 0.74, low: 0.7, close: 0.71 },
    { id: "c14", timestamp: "14:53", open: 0.71, high: 0.75, low: 0.7, close: 0.74 }
  ],
  events: [
    {
      id: "e1",
      agentId: "momentum-burst",
      timestamp: "14:42",
      candleIndex: 2,
      action: "buy",
      price: 0.6,
      size: 120,
      confidence: 69,
      reason: "Three-candle acceleration confirmed a breakout attempt."
    },
    {
      id: "e2",
      agentId: "volatility-sniper",
      timestamp: "14:44",
      candleIndex: 4,
      action: "buy",
      price: 0.63,
      size: 140,
      confidence: 72,
      reason: "Volatility expanded near expiry while spread tightened."
    },
    {
      id: "e3",
      agentId: "mean-reversion-monk",
      timestamp: "14:47",
      candleIndex: 7,
      action: "sell",
      price: 0.69,
      size: 90,
      confidence: 64,
      reason: "Price stretched above local fair value and momentum slowed."
    },
    {
      id: "e4",
      agentId: "risk-shield",
      timestamp: "14:48",
      candleIndex: 8,
      action: "risk-reduce",
      price: 0.68,
      size: 0,
      confidence: 81,
      reason: "Drawdown penalty risk exceeded expected upside."
    },
    {
      id: "e5",
      agentId: "oracle-hunter",
      timestamp: "14:49",
      candleIndex: 9,
      action: "buy",
      price: 0.7,
      size: 110,
      confidence: 61,
      reason: "Oracle-implied fair value remained above market probability."
    },
    {
      id: "e6",
      agentId: "liquidity-sense",
      timestamp: "14:50",
      candleIndex: 10,
      action: "close",
      price: 0.69,
      size: 60,
      confidence: 77,
      reason: "Orderbook spread widened enough to reduce edge."
    },
    {
      id: "e7",
      agentId: "volatility-sniper",
      timestamp: "14:52",
      candleIndex: 12,
      action: "risk-reduce",
      price: 0.71,
      size: 40,
      confidence: 74,
      reason: "Partial risk reduction protects battle score lead."
    }
  ]
};

export function getSortedAgents(agentsToSort: Agent[], mode: AgentSortMode): Agent[] {
  return [...agentsToSort].sort((left, right) => {
    if (mode === "crowd") {
      return right.audienceBacking - left.audienceBacking;
    }

    if (mode === "odds") {
      return right.odds - left.odds;
    }

    return right.battleScore - left.battleScore;
  });
}

export function getAgentById(match: ArenaMatch, agentId: string): Agent {
  const agent = match.agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  return agent;
}

export function getMarketStatement(agent: Agent): string {
  return `Will ${agent.name} finish rank 1?`;
}
