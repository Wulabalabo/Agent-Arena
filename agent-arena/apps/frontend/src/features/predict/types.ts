export interface PredictConfig {
  serverUrl: string;
  predictPackageId: string;
  predictObjectId: string;
  quoteAssetType: string;
  network: "testnet" | "mainnet" | "localnet";
  mockMode: boolean;
  liveWalletFlow: boolean;
}

export interface PredictStatus {
  [key: string]: unknown;
}

export interface PredictState {
  [key: string]: unknown;
}

export interface PredictOracleSummary {
  oracleId?: string;
  oracle_id?: string;
  symbol?: string;
  underlying_asset?: string;
  expiry?: number | string;
  status?: string;
  [key: string]: unknown;
}

export interface PredictOracleState {
  oracleId?: string;
  oracle_id?: string;
  [key: string]: unknown;
}

export interface PredictManagerSummary {
  managerId?: string;
  owner?: string;
  quoteBalance?: number;
  [key: string]: unknown;
}

export interface PredictManagerListItem {
  managerId?: string;
  owner?: string;
  [key: string]: unknown;
}

export interface PredictManagerPositionsSummary {
  [key: string]: unknown;
}

export interface PredictManagerPnl {
  [key: string]: unknown;
}

export interface PredictOracleTrade {
  [key: string]: unknown;
}

export interface PredictMintedPosition {
  [key: string]: unknown;
}

export interface PredictRedeemedPosition {
  [key: string]: unknown;
}

export interface PredictMintedRange {
  [key: string]: unknown;
}

export interface PredictRedeemedRange {
  [key: string]: unknown;
}

export interface PredictReadinessInput {
  walletConnected: boolean;
  hasManager: boolean;
  hasEnoughDeposit: boolean;
  roundLocked: boolean;
  mockMode: boolean;
  liveWalletFlow: boolean;
}

export interface PredictReadiness {
  primaryAction: "connect_wallet" | "create_manager" | "deposit" | "back_agent" | "locked" | "live_wallet_disabled";
  label: "Connect wallet" | "Create PredictManager" | "Deposit DUSDC" | "Back Agent" | "Round locked" | "Live wallet disabled";
  disabled: boolean;
  reasons: string[];
}
