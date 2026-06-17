import { describe, expect, it } from "bun:test";
import { createPerformanceLedgerRecord, createRegistrationCodeHash } from "./performance-ledger";
import { PlatformMockStore } from "./mock-store";

describe("platform mock store identity ledger", () => {
  it("stores identity bindings and performance ledger rows as defensive copies", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "Trend Ranger",
      ownerAddress: "0xowner",
      twitterHandle: "@Sui_Agent"
    });
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    const registrationCodeHash = createRegistrationCodeHash("PAIR-2048");

    store.saveIdentityBinding({
      agentDraftId: "draft_1",
      registrationCodeHash,
      agentId: agent.id,
      ownerAddress: "0xowner",
      twitterHandle: "Sui_Agent",
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: null,
      createdAt: "2026-06-17T10:00:00.000Z",
      claimedAt: "2026-06-17T10:00:01.000Z"
    });
    store.recordPerformanceLedger(createPerformanceLedgerRecord({
      kind: "wallet_binding",
      agentDraftId: "draft_1",
      registrationCodeHash,
      agentId: agent.id,
      ownerAddress: "0xowner",
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: null,
      competitionId: null,
      oracleId: null,
      expiryMs: null,
      intentId: null,
      riskDecisionId: null,
      executionId: null,
      txDigest: null,
      action: null,
      positionKind: null,
      quantityRaw: null,
      costRaw: null,
      proceedsRaw: null,
      status: "active",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T10:00:01.000Z",
      serverReceivedAt: "2026-06-17T10:00:01.100Z"
    }));

    const binding = store.getIdentityBindingByAgentId(agent.id);
    const ledgerRows = store.listPerformanceLedger({ agentId: agent.id });

    expect(binding).toMatchObject({
      agentDraftId: "draft_1",
      registrationCodeHash,
      agentId: agent.id,
      tradingWalletId: wallet.id
    });
    expect(JSON.stringify(binding)).not.toContain("PAIR-2048");
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]).toMatchObject({
      kind: "wallet_binding",
      agentId: agent.id,
      tradingWalletId: wallet.id
    });

    binding!.tradingWalletId = "mutated_wallet";
    ledgerRows[0]!.tradingWalletId = "mutated_wallet";

    expect(store.getIdentityBindingByAgentId(agent.id)).toMatchObject({
      tradingWalletId: wallet.id
    });
    expect(store.listPerformanceLedger({ agentId: agent.id })[0]).toMatchObject({
      tradingWalletId: wallet.id
    });
  });
});
