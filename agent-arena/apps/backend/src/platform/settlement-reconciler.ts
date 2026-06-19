import { createSettlementClaimJob, type SettlementClaimStatus } from "./settlement";
import type { PlatformMockStore } from "./mock-store";
import type { AgentPositionSnapshot, PositionKind, TradingWallet } from "./types";

const inFlightSettlementClaims = new Set<string>();

export type SettlementClaimExecutionRequest =
  | {
    walletId: string;
    operation: "claim_settled_directional";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    strikeRaw: string;
    direction: "up" | "down";
    minProceedsRaw: string;
    dryRunOnly: false;
  }
  | {
    walletId: string;
    operation: "claim_settled_range";
    managerId: string;
    oracleId: string;
    expiryMs: string;
    lowerStrikeRaw: string;
    higherStrikeRaw: string;
    minProceedsRaw: string;
    dryRunOnly: false;
  };

export interface SettlementClaimExecutionResult {
  status: "queued" | "submitted" | "confirmed" | "partial" | "failed";
  txDigest?: string | null;
  actualProceedsRaw?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface SettlementRedemptionLookupRequest {
  position: AgentPositionSnapshot;
  wallet: TradingWallet;
  claimRequest: SettlementClaimExecutionRequest;
}

export interface SettlementRedemptionRecord {
  txDigest?: string | null;
  proceedsRaw?: string | null;
  quantityRaw?: string | null;
}

export interface ReconcileSettlementsOptions {
  agentId?: string;
  nowMs?: number;
  executeSettlementClaim?: (request: SettlementClaimExecutionRequest) => Promise<SettlementClaimExecutionResult>;
  readSettlementRedemption?: (request: SettlementRedemptionLookupRequest) => Promise<SettlementRedemptionRecord | null>;
}

export interface SettlementReconcileSummary {
  results: SettlementReconcileResult[];
}

export type SettlementReconcileResult =
  | {
    agentId: string;
    competitionId: string;
    openExecutionId: string | null;
    status: "claimed";
    claimId: string;
    claimStatus: SettlementClaimStatus;
    txDigest: string | null;
  }
  | {
    agentId: string;
    competitionId: string;
    openExecutionId: string | null;
    status: "skipped";
    reason:
      | "already_claimed"
      | "claim_in_progress"
      | "executor_not_configured"
      | "invalid_expiry"
      | "manager_not_ready"
      | "missing_position_fields"
      | "missing_wallet"
      | "not_expired"
      | "oracle_not_settled";
  }
  | {
    agentId: string;
    competitionId: string;
    openExecutionId: string | null;
    status: "failed";
    claimId: string;
    errorCode: string;
    txDigest: string | null;
  };

export async function reconcileSettlements(
  store: PlatformMockStore,
  options: ReconcileSettlementsOptions = {}
): Promise<SettlementReconcileSummary> {
  const nowMs = options.nowMs ?? Date.now();
  const results: SettlementReconcileResult[] = [];
  const openPositions = store.listPositionSnapshots(options.agentId ? { agentId: options.agentId } : {})
    .filter((position) => position.status === "open" || position.status === "reduced");

  for (const position of openPositions) {
    const base = createResultBase(position);
    const expiryMsNumber = Number(position.expiryMs);
    if (!Number.isFinite(expiryMsNumber)) {
      results.push({ ...base, status: "skipped", reason: "invalid_expiry" });
      continue;
    }

    if (expiryMsNumber > nowMs) {
      results.push({ ...base, status: "skipped", reason: "not_expired" });
      continue;
    }

    const positionIdentityKey = createPositionIdentityKey(position);
    if (hasActiveClaimForPosition(store, positionIdentityKey)) {
      results.push({ ...base, status: "skipped", reason: "already_claimed" });
      continue;
    }

    if (inFlightSettlementClaims.has(positionIdentityKey)) {
      results.push({ ...base, status: "skipped", reason: "claim_in_progress" });
      continue;
    }

    const wallet = store.getTradingWalletByAgentId(position.agentId);
    if (!wallet || wallet.status !== "active") {
      results.push({ ...base, status: "skipped", reason: "missing_wallet" });
      continue;
    }

    if (wallet.predictManagerStatus !== "ready" || !wallet.predictManagerId) {
      results.push({ ...base, status: "skipped", reason: "manager_not_ready" });
      continue;
    }

    const request = createClaimRequest(position, wallet);
    if (!request) {
      results.push({ ...base, status: "skipped", reason: "missing_position_fields" });
      continue;
    }

    if (!options.executeSettlementClaim) {
      results.push({ ...base, status: "skipped", reason: "executor_not_configured" });
      continue;
    }

    inFlightSettlementClaims.add(positionIdentityKey);
    try {
      const createdAt = new Date(nowMs).toISOString();
      const executionResult = await executeClaim(options.executeSettlementClaim, request);
      if (isOracleSettlementPending(executionResult)) {
        results.push({ ...base, status: "skipped", reason: "oracle_not_settled" });
        continue;
      }
      const effectiveExecutionResult = await resolveExternallyRedeemedClaim({
        executionResult,
        position,
        wallet,
        request,
        readSettlementRedemption: options.readSettlementRedemption
      });

      const claimStatus = toSettlementClaimStatus(effectiveExecutionResult.status);
      const job = createSettlementClaimJob(store, {
        agentId: position.agentId,
        competitionId: position.competitionId,
        tradingWalletId: wallet.id,
        walletAddress: wallet.address,
        predictManagerId: wallet.predictManagerId,
        oracleId: position.oracleId,
        expiryMs: position.expiryMs,
        positionKind: position.positionRef.kind,
        positionIdentityKey,
        quantityRaw: position.quantityRaw,
        openExecutionId: position.positionRef.openExecutionId,
        proceedsRaw: effectiveExecutionResult.actualProceedsRaw ?? null,
        status: claimStatus,
        txDigest: effectiveExecutionResult.txDigest ?? null,
        errorCode: effectiveExecutionResult.errorCode ?? null,
        createdAt
      });

      if (claimStatus === "confirmed") {
        store.savePositionSnapshot({
          ...position,
          status: "settled",
          updatedAt: createdAt
        });
        if (!hasOpenExposure(store, position.agentId)) {
          store.updateAgentExposureStatus(position.agentId, "flat");
        }
      }

      if (claimStatus === "failed") {
        results.push({
          ...base,
          status: "failed",
          claimId: job.id,
          errorCode: effectiveExecutionResult.errorCode ?? "SETTLEMENT_CLAIM_FAILED",
          txDigest: effectiveExecutionResult.txDigest ?? null
        });
        continue;
      }

      results.push({
        ...base,
        status: "claimed",
        claimId: job.id,
        claimStatus,
        txDigest: effectiveExecutionResult.txDigest ?? null
      });
    } finally {
      inFlightSettlementClaims.delete(positionIdentityKey);
    }
  }

  return { results };
}

function createResultBase(position: AgentPositionSnapshot) {
  return {
    agentId: position.agentId,
    competitionId: position.competitionId,
    openExecutionId: position.positionRef.openExecutionId ?? null
  };
}

function hasActiveClaimForPosition(store: PlatformMockStore, positionIdentityKey: string): boolean {
  return store.listPerformanceLedger()
    .some((row) => (
      row.kind === "claim" &&
      row.positionIdentityKey === positionIdentityKey &&
      row.status !== "failed"
    ));
}

function createPositionIdentityKey(position: AgentPositionSnapshot): string {
  return [
    position.agentId,
    position.competitionId,
    position.positionRef.kind,
    position.positionRef.openExecutionId ?? "",
    position.positionRef.marketKey ?? "",
    position.positionRef.rangeKey ?? "",
    position.oracleId,
    position.expiryMs,
    position.strikeRaw ?? "",
    position.direction ?? "",
    position.lowerStrikeRaw ?? "",
    position.higherStrikeRaw ?? ""
  ].join("\u0000");
}

function createClaimRequest(
  position: AgentPositionSnapshot,
  wallet: TradingWallet
): SettlementClaimExecutionRequest | null {
  if (!wallet.predictManagerId) {
    return null;
  }

  if (position.positionRef.kind === "directional") {
    if (!position.strikeRaw || !position.direction) {
      return null;
    }

    return {
      walletId: wallet.id,
      operation: "claim_settled_directional",
      managerId: wallet.predictManagerId,
      oracleId: position.oracleId,
      expiryMs: position.expiryMs,
      strikeRaw: position.strikeRaw,
      direction: position.direction,
      minProceedsRaw: "0",
      dryRunOnly: false
    };
  }

  if (!position.lowerStrikeRaw || !position.higherStrikeRaw) {
    return null;
  }

  return {
    walletId: wallet.id,
    operation: "claim_settled_range",
    managerId: wallet.predictManagerId,
    oracleId: position.oracleId,
    expiryMs: position.expiryMs,
    lowerStrikeRaw: position.lowerStrikeRaw,
    higherStrikeRaw: position.higherStrikeRaw,
    minProceedsRaw: "0",
    dryRunOnly: false
  };
}

async function executeClaim(
  executeSettlementClaim: NonNullable<ReconcileSettlementsOptions["executeSettlementClaim"]>,
  request: SettlementClaimExecutionRequest
): Promise<SettlementClaimExecutionResult> {
  try {
    return await executeSettlementClaim(request);
  } catch (error) {
    return {
      status: "failed",
      txDigest: null,
      errorCode: "SETTLEMENT_EXECUTOR_ERROR",
      errorMessage: error instanceof Error ? error.message : "Settlement executor failed"
    };
  }
}

function isOracleSettlementPending(result: SettlementClaimExecutionResult): boolean {
  return result.status === "failed" && result.errorCode === "ORACLE_NOT_TRADEABLE";
}

async function resolveExternallyRedeemedClaim(input: {
  executionResult: SettlementClaimExecutionResult;
  position: AgentPositionSnapshot;
  wallet: TradingWallet;
  request: SettlementClaimExecutionRequest;
  readSettlementRedemption?: ReconcileSettlementsOptions["readSettlementRedemption"];
}): Promise<SettlementClaimExecutionResult> {
  if (!isPositionMissing(input.executionResult) || !input.readSettlementRedemption) {
    return input.executionResult;
  }

  const redemption = await input.readSettlementRedemption({
    position: input.position,
    wallet: input.wallet,
    claimRequest: input.request
  });
  if (!redemption) {
    return input.executionResult;
  }

  return {
    status: "confirmed",
    txDigest: redemption.txDigest ?? null,
    actualProceedsRaw: redemption.proceedsRaw ?? null,
    errorCode: null,
    errorMessage: null
  };
}

function isPositionMissing(result: SettlementClaimExecutionResult): boolean {
  return (
    result.status === "failed" &&
    (result.errorCode === "POSITION_NOT_FOUND" || result.errorCode === "RANGE_POSITION_NOT_FOUND")
  );
}

function toSettlementClaimStatus(status: SettlementClaimExecutionResult["status"]): SettlementClaimStatus {
  if (status === "failed") {
    return "failed";
  }

  if (status === "queued") {
    return "queued";
  }

  if (status === "partial") {
    return "submitted";
  }

  return "confirmed";
}

function hasOpenExposure(store: PlatformMockStore, agentId: string): boolean {
  return store.listPositionSnapshots({ agentId }).some((position) => (
    position.status === "open" || position.status === "reduced"
  ));
}
