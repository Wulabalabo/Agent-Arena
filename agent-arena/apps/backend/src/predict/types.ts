export type PredictNetwork = "testnet";

export type InternalExecutionStatus =
  | "planned"
  | "dry_run_ok"
  | "submitted"
  | "confirmed"
  | "confirmed_policy_drift"
  | "failed";

export type InternalExecutionSource = "internal_probe";
export type InternalSigningAuditStatus = "planned" | "signed" | "submitted" | "confirmed" | "failed";

export interface PredictConfig {
  network: PredictNetwork;
  suiRpcUrl: string;
  predictServerUrl: string;
  predictPackageId: string;
  predictObjectId: string;
  suiClockObjectId: string;
  quoteAssetType: string;
  quoteDecimals: 6;
  priceDecimals: 9;
  internalToken: string;
  walletSecret: string;
}

export type InternalWalletBindingMode = "internal_probe" | "claimed_agent";

export interface InternalTradingWallet {
  id: string;
  agentId: string;
  bindingMode: InternalWalletBindingMode;
  label?: string;
  address: string;
  publicKey: string;
  keyScheme: "ed25519";
  status: "active";
  testnetOnly: true;
  createdAt: string;
}

export interface InternalWalletBalances {
  walletId: string;
  address: string;
  suiBalanceRaw: string;
  quoteAssetType: string;
  dusdcBalanceRaw: string;
}

export interface CoinBalanceReader {
  getSuiBalance(address: string): Promise<string>;
  getCoinBalance(address: string, coinType: string): Promise<string>;
}
