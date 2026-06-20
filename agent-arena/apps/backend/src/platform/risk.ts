import type { AgentIntent, Competition, TradingWallet } from "./types";

const dusdcScale = 1_000_000;

export const riskLimit = Object.freeze({
  maxCostDisplay: 1_000,
  maxCostRaw: BigInt(1_000 * dusdcScale),
  quantityRaw: 5_000_000n
});

export type RiskRejectionCode =
  | "ACTION_NOT_ALLOWED"
  | "WALLET_NOT_BOUND"
  | "ROUND_NOT_LIVE"
  | "PENDING_EXECUTION_EXISTS"
  | "RISK_LIMIT_EXCEEDED";

export interface RiskEvaluationInput {
  intent: AgentIntent;
  competition: Competition | undefined;
  tradingWallet: TradingWallet | undefined;
  hasPendingExecution?: boolean;
}

export interface RiskEvaluation {
  accepted: boolean;
  rejectionCode: RiskRejectionCode | null;
}

export function evaluateIntentRisk({
  intent,
  competition,
  tradingWallet,
  hasPendingExecution = false
}: RiskEvaluationInput): RiskEvaluation {
  if (!competition) {
    return reject("ROUND_NOT_LIVE");
  }

  if (competition.status !== "live") {
    return reject("ROUND_NOT_LIVE");
  }

  if (!competition.allowedActions.includes(intent.action)) {
    return reject("ACTION_NOT_ALLOWED");
  }

  if (intent.action === "hold") {
    return accept();
  }

  if (hasPendingExecution) {
    return reject("PENDING_EXECUTION_EXISTS");
  }

  if (!tradingWallet || tradingWallet.status !== "active") {
    return reject("WALLET_NOT_BOUND");
  }

  if (exceedsRiskLimit(intent)) {
    return reject("RISK_LIMIT_EXCEEDED");
  }

  return accept();
}

function exceedsRiskLimit(intent: AgentIntent): boolean {
  return exceedsQuoteCostLimit(intent.maxCost) ||
    exceedsRawIntegerLimit(intent.quantity, riskLimit.quantityRaw);
}

function exceedsQuoteCostLimit(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  if (isRawIntegerString(value)) {
    return BigInt(value) > riskLimit.maxCostRaw;
  }

  return Number.parseFloat(value) > riskLimit.maxCostDisplay;
}

function exceedsRawIntegerLimit(value: string | undefined, limit: bigint): boolean {
  if (value === undefined) {
    return false;
  }

  if (!isRawIntegerString(value)) {
    return Number.parseFloat(value) > Number(limit);
  }

  return BigInt(value) > limit;
}

function isRawIntegerString(value: string): boolean {
  return /^\d+$/.test(value);
}

function accept(): RiskEvaluation {
  return {
    accepted: true,
    rejectionCode: null
  };
}

function reject(rejectionCode: RiskRejectionCode): RiskEvaluation {
  return {
    accepted: false,
    rejectionCode
  };
}
