import type { PredictReadiness, PredictReadinessInput } from "./types";

export function getPredictReadiness(input: PredictReadinessInput): PredictReadiness {
  if (input.roundLocked) {
    return {
      primaryAction: "locked",
      label: "Round locked",
      disabled: true,
      reasons: ["Backing closes before this round starts."]
    };
  }

  if (input.mockMode) {
    return {
      primaryAction: "back_agent",
      label: "Back Agent",
      disabled: false,
      reasons: ["Mock mode stores Agent attribution without submitting a live Predict transaction."]
    };
  }

  if (!input.liveWalletFlow) {
    return {
      primaryAction: "live_wallet_disabled",
      label: "Live wallet disabled",
      disabled: true,
      reasons: ["Live wallet execution is disabled for this MVP demo."]
    };
  }

  if (!input.walletConnected) {
    return {
      primaryAction: "connect_wallet",
      label: "Connect wallet",
      disabled: false,
      reasons: ["A wallet is required before creating a PredictManager."]
    };
  }

  if (!input.hasManager) {
    return {
      primaryAction: "create_manager",
      label: "Create PredictManager",
      disabled: false,
      reasons: ["Predict requires a per-user manager before minting positions."]
    };
  }

  if (!input.hasEnoughDeposit) {
    return {
      primaryAction: "deposit",
      label: "Deposit DUSDC",
      disabled: false,
      reasons: ["The PredictManager needs enough DUSDC for this Agent backing."]
    };
  }

  return {
    primaryAction: "back_agent",
    label: "Back Agent",
    disabled: false,
    reasons: ["The app will build a Predict mint transaction from the selected Agent strategy."]
  };
}
