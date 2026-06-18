import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PlatformMockStore, type CreatePairingDraftOptions, type PlatformStoreSnapshot } from "./mock-store";
import type { AgentRuntimeCredential } from "./auth";
import type {
  AgentIntent,
  AgentPairingDraft,
  AgentIdentityBinding,
  AgentPositionSnapshot,
  Competition,
  ExecutionRecord,
  ExposureStatus,
  OwnerWithdrawalRecord,
  PerformanceLedgerRecord,
  RiskDecision
} from "./types";

export class SQLitePlatformStore extends PlatformMockStore {
  private readonly db: Database;

  constructor(private readonly dbPath: string) {
    super(loadPlatformSnapshot(dbPath));
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS platform_state (
        id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    if (!this.readPersistedState()) {
      this.persist();
    }
  }

  override createPairingDraft(displayName: string, options: CreatePairingDraftOptions = {}): AgentPairingDraft {
    const result = super.createPairingDraft(displayName, options);
    this.persist();
    return result;
  }

  override markPairingDraftClaimed(draftId: string): AgentPairingDraft | undefined {
    const result = super.markPairingDraftClaimed(draftId);
    this.persist();
    return result;
  }

  override createClaimedAgent(input: Parameters<PlatformMockStore["createClaimedAgent"]>[0]) {
    const result = super.createClaimedAgent(input);
    this.persist();
    return result;
  }

  override updateAgentExposureStatus(agentId: string, exposureStatus: ExposureStatus) {
    const result = super.updateAgentExposureStatus(agentId, exposureStatus);
    this.persist();
    return result;
  }

  override bindTradingWallet(
    agentId: string,
    address: string,
    overrides: Parameters<PlatformMockStore["bindTradingWallet"]>[2] = {}
  ) {
    const result = super.bindTradingWallet(agentId, address, overrides);
    this.persist();
    return result;
  }

  override updateTradingWallet(
    walletId: string,
    updates: Parameters<PlatformMockStore["updateTradingWallet"]>[1]
  ) {
    const result = super.updateTradingWallet(walletId, updates);
    this.persist();
    return result;
  }

  override saveIdentityBinding(binding: AgentIdentityBinding): AgentIdentityBinding {
    const result = super.saveIdentityBinding(binding);
    this.persist();
    return result;
  }

  override recordPerformanceLedger(record: PerformanceLedgerRecord): PerformanceLedgerRecord {
    const result = super.recordPerformanceLedger(record);
    this.persist();
    return result;
  }

  override savePositionSnapshot(snapshot: AgentPositionSnapshot): AgentPositionSnapshot {
    const result = super.savePositionSnapshot(snapshot);
    this.persist();
    return result;
  }

  override seedCompetition(competition?: Competition): Competition {
    const result = super.seedCompetition(competition);
    this.persist();
    return result;
  }

  override saveIntent(intent: AgentIntent): AgentIntent {
    const result = super.saveIntent(intent);
    this.persist();
    return result;
  }

  override saveRiskDecision(riskDecision: RiskDecision): RiskDecision {
    const result = super.saveRiskDecision(riskDecision);
    this.persist();
    return result;
  }

  override saveExecution(execution: ExecutionRecord): ExecutionRecord {
    const result = super.saveExecution(execution);
    this.persist();
    return result;
  }

  override recordOwnerWithdrawal(input: Omit<OwnerWithdrawalRecord, "id" | "createdAt">): OwnerWithdrawalRecord {
    const result = super.recordOwnerWithdrawal(input);
    this.persist();
    return result;
  }

  override saveRuntimeCredential(credential: AgentRuntimeCredential): void {
    super.saveRuntimeCredential(credential);
    this.persist();
  }

  override findRuntimeCredentialByToken(token: string): AgentRuntimeCredential | undefined {
    return super.findRuntimeCredentialByToken(token)
      ?? super.findRuntimeCredentialByToken(createRuntimeCredentialHash(token));
  }

  close(): void {
    this.db.close();
  }

  private persist(): void {
    this.db.query(`
      INSERT INTO platform_state (id, state_json, updated_at)
      VALUES ('default', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(createPersistedSnapshot(this.exportSnapshot())), new Date().toISOString());
  }

  private readPersistedState(): PlatformStoreSnapshot | null {
    const row = this.db.query("SELECT state_json FROM platform_state WHERE id = 'default'")
      .get() as { state_json: string } | null;
    return row ? parsePlatformSnapshot(row.state_json) : null;
  }
}

function loadPlatformSnapshot(dbPath: string): PlatformStoreSnapshot | undefined {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  const row = db.query("SELECT state_json FROM platform_state WHERE id = 'default'")
    .get() as { state_json: string } | null;
  db.close();
  return row ? parsePlatformSnapshot(row.state_json) : undefined;
}

function parsePlatformSnapshot(raw: string): PlatformStoreSnapshot {
  const parsed = JSON.parse(raw) as PlatformStoreSnapshot;
  return {
    agents: parsed.agents ?? [],
    runtimeCredentials: parsed.runtimeCredentials ?? [],
    pairingDrafts: parsed.pairingDrafts ?? [],
    tradingWallets: parsed.tradingWallets ?? [],
    identityBindings: parsed.identityBindings ?? [],
    performanceLedger: parsed.performanceLedger ?? [],
    positionSnapshots: parsed.positionSnapshots ?? [],
    competitions: parsed.competitions ?? [],
    intents: parsed.intents ?? [],
    riskDecisions: parsed.riskDecisions ?? [],
    executions: parsed.executions ?? [],
    ownerWithdrawals: parsed.ownerWithdrawals ?? [],
    nextAgentNumber: normalizeCounter(parsed.nextAgentNumber),
    nextDraftNumber: normalizeCounter(parsed.nextDraftNumber),
    nextWalletNumber: normalizeCounter(parsed.nextWalletNumber),
    nextOwnerWithdrawalNumber: normalizeCounter(parsed.nextOwnerWithdrawalNumber)
  };
}

function normalizeCounter(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function createPersistedSnapshot(snapshot: PlatformStoreSnapshot): PlatformStoreSnapshot {
  return {
    ...snapshot,
    runtimeCredentials: snapshot.runtimeCredentials.map((credential) => ({
      ...credential,
      token: createRuntimeCredentialHash(credential.token)
    }))
  };
}

function createRuntimeCredentialHash(token: string): string {
  if (token.startsWith("sha256:")) {
    return token;
  }

  return `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}
