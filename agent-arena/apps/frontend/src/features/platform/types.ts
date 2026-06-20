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
export type IntentStatus = "accepted" | "rejected" | "executed" | "partial" | "failed";
export type ExecutionStatus = "queued" | "signed" | "submitted" | "confirmed" | "failed" | "partial";
export type OwnerWithdrawalStatus = "dry_run_ok" | "submitted" | "failed";
export type AgentRuntimeStatus = "waiting" | "active" | "cooldown" | "rejected" | "offline";
export type ExposureStatus = "flat" | "directional" | "range" | "closing" | "settled";
export type PositionKind = "directional" | "range";
export type PositionSnapshotStatus = "open" | "reduced" | "closed" | "settled";

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
  credentialVersion?: number;
  scopes: string[];
}

export interface RegistryWriteSummary {
  status: "disabled" | "submitted" | "failed";
  txDigest: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface RuntimeCredentialRotationChallenge {
  agentId: string;
  ownerAddress: string;
  reason: string;
  domain: string;
  chainId: string;
  currentCredentialVersion: number;
  nextCredentialVersion: number;
  nonce: string;
  expiresAt: string;
  message: string;
}

export interface RuntimeCredentialRotationResponse {
  runtimeCredential: RuntimeCredential;
  registry?: RegistryWriteSummary;
}

export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  status: "active" | "detached";
  testnetSuiBalance: string;
  quoteBalance: string;
  predictManagerStatus: "missing" | "ready";
  predictManagerId: string | null;
}

export interface AgentIdentityBinding {
  agentId: string;
  ownerAddress: string;
  twitterHandle: string | null;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  claimedAt: string;
}

export interface OwnerWithdrawalRecord {
  status: OwnerWithdrawalStatus;
  amountRaw: string;
  recipientAddress?: string;
  txDigest?: string | null;
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

export interface MarketSnapshot {
  allowedActions: AgentAction[];
  allowedOperations: {
    canClose: boolean;
    canHold: boolean;
    canOpen: boolean;
    canReduce: boolean;
  };
  competitionId: string;
  executableMarkets?: {
    directional?: {
      expiry: string;
      oracleId: string;
      strike: string;
    };
  };
  expiryMs: string;
  fetchedAt: string;
  forwardPriceRaw: string;
  lateWindow: {
    isFinalMinute: boolean;
    openAllowedByPlatform: boolean;
    openMayFailOnPredictQuote: boolean;
  };
  oracleId: string;
  oracleStatus: "inactive" | "active" | "expired" | "settled";
  priceDecimals: 9;
  serverTimeMs: string;
  spotPriceRaw: string;
  status: CompetitionStatus;
  strikeGrid: {
    maxStrikeRaw: string | null;
    minStrikeRaw: string;
    strikeStepRaw: string;
  };
  timeToExpiryMs: string;
  underlyingAsset: "BTC";
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
  quantity?: string;
}

export interface AgentPositionSnapshot {
  agentId: string;
  competitionId: string;
  positionRef: PositionRef;
  oracleId: string;
  expiryMs: string;
  strikeRaw?: string;
  direction?: "up" | "down";
  lowerStrikeRaw?: string;
  higherStrikeRaw?: string;
  quantityRaw: string;
  status: PositionSnapshotStatus;
  updatedAt: string;
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
  budgetRaw?: string;
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
  budgetRaw?: string;
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
  predictTxUrl?: string | null;
  action: AgentAction;
  createdAt: string;
}

export interface PublicAgentSummary {
  id: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
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
  currentExposureStatus?: ExposureStatus;
}

export interface PublicArenaActivity {
  agents: PublicAgentSummary[];
  intents: AgentIntent[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
  ownerAgentIds?: string[];
}

export interface OwnerAgentProfile {
  agent: AgentProfile | null;
  tradingWallet: TradingWallet | null;
  positions: AgentPositionSnapshot[];
  intents: AgentIntent[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
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
  identityBinding: AgentIdentityBinding;
  tradingWallet: TradingWallet;
  competitions: Competition[];
  latestIntent: AgentIntent;
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  executions: ExecutionRecord[];
  positions: AgentPositionSnapshot[];
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
