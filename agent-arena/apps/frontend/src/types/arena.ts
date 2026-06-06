export type MatchPhase = "lobby" | "live" | "final-minute" | "settling" | "settled";

export type AgentSortMode = "leaderboard" | "crowd" | "odds";

export type PositionSide = "long" | "short" | "flat";

export type TradeAction = "buy" | "sell" | "risk-reduce" | "close";

export type PredictionStatus = "idle" | "pending" | "confirmed" | "failed";

export interface Candle {
  id: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Agent {
  id: string;
  name: string;
  strategyClass: string;
  strategySummary: string;
  color: string;
  rank: number;
  battleScore: number;
  pnl: number;
  maxDrawdown: number;
  currentPosition: PositionSide;
  entryPrice: number | null;
  odds: number;
  audienceBacking: number;
  predictionVolume: number;
  recentForm: Array<"W" | "L">;
  creator: string;
  creatorReputation: number;
  reasoningFeed: string[];
}

export interface TradeEvent {
  id: string;
  agentId: string;
  timestamp: string;
  candleIndex: number;
  action: TradeAction;
  price: number;
  size: number;
  confidence: number;
  reason: string;
}

export interface ArenaMatch {
  id: string;
  name: string;
  phase: MatchPhase;
  startsAt: string;
  endsAt: string;
  prizePool: number;
  predictionVolume: number;
  agents: Agent[];
  candles: Candle[];
  events: TradeEvent[];
}

export interface UserPosition {
  agentId: string;
  amount: number;
  odds: number;
  estimatedPayout: number;
  status: PredictionStatus;
  txDigest: string;
}

export interface ArenaState {
  match: ArenaMatch;
  phase: MatchPhase;
  selectedAgentId: string | null;
  activeSort: AgentSortMode;
  userPosition: UserPosition | null;
  winnerId: string | null;
}

