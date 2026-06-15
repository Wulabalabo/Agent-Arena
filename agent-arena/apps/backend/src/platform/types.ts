export const agentActions = Object.freeze([
  "hold",
  "open_directional",
  "open_range",
  "add",
  "reduce",
  "close",
  "switch_direction",
  "adjust_range"
] as const);

export type AgentAction = (typeof agentActions)[number];
export type RoundStatus = "pre_open" | "live" | "expired" | "settled";
export type IntentStatus = "accepted" | "rejected" | "executed" | "partial";
export type ExecutionStatus = "queued" | "signed" | "submitted" | "confirmed" | "failed" | "partial";
export type PositionKind = "directional" | "range";

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
  name: string;
  normalizedName: string;
  twitterHandle: string | null;
  normalizedTwitterHandle: string | null;
  tradingWalletId: string | null;
  createdAt: string;
}

export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  status: "active" | "detached";
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
  quantity: string;
}

export interface AgentIntent {
  id: string;
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  market?: IntentMarket;
  positionRef?: PositionRef;
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
    allowedActions: [...agentActions],
    status: "live",
    skillFile: "/skills/deepbook-predict-btc-15m.md",
    startsAt: "2026-06-15T10:00:00.000Z",
    expiresAt: "2026-06-15T10:15:00.000Z",
    settlesAt: null
  };
}
