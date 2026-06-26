import {
  agentActions,
  type AgentAction,
  type AgentPositionSnapshot,
  type Competition,
  type ExecutionRecord,
  type MarketSnapshot,
  type TradingWallet
} from "./types";
import {
  minimumQuoteBalanceRaw,
  parseMinimumTestnetSuiBalanceRaw,
  parseRawBalance,
  parseTestnetSuiBalanceRaw
} from "./wallet-balances";

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
  minimumTestnetSuiBalanceRaw?: string;
  nowMs: number;
}

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
      action,
      marketExists: Boolean(input.marketState.executableMarkets?.directional),
      missingMarketReason: reason("NO_EXECUTABLE_DIRECTIONAL_MARKET"),
      markets: ["directional"]
    });
  }

  if (action === "open_range") {
    return createOpenActionReadiness(input, {
      action,
      marketExists: Boolean(input.marketState.executableMarkets?.range),
      missingMarketReason: reason("NO_EXECUTABLE_RANGE_MARKET"),
      markets: ["range"]
    });
  }

  return createExitActionReadiness(input, action);
}

function createOpenActionReadiness(
  input: CreateAgentReadinessInput,
  market: {
    action: AgentAction;
    marketExists: boolean;
    missingMarketReason: ActionReadinessReason;
    markets: string[];
  }
): ActionReadiness {
  const reasons = createOpenBaseBlockers(input, market.action);
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

function createOpenBaseBlockers(
  input: CreateAgentReadinessInput,
  action: AgentAction
): ActionReadinessReason[] {
  const reasons: ActionReadinessReason[] = [];

  if (!input.competition.allowedActions.includes(action)) {
    reasons.push(reason("ACTION_NOT_ALLOWED"));
  }

  if (input.competition.status !== "live") {
    reasons.push(reason("ROUND_NOT_LIVE", input.competition.status));
  }

  if (input.marketState.oracleStatus !== "active") {
    reasons.push(reason("ORACLE_NOT_TRADEABLE", input.marketState.oracleStatus));
  }

  reasons.push(...createWalletRuntimeBlockers(input, { requireQuoteBalance: true }));

  if (hasPendingExecution(input)) {
    reasons.push(reason("PENDING_EXECUTION_EXISTS"));
  }

  return reasons;
}

function createExitActionReadiness(input: CreateAgentReadinessInput, action: AgentAction): ActionReadiness {
  const reasons: ActionReadinessReason[] = [];

  if (!input.competition.allowedActions.includes(action)) {
    reasons.push(reason("ACTION_NOT_ALLOWED"));
  }

  reasons.push(...createWalletRuntimeBlockers(input, { requireQuoteBalance: false }));

  if (hasPendingExecution(input)) {
    reasons.push(reason("PENDING_EXECUTION_EXISTS"));
  }

  if (!hasActionablePosition(input)) {
    reasons.push(reason("NO_OPEN_POSITION"));
  }

  return reasons.length > 0 ? blocked(reasons) : executable();
}

function createWalletRuntimeBlockers(
  input: CreateAgentReadinessInput,
  { requireQuoteBalance }: { requireQuoteBalance: boolean }
): ActionReadinessReason[] {
  const wallet = input.wallet;
  if (!wallet || wallet.status !== "active") {
    return [reason("WALLET_NOT_BOUND")];
  }

  const reasons: ActionReadinessReason[] = [];
  if (requireQuoteBalance && !hasMinimumOpenQuoteBalance(wallet.quoteBalance)) {
    reasons.push(reason("WALLET_NOT_FUNDED"));
  }

  if (!hasMinimumTestnetSuiBalance(wallet.testnetSuiBalance, input.minimumTestnetSuiBalanceRaw)) {
    reasons.push(reason("GAS_BALANCE_TOO_LOW"));
  }

  if (wallet.predictManagerStatus !== "ready") {
    reasons.push(reason("PREDICT_MANAGER_NOT_READY"));
  }

  return reasons;
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
  const parsed = parseRawBalance(value);
  return parsed !== null && parsed >= minimumQuoteBalanceRaw;
}

function hasMinimumTestnetSuiBalance(value: string, minimumRaw: string | undefined): boolean {
  const parsed = parseTestnetSuiBalanceRaw(value);
  const minimum = parseMinimumTestnetSuiBalanceRaw(minimumRaw);
  return parsed !== null && parsed >= minimum;
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
    case "ACTION_NOT_ALLOWED":
      return {
        code,
        message: "Competition policy does not allow this action.",
        recommendedAgentAction: "Choose an allowed action from the current competition policy."
      };
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
    case "GAS_BALANCE_TOO_LOW":
      return {
        code,
        message: "Trading wallet Testnet SUI gas balance is below the configured threshold.",
        recommendedAgentAction: "Fund the Agent trading wallet with enough Testnet SUI for gas."
      };
    case "PREDICT_MANAGER_NOT_READY":
      return {
        code,
        message: "Trading wallet PredictManager is not ready.",
        recommendedAgentAction: "Initialize or repair the PredictManager before changing exposure."
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
