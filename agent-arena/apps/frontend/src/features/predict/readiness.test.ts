import { describe, expect, it } from "vitest";
import { predictConfig } from "./config";
import { getPredictReadiness } from "./readiness";

describe("predict config", () => {
  it("keeps public testnet integration values configurable", () => {
    expect(predictConfig.serverUrl).toBe("https://predict-server.testnet.mystenlabs.com");
    expect(predictConfig.predictPackageId).toBe(
      "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138"
    );
    expect(predictConfig.predictObjectId).toBe(
      "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a"
    );
    expect(predictConfig.quoteAssetType).toBe(
      "e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC"
    );
    expect(predictConfig.network).toBe("testnet");
    expect(predictConfig.mockMode).toBe(true);
    expect(predictConfig.liveWalletFlow).toBe(false);
  });
});

describe("getPredictReadiness", () => {
  it("asks the user to connect a wallet first", () => {
    const readiness = getPredictReadiness({
      walletConnected: false,
      hasManager: false,
      hasEnoughDeposit: false,
      roundLocked: false,
      mockMode: false,
      liveWalletFlow: true
    });

    expect(readiness.primaryAction).toBe("connect_wallet");
    expect(readiness.label).toBe("Connect wallet");
    expect(readiness.disabled).toBe(false);
  });

  it("asks the user to create a PredictManager before live backing", () => {
    const readiness = getPredictReadiness({
      walletConnected: true,
      hasManager: false,
      hasEnoughDeposit: false,
      roundLocked: false,
      mockMode: false,
      liveWalletFlow: true
    });

    expect(readiness.primaryAction).toBe("create_manager");
    expect(readiness.label).toBe("Create PredictManager");
    expect(readiness.disabled).toBe(false);
  });

  it("asks the user to deposit DUSDC before live backing", () => {
    const readiness = getPredictReadiness({
      walletConnected: true,
      hasManager: true,
      hasEnoughDeposit: false,
      roundLocked: false,
      mockMode: false,
      liveWalletFlow: true
    });

    expect(readiness.primaryAction).toBe("deposit");
    expect(readiness.label).toBe("Deposit DUSDC");
    expect(readiness.disabled).toBe(false);
  });

  it("allows live backing when wallet, manager, and deposit are ready", () => {
    const readiness = getPredictReadiness({
      walletConnected: true,
      hasManager: true,
      hasEnoughDeposit: true,
      roundLocked: false,
      mockMode: false,
      liveWalletFlow: true
    });

    expect(readiness.primaryAction).toBe("back_agent");
    expect(readiness.label).toBe("Back Agent");
    expect(readiness.disabled).toBe(false);
  });

  it("uses Back Agent in mock mode when the round is open", () => {
    const readiness = getPredictReadiness({
      walletConnected: false,
      hasManager: false,
      hasEnoughDeposit: false,
      roundLocked: false,
      mockMode: true,
      liveWalletFlow: false
    });

    expect(readiness.primaryAction).toBe("back_agent");
    expect(readiness.label).toBe("Back Agent");
    expect(readiness.disabled).toBe(false);
  });

  it("blocks actions after lock", () => {
    const readiness = getPredictReadiness({
      walletConnected: true,
      hasManager: true,
      hasEnoughDeposit: true,
      roundLocked: true,
      mockMode: false,
      liveWalletFlow: true
    });

    expect(readiness.primaryAction).toBe("locked");
    expect(readiness.disabled).toBe(true);
    expect(readiness.label).toBe("Round locked");
  });

  it("keeps round lock stronger than mock mode", () => {
    const readiness = getPredictReadiness({
      walletConnected: false,
      hasManager: false,
      hasEnoughDeposit: false,
      roundLocked: true,
      mockMode: true,
      liveWalletFlow: false
    });

    expect(readiness.primaryAction).toBe("locked");
    expect(readiness.label).toBe("Round locked");
    expect(readiness.disabled).toBe(true);
  });

  it("disables live wallet actions when live wallet flow is off", () => {
    const readiness = getPredictReadiness({
      walletConnected: false,
      hasManager: false,
      hasEnoughDeposit: false,
      roundLocked: false,
      mockMode: false,
      liveWalletFlow: false
    });

    expect(readiness.primaryAction).toBe("live_wallet_disabled");
    expect(readiness.label).toBe("Live wallet disabled");
    expect(readiness.disabled).toBe(true);
  });
});
