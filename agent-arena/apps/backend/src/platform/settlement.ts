import { createPerformanceLedgerRecord } from "./performance-ledger";
import type { PlatformMockStore } from "./mock-store";
import type { PositionKind } from "./types";

export type SettlementClaimStatus = "queued" | "submitted" | "confirmed" | "failed";

export interface CreateSettlementClaimJobInput {
  agentId: string;
  competitionId: string;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string;
  oracleId: string;
  expiryMs: string;
  positionKind: PositionKind;
  positionIdentityKey?: string | null;
  quantityRaw: string;
  openExecutionId?: string;
  costRaw?: string | null;
  proceedsRaw?: string | null;
  status: SettlementClaimStatus;
  txDigest?: string | null;
  errorCode?: string | null;
  createdAt: string;
}

export interface SettlementClaimJob extends CreateSettlementClaimJobInput {
  id: string;
}

export function createSettlementClaimJob(
  store: PlatformMockStore,
  input: CreateSettlementClaimJobInput
): SettlementClaimJob {
  const job: SettlementClaimJob = {
    ...input,
    id: `settlement_claim_${countExistingClaimRows(store, input.agentId) + 1}`
  };
  const binding = store.getIdentityBindingByAgentId(input.agentId);
  const agent = store.getAgent(input.agentId);

  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    kind: "claim",
    agentDraftId: binding?.agentDraftId ?? null,
    registrationCodeHash: binding?.registrationCodeHash ?? null,
    agentId: input.agentId,
    ownerAddress: binding?.ownerAddress ?? agent?.ownerAddress ?? null,
    tradingWalletId: input.tradingWalletId,
    walletAddress: input.walletAddress,
    predictManagerId: input.predictManagerId,
    competitionId: input.competitionId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    intentId: null,
    riskDecisionId: null,
    executionId: job.id,
    txDigest: input.txDigest ?? null,
    action: null,
    positionKind: input.positionKind,
    quantityRaw: input.quantityRaw,
    costRaw: input.costRaw ?? null,
    proceedsRaw: input.proceedsRaw ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    positionIdentityKey: input.positionIdentityKey ?? null,
    policyDrift: "none",
    createdAt: input.createdAt,
    serverReceivedAt: input.createdAt
  }));
  recordSettledPositionPnl(store, input, job.id);

  return { ...job };
}

function recordSettledPositionPnl(
  store: PlatformMockStore,
  input: CreateSettlementClaimJobInput,
  executionId: string
): void {
  if (input.status !== "confirmed" || !input.proceedsRaw || !isRawInteger(input.proceedsRaw)) {
    return;
  }

  const openCostRaw = input.costRaw ?? findOpenExecutionCostRaw(store, input.agentId, input.openExecutionId);
  if (!openCostRaw || !isRawInteger(openCostRaw)) {
    return;
  }

  const binding = store.getIdentityBindingByAgentId(input.agentId);
  const agent = store.getAgent(input.agentId);
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    kind: "position",
    agentDraftId: binding?.agentDraftId ?? null,
    registrationCodeHash: binding?.registrationCodeHash ?? null,
    agentId: input.agentId,
    ownerAddress: binding?.ownerAddress ?? agent?.ownerAddress ?? null,
    tradingWalletId: input.tradingWalletId,
    walletAddress: input.walletAddress,
    predictManagerId: input.predictManagerId,
    competitionId: input.competitionId,
    oracleId: input.oracleId,
    expiryMs: input.expiryMs,
    intentId: null,
    riskDecisionId: null,
    executionId,
    txDigest: input.txDigest ?? null,
    action: null,
    positionKind: input.positionKind,
    quantityRaw: input.quantityRaw,
    costRaw: openCostRaw,
    proceedsRaw: input.proceedsRaw,
    realizedPnlRaw: subtractRawAmounts(input.proceedsRaw, openCostRaw),
    status: "realized",
    errorCode: null,
    positionIdentityKey: input.positionIdentityKey ?? null,
    policyDrift: "none",
    createdAt: input.createdAt,
    serverReceivedAt: input.createdAt
  }));
}

function findOpenExecutionCostRaw(
  store: PlatformMockStore,
  agentId: string,
  openExecutionId: string | undefined
): string | null {
  if (!openExecutionId) {
    return null;
  }

  return store.listPerformanceLedger({ agentId }).find((row) => (
    row.kind === "execution" &&
    row.executionId === openExecutionId &&
    row.status === "confirmed"
  ))?.costRaw ?? null;
}

function countExistingClaimRows(store: PlatformMockStore, agentId: string): number {
  return store.listPerformanceLedger({ agentId }).filter((row) => row.kind === "claim").length;
}

function isRawInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

function subtractRawAmounts(left: string, right: string): string {
  return (BigInt(left) - BigInt(right)).toString();
}
