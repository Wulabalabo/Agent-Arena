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
  quantityRaw: string;
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
    costRaw: null,
    proceedsRaw: null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    policyDrift: "none",
    createdAt: input.createdAt,
    serverReceivedAt: input.createdAt
  }));

  return { ...job };
}

function countExistingClaimRows(store: PlatformMockStore, agentId: string): number {
  return store.listPerformanceLedger({ agentId }).filter((row) => row.kind === "claim").length;
}
