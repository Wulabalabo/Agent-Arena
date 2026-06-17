import { describe, expect, it } from "bun:test";
import { createPerformanceLedgerRecord, createRegistrationCodeHash } from "./performance-ledger";

describe("performance ledger identity", () => {
  it("keeps the registration code as a private hash and ranks by agent id", () => {
    const registrationCodeHash = createRegistrationCodeHash("PAIR-2048");
    const row = createPerformanceLedgerRecord({
      kind: "execution",
      agentDraftId: "draft_1",
      registrationCodeHash,
      agentId: "agent_1",
      ownerAddress: "0xowner",
      tradingWalletId: "wallet_internal_001",
      walletAddress: "0xwallet",
      predictManagerId: "0xmanager",
      competitionId: "btc-15m-001",
      oracleId: "0xoracle",
      expiryMs: "1781701200000",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: "exec_1",
      txDigest: "0xdigest",
      action: "open_range",
      positionKind: "range",
      quantityRaw: "10",
      costRaw: "100000",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T10:00:00.000Z",
      serverReceivedAt: "2026-06-17T10:00:00.100Z"
    });

    expect(registrationCodeHash).not.toBe("PAIR-2048");
    expect(row).toMatchObject({
      agentId: "agent_1",
      tradingWalletId: "wallet_internal_001",
      registrationCodeHash
    });
    expect(JSON.stringify(row)).not.toContain("PAIR-2048");
  });
});
