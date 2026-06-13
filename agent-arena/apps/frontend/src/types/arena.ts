export type RoundStatus = "upcoming" | "locking" | "live" | "settling" | "settled";

export type AgentSortMode = "leaderboard" | "winRate" | "backingVolume" | "riskAdjusted" | "recentForm";

export type ReasoningDepth = "low" | "medium" | "high";

export type RiskLabel = "aggressive" | "balanced" | "defensive";

export type PredictPositionType = "directional" | "range";

export type AttributionSyncStatus =
  | "not_started"
  | "pending"
  | "submitted"
  | "confirmed"
  | "redeemable"
  | "redeemed"
  | "failed";

export type AgentExposureStatus = "flat" | "long" | "short" | "range" | "closed";

export type TradeAction =
  | "enter_long"
  | "enter_short"
  | "mint_range"
  | "reduce"
  | "close"
  | "reverse"
  | "take_profit"
  | "stop_loss";

export type BackingStatus =
  | "draft"
  | "pending_signature"
  | "submitted"
  | "backed"
  | "locked"
  | "live"
  | "redeemable"
  | "redeemed"
  | "cancelled"
  | "failed";

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
  avatar: string;
  color: string;
  model: string;
  reasoningDepth: ReasoningDepth;
  strategyType: string;
  strategySummary: string;
  dataInputs: string[];
  winRate: number;
  historicalRoi: number;
  maxDrawdown: number;
  recentForm: Array<"W" | "L">;
  riskLabel: RiskLabel;
  supportedPositionTypes: PredictPositionType[];
  popularityRank: number;
  backingVolume: number;
}

export interface TradeMarker {
  id: string;
  roundId: string;
  agentId: string;
  timestamp: string;
  candleIndex: number;
  action: TradeAction;
  price: number;
  confidence: number;
  reason: string;
  predictPosition: PredictPositionDescriptor;
}

export interface DirectionalPredictPositionDescriptor {
  type: "directional";
  label: string;
  marketKey: string;
  rangeKey: null;
}

export interface RangePredictPositionDescriptor {
  type: "range";
  label: string;
  marketKey: null;
  rangeKey: string;
}

export type PredictPositionDescriptor =
  | DirectionalPredictPositionDescriptor
  | RangePredictPositionDescriptor;

export interface AgentRoundState {
  roundId: string;
  agentId: string;
  status: AgentExposureStatus;
  currentExposure: string;
  floatingPnl: number;
  lastAction: TradeAction | "none";
  lastReason: string;
  finalRoi: number | null;
}

export interface ArenaRound {
  id: string;
  marketSymbol: string;
  durationLabel: string;
  status: RoundStatus;
  startsAt: string;
  locksAt: string;
  endsAt: string;
  predictOracleId: string;
  predictExpiry: string;
  totalBackingVolume: number;
  agentIds: string[];
  candles: Candle[];
  tradeMarkers: TradeMarker[];
  agentStates: AgentRoundState[];
}

export interface BackingPositionBase {
  id: string;
  userAddress: string;
  managerId: string | null;
  roundId: string;
  agentId: string;
  amount: number;
  status: BackingStatus;
  createdAt: string;
  updatedAt: string;
  predictTxDigest: string | null;
  attributionId: string | null;
  attributionStatus: AttributionSyncStatus;
  attributionError: string | null;
  estimatedValue: number;
  finalValue: number | null;
  fee: number | null;
  redeemTxDigest: string | null;
}

export interface DirectionalBackingPosition extends BackingPositionBase {
  predictPositionType: "directional";
  marketKey: string;
  rangeKey: null;
}

export interface RangeBackingPosition extends BackingPositionBase {
  predictPositionType: "range";
  marketKey: null;
  rangeKey: string;
}

export type BackingPosition = DirectionalBackingPosition | RangeBackingPosition;

export interface BackingDraft {
  roundId: string;
  agentId: string;
  amount: number;
}

export interface ArenaState {
  rounds: ArenaRound[];
  agents: Agent[];
  userBackings: BackingPosition[];
  selectedRoundId: string;
  selectedAgentId: string;
  activeSort: AgentSortMode;
  backingDraft: BackingDraft | null;
}
