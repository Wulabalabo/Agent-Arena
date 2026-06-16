export type AgentAction =
  | "hold"
  | "open_directional"
  | "open_range"
  | "add"
  | "reduce"
  | "close"
  | "switch_direction"
  | "adjust_range";

export type CompetitionStatus = "pre_open" | "live" | "expired" | "settled";
export type IntentStatus = "accepted" | "rejected" | "executed" | "partial";
export type ExecutionStatus = "queued" | "signed" | "submitted" | "confirmed" | "failed" | "partial";
export type AgentRuntimeStatus = "waiting" | "active" | "cooldown" | "rejected" | "offline";
export type ExposureStatus = "flat" | "directional" | "range" | "closing" | "settled";
export type PositionKind = "directional" | "range";

export interface AgentProfile {
  id: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
  ownerAddress: string;
  tradingWalletAddress: string;
  runtimeStatus: AgentRuntimeStatus;
  exposureStatus: ExposureStatus;
  createdAt: string;
}

export interface PairingDraft {
  agentDraftId: string;
  displayName: string;
  registrationCode: string;
  claimUrl: string;
  expiresAt: string;
}

export interface RuntimeCredential {
  token: string;
  shownOnce: boolean;
  scopes: string[];
}

export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  status: "active" | "detached";
  testnetSuiBalance: string;
  quoteBalance: string;
  predictManagerStatus: "missing" | "ready";
}

export interface Competition {
  id: string;
  name: string;
  marketSymbol: "BTC-USD";
  durationSeconds: 900;
  oracleId: string;
  predictObjectId: string;
  allowedActions: AgentAction[];
  status: CompetitionStatus;
  startsAt: string;
  expiresAt: string;
  settlesAt: string | null;
  registeredAgentCount: number;
  activeAgentCount: number;
  latestExecutionCount: number;
}

export interface DirectionalMarket {
  kind: "directional";
  oracleId: string;
  expiry: string;
  strike: string;
  isUp: boolean;
}

export interface RangeMarket {
  kind: "range";
  oracleId: string;
  expiry: string;
  lowerStrike: string;
  higherStrike: string;
}

export type IntentMarket = DirectionalMarket | RangeMarket;

export interface PositionRef {
  kind: PositionKind;
  marketKey?: string;
  rangeKey?: string;
  openExecutionId?: string;
  quantity: string;
}

export interface AgentIntent {
  id: string;
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  status: IntentStatus;
  confidence: number;
  reason: string;
  rejectionCode: string | null;
  createdAt: string;
  market?: IntentMarket;
  positionRef?: PositionRef;
  quantity?: string;
  maxCost?: string;
  minProceeds?: string;
}

export interface SubmitIntentInput {
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  confidence: number;
  reason: string;
  createdAt: string;
  market?: IntentMarket;
  positionRef?: PositionRef;
  quantity?: string;
  maxCost?: string;
  minProceeds?: string;
}

export interface RiskDecision {
  id: string;
  intentId: string;
  accepted: boolean;
  rejectionCode: string | null;
  policyMessage: string;
  createdAt: string;
}

export interface ExecutionRecord {
  id: string;
  intentId: string;
  agentId: string;
  competitionId: string;
  status: ExecutionStatus;
  predictTxDigest: string | null;
  action: AgentAction;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
  score: number;
  netPnlPct: number;
  maxDrawdownPct: number;
  capitalEfficiencyPct: number;
  hitRatePct: number;
  executionCount: number;
  invalidIntentCount: number;
  finalExecutionAt: string;
}

export interface ReplayEvent {
  id: string;
  timestamp: string;
  label: string;
  summary: string;
  recordId: string;
  copyValue: string | null;
  txDigest: string | null;
}

export interface PlatformSnapshot {
  agents: AgentProfile[];
  tradingWallet: TradingWallet;
  competitions: Competition[];
  latestIntent: AgentIntent;
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
  replay: ReplayEvent[];
}

export interface PlatformErrorBody {
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
}
