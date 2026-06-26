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
    expect(snapshot.service).toBe("agent-arena-platform");
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

  it("reports low formatted SUI gas balance directly", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "Low Gas Wallet Agent",
      ownerAddress: "0xowner"
    });
    store.bindTradingWallet(agent.id, "0xwallet", {
      testnetSuiBalance: "0.000000001",
      quoteBalance: "10000000",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
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
    const walletCodes = snapshot.categories.wallets.checks.map((check) => check.code);

    expect(snapshot.categories.wallets.status).toBe("warning");
    expect(walletCodes).toContain("GAS_BALANCE_TOO_LOW");
  });

  it("accepts whole-number formatted SUI balances for funded ready wallets", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "One SUI Wallet Agent",
      ownerAddress: "0xowner"
    });
    store.bindTradingWallet(agent.id, "0xwallet", {
      testnetSuiBalance: "1",
      quoteBalance: "10000000",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
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
    const walletCodes = snapshot.categories.wallets.checks.map((check) => check.code);

    expect(snapshot.categories.wallets.status).toBe("ok");
    expect(walletCodes).not.toContain("GAS_BALANCE_TOO_LOW");
    expect(walletCodes).not.toContain("WALLET_NOT_FUNDED");
  });

  it("uses a custom Testnet SUI gas threshold when provided", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "Custom Threshold Agent",
      ownerAddress: "0xowner"
    });
    store.bindTradingWallet(agent.id, "0xwallet", {
      testnetSuiBalance: "1",
      quoteBalance: "10000000",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
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
      minimumTestnetSuiBalanceRaw: "2000000000",
      marketFreshness: freshPredictMarket
    });
    const walletCodes = snapshot.categories.wallets.checks.map((check) => check.code);

    expect(snapshot.categories.wallets.status).toBe("warning");
    expect(walletCodes).toContain("GAS_BALANCE_TOO_LOW");
  });

  it("accepts formatted decimal SUI balances for funded ready wallets", () => {
    const store = new PlatformMockStore();
    const agent = store.createClaimedAgent({
      displayName: "Funded Wallet Agent",
      ownerAddress: "0xowner"
    });
    store.bindTradingWallet(agent.id, "0xwallet", {
      testnetSuiBalance: "1.5",
      quoteBalance: "10000000",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
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
    const walletCodes = snapshot.categories.wallets.checks.map((check) => check.code);

    expect(snapshot.categories.wallets.status).toBe("ok");
    expect(walletCodes).not.toContain("GAS_BALANCE_TOO_LOW");
    expect(walletCodes).not.toContain("WALLET_NOT_FUNDED");
  });
});
