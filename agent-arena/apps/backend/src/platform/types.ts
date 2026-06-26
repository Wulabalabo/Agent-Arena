import type { RegisterAgentRegistryProof } from "./registry";

export const agentActions = Object.freeze([
  "hold",
  "open_directional",
  "open_range",
  "reduce",
  "close"
] as const);

export type AgentAction = (typeof agentActions)[number];
export type RoundStatus = "pre_open" | "live" | "expired" | "settled";
export type IntentStatus = "accepted" | "rejected" | "executed" | "partial" | "failed";
export type ExecutionStatus = "queued" | "signed" | "submitted" | "confirmed" | "failed" | "partial";
export type ExecutionHealthPhase =
  | ExecutionStatus
  | "planned"
  | "failed_after_chain_check";
export type ExecutionRetryableReason =
  | "NO_SIGNING_ATTEMPT"
  | "CHAIN_STATUS_REQUIRED"
  | "TERMINAL"
  | "NOT_RETRYABLE";
export type OwnerWithdrawalStatus = "dry_run_ok" | "submitted" | "failed";
export type PositionKind = "directional" | "range";
export type AgentRuntimeStatus = "waiting" | "active" | "cooldown" | "rejected" | "offline";
export type ExposureStatus = "flat" | "directional" | "range" | "closing" | "settled";
export type PositionSnapshotStatus = "open" | "reduced" | "closed" | "settled";
export type PerformanceLedgerKind =
  | "pairing"
  | "wallet_binding"
  | "intent"
  | "risk"
  | "execution"
  | "position"
  | "settlement"
  | "claim"
  | "score";
export type PolicyDrift = "none" | "cost_exceeded" | "proceeds_below_minimum" | "unknown";

export interface Competition {
  id: string;
  name: string;
  gameType: "DeepBookPredictBtc15m";
  marketSymbol: "BTC-USD";
  durationSeconds: 900;
  predictObjectId: string;
  oracleId: string;
  expiry: string;
  allowedActions: AgentAction[];
  status: RoundStatus;
  skillFile: string;
  startsAt: string;
  expiresAt: string;
  settlesAt: string | null;
}

export interface AgentProfile {
  id: string;
  displayName: string;
  normalizedName: string;
  twitterHandle: string | null;
  normalizedTwitterHandle: string | null;
  twitterVerified: false;
  ownerAddress: string;
  tradingWalletAddress: string;
  tradingWalletId: string | null;
  runtimeStatus: AgentRuntimeStatus;
  exposureStatus: ExposureStatus;
  createdAt: string;
}

export interface AgentPairingDraft {
  id: string;
  displayName: string;
  registrationCode: string;
  claimUrl: string;
  expiresAt: string;
  status: "pending" | "claimed" | "expired";
  createdAt: string;
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
  createdAt: string;
}

export interface AgentIdentityBinding {
  agentDraftId: string;
  registrationCodeHash: string;
  agentId: string;
  ownerAddress: string;
  twitterHandle: string | null;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  createdAt: string;
  claimedAt: string;
}

export interface PendingAgentClaim {
  id: string;
  agentDraftId: string;
  registrationCodeHash: string;
  agentId: string;
  ownerAddress: string;
  twitterHandle: string | null;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  registryProof: RegisterAgentRegistryProof;
  status: "pending" | "finalized";
  txDigest: string | null;
  createdAt: string;
  finalizedAt: string | null;
}

export interface PerformanceLedgerRecord {
  kind: PerformanceLedgerKind;
  agentDraftId: string | null;
  registrationCodeHash: string | null;
  agentId: string;
  ownerAddress: string | null;
  tradingWalletId: string | null;
  walletAddress: string | null;
  predictManagerId: string | null;
  competitionId: string | null;
  oracleId: string | null;
  expiryMs: string | null;
  intentId: string | null;
  riskDecisionId: string | null;
  executionId: string | null;
  txDigest: string | null;
  action: AgentAction | null;
  positionKind: PositionKind | null;
  quantityRaw: string | null;
  costRaw: string | null;
  proceedsRaw: string | null;
  realizedPnlRaw?: string | null;
  status: string;
  errorCode: string | null;
  positionIdentityKey?: string | null;
  policyDrift: PolicyDrift;
  createdAt: string;
  serverReceivedAt: string;
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

export interface MarketSnapshot {
  competitionId: string;
  status: RoundStatus;
  serverTimeMs: string;
  oracleId: string;
  oracleStatus: "inactive" | "active" | "expired" | "settled";
  expiryMs: string;
  timeToExpiryMs: string;
  underlyingAsset: "BTC";
  spotPriceRaw: string;
  forwardPriceRaw: string;
  priceDecimals: 9;
  strikeGrid: {
    minStrikeRaw: string;
    maxStrikeRaw: string | null;
    strikeStepRaw: string;
  };
  executableMarkets?: {
    directional?: {
      oracleId: string;
      expiry: string;
      strike: string;
    };
  };
  allowedActions: AgentAction[];
  allowedOperations: {
    canHold: boolean;
    canOpen: boolean;
    canReduce: boolean;
    canClose: boolean;
  };
  lateWindow: {
    isFinalMinute: boolean;
    openAllowedByPlatform: boolean;
    openMayFailOnPredictQuote: boolean;
  };
  fetchedAt: string;
}

export interface OwnerWithdrawalRecord {
  id: string;
  ownerAddress: string;
  agentId: string;
  walletId: string;
  managerId: string;
  amountRaw: string;
  recipientAddress?: string;
  txDigest: string | null;
  status: OwnerWithdrawalStatus;
  createdAt: string;
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

export interface AgentIntent {
  id: string;
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  market?: IntentMarket;
  positionRef?: PositionRef;
  budgetRaw?: string;
  quantity?: string;
  maxCost?: string;
  minProceeds?: string;
  confidence: number;
  reason: string;
  createdAt: string;
  status: IntentStatus;
  rejectionCode: string | null;
}

export interface RiskDecision {
  id: string;
  intentId: string;
  accepted: boolean;
  rejectionCode: string | null;
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
  queuedAt?: string | null;
  plannedAt?: string | null;
  signedAt?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  lastAttemptAt?: string | null;
  attemptCount?: number;
  terminal?: boolean;
  retryable?: boolean;
  failureCode?: string | null;
  failureMessage?: string | null;
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

export function isAgentAction(value: string): value is AgentAction {
  return (agentActions as readonly string[]).includes(value);
}

export function createMockCompetition(id: string): Competition {
  return {
    id,
    name: "BTC 15m Testnet Arena",
    gameType: "DeepBookPredictBtc15m",
    marketSymbol: "BTC-USD",
    durationSeconds: 900,
    predictObjectId: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
    oracleId: "0xbtc15m",
    expiry: "2026-06-15T10:15:00.000Z",
    allowedActions: [
      "hold",
      "open_directional",
      "open_range",
      "reduce",
      "close"
    ],
    status: "live",
    skillFile: "/skills/deepbook-predict-btc-15m.md",
    startsAt: "2026-06-15T10:00:00.000Z",
    expiresAt: "2026-06-15T10:15:00.000Z",
    settlesAt: null
  };
}
