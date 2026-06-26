import { describe, expect, it } from "bun:test";
import { createRuntimeHealthSnapshot } from "./runtime-health";
import type { MarketFreshnessSummary } from "./market-health";
import { PlatformMockStore } from "./mock-store";

const nowMs = Date.parse("2026-06-25T00:00:05.000Z");
const freshPredictMarket: MarketFreshnessSummary = {
  status: "ok",
  summary: "Market snapshot is fresh.",
  source: "predict_server",
  ageMs: 1000,
  lastErrorCode: null
};

describe("createRuntimeHealthSnapshot", () => {
  it("blocks real runtime health when Predict submit is disabled", () => {
    const snapshot = createRuntimeHealthSnapshot({
      store: new PlatformMockStore(),
      nowMs,
      runtimeMode: "real",
      network: "testnet",
      predictSubmitEnabled: false,
      registrySubmitEnabled: true,
      internalTokenConfigured: true,
      walletSecretConfigured: true,
      marketFreshness: freshPredictMarket
    });

    expect(snapshot.overallStatus).toBe("blocked");
    expect(snapshot.categories.runtime.status).toBe("blocked");
    expect(snapshot.categories.runtime.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "PREDICT_SUBMIT_DISABLED",
        status: "blocked"
      })
    ]));
    expect(JSON.stringify(snapshot)).not.toContain("suiprivkey");
  });

  it("reports wallet funding warnings without exposing secrets", () => {
    const store = new PlatformMockStore();
    const draft = store.createPairingDraft("Tiny Wallet Agent", { nowMs });
    store.markPairingDraftClaimed(draft.id);
    const agent = store.createClaimedAgent({
      displayName: "Tiny Wallet Agent",
      ownerAddress: "0xowner"
    });
    store.bindTradingWallet(agent.id, "0xwallet", {
      testnetSuiBalance: "1",
      quoteBalance: "9999999",
      predictManagerStatus: "missing",
      predictManagerId: null
    });
    store.saveRuntimeCredential({
      agentId: agent.id,
      token: "runtimeCredential-secret",
      createdAt: new Date(nowMs).toISOString(),
      credentialVersion: 1,
      scopes: ["agent:read", "agent:write"],
      revokedAt: null,
      revocationReason: null
    });

    const snapshot = createRuntimeHealthSnapshot({
      store,
      nowMs,
      runtimeMode: "real",
      network: "testnet",
      predictSubmitEnabled: true,
      registrySubmitEnabled: true,
      internalTokenConfigured: true,
      walletSecretConfigured: true,
      marketFreshness: freshPredictMarket
    });

    expect(snapshot.categories.wallets.status).toBe("warning");
    expect(snapshot.categories.wallets.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "WALLET_NOT_FUNDED",
        status: "warning"
      })
    ]));
    expect(JSON.stringify(snapshot)).not.toContain("runtimeCredential");
  });
});
