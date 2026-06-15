import type { AgentCredential } from "./auth";
import {
  createMockCompetition,
  type AgentIntent,
  type AgentProfile,
  type Competition,
  type ExecutionRecord,
  type IntentMarket,
  type PositionRef,
  type RiskDecision,
  type TradingWallet
} from "./types";
import { normalizeTwitterHandle } from "./validation";

export interface CreateAgentInput {
  name: string;
  twitterHandle?: string | null;
}

export class PlatformMockStore {
  private readonly agents = new Map<string, AgentProfile>();
  private readonly credentialsByApiKey = new Map<string, AgentCredential>();
  private readonly tradingWallets = new Map<string, TradingWallet>();
  private readonly tradingWalletIdsByAgentId = new Map<string, string>();
  private readonly competitions = new Map<string, Competition>();
  private readonly intents = new Map<string, AgentIntent>();
  private readonly intentIdsByIdempotencyKey = new Map<string, string>();
  private readonly riskDecisions = new Map<string, RiskDecision>();
  private readonly executions = new Map<string, ExecutionRecord>();
  private nextAgentNumber = 1;
  private nextWalletNumber = 1;

  createAgent(input: CreateAgentInput): AgentProfile {
    const id = `agent_${this.nextAgentNumber}`;
    this.nextAgentNumber += 1;

    const name = input.name.trim();
    const twitter = normalizeTwitterHandle(input.twitterHandle);
    const agent: AgentProfile = {
      id,
      name,
      normalizedName: name.toLowerCase(),
      twitterHandle: twitter.twitterHandle,
      normalizedTwitterHandle: twitter.normalizedTwitterHandle,
      tradingWalletId: null,
      createdAt: "2026-06-15T00:00:00.000Z"
    };

    this.agents.set(agent.id, cloneAgent(agent));
    return cloneAgent(agent);
  }

  getAgent(agentId: string): AgentProfile | undefined {
    const agent = this.agents.get(agentId);
    return agent ? cloneAgent(agent) : undefined;
  }

  bindTradingWallet(agentId: string, address: string): TradingWallet {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const wallet: TradingWallet = {
      id: `wallet_${this.nextWalletNumber}`,
      agentId,
      address,
      status: "active",
      createdAt: "2026-06-15T00:00:00.000Z"
    };
    this.nextWalletNumber += 1;

    const previousWalletId = this.tradingWalletIdsByAgentId.get(agentId);
    if (previousWalletId) {
      const previousWallet = this.tradingWallets.get(previousWalletId);
      if (previousWallet) {
        this.tradingWallets.set(previousWalletId, cloneTradingWallet({
          ...previousWallet,
          status: "detached"
        }));
      }
    }

    this.tradingWallets.set(wallet.id, cloneTradingWallet(wallet));
    this.tradingWalletIdsByAgentId.set(agentId, wallet.id);
    this.agents.set(agentId, cloneAgent({
      ...agent,
      tradingWalletId: wallet.id
    }));

    return cloneTradingWallet(wallet);
  }

  getTradingWalletByAgentId(agentId: string): TradingWallet | undefined {
    const walletId = this.tradingWalletIdsByAgentId.get(agentId);
    if (!walletId) {
      return undefined;
    }

    const wallet = this.tradingWallets.get(walletId);
    return wallet ? cloneTradingWallet(wallet) : undefined;
  }

  seedCompetition(competition: Competition = createMockCompetition("btc-15m-001")): Competition {
    this.competitions.set(competition.id, cloneCompetition(competition));
    return cloneCompetition(competition);
  }

  getCompetition(id: string): Competition | undefined {
    const competition = this.competitions.get(id);
    return competition ? cloneCompetition(competition) : undefined;
  }

  saveIntent(intent: AgentIntent): AgentIntent {
    this.intents.set(intent.id, cloneIntent(intent));
    this.intentIdsByIdempotencyKey.set(createIntentKey(intent), intent.id);
    return cloneIntent(intent);
  }

  findIntentById(intentId: string): AgentIntent | undefined {
    const intent = this.intents.get(intentId);
    return intent ? cloneIntent(intent) : undefined;
  }

  findIntentByIdempotencyKey(
    agentId: string,
    competitionId: string,
    idempotencyKey: string
  ): AgentIntent | undefined {
    const intentId = this.intentIdsByIdempotencyKey.get(createIdempotencyKey(agentId, competitionId, idempotencyKey));
    return intentId ? this.findIntentById(intentId) : undefined;
  }

  listIntents(): AgentIntent[] {
    return [...this.intents.values()].map(cloneIntent);
  }

  saveRiskDecision(riskDecision: RiskDecision): RiskDecision {
    this.riskDecisions.set(riskDecision.id, cloneRiskDecision(riskDecision));
    return cloneRiskDecision(riskDecision);
  }

  listRiskDecisions(): RiskDecision[] {
    return [...this.riskDecisions.values()].map(cloneRiskDecision);
  }

  findRiskDecisionByIntentId(intentId: string): RiskDecision | undefined {
    const riskDecision = [...this.riskDecisions.values()]
      .find((riskDecision) => riskDecision.intentId === intentId);
    return riskDecision ? cloneRiskDecision(riskDecision) : undefined;
  }

  saveExecution(execution: ExecutionRecord): ExecutionRecord {
    this.executions.set(execution.id, cloneExecution(execution));
    return cloneExecution(execution);
  }

  listExecutions(): ExecutionRecord[] {
    return [...this.executions.values()].map(cloneExecution);
  }

  findExecutionByIntentId(intentId: string): ExecutionRecord | undefined {
    const execution = [...this.executions.values()]
      .find((record) => record.intentId === intentId);
    return execution ? cloneExecution(execution) : undefined;
  }

  saveCredential(credential: AgentCredential): void {
    this.credentialsByApiKey.set(credential.apiKey, cloneCredential(credential));
  }

  findCredentialByApiKey(apiKey: string): AgentCredential | undefined {
    const credential = this.credentialsByApiKey.get(apiKey);
    return credential ? cloneCredential(credential) : undefined;
  }
}

function cloneAgent(agent: AgentProfile): AgentProfile {
  return { ...agent };
}

function cloneCredential(credential: AgentCredential): AgentCredential {
  return { ...credential };
}

function cloneTradingWallet(wallet: TradingWallet): TradingWallet {
  return { ...wallet };
}

function cloneCompetition(competition: Competition): Competition {
  return {
    ...competition,
    allowedActions: [...competition.allowedActions]
  };
}

function cloneIntent(intent: AgentIntent): AgentIntent {
  return {
    ...intent,
    market: intent.market ? cloneMarket(intent.market) : undefined,
    positionRef: intent.positionRef ? clonePositionRef(intent.positionRef) : undefined
  };
}

function cloneMarket(market: IntentMarket): IntentMarket {
  return { ...market };
}

function clonePositionRef(positionRef: PositionRef): PositionRef {
  return { ...positionRef };
}

function cloneRiskDecision(riskDecision: RiskDecision): RiskDecision {
  return { ...riskDecision };
}

function cloneExecution(execution: ExecutionRecord): ExecutionRecord {
  return { ...execution };
}

function createIntentKey(intent: AgentIntent): string {
  return createIdempotencyKey(intent.agentId, intent.competitionId, intent.idempotencyKey);
}

function createIdempotencyKey(agentId: string, competitionId: string, idempotencyKey: string): string {
  return `${agentId}\u0000${competitionId}\u0000${idempotencyKey}`;
}
