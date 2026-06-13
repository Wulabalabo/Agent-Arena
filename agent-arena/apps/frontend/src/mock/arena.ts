import type {
  Agent,
  AgentRoundState,
  AgentSortMode,
  ArenaRound,
  BackingPosition,
  Candle,
  PredictPositionDescriptor,
  TradeAction,
  TradeMarker
} from "../types/arena";

const round1Id = "round-btc-15m";
const round2Id = "round-eth-30m";
const round3Id = "round-sui-1h";

const pad2 = (value: number): string => String(value).padStart(2, "0");

const timestampAt = (
  date: string,
  startHour: number,
  startMinute: number,
  startSecond: number,
  offsetSeconds: number
): string => {
  const totalSeconds = startHour * 3600 + startMinute * 60 + startSecond + offsetSeconds;
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;

  return `${date}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+08:00`;
};

const makeCandle = (id: string, timestamp: string, open: number, high: number, low: number, close: number): Candle => ({
  id,
  timestamp,
  open,
  high,
  low,
  close
});

const makeMarker = (
  id: string,
  roundId: string,
  agentId: string,
  timestamp: string,
  candleIndex: number,
  action: TradeAction,
  price: number,
  confidence: number,
  reason: string,
  predictPosition: PredictPositionDescriptor
): TradeMarker => ({
  id,
  roundId,
  agentId,
  timestamp,
  candleIndex,
  action,
  price,
  confidence,
  reason,
  predictPosition
});

const createAgentStates = (
  roundId: string,
  entries: Array<{
    agentId: string;
    status: AgentRoundState["status"];
    currentExposure: string;
    floatingPnl: number;
    lastAction: AgentRoundState["lastAction"];
    lastReason: string;
    finalRoi: number | null;
  }>
): AgentRoundState[] =>
  entries.map((entry) => ({
    roundId,
    agentId: entry.agentId,
    status: entry.status,
    currentExposure: entry.currentExposure,
    floatingPnl: entry.floatingPnl,
    lastAction: entry.lastAction,
    lastReason: entry.lastReason,
    finalRoi: entry.finalRoi
  }));

const countWins = (agent: Agent): number => agent.recentForm.filter((result) => result === "W").length;

export const mockAgents: Agent[] = [
  {
    id: "volatility-sniper",
    name: "Volatility Sniper",
    avatar: "VS",
    color: "#4da2ff",
    model: "gpt-4.1",
    reasoningDepth: "high",
    strategyType: "Volatility Expansion",
    strategySummary: "Trades breakouts after spread compression and exits when the move loses momentum.",
    dataInputs: ["BTC 1m candles", "spread compression", "implied volatility"],
    winRate: 0.74,
    historicalRoi: 0.31,
    maxDrawdown: 0.08,
    recentForm: ["W", "W", "L", "W", "W"],
    riskLabel: "balanced",
    supportedPositionTypes: ["directional"],
    popularityRank: 1,
    backingVolume: 18450
  },
  {
    id: "mean-reversion-monk",
    name: "Mean Reversion Monk",
    avatar: "MM",
    color: "#ffb95f",
    model: "o4-mini",
    reasoningDepth: "medium",
    strategyType: "Mean Reversion",
    strategySummary: "Fades stretched moves when orderbook imbalance drifts back toward equilibrium.",
    dataInputs: ["orderbook depth", "VWAP bands", "liquidity skew"],
    winRate: 0.69,
    historicalRoi: 0.24,
    maxDrawdown: 0.05,
    recentForm: ["W", "L", "W", "W", "L"],
    riskLabel: "defensive",
    supportedPositionTypes: ["directional", "range"],
    popularityRank: 2,
    backingVolume: 15320
  },
  {
    id: "momentum-burst",
    name: "Momentum Burst",
    avatar: "MB",
    color: "#5ee6a7",
    model: "gpt-5.2",
    reasoningDepth: "high",
    strategyType: "Momentum Breakout",
    strategySummary: "Adds into trend acceleration when candle bodies expand and momentum stays intact.",
    dataInputs: ["price velocity", "funding flips", "candle body expansion"],
    winRate: 0.64,
    historicalRoi: 0.27,
    maxDrawdown: 0.11,
    recentForm: ["L", "W", "W", "L", "W"],
    riskLabel: "aggressive",
    supportedPositionTypes: ["directional"],
    popularityRank: 3,
    backingVolume: 13240
  },
  {
    id: "liquidity-sense",
    name: "Liquidity Sense",
    avatar: "LS",
    color: "#a2c9ff",
    model: "gpt-4.1-mini",
    reasoningDepth: "low",
    strategyType: "Orderbook Arb",
    strategySummary: "Waits for depth recovery and uses range positions only when the spread is clean.",
    dataInputs: ["best bid/ask", "depth delta", "adverse selection"],
    winRate: 0.61,
    historicalRoi: 0.18,
    maxDrawdown: 0.04,
    recentForm: ["W", "W", "W", "L", "W"],
    riskLabel: "defensive",
    supportedPositionTypes: ["directional", "range"],
    popularityRank: 4,
    backingVolume: 10850
  },
  {
    id: "oracle-hunter",
    name: "Oracle Hunter",
    avatar: "OH",
    color: "#c4c6cd",
    model: "o3",
    reasoningDepth: "high",
    strategyType: "Oracle Convergence",
    strategySummary: "Trades the gap between oracle fairness and market pricing before expiry converges.",
    dataInputs: ["oracle fairness", "expiry drift", "probability skew"],
    winRate: 0.58,
    historicalRoi: 0.21,
    maxDrawdown: 0.14,
    recentForm: ["L", "L", "W", "W", "W"],
    riskLabel: "balanced",
    supportedPositionTypes: ["directional"],
    popularityRank: 5,
    backingVolume: 9120
  },
  {
    id: "risk-shield",
    name: "Risk Shield",
    avatar: "RS",
    color: "#ffb4ab",
    model: "gpt-4o-mini",
    reasoningDepth: "low",
    strategyType: "Capital Preservation",
    strategySummary: "Preserves score by staying small and prioritizing downside protection.",
    dataInputs: ["drawdown curve", "variance bands", "settlement risk"],
    winRate: 0.55,
    historicalRoi: 0.12,
    maxDrawdown: 0.03,
    recentForm: ["W", "L", "L", "W", "W"],
    riskLabel: "defensive",
    supportedPositionTypes: ["range"],
    popularityRank: 6,
    backingVolume: 6400
  }
];

const round1Candles: Candle[] = Array.from({ length: 20 }, (_, index) => {
  const open = 67200 + index * 42;
  const close = open + (index % 3 === 0 ? -75 : 95);
  return makeCandle(
    `btc-${pad2(index + 1)}`,
    timestampAt("2026-06-09", 14, 50, 0, index * 45),
    open,
    Math.max(open, close) + 120,
    Math.min(open, close) - 110,
    close
  );
});

const round1TradeMarkers: TradeMarker[] = [
  makeMarker(
    "btc-m1",
    round1Id,
    "volatility-sniper",
    timestampAt("2026-06-09", 14, 50, 0, 30),
    2,
    "enter_long",
    0.61,
    82,
    "Spread compression left enough room for a clean directional breakout.",
    { type: "directional", label: "BTC breakout long", marketKey: "BTC_BREAKOUT_15M", rangeKey: null }
  ),
  makeMarker(
    "btc-m2",
    round1Id,
    "liquidity-sense",
    timestampAt("2026-06-09", 14, 51, 0, 45),
    3,
    "mint_range",
    0.62,
    76,
    "Depth tightened inside a narrow band, so the range structure became attractive.",
    { type: "range", label: "BTC inner range", marketKey: null, rangeKey: "BTC_15M_060_065" }
  ),
  makeMarker(
    "btc-m3",
    round1Id,
    "mean-reversion-monk",
    timestampAt("2026-06-09", 14, 53, 0, 0),
    5,
    "reduce",
    0.64,
    71,
    "Move stretched too far above the anchored mean for a full-size fade.",
    { type: "directional", label: "BTC fade short", marketKey: "BTC_FADE_15M", rangeKey: null }
  ),
  makeMarker(
    "btc-m4",
    round1Id,
    "momentum-burst",
    timestampAt("2026-06-09", 14, 54, 0, 15),
    7,
    "enter_long",
    0.66,
    79,
    "Trend acceleration stayed intact after the mid-session pause.",
    { type: "directional", label: "BTC momentum long", marketKey: "BTC_MOMO_15M", rangeKey: null }
  ),
  makeMarker(
    "btc-m5",
    round1Id,
    "volatility-sniper",
    timestampAt("2026-06-09", 14, 55, 0, 30),
    9,
    "take_profit",
    0.68,
    84,
    "Momentum held but the easy part of the move already paid out.",
    { type: "directional", label: "BTC breakout long", marketKey: "BTC_BREAKOUT_15M", rangeKey: null }
  ),
  makeMarker(
    "btc-m6",
    round1Id,
    "oracle-hunter",
    timestampAt("2026-06-09", 14, 56, 0, 45),
    10,
    "enter_short",
    0.69,
    67,
    "Oracle fair value still lagged the market-implied price.",
    { type: "directional", label: "BTC oracle short", marketKey: "BTC_ORACLE_15M", rangeKey: null }
  ),
  makeMarker(
    "btc-m7",
    round1Id,
    "liquidity-sense",
    timestampAt("2026-06-09", 14, 58, 0, 0),
    12,
    "close",
    0.71,
    73,
    "Range edge weakened as the book widened into the open.",
    { type: "range", label: "BTC inner range", marketKey: null, rangeKey: "BTC_15M_060_065" }
  ),
  makeMarker(
    "btc-m8",
    round1Id,
    "mean-reversion-monk",
    timestampAt("2026-06-09", 14, 59, 0, 15),
    13,
    "reverse",
    0.72,
    69,
    "The fade thesis flipped once the trend established a higher low.",
    { type: "directional", label: "BTC fade short", marketKey: "BTC_FADE_15M", rangeKey: null }
  ),
  makeMarker(
    "btc-m9",
    round1Id,
    "risk-shield",
    timestampAt("2026-06-09", 15, 0, 0, 30),
    15,
    "stop_loss",
    0.74,
    88,
    "Downside protection triggered before drawdown could compound.",
    { type: "range", label: "BTC defense band", marketKey: null, rangeKey: "BTC_15M_DEFENSE" }
  ),
  makeMarker(
    "btc-m10",
    round1Id,
    "momentum-burst",
    timestampAt("2026-06-09", 15, 1, 0, 45),
    17,
    "reduce",
    0.76,
    77,
    "Trend stayed positive, but the follow-through pace started to fade.",
    { type: "directional", label: "BTC momentum long", marketKey: "BTC_MOMO_15M", rangeKey: null }
  )
];

const round3Candles: Candle[] = Array.from({ length: 12 }, (_, index) => {
  const open = 0.4 + index * 0.01;
  const close = open + (index % 2 === 0 ? 0.01 : -0.005);
  return makeCandle(
    `sui-${pad2(index + 1)}`,
    timestampAt("2026-06-08", 18, 0, 0, index * 300),
    open,
    Math.max(open, close) + 0.01,
    Math.min(open, close) - 0.01,
    close
  );
});

const round3TradeMarkers: TradeMarker[] = [
  makeMarker(
    "sui-m1",
    round3Id,
    "oracle-hunter",
    timestampAt("2026-06-08", 18, 10, 0, 0),
    2,
    "enter_long",
    0.42,
    66,
    "Oracle fair value stayed above the market-implied line into expiry.",
    { type: "directional", label: "SUI oracle long", marketKey: "SUI_ORACLE_1H", rangeKey: null }
  ),
  makeMarker(
    "sui-m2",
    round3Id,
    "volatility-sniper",
    timestampAt("2026-06-08", 18, 25, 0, 0),
    5,
    "take_profit",
    0.45,
    80,
    "The upside move hit the target zone ahead of settlement.",
    { type: "directional", label: "SUI breakout long", marketKey: "SUI_BREAKOUT_1H", rangeKey: null }
  ),
  makeMarker(
    "sui-m3",
    round3Id,
    "liquidity-sense",
    timestampAt("2026-06-08", 18, 40, 0, 0),
    8,
    "close",
    0.48,
    72,
    "The range was closed once the edge stopped improving.",
    { type: "range", label: "SUI settlement band", marketKey: null, rangeKey: "SUI_1H_040_048" }
  ),
  makeMarker(
    "sui-m4",
    round3Id,
    "risk-shield",
    timestampAt("2026-06-08", 18, 55, 0, 0),
    11,
    "reduce",
    0.51,
    78,
    "Settlement was already locked in, so exposure was trimmed to protect capital.",
    { type: "range", label: "SUI settlement band", marketKey: null, rangeKey: "SUI_1H_040_048" }
  )
];

const round1AgentStates: AgentRoundState[] = createAgentStates(round1Id, [
  {
    agentId: "volatility-sniper",
    status: "long",
    currentExposure: "0.31 BTC breakout long",
    floatingPnl: 1.8,
    lastAction: "take_profit",
    lastReason: "Held through the impulse and clipped gains into strength.",
    finalRoi: null
  },
  {
    agentId: "mean-reversion-monk",
    status: "short",
    currentExposure: "-0.18 BTC fade short",
    floatingPnl: -0.4,
    lastAction: "reverse",
    lastReason: "The fade thesis rolled over once momentum reclaimed the highs.",
    finalRoi: null
  },
  {
    agentId: "momentum-burst",
    status: "long",
    currentExposure: "0.27 BTC momentum long",
    floatingPnl: 1.2,
    lastAction: "enter_long",
    lastReason: "Stayed with the trend as continuation candles printed cleanly.",
    finalRoi: null
  },
  {
    agentId: "liquidity-sense",
    status: "range",
    currentExposure: "0.22 BTC range",
    floatingPnl: 0.9,
    lastAction: "close",
    lastReason: "Closed the range once book depth stopped improving.",
    finalRoi: null
  },
  {
    agentId: "oracle-hunter",
    status: "long",
    currentExposure: "0.14 BTC oracle long",
    floatingPnl: 0.6,
    lastAction: "enter_long",
    lastReason: "Held until the fair-value gap narrowed.",
    finalRoi: null
  },
  {
    agentId: "risk-shield",
    status: "flat",
    currentExposure: "0.00 BTC",
    floatingPnl: 0,
    lastAction: "reduce",
    lastReason: "Stayed small while the session remained volatile.",
    finalRoi: null
  }
]);

const round2AgentStates: AgentRoundState[] = createAgentStates(round2Id, mockAgents.map((agent) => ({
  agentId: agent.id,
  status: "flat",
  currentExposure: "waiting for open",
  floatingPnl: 0,
  lastAction: "none",
  lastReason: "No trade until the ETH 30m round actually starts.",
  finalRoi: null
})));

const round3AgentStates: AgentRoundState[] = createAgentStates(round3Id, [
  {
    agentId: "volatility-sniper",
    status: "closed",
    currentExposure: "settled long",
    floatingPnl: 2.4,
    lastAction: "take_profit",
    lastReason: "Exited before settlement locked in the final value.",
    finalRoi: 0.29
  },
  {
    agentId: "mean-reversion-monk",
    status: "closed",
    currentExposure: "settled short",
    floatingPnl: 0.8,
    lastAction: "close",
    lastReason: "The fade resolved cleanly after the mean snapped back.",
    finalRoi: 0.16
  },
  {
    agentId: "momentum-burst",
    status: "closed",
    currentExposure: "settled long",
    floatingPnl: 1.6,
    lastAction: "take_profit",
    lastReason: "The late trend carried enough strength to realize gains.",
    finalRoi: 0.21
  },
  {
    agentId: "liquidity-sense",
    status: "closed",
    currentExposure: "settled range",
    floatingPnl: 1.1,
    lastAction: "close",
    lastReason: "Range capture finished once the settlement band stayed intact.",
    finalRoi: 0.18
  },
  {
    agentId: "oracle-hunter",
    status: "closed",
    currentExposure: "settled long",
    floatingPnl: 0.5,
    lastAction: "close",
    lastReason: "The oracle gap narrowed into expiry as expected.",
    finalRoi: 0.14
  },
  {
    agentId: "risk-shield",
    status: "closed",
    currentExposure: "settled range",
    floatingPnl: 0.4,
    lastAction: "reduce",
    lastReason: "Capital preservation stayed intact through the final hour.",
    finalRoi: 0.11
  }
]);

export const mockArenaRounds: ArenaRound[] = [
  {
    id: round1Id,
    marketSymbol: "BTC",
    durationLabel: "15m",
    status: "live",
    startsAt: "2026-06-09T14:50:00+08:00",
    locksAt: "2026-06-09T14:49:30+08:00",
    endsAt: "2026-06-09T15:05:00+08:00",
    predictOracleId: "oracle-btc-15m-20260609",
    predictExpiry: "2026-06-09T15:05:00+08:00",
    totalBackingVolume: 71420,
    agentIds: mockAgents.map((agent) => agent.id),
    candles: round1Candles,
    tradeMarkers: round1TradeMarkers,
    agentStates: round1AgentStates
  },
  {
    id: round2Id,
    marketSymbol: "ETH",
    durationLabel: "30m",
    status: "upcoming",
    startsAt: "2026-06-09T10:00:00+08:00",
    locksAt: "2026-06-09T09:59:30+08:00",
    endsAt: "2026-06-09T10:30:00+08:00",
    predictOracleId: "oracle-eth-30m-20260609",
    predictExpiry: "2026-06-09T10:30:00+08:00",
    totalBackingVolume: 28600,
    agentIds: mockAgents.map((agent) => agent.id),
    candles: [],
    tradeMarkers: [],
    agentStates: round2AgentStates
  },
  {
    id: round3Id,
    marketSymbol: "SUI",
    durationLabel: "1h",
    status: "settled",
    startsAt: "2026-06-08T18:00:00+08:00",
    locksAt: "2026-06-08T17:59:30+08:00",
    endsAt: "2026-06-08T19:00:00+08:00",
    predictOracleId: "oracle-sui-1h-20260608",
    predictExpiry: "2026-06-08T19:00:00+08:00",
    totalBackingVolume: 48950,
    agentIds: mockAgents.map((agent) => agent.id),
    candles: round3Candles,
    tradeMarkers: round3TradeMarkers,
    agentStates: round3AgentStates
  }
];

export const mockUserBackings: BackingPosition[] = [
  {
    id: "backing-live-range",
    userAddress: "0x1111aaaabbbb",
    managerId: "manager-range-1",
    roundId: round1Id,
    agentId: "liquidity-sense",
    amount: 250,
    status: "live",
    createdAt: "2026-06-09T08:58:00+08:00",
    updatedAt: "2026-06-09T09:06:00+08:00",
    predictTxDigest: "0xlive-range-001",
    attributionId: "attr_0xlive-range-001_liquidity-sense",
    attributionStatus: "submitted",
    attributionError: null,
    estimatedValue: 372.5,
    finalValue: null,
    fee: null,
    redeemTxDigest: null,
    predictPositionType: "range",
    marketKey: null,
    rangeKey: "BTC_15M_060_065"
  },
  {
    id: "backing-draft-directional",
    userAddress: "0x2222ccccdddd",
    managerId: null,
    roundId: round2Id,
    agentId: "momentum-burst",
    amount: 120,
    status: "draft",
    createdAt: "2026-06-09T09:40:00+08:00",
    updatedAt: "2026-06-09T09:40:00+08:00",
    predictTxDigest: null,
    attributionId: null,
    attributionStatus: "not_started",
    attributionError: null,
    estimatedValue: 0,
    finalValue: null,
    fee: null,
    redeemTxDigest: null,
    predictPositionType: "directional",
    marketKey: "ETH_MOMO_30M",
    rangeKey: null
  },
  {
    id: "backing-redeemed-positive-range",
    userAddress: "0x3333eeeeffff",
    managerId: "manager-range-2",
    roundId: round3Id,
    agentId: "liquidity-sense",
    amount: 300,
    status: "redeemed",
    createdAt: "2026-06-08T17:55:00+08:00",
    updatedAt: "2026-06-08T19:04:00+08:00",
    predictTxDigest: "0xredeemed-range-001",
    attributionId: "attr_0xredeemed-range-001_liquidity-sense",
    attributionStatus: "redeemed",
    attributionError: null,
    estimatedValue: 440,
    finalValue: 462,
    fee: 3,
    redeemTxDigest: "0xredeem-range-001",
    predictPositionType: "range",
    marketKey: null,
    rangeKey: "SUI_1H_040_048"
  },
  {
    id: "backing-redeemed-negative-directional",
    userAddress: "0x4444aaaacccc",
    managerId: null,
    roundId: round3Id,
    agentId: "oracle-hunter",
    amount: 180,
    status: "redeemed",
    createdAt: "2026-06-08T18:08:00+08:00",
    updatedAt: "2026-06-08T19:06:00+08:00",
    predictTxDigest: "0xredeemed-directional-002",
    attributionId: "attr_0xredeemed-directional-002_oracle-hunter",
    attributionStatus: "redeemed",
    attributionError: null,
    estimatedValue: 132,
    finalValue: 91,
    fee: 2.5,
    redeemTxDigest: "0xredeem-directional-002",
    predictPositionType: "directional",
    marketKey: "SUI_ORACLE_1H",
    rangeKey: null
  }
];

export function getAgentById(agents: Agent[], agentId: string): Agent {
  const agent = agents.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  return agent;
}

export function getRoundById(rounds: ArenaRound[], roundId: string): ArenaRound {
  const round = rounds.find((candidate) => candidate.id === roundId);

  if (!round) {
    throw new Error(`Round not found: ${roundId}`);
  }

  return round;
}

export function getSortedAgents(agentsToSort: Agent[], mode: AgentSortMode): Agent[] {
  return [...agentsToSort].sort((left, right) => {
    switch (mode) {
      case "winRate":
        return right.winRate - left.winRate || left.popularityRank - right.popularityRank;
      case "backingVolume":
        return right.backingVolume - left.backingVolume || left.popularityRank - right.popularityRank;
      case "riskAdjusted":
        return left.maxDrawdown - right.maxDrawdown || left.popularityRank - right.popularityRank;
      case "recentForm":
        return countWins(right) - countWins(left) || left.popularityRank - right.popularityRank;
      case "leaderboard":
      default:
        return left.popularityRank - right.popularityRank || right.winRate - left.winRate;
    }
  });
}
