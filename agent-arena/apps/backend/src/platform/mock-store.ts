import {
  randomBytes
} from "node:crypto";
import {
  createRuntimeCredentialToken,
  runtimeCredentialScopes,
  type AgentRuntimeCredential,
  type RuntimeCredentialRotationChallenge,
  type RuntimeCredentialRotationInput,
  type RuntimeCredentialRotationResult
} from "./auth";
import {
  createMockCompetition,
  type AgentIntent,
  type AgentPairingDraft,
  type AgentProfile,
  type Competition,
  type ExecutionRecord,
  type ExposureStatus,
  type AgentIdentityBinding,
  type PendingAgentClaim,
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
  runtimeStatus?: AgentProfile["runtimeStatus"];
}

export interface CreatePairingDraftOptions {
  claimBaseUrl?: string;
  nowMs?: number;
  ttlMs?: number;
}

export interface CreatePendingClaimInput {
  agentDraftId: string;
  registrationCodeHash: string;
  agentId: string;
  ownerAddress: string;
  twitterHandle: string | null;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  registryProof: PendingAgentClaim["registryProof"];
  now?: string;
}

export interface PlatformStoreSnapshot {
  agents: AgentProfile[];
  runtimeCredentials: AgentRuntimeCredential[];
  runtimeCredentialRotationChallenges?: RuntimeCredentialRotationChallenge[];
  pairingDrafts: AgentPairingDraft[];
  pendingClaims?: PendingAgentClaim[];
  tradingWallets: TradingWallet[];
  identityBindings: AgentIdentityBinding[];
  performanceLedger: PerformanceLedgerRecord[];
  positionSnapshots: AgentPositionSnapshot[];
  competitions: Competition[];
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  executions: ExecutionRecord[];
  ownerWithdrawals: OwnerWithdrawalRecord[];
  nextAgentNumber: number;
  nextDraftNumber: number;
  nextPendingClaimNumber?: number;
  nextWalletNumber: number;
  nextOwnerWithdrawalNumber: number;
}

const defaultPairingClaimBaseUrl = "http://127.0.0.1:5173/agent-arena/claim";
const defaultPairingTtlMs = 15 * 60 * 1000;

export class PlatformMockStore {
  private readonly agents = new Map<string, AgentProfile>();
  private readonly credentialsByRuntimeToken = new Map<string, AgentRuntimeCredential>();
  private readonly runtimeCredentialRotationChallengesByNonce = new Map<string, RuntimeCredentialRotationChallenge>();
  private readonly pairingDrafts = new Map<string, AgentPairingDraft>();
  private readonly pairingDraftIdsByCode = new Map<string, string>();
  private readonly pendingClaims = new Map<string, PendingAgentClaim>();
  private readonly pendingClaimIdsByDraftId = new Map<string, string>();
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
  private nextPendingClaimNumber = 1;
  private nextWalletNumber = 1;
  private nextOwnerWithdrawalNumber = 1;

  constructor(snapshot?: PlatformStoreSnapshot) {
    if (snapshot) {
      this.restoreSnapshot(snapshot);
    }
  }

  createPairingDraft(displayName: string, options: CreatePairingDraftOptions = {}): AgentPairingDraft {
    const id = `draft_${this.nextDraftNumber}`;
    this.nextDraftNumber += 1;
    const registrationCode = this.createRegistrationCode();
    const nowMs = options.nowMs ?? Date.now();
    const claimBaseUrl = normalizeClaimBaseUrl(options.claimBaseUrl ?? defaultPairingClaimBaseUrl);
    const draft: AgentPairingDraft = {
      id,
      displayName,
      registrationCode,
      claimUrl: `${claimBaseUrl}/${encodeURIComponent(registrationCode)}`,
      expiresAt: new Date(nowMs + (options.ttlMs ?? defaultPairingTtlMs)).toISOString(),
      status: "pending",
      createdAt: new Date(nowMs).toISOString()
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

    return this.getPairingDraftById(draftId);
  }

  getPairingDraftById(draftId: string): AgentPairingDraft | undefined {
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

  private createRegistrationCode(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `PAIR-${randomBytes(16).toString("hex")}`;
      if (!this.pairingDraftIdsByCode.has(code)) {
        return code;
      }
    }

    throw new Error("PAIRING_CODE_GENERATION_FAILED");
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
      runtimeStatus: input.runtimeStatus ?? "active",
      exposureStatus: "flat",
      createdAt: "2026-06-15T00:00:00.000Z"
    };

    this.agents.set(agent.id, cloneAgent(agent));
    return cloneAgent(agent);
  }

  updateAgentRuntimeStatus(agentId: string, runtimeStatus: AgentProfile["runtimeStatus"]): AgentProfile {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const updated = {
      ...agent,
      runtimeStatus
    };
    this.agents.set(agentId, cloneAgent(updated));
    return cloneAgent(updated);
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
    return wallet?.agentId === agentId ? cloneTradingWallet(wallet) : undefined;
  }

  getTradingWalletById(walletId: string): TradingWallet | undefined {
    const wallet = this.tradingWallets.get(walletId);
    return wallet ? cloneTradingWallet(wallet) : undefined;
  }

  removeUnfinalizedAgentReservation(agentId: string): void {
    if (this.identityBindingsByAgentId.has(agentId) || this.findLatestRuntimeCredentialByAgentId(agentId)) {
      throw new Error("AGENT_ALREADY_CLAIMED");
    }

    const pendingClaim = [...this.pendingClaims.values()].find((claim) => claim.agentId === agentId);
    if (pendingClaim?.status === "finalized") {
      throw new Error("AGENT_ALREADY_CLAIMED");
    }
    if (pendingClaim) {
      this.pendingClaims.delete(pendingClaim.id);
      this.pendingClaimIdsByDraftId.delete(pendingClaim.agentDraftId);
    }

    const walletId = this.tradingWalletIdsByAgentId.get(agentId);
    if (walletId) {
      this.tradingWallets.delete(walletId);
      this.tradingWalletIdsByAgentId.delete(agentId);
    }
    this.agents.delete(agentId);
  }

  updateTradingWallet(
    walletId: string,
    updates: Partial<Pick<
      TradingWallet,
      "testnetSuiBalance" | "quoteBalance" | "predictManagerStatus" | "predictManagerId"
    >>
  ): TradingWallet {
    const wallet = this.tradingWallets.get(walletId);
    if (!wallet) {
      throw new Error("WALLET_NOT_FOUND");
    }

    const updated = {
      ...wallet,
      ...updates
    };
    this.tradingWallets.set(walletId, cloneTradingWallet(updated));
    return cloneTradingWallet(updated);
  }

  saveIdentityBinding(binding: AgentIdentityBinding): AgentIdentityBinding {
    this.identityBindingsByAgentId.set(binding.agentId, cloneIdentityBinding(binding));
    return cloneIdentityBinding(binding);
  }

  getIdentityBindingByAgentId(agentId: string): AgentIdentityBinding | undefined {
    const binding = this.identityBindingsByAgentId.get(agentId);
    return binding ? cloneIdentityBinding(binding) : undefined;
  }

  createPendingClaim(input: CreatePendingClaimInput): PendingAgentClaim {
    const existing = this.findPendingClaimByDraftId(input.agentDraftId);
    if (existing) {
      throw new Error("PENDING_CLAIM_EXISTS");
    }

    const now = input.now ?? "2026-06-15T00:00:00.000Z";
    const pendingClaim: PendingAgentClaim = {
      id: `pending_claim_${this.nextPendingClaimNumber}`,
      agentDraftId: input.agentDraftId,
      registrationCodeHash: input.registrationCodeHash,
      agentId: input.agentId,
      ownerAddress: input.ownerAddress,
      twitterHandle: input.twitterHandle,
      tradingWalletId: input.tradingWalletId,
      walletAddress: input.walletAddress,
      predictManagerId: input.predictManagerId,
      registryProof: cloneRegisterAgentRegistryProof(input.registryProof),
      status: "pending",
      txDigest: null,
      createdAt: now,
      finalizedAt: null
    };
    this.nextPendingClaimNumber += 1;
    this.pendingClaims.set(pendingClaim.id, clonePendingClaim(pendingClaim));
    this.pendingClaimIdsByDraftId.set(pendingClaim.agentDraftId, pendingClaim.id);
    return clonePendingClaim(pendingClaim);
  }

  findPendingClaimById(pendingClaimId: string): PendingAgentClaim | undefined {
    const pendingClaim = this.pendingClaims.get(pendingClaimId);
    return pendingClaim ? clonePendingClaim(pendingClaim) : undefined;
  }

  findPendingClaimByDraftId(agentDraftId: string): PendingAgentClaim | undefined {
    const pendingClaimId = this.pendingClaimIdsByDraftId.get(agentDraftId);
    return pendingClaimId ? this.findPendingClaimById(pendingClaimId) : undefined;
  }

  markPendingClaimFinalized(
    pendingClaimId: string,
    input: { txDigest: string; finalizedAt: string }
  ): PendingAgentClaim | undefined {
    const pendingClaim = this.pendingClaims.get(pendingClaimId);
    if (!pendingClaim) {
      return undefined;
    }

    const finalized = {
      ...pendingClaim,
      status: "finalized" as const,
      txDigest: input.txDigest,
      finalizedAt: input.finalizedAt
    };
    this.pendingClaims.set(pendingClaimId, clonePendingClaim(finalized));
    return clonePendingClaim(finalized);
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
    const cloned = clonePositionSnapshot(snapshot);
    const existingIndex = this.positionSnapshots.findIndex((candidate) => hasSamePositionIdentity(candidate, cloned));
    if (existingIndex >= 0) {
      this.positionSnapshots[existingIndex] = cloned;
    } else {
      this.positionSnapshots.push(cloned);
    }

    return clonePositionSnapshot(cloned);
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
    const normalized = normalizeRuntimeCredential(credential);
    this.credentialsByRuntimeToken.set(normalized.token, cloneRuntimeCredential(normalized));
  }

  findRuntimeCredentialByToken(token: string): AgentRuntimeCredential | undefined {
    const credential = this.credentialsByRuntimeToken.get(token);
    return credential && !credential.revokedAt ? cloneRuntimeCredential(credential) : undefined;
  }

  findLatestRuntimeCredentialByAgentId(agentId: string): AgentRuntimeCredential | undefined {
    const credential = [...this.credentialsByRuntimeToken.values()]
      .filter((candidate) => candidate.agentId === agentId && !candidate.revokedAt)
      .sort((left, right) => right.credentialVersion - left.credentialVersion)[0];
    return credential ? cloneRuntimeCredential(credential) : undefined;
  }

  saveRuntimeCredentialRotationChallenge(
    challenge: RuntimeCredentialRotationChallenge
  ): RuntimeCredentialRotationChallenge {
    this.runtimeCredentialRotationChallengesByNonce.set(challenge.nonce, cloneRuntimeCredentialRotationChallenge(challenge));
    return cloneRuntimeCredentialRotationChallenge(challenge);
  }

  findRuntimeCredentialRotationChallenge(nonce: string): RuntimeCredentialRotationChallenge | undefined {
    const challenge = this.runtimeCredentialRotationChallengesByNonce.get(nonce);
    return challenge ? cloneRuntimeCredentialRotationChallenge(challenge) : undefined;
  }

  rotateRuntimeCredentialForAgent(input: RuntimeCredentialRotationInput): RuntimeCredentialRotationResult {
    const challenge = this.runtimeCredentialRotationChallengesByNonce.get(input.nonce);
    if (!challenge) {
      throw new Error("ROTATION_CHALLENGE_NOT_FOUND");
    }
    if (challenge.consumedAt) {
      throw new Error("ROTATION_NONCE_CONSUMED");
    }
    if (challenge.agentId !== input.agentId) {
      throw new Error("ROTATION_AGENT_MISMATCH");
    }
    if (normalizeAddress(challenge.ownerAddress) !== normalizeAddress(input.ownerAddress)) {
      throw new Error("OWNER_MISMATCH");
    }
    if (challenge.reason !== input.reason) {
      throw new Error("ROTATION_REASON_MISMATCH");
    }
    if (challenge.domain !== input.domain) {
      throw new Error("ROTATION_DOMAIN_MISMATCH");
    }
    if (challenge.chainId !== input.chainId) {
      throw new Error("ROTATION_CHAIN_MISMATCH");
    }
    if (challenge.currentCredentialVersion !== input.currentCredentialVersion) {
      throw new Error("CREDENTIAL_VERSION_CONFLICT");
    }
    if (Date.parse(challenge.expiresAt) <= Date.parse(input.now)) {
      throw new Error("ROTATION_CHALLENGE_EXPIRED");
    }

    const current = [...this.credentialsByRuntimeToken.values()]
      .filter((candidate) => candidate.agentId === input.agentId && !candidate.revokedAt)
      .sort((left, right) => right.credentialVersion - left.credentialVersion)[0];
    if (!current || current.credentialVersion !== input.currentCredentialVersion) {
      throw new Error("CREDENTIAL_VERSION_CONFLICT");
    }

    const previousCredential = cloneRuntimeCredential({
      ...current,
      revokedAt: input.now,
      revocationReason: input.revocationReason
    });
    this.credentialsByRuntimeToken.set(current.token, cloneRuntimeCredential(previousCredential));

    const credential: AgentRuntimeCredential = {
      agentId: input.agentId,
      token: createRuntimeCredentialToken(),
      createdAt: input.now,
      credentialVersion: challenge.nextCredentialVersion,
      scopes: [...runtimeCredentialScopes],
      revokedAt: null,
      revocationReason: null
    };
    this.credentialsByRuntimeToken.set(credential.token, cloneRuntimeCredential(credential));

    const consumedChallenge = {
      ...challenge,
      consumedAt: input.now
    };
    this.runtimeCredentialRotationChallengesByNonce.set(input.nonce, cloneRuntimeCredentialRotationChallenge(consumedChallenge));

    return {
      credential: cloneRuntimeCredential(credential),
      previousCredential
    };
  }

  exportSnapshot(): PlatformStoreSnapshot {
    return {
      agents: [...this.agents.values()].map(cloneAgent),
      runtimeCredentials: [...this.credentialsByRuntimeToken.values()].map(cloneRuntimeCredential),
      runtimeCredentialRotationChallenges: [...this.runtimeCredentialRotationChallengesByNonce.values()]
        .map(cloneRuntimeCredentialRotationChallenge),
      pairingDrafts: [...this.pairingDrafts.values()].map(clonePairingDraft),
      pendingClaims: [...this.pendingClaims.values()].map(clonePendingClaim),
      tradingWallets: [...this.tradingWallets.values()].map(cloneTradingWallet),
      identityBindings: [...this.identityBindingsByAgentId.values()].map(cloneIdentityBinding),
      performanceLedger: this.performanceLedger.map(clonePerformanceLedgerRecord),
      positionSnapshots: this.positionSnapshots.map(clonePositionSnapshot),
      competitions: [...this.competitions.values()].map(cloneCompetition),
      intents: [...this.intents.values()].map(cloneIntent),
      riskDecisions: [...this.riskDecisions.values()].map(cloneRiskDecision),
      executions: [...this.executions.values()].map(cloneExecution),
      ownerWithdrawals: [...this.ownerWithdrawals.values()].map(cloneOwnerWithdrawal),
      nextAgentNumber: this.nextAgentNumber,
      nextDraftNumber: this.nextDraftNumber,
      nextPendingClaimNumber: this.nextPendingClaimNumber,
      nextWalletNumber: this.nextWalletNumber,
      nextOwnerWithdrawalNumber: this.nextOwnerWithdrawalNumber
    };
  }

  private restoreSnapshot(snapshot: PlatformStoreSnapshot): void {
    this.agents.clear();
    this.credentialsByRuntimeToken.clear();
    this.runtimeCredentialRotationChallengesByNonce.clear();
    this.pairingDrafts.clear();
    this.pairingDraftIdsByCode.clear();
    this.pendingClaims.clear();
    this.pendingClaimIdsByDraftId.clear();
    this.tradingWallets.clear();
    this.tradingWalletIdsByAgentId.clear();
    this.identityBindingsByAgentId.clear();
    this.performanceLedger.length = 0;
    this.positionSnapshots.length = 0;
    this.competitions.clear();
    this.intents.clear();
    this.intentIdsByIdempotencyKey.clear();
    this.riskDecisions.clear();
    this.executions.clear();
    this.ownerWithdrawals.clear();

    for (const agent of snapshot.agents) {
      this.agents.set(agent.id, cloneAgent(agent));
    }
    for (const credential of snapshot.runtimeCredentials) {
      const normalized = normalizeRuntimeCredential(credential);
      this.credentialsByRuntimeToken.set(normalized.token, cloneRuntimeCredential(normalized));
    }
    for (const challenge of snapshot.runtimeCredentialRotationChallenges ?? []) {
      this.runtimeCredentialRotationChallengesByNonce.set(
        challenge.nonce,
        cloneRuntimeCredentialRotationChallenge(challenge)
      );
    }
    for (const draft of snapshot.pairingDrafts) {
      this.pairingDrafts.set(draft.id, clonePairingDraft(draft));
      this.pairingDraftIdsByCode.set(draft.registrationCode, draft.id);
    }
    for (const pendingClaim of snapshot.pendingClaims ?? []) {
      this.pendingClaims.set(pendingClaim.id, clonePendingClaim(pendingClaim));
      this.pendingClaimIdsByDraftId.set(pendingClaim.agentDraftId, pendingClaim.id);
    }
    for (const wallet of snapshot.tradingWallets) {
      this.tradingWallets.set(wallet.id, cloneTradingWallet(wallet));
      if (wallet.status === "active" || !this.tradingWalletIdsByAgentId.has(wallet.agentId)) {
        this.tradingWalletIdsByAgentId.set(wallet.agentId, wallet.id);
      }
    }
    for (const binding of snapshot.identityBindings) {
      this.identityBindingsByAgentId.set(binding.agentId, cloneIdentityBinding(binding));
    }
    this.performanceLedger.push(...snapshot.performanceLedger.map(clonePerformanceLedgerRecord));
    this.positionSnapshots.push(...snapshot.positionSnapshots.map(clonePositionSnapshot));
    for (const competition of snapshot.competitions) {
      this.competitions.set(competition.id, cloneCompetition(competition));
    }
    for (const intent of snapshot.intents) {
      this.intents.set(intent.id, cloneIntent(intent));
      this.intentIdsByIdempotencyKey.set(createIntentKey(intent), intent.id);
    }
    for (const riskDecision of snapshot.riskDecisions) {
      this.riskDecisions.set(riskDecision.id, cloneRiskDecision(riskDecision));
    }
    for (const execution of snapshot.executions) {
      this.executions.set(execution.id, cloneExecution(execution));
    }
    for (const withdrawal of snapshot.ownerWithdrawals) {
      this.ownerWithdrawals.set(withdrawal.id, cloneOwnerWithdrawal(withdrawal));
    }

    this.nextAgentNumber = snapshot.nextAgentNumber;
    this.nextDraftNumber = snapshot.nextDraftNumber;
    this.nextPendingClaimNumber = snapshot.nextPendingClaimNumber ?? inferNextNumber(
      [...this.pendingClaims.keys()],
      "pending_claim_"
    );
    this.nextWalletNumber = snapshot.nextWalletNumber;
    this.nextOwnerWithdrawalNumber = snapshot.nextOwnerWithdrawalNumber;
  }
}

function cloneAgent(agent: AgentProfile): AgentProfile {
  return { ...agent };
}

function cloneRuntimeCredential(credential: AgentRuntimeCredential): AgentRuntimeCredential {
  return {
    ...normalizeRuntimeCredential(credential),
    scopes: [...credential.scopes]
  };
}

function normalizeRuntimeCredential(credential: AgentRuntimeCredential): AgentRuntimeCredential {
  return {
    ...credential,
    credentialVersion: Number.isSafeInteger(credential.credentialVersion) && credential.credentialVersion > 0
      ? credential.credentialVersion
      : 1,
    revokedAt: credential.revokedAt ?? null,
    revocationReason: credential.revocationReason ?? null
  };
}

function cloneRuntimeCredentialRotationChallenge(
  challenge: RuntimeCredentialRotationChallenge
): RuntimeCredentialRotationChallenge {
  return {
    ...challenge,
    consumedAt: challenge.consumedAt ?? null
  };
}

function clonePairingDraft(draft: AgentPairingDraft): AgentPairingDraft {
  return { ...draft };
}

function clonePendingClaim(pendingClaim: PendingAgentClaim): PendingAgentClaim {
  return {
    ...pendingClaim,
    registryProof: cloneRegisterAgentRegistryProof(pendingClaim.registryProof),
    txDigest: pendingClaim.txDigest ?? null,
    finalizedAt: pendingClaim.finalizedAt ?? null
  };
}

function cloneRegisterAgentRegistryProof(
  proof: PendingAgentClaim["registryProof"]
): PendingAgentClaim["registryProof"] {
  return { ...proof };
}

function cloneTradingWallet(wallet: TradingWallet): TradingWallet {
  return { ...wallet };
}

function normalizeClaimBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
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

function hasSamePositionIdentity(left: AgentPositionSnapshot, right: AgentPositionSnapshot): boolean {
  return left.agentId === right.agentId &&
    left.competitionId === right.competitionId &&
    left.positionRef.kind === right.positionRef.kind &&
    left.positionRef.openExecutionId === right.positionRef.openExecutionId &&
    left.positionRef.marketKey === right.positionRef.marketKey &&
    left.positionRef.rangeKey === right.positionRef.rangeKey;
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

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function inferNextNumber(ids: string[], prefix: string): number {
  const max = ids.reduce((highest, id) => {
    if (!id.startsWith(prefix)) {
      return highest;
    }
    const value = Number(id.slice(prefix.length));
    return Number.isSafeInteger(value) && value > highest ? value : highest;
  }, 0);
  return max + 1;
}
