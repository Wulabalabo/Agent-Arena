export type PredictNetwork = "testnet";

export type InternalExecutionStatus =
  | "planned"
  | "dry_run_ok"
  | "submitted"
  | "confirmed"
  | "confirmed_policy_drift"
  | "failed";

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
