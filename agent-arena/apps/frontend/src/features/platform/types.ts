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
  expiresAt: string;
}

export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  testnetSuiBalance: string;
  quoteBalance: string;
  predictManagerStatus: "missing" | "ready";
  createdAt: string;
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
  marketSymbol: "BTC-USD";
  quantity: string;
  maxCost: string | null;
}

export interface RiskDecision {
  id: string;
  intentId: string;
  accepted: boolean;
  rejectionCode: string | null;
  reason: string;
  createdAt: string;
}

export interface ExecutionRecord {
  id: string;
  intentId: string;
  agentId: string;
  competitionId: string;
  riskDecisionId: string;
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
  competitionId: string;
  agentId: string;
  label: string;
  intentId: string | null;
  riskDecisionId: string | null;
  executionId: string | null;
  predictTxDigest: string | null;
  createdAt: string;
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
