import type { AgentRuntimeCredential } from "./auth";
import {
  createMockCompetition,
  type AgentIntent,
  type AgentPairingDraft,
  type AgentProfile,
  type Competition,
  type ExecutionRecord,
  type ExposureStatus,
  type AgentIdentityBinding,
  type AgentPositionSnapshot,
  type IntentMarket,
  type OwnerWithdrawalRecord,
  type PerformanceLedgerRecord,
  type PositionRef,
  type RiskDecision,
  type TradingWallet
} from "./types";
import { normalizeTwitterHandle } from "./validation";

export interface CreateAgentInput {
  name: string;
  twitterHandle?: string | null;
}

export interface CreateClaimedAgentInput {
  displayName: string;
  ownerAddress: string;
  twitterHandle?: string | null;
}

export class PlatformMockStore {
  private readonly agents = new Map<string, AgentProfile>();
  private readonly credentialsByRuntimeToken = new Map<string, AgentRuntimeCredential>();
  private readonly pairingDrafts = new Map<string, AgentPairingDraft>();
  private readonly pairingDraftIdsByCode = new Map<string, string>();
  private readonly tradingWallets = new Map<string, TradingWallet>();
  private readonly tradingWalletIdsByAgentId = new Map<string, string>();
  private readonly identityBindingsByAgentId = new Map<string, AgentIdentityBinding>();
  private readonly performanceLedger: PerformanceLedgerRecord[] = [];
  private readonly positionSnapshots: AgentPositionSnapshot[] = [];
  private readonly competitions = new Map<string, Competition>();
  private readonly intents = new Map<string, AgentIntent>();
  private readonly intentIdsByIdempotencyKey = new Map<string, string>();
  private readonly riskDecisions = new Map<string, RiskDecision>();
  private readonly executions = new Map<string, ExecutionRecord>();
  private readonly ownerWithdrawals = new Map<string, OwnerWithdrawalRecord>();
  private nextAgentNumber = 1;
  private nextDraftNumber = 1;
  private nextWalletNumber = 1;
  private nextOwnerWithdrawalNumber = 1;

  createPairingDraft(displayName: string): AgentPairingDraft {
    const id = `draft_${this.nextDraftNumber}`;
    this.nextDraftNumber += 1;
    const registrationCode = `PAIR-${String(this.nextDraftNumber + 2047)}`;
    const draft: AgentPairingDraft = {
      id,
      displayName,
      registrationCode,
      claimUrl: `http://127.0.0.1:8787/agent-arena/claim/${registrationCode}`,
      expiresAt: "2026-06-15T00:15:00.000Z",
      status: "pending",
      createdAt: "2026-06-15T00:00:00.000Z"
    };

    this.pairingDrafts.set(id, clonePairingDraft(draft));
    this.pairingDraftIdsByCode.set(registrationCode, id);
    return clonePairingDraft(draft);
  }

  findPairingDraftByRegistrationCode(registrationCode: string): AgentPairingDraft | undefined {
    const draftId = this.pairingDraftIdsByCode.get(registrationCode);
    if (!draftId) {
      return undefined;
    }

    const draft = this.pairingDrafts.get(draftId);
    return draft ? clonePairingDraft(draft) : undefined;
  }

  markPairingDraftClaimed(draftId: string): AgentPairingDraft | undefined {
    const draft = this.pairingDrafts.get(draftId);
    if (!draft) {
      return undefined;
    }

    const claimed = {
      ...draft,
      status: "claimed" as const
    };
    this.pairingDrafts.set(draftId, clonePairingDraft(claimed));
    return clonePairingDraft(claimed);
  }

  createAgent(input: CreateAgentInput): AgentProfile {
    return this.createClaimedAgent({
      displayName: input.name,
      ownerAddress: "",
      twitterHandle: input.twitterHandle
    });
  }

  createClaimedAgent(input: CreateClaimedAgentInput): AgentProfile {
    const id = `agent_${this.nextAgentNumber}`;
    this.nextAgentNumber += 1;

    const displayName = input.displayName.trim();
    const twitter = normalizeTwitterHandle(input.twitterHandle);
    const agent: AgentProfile = {
      id,
      displayName,
      normalizedName: displayName.toLowerCase(),
      twitterHandle: twitter.twitterHandle,
      normalizedTwitterHandle: twitter.normalizedTwitterHandle,
      twitterVerified: false,
      ownerAddress: input.ownerAddress,
      tradingWalletAddress: "",
      tradingWalletId: null,
      runtimeStatus: "active",
      exposureStatus: "flat",
      createdAt: "2026-06-15T00:00:00.000Z"
    };

    this.agents.set(agent.id, cloneAgent(agent));
    return cloneAgent(agent);
  }

  getAgent(agentId: string): AgentProfile | undefined {
    const agent = this.agents.get(agentId);
    return agent ? cloneAgent(agent) : undefined;
  }

  listAgents(): AgentProfile[] {
    return [...this.agents.values()].map(cloneAgent);
  }

  updateAgentExposureStatus(agentId: string, exposureStatus: ExposureStatus): AgentProfile {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const updated = {
      ...agent,
      exposureStatus
    };
    this.agents.set(agentId, cloneAgent(updated));
    return cloneAgent(updated);
  }

  bindTradingWallet(
    agentId: string,
    address: string,
    overrides: Partial<Pick<
      TradingWallet,
      "id" | "testnetSuiBalance" | "quoteBalance" | "predictManagerStatus" | "predictManagerId"
    >> = {}
  ): TradingWallet {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const wallet: TradingWallet = {
      id: overrides.id ?? `wallet_${this.nextWalletNumber}`,
      agentId,
      address,
      status: "active",
      testnetSuiBalance: overrides.testnetSuiBalance ?? "0",
      quoteBalance: overrides.quoteBalance ?? "0",
      predictManagerStatus: overrides.predictManagerStatus ?? "missing",
      predictManagerId: overrides.predictManagerId ?? null,
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
      tradingWalletAddress: wallet.address,
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

  getTradingWalletById(walletId: string): TradingWallet | undefined {
    const wallet = this.tradingWallets.get(walletId);
    return wallet ? cloneTradingWallet(wallet) : undefined;
  }

  saveIdentityBinding(binding: AgentIdentityBinding): AgentIdentityBinding {
    this.identityBindingsByAgentId.set(binding.agentId, cloneIdentityBinding(binding));
    return cloneIdentityBinding(binding);
  }

  getIdentityBindingByAgentId(agentId: string): AgentIdentityBinding | undefined {
    const binding = this.identityBindingsByAgentId.get(agentId);
    return binding ? cloneIdentityBinding(binding) : undefined;
  }

  recordPerformanceLedger(record: PerformanceLedgerRecord): PerformanceLedgerRecord {
    this.performanceLedger.push(clonePerformanceLedgerRecord(record));
    return clonePerformanceLedgerRecord(record);
  }

  listPerformanceLedger(filter: { agentId?: string; competitionId?: string } = {}): PerformanceLedgerRecord[] {
    return this.performanceLedger
      .filter((record) => !filter.agentId || record.agentId === filter.agentId)
      .filter((record) => !filter.competitionId || record.competitionId === filter.competitionId)
      .map(clonePerformanceLedgerRecord);
  }

  savePositionSnapshot(snapshot: AgentPositionSnapshot): AgentPositionSnapshot {
    this.positionSnapshots.push(clonePositionSnapshot(snapshot));
    return clonePositionSnapshot(snapshot);
  }

  listPositionSnapshots(filter: { agentId?: string; competitionId?: string } = {}): AgentPositionSnapshot[] {
    return this.positionSnapshots
      .filter((snapshot) => !filter.agentId || snapshot.agentId === filter.agentId)
      .filter((snapshot) => !filter.competitionId || snapshot.competitionId === filter.competitionId)
      .map(clonePositionSnapshot);
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

  findExecutionById(executionId: string): ExecutionRecord | undefined {
    const execution = this.executions.get(executionId);
    return execution ? cloneExecution(execution) : undefined;
  }

  recordOwnerWithdrawal(input: Omit<OwnerWithdrawalRecord, "id" | "createdAt">): OwnerWithdrawalRecord {
    const withdrawal: OwnerWithdrawalRecord = {
      ...input,
      id: `owner_withdrawal_${this.nextOwnerWithdrawalNumber}`,
      createdAt: "2026-06-15T00:00:00.000Z"
    };
    this.nextOwnerWithdrawalNumber += 1;
    this.ownerWithdrawals.set(withdrawal.id, cloneOwnerWithdrawal(withdrawal));
    return cloneOwnerWithdrawal(withdrawal);
  }

  listOwnerWithdrawals(): OwnerWithdrawalRecord[] {
    return [...this.ownerWithdrawals.values()].map(cloneOwnerWithdrawal);
  }

  saveRuntimeCredential(credential: AgentRuntimeCredential): void {
    this.credentialsByRuntimeToken.set(credential.token, cloneRuntimeCredential(credential));
  }

  findRuntimeCredentialByToken(token: string): AgentRuntimeCredential | undefined {
    const credential = this.credentialsByRuntimeToken.get(token);
    return credential ? cloneRuntimeCredential(credential) : undefined;
  }
}

function cloneAgent(agent: AgentProfile): AgentProfile {
  return { ...agent };
}

function cloneRuntimeCredential(credential: AgentRuntimeCredential): AgentRuntimeCredential {
  return {
    ...credential,
    scopes: [...credential.scopes]
  };
}

function clonePairingDraft(draft: AgentPairingDraft): AgentPairingDraft {
  return { ...draft };
}

function cloneTradingWallet(wallet: TradingWallet): TradingWallet {
  return { ...wallet };
}

function cloneIdentityBinding(binding: AgentIdentityBinding): AgentIdentityBinding {
  return { ...binding };
}

function clonePerformanceLedgerRecord(record: PerformanceLedgerRecord): PerformanceLedgerRecord {
  return { ...record };
}

function clonePositionSnapshot(snapshot: AgentPositionSnapshot): AgentPositionSnapshot {
  return {
    ...snapshot,
    positionRef: clonePositionRef(snapshot.positionRef)
  };
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

function cloneOwnerWithdrawal(withdrawal: OwnerWithdrawalRecord): OwnerWithdrawalRecord {
  return { ...withdrawal };
}

function createIntentKey(intent: AgentIntent): string {
  return createIdempotencyKey(intent.agentId, intent.competitionId, intent.idempotencyKey);
}

function createIdempotencyKey(agentId: string, competitionId: string, idempotencyKey: string): string {
  return `${agentId}\u0000${competitionId}\u0000${idempotencyKey}`;
}
