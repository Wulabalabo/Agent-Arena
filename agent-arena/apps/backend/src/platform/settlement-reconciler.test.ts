import { describe, expect, it } from "bun:test";
import { PlatformMockStore } from "./mock-store";
import {
  reconcileSettlements,
  type SettlementClaimExecutionRequest
} from "./settlement-reconciler";
import type { AgentProfile, AgentPositionSnapshot, TradingWallet } from "./types";

const competitionId = "btc-15m-001";
const expiryMs = "1781700900000";
const nowMs = 1781700960000;

describe("platform settlement reconciler", () => {
  it("claims expired directional positions and marks confirmed exposure settled", async () => {
    const { agent, store, wallet } = createOpenDirectionalPosition();
    const calls: SettlementClaimExecutionRequest[] = [];

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async (request) => {
        calls.push(request);
        return {
          status: "confirmed",
          txDigest: "claim-digest",
          actualProceedsRaw: "5600000"
        };
      }
    });

    expect(summary.results).toMatchObject([{
      agentId: agent.id,
      competitionId,
      status: "claimed",
      claimStatus: "confirmed",
      claimId: "settlement_claim_1",
      txDigest: "claim-digest"
    }]);
    expect(calls).toEqual([{
      walletId: wallet.id,
      operation: "claim_settled_directional",
      managerId: "0xmanager",
      oracleId: "0xbtc15m",
      expiryMs,
      strikeRaw: "62929000000000",
      direction: "up",
      minProceedsRaw: "0",
      dryRunOnly: false
    }]);
    expect(store.listPositionSnapshots({ agentId: agent.id, competitionId })).toMatchObject([{
      status: "settled",
      updatedAt: "2026-06-17T12:56:00.000Z"
    }]);
    expect(store.getAgent(agent.id)?.exposureStatus).toBe("flat");
    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "claim",
      executionId: "settlement_claim_1",
      txDigest: "claim-digest",
      status: "confirmed",
      proceedsRaw: "5600000"
    }));
    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "position",
      executionId: "settlement_claim_1",
      costRaw: "5000000",
      proceedsRaw: "5600000",
      realizedPnlRaw: "600000",
      status: "realized"
    }));
  });

  it("does not submit a second claim for a position that already has an active claim row", async () => {
    const { agent, store, wallet } = createOpenDirectionalPosition();
    const identityKey = [
      agent.id,
      competitionId,
      "directional",
      "exec_open",
      "btc-up-62929000000000",
      "",
      "0xbtc15m",
      expiryMs,
      "62929000000000",
      "up",
      "",
      ""
    ].join("\u0000");
    store.recordPerformanceLedger({
      ...baseLedger(agent, wallet),
      kind: "claim",
      executionId: "settlement_claim_1",
      txDigest: "existing-claim",
      action: null,
      positionKind: "directional",
      positionIdentityKey: identityKey,
      quantityRaw: "500000",
      costRaw: null,
      proceedsRaw: null,
      status: "submitted"
    });

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async () => {
        throw new Error("claim executor should not be called");
      }
    });

    expect(summary.results).toMatchObject([{
      agentId: agent.id,
      status: "skipped",
      reason: "already_claimed"
    }]);
  });

  it("prevents concurrent duplicate submissions for the same expired position", async () => {
    const { agent, store } = createOpenDirectionalPosition();
    let resolveClaim: (() => void) | null = null;
    let claimStarted: (() => void) | null = null;
    const claimStartedPromise = new Promise<void>((resolve) => {
      claimStarted = resolve;
    });
    const releaseClaimPromise = new Promise<void>((resolve) => {
      resolveClaim = resolve;
    });
    let callCount = 0;

    const first = reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async () => {
        callCount += 1;
        claimStarted?.();
        await releaseClaimPromise;
        return {
          status: "confirmed",
          txDigest: "claim-digest",
          actualProceedsRaw: "5500000"
        };
      }
    });
    await claimStartedPromise;

    const second = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async () => {
        throw new Error("second concurrent executor should not run");
      }
    });
    resolveClaim?.();
    const firstSummary = await first;

    expect(second.results).toMatchObject([{
      agentId: agent.id,
      status: "skipped",
      reason: "claim_in_progress"
    }]);
    expect(firstSummary.results).toMatchObject([{
      agentId: agent.id,
      status: "claimed",
      claimStatus: "confirmed"
    }]);
    expect(callCount).toBe(1);
    expect(store.listPerformanceLedger({ agentId: agent.id }).filter((row) => row.kind === "claim")).toHaveLength(1);
  });

  it("claims distinct same-sized positions on the same oracle instead of broad-skipping them", async () => {
    const { agent, store, wallet } = createOpenDirectionalPosition();
    store.savePositionSnapshot({
      agentId: agent.id,
      competitionId,
      positionRef: {
        kind: "directional",
        marketKey: "btc-down-62929000000000",
        openExecutionId: "exec_open_2",
        quantity: "500000"
      },
      oracleId: "0xbtc15m",
      expiryMs,
      strikeRaw: "62929000000000",
      direction: "down",
      quantityRaw: "500000",
      status: "open",
      updatedAt: "2026-06-17T15:30:00.000Z"
    });
    store.recordPerformanceLedger({
      ...baseLedger(agent, wallet),
      kind: "execution",
      intentId: "intent_open_2",
      riskDecisionId: "risk_open_2",
      executionId: "exec_open_2",
      txDigest: "open-digest-2",
      action: "open_directional",
      positionKind: "directional",
      quantityRaw: "500000",
      costRaw: "5000000",
      proceedsRaw: null,
      status: "confirmed"
    });
    const requests: SettlementClaimExecutionRequest[] = [];

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async (request) => {
        requests.push(request);
        return {
          status: "confirmed",
          txDigest: `claim-${requests.length}`,
          actualProceedsRaw: "5500000"
        };
      }
    });

    expect(summary.results).toMatchObject([
      { status: "claimed", openExecutionId: "exec_open" },
      { status: "claimed", openExecutionId: "exec_open_2" }
    ]);
    expect(requests).toMatchObject([
      { operation: "claim_settled_directional", direction: "up" },
      { operation: "claim_settled_directional", direction: "down" }
    ]);
    expect(store.listPerformanceLedger({ agentId: agent.id }).filter((row) => row.kind === "claim")).toHaveLength(2);
  });

  it("claims expired range positions with lower and higher strike identity", async () => {
    const { agent, store, wallet } = createOpenRangePosition();
    const requests: SettlementClaimExecutionRequest[] = [];

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async (request) => {
        requests.push(request);
        return {
          status: "confirmed",
          txDigest: "range-claim-digest",
          actualProceedsRaw: "5500000"
        };
      }
    });

    expect(summary.results).toMatchObject([{
      agentId: agent.id,
      status: "claimed",
      claimStatus: "confirmed"
    }]);
    expect(requests).toEqual([{
      walletId: wallet.id,
      operation: "claim_settled_range",
      managerId: "0xmanager",
      oracleId: "0xbtc15m",
      expiryMs,
      lowerStrikeRaw: "62000000000000",
      higherStrikeRaw: "64000000000000",
      minProceedsRaw: "0",
      dryRunOnly: false
    }]);
    expect(store.listPositionSnapshots({ agentId: agent.id })[0].status).toBe("settled");
    expect(store.getAgent(agent.id)?.exposureStatus).toBe("flat");
  });

  it("skips positions that are not expired or cannot be claimed by the platform", async () => {
    const active = createOpenDirectionalPosition({
      expiryMs: String(nowMs + 60_000)
    });
    const noManager = createOpenDirectionalPosition({
      predictManagerId: null,
      predictManagerStatus: "missing"
    });

    await expect(reconcileSettlements(active.store, {
      nowMs,
      executeSettlementClaim: async () => {
        throw new Error("active position should not be claimed");
      }
    })).resolves.toMatchObject({
      results: [{
        agentId: active.agent.id,
        status: "skipped",
        reason: "not_expired"
      }]
    });

    await expect(reconcileSettlements(noManager.store, {
      nowMs,
      executeSettlementClaim: async () => {
        throw new Error("wallet without manager should not be claimed");
      }
    })).resolves.toMatchObject({
      results: [{
        agentId: noManager.agent.id,
        status: "skipped",
        reason: "manager_not_ready"
      }]
    });
  });

  it("does not record a failed claim job while Predict oracle settlement is not ready", async () => {
    const { agent, store } = createOpenDirectionalPosition();

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async () => ({
        status: "failed",
        errorCode: "ORACLE_NOT_TRADEABLE",
        errorMessage: "Oracle is not settled yet",
        txDigest: null
      })
    });

    expect(summary.results).toMatchObject([{
      agentId: agent.id,
      status: "skipped",
      reason: "oracle_not_settled"
    }]);
    expect(store.listPerformanceLedger({ agentId: agent.id }).filter((row) => row.kind === "claim")).toHaveLength(0);
    expect(store.listPositionSnapshots({ agentId: agent.id })[0].status).toBe("open");
    expect(store.getAgent(agent.id)?.exposureStatus).toBe("directional");
  });

  it("reconciles an expired directional position that was already redeemed outside the platform", async () => {
    const { agent, store, wallet, position } = createOpenDirectionalPosition();

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async () => ({
        status: "failed",
        errorCode: "POSITION_NOT_FOUND",
        txDigest: null
      }),
      readSettlementRedemption: async (request) => {
        expect(request.position).toEqual(position);
        expect(request.wallet).toEqual(wallet);
        expect(request.claimRequest).toMatchObject({
          operation: "claim_settled_directional",
          managerId: "0xmanager",
          oracleId: "0xbtc15m",
          strikeRaw: "62929000000000",
          direction: "up",
          expiryMs
        });

        return {
          txDigest: "external-redeem-digest",
          proceedsRaw: "5500000",
          quantityRaw: "500000"
        };
      }
    });

    expect(summary.results).toMatchObject([{
      agentId: agent.id,
      status: "claimed",
      claimStatus: "confirmed",
      claimId: "settlement_claim_1",
      txDigest: "external-redeem-digest"
    }]);
    expect(store.listPositionSnapshots({ agentId: agent.id })[0].status).toBe("settled");
    expect(store.getAgent(agent.id)?.exposureStatus).toBe("flat");
    expect(store.listPerformanceLedger({ agentId: agent.id }).filter((row) => row.kind === "claim")).toEqual([
      expect.objectContaining({
        executionId: "settlement_claim_1",
        txDigest: "external-redeem-digest",
        proceedsRaw: "5500000",
        status: "confirmed",
        errorCode: null
      })
    ]);
    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "position",
      executionId: "settlement_claim_1",
      costRaw: "5000000",
      proceedsRaw: "5500000",
      realizedPnlRaw: "500000",
      status: "realized"
    }));
  });

  it("reconciles an expired range position that was already redeemed outside the platform", async () => {
    const { agent, store, wallet, position } = createOpenRangePosition();

    const summary = await reconcileSettlements(store, {
      nowMs,
      executeSettlementClaim: async () => ({
        status: "failed",
        errorCode: "RANGE_POSITION_NOT_FOUND",
        txDigest: null
      }),
      readSettlementRedemption: async (request) => {
        expect(request.position).toEqual(position);
        expect(request.wallet).toEqual(wallet);
        expect(request.claimRequest).toMatchObject({
          operation: "claim_settled_range",
          managerId: "0xmanager",
          oracleId: "0xbtc15m",
          lowerStrikeRaw: "62000000000000",
          higherStrikeRaw: "64000000000000",
          expiryMs
        });

        return {
          txDigest: "external-range-redeem-digest",
          proceedsRaw: "4500000",
          quantityRaw: "500000"
        };
      }
    });

    expect(summary.results).toMatchObject([{
      agentId: agent.id,
      status: "claimed",
      claimStatus: "confirmed",
      claimId: "settlement_claim_1",
      txDigest: "external-range-redeem-digest"
    }]);
    expect(store.listPositionSnapshots({ agentId: agent.id })[0].status).toBe("settled");
    expect(store.getAgent(agent.id)?.exposureStatus).toBe("flat");
    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "position",
      executionId: "settlement_claim_1",
      costRaw: "5000000",
      proceedsRaw: "4500000",
      realizedPnlRaw: "-500000",
      status: "realized"
    }));
  });
});

function createOpenDirectionalPosition(options: {
  expiryMs?: string;
  predictManagerId?: string | null;
  predictManagerStatus?: TradingWallet["predictManagerStatus"];
} = {}): {
  agent: AgentProfile;
  store: PlatformMockStore;
  wallet: TradingWallet;
  position: AgentPositionSnapshot;
} {
  const store = new PlatformMockStore();
  const agent = store.createClaimedAgent({
    displayName: "Settlement Agent",
    ownerAddress: "0xowner",
    twitterHandle: null
  });
  const wallet = store.bindTradingWallet(agent.id, "0xwallet", {
    predictManagerId: options.predictManagerId === undefined ? "0xmanager" : options.predictManagerId,
    predictManagerStatus: options.predictManagerStatus ?? (
      options.predictManagerId === null ? "missing" : "ready"
    )
  });
  const position: AgentPositionSnapshot = {
    agentId: agent.id,
    competitionId,
    positionRef: {
      kind: "directional",
      marketKey: "btc-up-62929000000000",
      openExecutionId: "exec_open",
      quantity: "500000"
    },
    oracleId: "0xbtc15m",
    expiryMs: options.expiryMs ?? expiryMs,
    strikeRaw: "62929000000000",
    direction: "up",
    quantityRaw: "500000",
    status: "open",
    updatedAt: "2026-06-17T15:30:00.000Z"
  };

  store.updateAgentExposureStatus(agent.id, "directional");
  store.savePositionSnapshot(position);
  store.recordPerformanceLedger({
    ...baseLedger(agent, wallet),
    kind: "execution",
    intentId: "intent_open",
    riskDecisionId: "risk_open",
    executionId: "exec_open",
    txDigest: "open-digest",
    action: "open_directional",
    positionKind: "directional",
    quantityRaw: "500000",
    costRaw: "5000000",
    proceedsRaw: null,
    status: "confirmed"
  });

  return { agent, store, wallet, position };
}

function createOpenRangePosition(): {
  agent: AgentProfile;
  store: PlatformMockStore;
  wallet: TradingWallet;
  position: AgentPositionSnapshot;
} {
  const store = new PlatformMockStore();
  const agent = store.createClaimedAgent({
    displayName: "Range Settlement Agent",
    ownerAddress: "0xowner",
    twitterHandle: null
  });
  const wallet = store.bindTradingWallet(agent.id, "0xwallet", {
    predictManagerId: "0xmanager",
    predictManagerStatus: "ready"
  });
  const position: AgentPositionSnapshot = {
    agentId: agent.id,
    competitionId,
    positionRef: {
      kind: "range",
      rangeKey: "btc-range-62000-64000",
      openExecutionId: "exec_range",
      quantity: "500000"
    },
    oracleId: "0xbtc15m",
    expiryMs,
    lowerStrikeRaw: "62000000000000",
    higherStrikeRaw: "64000000000000",
    quantityRaw: "500000",
    status: "open",
    updatedAt: "2026-06-17T15:30:00.000Z"
  };

  store.updateAgentExposureStatus(agent.id, "range");
  store.savePositionSnapshot(position);
  store.recordPerformanceLedger({
    ...baseLedger(agent, wallet),
    kind: "execution",
    intentId: "intent_range",
    riskDecisionId: "risk_range",
    executionId: "exec_range",
    txDigest: "range-open-digest",
    action: "open_range",
    positionKind: "range",
    quantityRaw: "500000",
    costRaw: "5000000",
    proceedsRaw: null,
    status: "confirmed"
  });

  return { agent, store, wallet, position };
}

function baseLedger(agent: AgentProfile, wallet: TradingWallet) {
  return {
    agentDraftId: null,
    registrationCodeHash: null,
    agentId: agent.id,
    ownerAddress: agent.ownerAddress,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: wallet.predictManagerId,
    competitionId,
    oracleId: "0xbtc15m",
    expiryMs,
    intentId: null,
    riskDecisionId: null,
    executionId: null,
    txDigest: null,
    action: null,
    positionKind: null,
    quantityRaw: null,
    costRaw: null,
    proceedsRaw: null,
    status: "confirmed",
    errorCode: null,
    policyDrift: "none" as const,
    createdAt: "2026-06-17T15:31:00.000Z",
    serverReceivedAt: "2026-06-17T15:31:00.000Z"
  };
}
