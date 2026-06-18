import { describe, expect, it } from "bun:test";
import { PlatformMockStore } from "./mock-store";
import { createSettlementClaimJob } from "./settlement";

describe("platform settlement claim jobs", () => {
  it("creates platform-controlled claim jobs keyed by agent id and records ledger rows", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "Settlement Agent",
      ownerAddress: "0xowner",
      twitterHandle: null
    });
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet", {
      predictManagerId: "0xmanager"
    });

    const job = createSettlementClaimJob(store, {
      agentId: agent.id,
      competitionId: "btc-15m-001",
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: "0xmanager",
      oracleId: "0xbtc15m",
      expiryMs: "1781701200000",
      positionKind: "range",
      quantityRaw: "10",
      status: "queued",
      createdAt: "2026-06-15T10:16:00.000Z"
    });

    expect(job).toMatchObject({
      id: "settlement_claim_1",
      agentId: agent.id,
      tradingWalletId: wallet.id,
      status: "queued"
    });
    expect(job).not.toHaveProperty("runtimeToken");
    expect(store.listPerformanceLedger({ agentId: agent.id })).toMatchObject([{
      kind: "claim",
      agentId: agent.id,
      tradingWalletId: wallet.id,
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      action: null,
      positionKind: "range",
      quantityRaw: "10",
      status: "queued"
    }]);
  });

  it("records position-level realized PnL for confirmed settlement claims", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "Settled PnL Agent",
      ownerAddress: "0xowner",
      twitterHandle: null
    });
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet", {
      predictManagerId: "0xmanager"
    });
    store.recordPerformanceLedger({
      kind: "execution",
      agentDraftId: null,
      registrationCodeHash: null,
      agentId: agent.id,
      ownerAddress: "0xowner",
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: "0xmanager",
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      expiryMs: "1781701200000",
      intentId: "intent_open",
      riskDecisionId: "risk_open",
      executionId: "exec_open",
      txDigest: "0xdigest_open",
      action: "open_directional",
      positionKind: "directional",
      quantityRaw: "10",
      costRaw: "100",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-15T10:04:00.000Z",
      serverReceivedAt: "2026-06-15T10:04:00.100Z"
    });

    createSettlementClaimJob(store, {
      agentId: agent.id,
      competitionId: "btc-15m-001",
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: "0xmanager",
      oracleId: "0xbtc15m",
      expiryMs: "1781701200000",
      positionKind: "directional",
      quantityRaw: "10",
      openExecutionId: "exec_open",
      proceedsRaw: "140",
      status: "confirmed",
      txDigest: "0xclaimdigest",
      createdAt: "2026-06-15T10:16:00.000Z"
    });

    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "position",
      tradingWalletId: wallet.id,
      executionId: "settlement_claim_1",
      txDigest: "0xclaimdigest",
      action: null,
      positionKind: "directional",
      quantityRaw: "10",
      costRaw: "100",
      proceedsRaw: "140",
      realizedPnlRaw: "40",
      status: "realized"
    }));
  });
});
