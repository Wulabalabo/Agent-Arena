import { createExecutionHealth } from "./execution-health";
import type { MarketFreshnessSummary, RuntimeMode } from "./market-health";
import type { PlatformMockStore } from "./mock-store";

export type HealthStatus = "ok" | "warning" | "blocked";

export interface HealthCheck {
  code: string;
  status: HealthStatus;
  message: string;
  details?: Record<string, boolean | number | string | null>;
}

export interface HealthCategory {
  status: HealthStatus;
  summary: string;
  checks: HealthCheck[];
}

export interface RuntimeHealthSnapshot {
  generatedAt: string;
  runtimeMode: RuntimeMode;
  network: string;
  overallStatus: HealthStatus;
  categories: {
    runtime: HealthCategory;
    market: HealthCategory;
    execution: HealthCategory;
    settlement: HealthCategory;
    registry: HealthCategory;
    wallets: HealthCategory;
  };
}

export interface CreateRuntimeHealthSnapshotOptions {
  store: PlatformMockStore;
  nowMs: number;
  runtimeMode: RuntimeMode;
  network: string;
  predictSubmitEnabled: boolean;
  registrySubmitEnabled: boolean;
  internalTokenConfigured: boolean;
  walletSecretConfigured: boolean;
  marketFreshness: MarketFreshnessSummary;
}

const stalePendingExecutionAgeMs = 20_000;
const minimumQuoteBalanceRaw = 10_000_000n;
const minimumTestnetSuiBalanceRaw = 1_000_000_000n;

export function createRuntimeHealthSnapshot({
  store,
  nowMs,
  runtimeMode,
  network,
  predictSubmitEnabled,
  registrySubmitEnabled,
  internalTokenConfigured,
  walletSecretConfigured,
  marketFreshness
}: CreateRuntimeHealthSnapshotOptions): RuntimeHealthSnapshot {
  const categories = {
    runtime: createRuntimeCategory({
      runtimeMode,
      network,
      predictSubmitEnabled,
      internalTokenConfigured,
      walletSecretConfigured
    }),
    market: createMarketCategory(marketFreshness),
    execution: createExecutionCategory({ store, nowMs }),
    settlement: createSettlementCategory(store),
    registry: createRegistryCategory(registrySubmitEnabled),
    wallets: createWalletCategory(store)
  };

  return {
    generatedAt: new Date(nowMs).toISOString(),
    runtimeMode,
    network,
    overallStatus: worstStatus(Object.values(categories).map((category) => category.status)),
    categories
  };
}

function createRuntimeCategory({
  runtimeMode,
  network,
  predictSubmitEnabled,
  internalTokenConfigured,
  walletSecretConfigured
}: {
  runtimeMode: RuntimeMode;
  network: string;
  predictSubmitEnabled: boolean;
  internalTokenConfigured: boolean;
  walletSecretConfigured: boolean;
}): HealthCategory {
  const checks: HealthCheck[] = [{
    code: "RUNTIME_MODE",
    status: "ok",
    message: `Runtime mode is ${runtimeMode}.`,
    details: { runtimeMode, network }
  }];

  if (runtimeMode === "real" && !predictSubmitEnabled) {
    checks.push({
      code: "PREDICT_SUBMIT_DISABLED",
      status: "blocked",
      message: "Real runtime is blocked because Predict submit is disabled."
    });
  }

  if (!internalTokenConfigured) {
    checks.push({
      code: "INTERNAL_TOKEN_MISSING",
      status: "blocked",
      message: "Internal operator token is not configured."
    });
  }

  if (!walletSecretConfigured) {
    checks.push({
      code: "WALLET_SECRET_MISSING",
      status: "blocked",
      message: "Wallet secret is not configured."
    });
  }

  return createCategory("Runtime configuration is usable.", checks);
}

function createMarketCategory(marketFreshness: MarketFreshnessSummary): HealthCategory {
  return createCategory(marketFreshness.summary, [{
    code: "MARKET_FRESHNESS",
    status: marketFreshness.status,
    message: marketFreshness.summary,
    details: {
      source: marketFreshness.source,
      ageMs: marketFreshness.ageMs,
      lastErrorCode: marketFreshness.lastErrorCode
    }
  }]);
}

function createExecutionCategory({
  store,
  nowMs
}: {
  store: PlatformMockStore;
  nowMs: number;
}): HealthCategory {
  const executionHealth = store.listExecutions()
    .map((execution) => createExecutionHealth({ execution, nowMs }));
  const pending = executionHealth.filter((execution) => !execution.terminal);
  const stalePending = pending.filter((execution) => execution.ageMs > stalePendingExecutionAgeMs);
  const checks: HealthCheck[] = [{
    code: "EXECUTION_QUEUE",
    status: "ok",
    message: `${pending.length} non-terminal executions are tracked.`,
    details: {
      nonTerminalCount: pending.length,
      stalePendingCount: stalePending.length
    }
  }];

  checks.push(...stalePending.map((execution): HealthCheck => ({
    code: "STALE_PENDING_EXECUTION",
    status: "warning",
    message: "Pending execution has exceeded the stale age threshold.",
    details: {
      executionId: execution.executionId,
      status: execution.status,
      ageMs: execution.ageMs,
      retryable: execution.retryable,
      retryableReason: execution.retryableReason
    }
  })));

  return createCategory("Execution queue has no stale pending work.", checks);
}

function createSettlementCategory(store: PlatformMockStore): HealthCategory {
  const ledger = store.listPerformanceLedger();
  const claimLedgerCount = ledger.filter((record) => record.kind === "claim").length;
  const settlementLedgerCount = ledger.filter((record) => record.kind === "settlement").length;

  return createCategory(`${claimLedgerCount} claim ledger records are tracked.`, [{
    code: "SETTLEMENT_LEDGER",
    status: "ok",
    message: "Settlement ledger summary is available.",
    details: {
      claimLedgerCount,
      settlementLedgerCount
    }
  }]);
}

function createRegistryCategory(registrySubmitEnabled: boolean): HealthCategory {
  return createCategory(
    registrySubmitEnabled
      ? "Registry submit is enabled."
      : "Registry submit is disabled.",
    [{
      code: registrySubmitEnabled ? "REGISTRY_SUBMIT_ENABLED" : "REGISTRY_SUBMIT_DISABLED",
      status: registrySubmitEnabled ? "ok" : "warning",
      message: registrySubmitEnabled
        ? "Registry submissions can be sent."
        : "Registry submissions are not enabled."
    }]
  );
}

function createWalletCategory(store: PlatformMockStore): HealthCategory {
  const activeWallets = store.listTradingWallets().filter((wallet) => wallet.status === "active");
  const checks: HealthCheck[] = [{
    code: "WALLET_INVENTORY",
    status: "ok",
    message: `${activeWallets.length} active trading wallets are tracked.`,
    details: { activeWalletCount: activeWallets.length }
  }];

  for (const wallet of activeWallets) {
    const quoteBalance = parseRawBalance(wallet.quoteBalance);
    const suiBalance = parseRawBalance(wallet.testnetSuiBalance);
    const fundingWarnings: string[] = [];

    if (quoteBalance === null || quoteBalance < minimumQuoteBalanceRaw) {
      fundingWarnings.push("quoteBalance");
    }
    if (suiBalance === null || suiBalance < minimumTestnetSuiBalanceRaw) {
      fundingWarnings.push("testnetSuiBalance");
    }

    if (fundingWarnings.length > 0) {
      checks.push({
        code: "WALLET_NOT_FUNDED",
        status: "warning",
        message: "Trading wallet does not meet funding thresholds.",
        details: {
          walletId: wallet.id,
          agentId: wallet.agentId,
          quoteBalanceReady: quoteBalance !== null && quoteBalance >= minimumQuoteBalanceRaw,
          testnetSuiBalanceReady: suiBalance !== null && suiBalance >= minimumTestnetSuiBalanceRaw,
          missing: fundingWarnings.join(",")
        }
      });
    }

    if (wallet.predictManagerStatus !== "ready") {
      checks.push({
        code: "PREDICT_MANAGER_NOT_READY",
        status: "warning",
        message: "Trading wallet PredictManager is not ready.",
        details: {
          walletId: wallet.id,
          agentId: wallet.agentId,
          predictManagerStatus: wallet.predictManagerStatus
        }
      });
    }
  }

  return createCategory("Trading wallets are funded and manager-ready.", checks);
}

function createCategory(okSummary: string, checks: HealthCheck[]): HealthCategory {
  const status = worstStatus(checks.map((check) => check.status));
  const summary = status === "ok"
    ? okSummary
    : `${checks.filter((check) => check.status === status).length} ${status} checks.`;

  return {
    status,
    summary,
    checks
  };
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("blocked")) {
    return "blocked";
  }
  if (statuses.includes("warning")) {
    return "warning";
  }
  return "ok";
}

function parseRawBalance(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
