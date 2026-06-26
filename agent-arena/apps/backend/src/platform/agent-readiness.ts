import {
  agentActions,
  type AgentAction,
  type AgentPositionSnapshot,
  type Competition,
  type ExecutionRecord,
  type MarketSnapshot,
  type TradingWallet
} from "./types";

export type ActionReadinessStatus = "executable" | "risky" | "blocked";

export interface ActionReadinessReason {
  code: string;
  message: string;
  recommendedAgentAction: string;
}

export interface ActionReadiness {
  status: ActionReadinessStatus;
  markets?: string[];
  reasons: ActionReadinessReason[];
}

export interface AgentReadiness {
  competitionId: string;
  agentId: string;
  asOfMs: string;
  actions: Record<AgentAction, ActionReadiness>;
}

export interface CreateAgentReadinessInput {
  agentId: string;
  competition: Competition;
  marketState: MarketSnapshot;
  wallet: TradingWallet | null | undefined;
  positions: AgentPositionSnapshot[];
  pendingExecutions: ExecutionRecord[];
  nowMs: number;
}

const minimumOpenQuoteBalanceRaw = 10_000_000n;
const pendingExecutionStatuses = new Set<ExecutionRecord["status"]>([
  "queued",
  "signed",
  "submitted"
]);
const actionablePositionStatuses = new Set<AgentPositionSnapshot["status"]>([
  "open",
  "reduced"
]);

export function createAgentReadiness(input: CreateAgentReadinessInput): AgentReadiness {
  return {
    competitionId: input.competition.id,
    agentId: input.agentId,
    asOfMs: String(input.nowMs),
    actions: Object.fromEntries(
      agentActions.map((action) => [action, createActionReadiness(action, input)])
    ) as Record<AgentAction, ActionReadiness>
  };
}

function createActionReadiness(
  action: AgentAction,
  input: CreateAgentReadinessInput
): ActionReadiness {
  if (action === "hold") {
    return executable();
  }

  if (action === "open_directional") {
    return createOpenActionReadiness(input, {
      marketExists: Boolean(input.marketState.executableMarkets?.directional),
      missingMarketReason: reason("NO_EXECUTABLE_DIRECTIONAL_MARKET"),
      markets: ["directional"]
    });
  }

  if (action === "open_range") {
    return createOpenActionReadiness(input, {
      marketExists: Boolean(input.marketState.executableMarkets?.range),
      missingMarketReason: reason("NO_EXECUTABLE_RANGE_MARKET"),
      markets: ["range"]
    });
  }

  return createExitActionReadiness(input);
}

function createOpenActionReadiness(
  input: CreateAgentReadinessInput,
  market: {
    marketExists: boolean;
    missingMarketReason: ActionReadinessReason;
    markets: string[];
  }
): ActionReadiness {
  const reasons = createOpenBaseBlockers(input);
  if (!market.marketExists) {
    reasons.push(market.missingMarketReason);
  }

  if (reasons.length > 0) {
    return blocked(reasons);
  }

  if (input.marketState.lateWindow.openMayFailOnPredictQuote) {
    return {
      status: "risky",
      markets: market.markets,
      reasons: [reason("PREDICT_QUOTE_MAY_FAIL")]
    };
  }

  return executable(market.markets);
}

function createOpenBaseBlockers(input: CreateAgentReadinessInput): ActionReadinessReason[] {
  const reasons: ActionReadinessReason[] = [];

  if (input.competition.status !== "live") {
    reasons.push(reason("ROUND_NOT_LIVE", input.competition.status));
  }

  if (input.marketState.oracleStatus !== "active") {
    reasons.push(reason("ORACLE_NOT_TRADEABLE", input.marketState.oracleStatus));
  }

  if (!input.wallet) {
    reasons.push(reason("WALLET_NOT_BOUND"));
  } else {
    if (!hasMinimumOpenQuoteBalance(input.wallet.quoteBalance)) {
      reasons.push(reason("WALLET_NOT_FUNDED"));
    }

    if (input.wallet.predictManagerStatus !== "ready") {
      reasons.push(reason("PREDICT_MANAGER_MISSING"));
    }
  }

  if (hasPendingExecution(input)) {
    reasons.push(reason("PENDING_EXECUTION_EXISTS"));
  }

  return reasons;
}

function createExitActionReadiness(input: CreateAgentReadinessInput): ActionReadiness {
  const reasons: ActionReadinessReason[] = [];

  if (hasPendingExecution(input)) {
    reasons.push(reason("PENDING_EXECUTION_EXISTS"));
  }

  if (!hasActionablePosition(input)) {
    reasons.push(reason("NO_OPEN_POSITION"));
  }

  return reasons.length > 0 ? blocked(reasons) : executable();
}

function hasPendingExecution(input: CreateAgentReadinessInput): boolean {
  return input.pendingExecutions.some((execution) => (
    execution.agentId === input.agentId &&
    execution.competitionId === input.competition.id &&
    pendingExecutionStatuses.has(execution.status)
  ));
}

function hasActionablePosition(input: CreateAgentReadinessInput): boolean {
  return input.positions.some((position) => (
    position.agentId === input.agentId &&
    position.competitionId === input.competition.id &&
    actionablePositionStatuses.has(position.status)
  ));
}

function hasMinimumOpenQuoteBalance(value: string): boolean {
  try {
    return BigInt(value) >= minimumOpenQuoteBalanceRaw;
  } catch {
    return false;
  }
}

function executable(markets?: string[]): ActionReadiness {
  return {
    status: "executable",
    ...(markets ? { markets } : {}),
    reasons: []
  };
}

function blocked(reasons: ActionReadinessReason[]): ActionReadiness {
  return {
    status: "blocked",
    reasons
  };
}

function reason(code: string, detail?: string): ActionReadinessReason {
  switch (code) {
    case "ROUND_NOT_LIVE":
      return {
        code,
        message: `Competition round is ${detail ?? "not live"}.`,
        recommendedAgentAction: "Wait for a live competition round before opening exposure."
      };
    case "ORACLE_NOT_TRADEABLE":
      return {
        code,
        message: `Oracle status is ${detail ?? "not active"}.`,
        recommendedAgentAction: "Wait for an active oracle before opening exposure."
      };
    case "WALLET_NOT_BOUND":
      return {
        code,
        message: "No trading wallet is bound to this Agent.",
        recommendedAgentAction: "Complete Agent claim and wallet binding before opening exposure."
      };
    case "WALLET_NOT_FUNDED":
      return {
        code,
        message: "Trading wallet quote balance is below 10000000 raw DUSDC.",
        recommendedAgentAction: "Fund the Agent trading wallet with at least 10000000 raw DUSDC."
      };
    case "PREDICT_MANAGER_MISSING":
      return {
        code,
        message: "Trading wallet PredictManager is not ready.",
        recommendedAgentAction: "Initialize or repair the PredictManager before opening exposure."
      };
    case "PENDING_EXECUTION_EXISTS":
      return {
        code,
        message: "An execution is already queued, signed, or submitted for this Agent and competition.",
        recommendedAgentAction: "Wait for the pending execution to confirm or fail before submitting another exposure change."
      };
    case "NO_EXECUTABLE_DIRECTIONAL_MARKET":
      return {
        code,
        message: "The market snapshot does not publish an executable directional market.",
        recommendedAgentAction: "Refresh market-state and only submit directional opens when executableMarkets.directional is present."
      };
    case "NO_EXECUTABLE_RANGE_MARKET":
      return {
        code,
        message: "The market snapshot does not publish an executable range market.",
        recommendedAgentAction: "Refresh market-state and only submit range opens when executableMarkets.range is present."
      };
    case "NO_OPEN_POSITION":
      return {
        code,
        message: "No open or reduced position exists for this Agent and competition.",
        recommendedAgentAction: "Open a position before attempting to reduce or close exposure."
      };
    case "PREDICT_QUOTE_MAY_FAIL":
      return {
        code,
        message: "Predict quote availability may fail in the current late window.",
        recommendedAgentAction: "Submit only if the Agent accepts late-window quote risk; otherwise hold."
      };
    default:
      return {
        code,
        message: code,
        recommendedAgentAction: "Review the readiness code before submitting an intent."
      };
  }
}
