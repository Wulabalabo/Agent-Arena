import type { AgentIntent, Competition, TradingWallet } from "./types";

export const riskLimit = Object.freeze({
  maxCost: 1_000,
  quantity: 1_000
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
  return exceedsDecimalLimit(intent.maxCost, riskLimit.maxCost) ||
    exceedsDecimalLimit(intent.quantity, riskLimit.quantity);
}

function exceedsDecimalLimit(value: string | undefined, limit: number): boolean {
  return value !== undefined && Number.parseFloat(value) > limit;
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
