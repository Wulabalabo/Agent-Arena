# Agent Arena Runtime Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-only operator health, Agent action readiness, execution retry diagnostics, and docs updates for the live Agent Arena Testnet runtime.

**Architecture:** Backend hardening is split into focused services: execution state diagnostics, market-provider metadata, runtime health, and Agent readiness. Public Agent readiness is runtime-token scoped; operator health is internal-token scoped and server-side only. Frontend changes only display readiness while a runtime credential is already in memory during claim or rotation handoff.

**Tech Stack:** Bun, TypeScript, React, Vite, Vitest, SQLite-backed platform store, Sui Testnet, DeepBook Predict, existing Agent Arena platform APIs.

---

## Source Spec

- `docs/superpowers/specs/2026-06-25-agent-arena-runtime-hardening-design.md`

## File Structure

Backend files:

- Create `agent-arena/apps/backend/src/platform/execution-health.ts`
  - Owns execution job phase, terminal, retryability, and age calculation.
- Create `agent-arena/apps/backend/src/platform/execution-health.test.ts`
  - Proves legal transitions and retryability rules.
- Create `agent-arena/apps/backend/src/platform/market-health.ts`
  - Owns market snapshot metadata and stale-state calculation.
- Create `agent-arena/apps/backend/src/platform/market-health.test.ts`
  - Proves real-mode stale behavior and mock-source reporting.
- Create `agent-arena/apps/backend/src/platform/runtime-health.ts`
  - Owns sanitized operator health category summaries.
- Create `agent-arena/apps/backend/src/platform/runtime-health.test.ts`
  - Proves health categories, redaction, thresholds, and overall status.
- Create `agent-arena/apps/backend/src/platform/agent-readiness.ts`
  - Owns per-Agent action readiness for `hold`, `open_directional`, `open_range`, `reduce`, and `close`.
- Create `agent-arena/apps/backend/src/platform/agent-readiness.test.ts`
  - Proves readiness reasons for range, funding, pending execution, and missing positions.
- Modify `agent-arena/apps/backend/src/platform/types.ts`
  - Add optional execution hardening timestamps, failure metadata, and executable range market shape.
- Modify `agent-arena/apps/backend/src/platform/execution.ts`
  - Write the new execution metadata when creating and updating execution records.
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
  - Add a cloned trading-wallet list reader for operator health summaries.
- Modify `agent-arena/apps/backend/src/platform/api.ts`
  - Add `GET /api/arena/internal/health` and `GET /api/arena/agent/readiness?competitionId=btc-15m-001`.
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
  - Add route-level tests for internal health auth and Agent readiness auth.
- Modify `agent-arena/apps/backend/src/server.ts`
  - Wrap the market data provider with metadata tracking and pass health options into `createPlatformFetchHandler`.

Frontend files:

- Modify `agent-arena/apps/frontend/src/features/platform/types.ts`
  - Add Agent readiness response types.
- Modify `agent-arena/apps/frontend/src/features/platform/client.ts`
  - Add `getAgentReadiness(runtimeCredential, competitionId)`.
- Modify `agent-arena/apps/frontend/src/features/platform/client.test.ts`
  - Prove runtime header and URL for readiness.
- Create `agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.tsx`
  - Displays readiness actions and reason codes without internal health data.
- Create `agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.test.tsx`
  - Proves blocked/risky/executable labels render and no internal fields are displayed.
- Modify `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`
  - Fetch readiness only while the shown-once runtime credential is in component memory after claim.
- Modify `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`
  - Proves readiness lookup uses the runtime token and does not run before claim.

Docs and validation files:

- Modify `agent-arena/skills/agent-arena.md`
  - Add readiness route guidance before non-hold intents.
- Modify `agent-arena/skills/deepbook-predict-btc-15m.md`
  - Add `allowedActions` versus executable markets guidance.
- Modify `agent-arena/OPERATE.md`
  - Add server-side internal health curl checks and incident checklists.
- Modify `docs/superpowers/README.md`
  - Link this plan in Recent Execution Plans.

---

### Task 1: Execution Health State

**Files:**
- Create: `agent-arena/apps/backend/src/platform/execution-health.test.ts`
- Create: `agent-arena/apps/backend/src/platform/execution-health.ts`
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Modify: `agent-arena/apps/backend/src/platform/execution.ts`

- [ ] **Step 1: Write failing execution-health tests**

Create `agent-arena/apps/backend/src/platform/execution-health.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createExecutionHealth, isRetryableExecutionPhase } from "./execution-health";
import type { ExecutionRecord } from "./types";

const baseExecution: ExecutionRecord = {
  id: "exec_1",
  intentId: "intent_1",
  agentId: "agent_1",
  competitionId: "btc-15m-001",
  riskDecisionId: "risk_1",
  status: "queued",
  predictTxDigest: null,
  action: "open_directional",
  createdAt: "2026-06-25T00:00:00.000Z"
};

describe("execution health", () => {
  it("marks queued executions retryable when no signing attempt exists", () => {
    const health = createExecutionHealth({
      execution: {
        ...baseExecution,
        queuedAt: "2026-06-25T00:00:00.000Z"
      },
      nowMs: Date.parse("2026-06-25T00:00:22.000Z")
    });

    expect(health).toMatchObject({
      executionId: "exec_1",
      status: "queued",
      ageMs: 22000,
      terminal: false,
      retryable: true,
      retryableReason: "NO_SIGNING_ATTEMPT"
    });
  });

  it("marks submitted executions non-retryable until chain status is inspected", () => {
    const health = createExecutionHealth({
      execution: {
        ...baseExecution,
        status: "submitted",
        submittedAt: "2026-06-25T00:00:03.000Z",
        predictTxDigest: "0xdigest"
      },
      nowMs: Date.parse("2026-06-25T00:00:25.000Z")
    });

    expect(health).toMatchObject({
      status: "submitted",
      ageMs: 22000,
      terminal: false,
      retryable: false,
      retryableReason: "CHAIN_STATUS_REQUIRED",
      predictTxDigest: "0xdigest"
    });
  });

  it("treats confirmed, partial, and failed-after-chain-check as terminal", () => {
    expect(isRetryableExecutionPhase("confirmed")).toBe(false);
    expect(isRetryableExecutionPhase("partial")).toBe(false);
    expect(isRetryableExecutionPhase("failed_after_chain_check")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused backend test and verify it fails**

Run from repo root:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/execution-health.test.ts
```

Expected: FAIL because `./execution-health` does not exist.

- [ ] **Step 3: Add execution metadata to backend types**

Modify `agent-arena/apps/backend/src/platform/types.ts`:

```ts
export type ExecutionHealthPhase =
  | ExecutionStatus
  | "planned"
  | "failed_after_chain_check";

export type ExecutionRetryableReason =
  | "NO_SIGNING_ATTEMPT"
  | "CHAIN_STATUS_REQUIRED"
  | "TERMINAL"
  | "NOT_RETRYABLE";
```

Extend `ExecutionRecord`:

```ts
export interface ExecutionRecord {
  id: string;
  intentId: string;
  agentId: string;
  competitionId: string;
  riskDecisionId: string;
  status: ExecutionStatus;
  predictTxDigest: string | null;
  action: AgentAction;
  createdAt: string;
  queuedAt?: string | null;
  plannedAt?: string | null;
  signedAt?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  lastAttemptAt?: string | null;
  attemptCount?: number;
  terminal?: boolean;
  retryable?: boolean;
  failureCode?: string | null;
  failureMessage?: string | null;
}
```

- [ ] **Step 4: Implement execution-health helper**

Create `agent-arena/apps/backend/src/platform/execution-health.ts`:

```ts
import type {
  ExecutionHealthPhase,
  ExecutionRecord,
  ExecutionRetryableReason
} from "./types";

export interface ExecutionHealthSummary {
  executionId: string;
  status: ExecutionHealthPhase;
  ageMs: number;
  terminal: boolean;
  retryable: boolean;
  retryableReason: ExecutionRetryableReason;
  predictTxDigest: string | null;
  failureCode: string | null;
}

export function createExecutionHealth({
  execution,
  nowMs
}: {
  execution: ExecutionRecord;
  nowMs: number;
}): ExecutionHealthSummary {
  const status = executionHealthPhase(execution);
  const terminal = isTerminalExecutionPhase(status);
  const retryable = isRetryableExecutionRecord(execution, status);
  const retryableReason = executionRetryableReason(execution, status, retryable, terminal);

  return {
    executionId: execution.id,
    status,
    ageMs: Math.max(0, nowMs - Date.parse(executionAgeAnchor(execution))),
    terminal,
    retryable,
    retryableReason,
    predictTxDigest: execution.predictTxDigest,
    failureCode: execution.failureCode ?? null
  };
}

export function isRetryableExecutionPhase(status: ExecutionHealthPhase): boolean {
  return status === "queued" || status === "planned";
}

function executionHealthPhase(execution: ExecutionRecord): ExecutionHealthPhase {
  if (execution.failureCode === "FAILED_AFTER_CHAIN_CHECK") {
    return "failed_after_chain_check";
  }

  if (execution.plannedAt && execution.status === "queued") {
    return "planned";
  }

  return execution.status;
}

function isTerminalExecutionPhase(status: ExecutionHealthPhase): boolean {
  return status === "confirmed" ||
    status === "partial" ||
    status === "failed" ||
    status === "failed_after_chain_check";
}

function isRetryableExecutionRecord(execution: ExecutionRecord, status: ExecutionHealthPhase): boolean {
  if (!isRetryableExecutionPhase(status)) {
    return false;
  }

  return !execution.signedAt && !execution.submittedAt && !execution.predictTxDigest;
}

function executionRetryableReason(
  execution: ExecutionRecord,
  status: ExecutionHealthPhase,
  retryable: boolean,
  terminal: boolean
): ExecutionRetryableReason {
  if (retryable) {
    return "NO_SIGNING_ATTEMPT";
  }

  if (status === "submitted" || execution.predictTxDigest) {
    return "CHAIN_STATUS_REQUIRED";
  }

  return terminal ? "TERMINAL" : "NOT_RETRYABLE";
}

function executionAgeAnchor(execution: ExecutionRecord): string {
  return execution.submittedAt ??
    execution.signedAt ??
    execution.plannedAt ??
    execution.queuedAt ??
    execution.createdAt;
}
```

- [ ] **Step 5: Populate execution metadata in execution creation**

Modify queued execution creation in `agent-arena/apps/backend/src/platform/execution.ts`:

```ts
  const queuedExecution: ExecutionRecord = {
    id: input.executionId,
    intentId: input.intent.id,
    agentId: input.intent.agentId,
    competitionId: input.intent.competitionId,
    riskDecisionId: input.riskDecisionId,
    status: "queued",
    predictTxDigest: null,
    action: input.intent.action,
    createdAt: input.intent.createdAt,
    queuedAt: input.intent.createdAt,
    plannedAt: null,
    signedAt: null,
    submittedAt: null,
    confirmedAt: null,
    failedAt: null,
    lastAttemptAt: null,
    attemptCount: 0,
    terminal: false,
    retryable: true,
    failureCode: null,
    failureMessage: null
  };
```

Modify adapter result execution update:

```ts
  const completedAt = new Date().toISOString();
  const execution: ExecutionRecord = {
    ...queuedExecution,
    status: result.status,
    predictTxDigest: result.predictTxDigest ?? null,
    submittedAt: result.predictTxDigest ? completedAt : queuedExecution.submittedAt ?? null,
    confirmedAt: result.status === "confirmed" ? completedAt : null,
    failedAt: result.status === "failed" ? completedAt : null,
    lastAttemptAt: completedAt,
    attemptCount: (queuedExecution.attemptCount ?? 0) + 1,
    terminal: result.status === "confirmed" || result.status === "partial" || result.status === "failed",
    retryable: result.status === "failed" && !result.predictTxDigest,
    failureCode: result.errorCode ?? null,
    failureMessage: result.errorMessage ?? null
  };
```

- [ ] **Step 6: Run the execution-health tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/execution-health.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/execution.ts agent-arena/apps/backend/src/platform/execution-health.ts agent-arena/apps/backend/src/platform/execution-health.test.ts
git commit -m "feat: add execution health diagnostics"
```

---

### Task 2: Market Metadata And Staleness

**Files:**
- Create: `agent-arena/apps/backend/src/platform/market-health.test.ts`
- Create: `agent-arena/apps/backend/src/platform/market-health.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Write failing market-health tests**

Create `agent-arena/apps/backend/src/platform/market-health.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createMarketDataTracker, evaluateMarketFreshness } from "./market-health";
import type { AgentMarketDataResult } from "./api";
import { createMarketSnapshot } from "./market-snapshot";
import { createMockCompetition } from "./types";

const competition = createMockCompetition("btc-15m-001");

describe("market health", () => {
  it("blocks real-mode health when provider metadata is stale", () => {
    const result = evaluateMarketFreshness({
      metadata: {
        competitionId: competition.id,
        source: "predict_server",
        fetchedAt: "2026-06-25T00:00:00.000Z",
        lastSuccessAt: "2026-06-25T00:00:00.000Z",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null
      },
      nowMs: Date.parse("2026-06-25T00:00:06.000Z"),
      staleThresholdMs: 5000,
      runtimeMode: "real"
    });

    expect(result).toMatchObject({
      status: "blocked",
      ageMs: 6000,
      source: "predict_server",
      summary: "Market snapshot is stale."
    });
  });

  it("reports mock source without pretending it is real Predict data", () => {
    const result = evaluateMarketFreshness({
      metadata: {
        competitionId: competition.id,
        source: "mock",
        fetchedAt: "2026-06-25T00:00:00.000Z",
        lastSuccessAt: "2026-06-25T00:00:00.000Z",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null
      },
      nowMs: Date.parse("2026-06-25T00:00:20.000Z"),
      staleThresholdMs: 5000,
      runtimeMode: "mock"
    });

    expect(result.status).toBe("ok");
    expect(result.source).toBe("mock");
  });

  it("tracks provider success and failure metadata", async () => {
    const tracker = createMarketDataTracker({
      source: "predict_server",
      now: () => Date.parse("2026-06-25T00:00:00.000Z"),
      provider: async (): Promise<AgentMarketDataResult> => ({
        competition,
        marketState: createMarketSnapshot(competition, Date.parse("2026-06-25T00:00:00.000Z"))
      })
    });

    await tracker.getMarketData();
    expect(tracker.getMetadata()).toMatchObject({
      competitionId: competition.id,
      source: "predict_server",
      lastErrorCode: null
    });
  });
});
```

- [ ] **Step 2: Run the focused backend test and verify it fails**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/market-health.test.ts
```

Expected: FAIL because `./market-health` does not exist.

- [ ] **Step 3: Export market provider result type from API**

In `agent-arena/apps/backend/src/platform/api.ts`, export the existing market result interface:

```ts
export interface AgentMarketDataResult {
  competition: Competition;
  marketState: MarketSnapshot;
}
```

- [ ] **Step 4: Implement market-health helper**

Create `agent-arena/apps/backend/src/platform/market-health.ts`:

```ts
import type { AgentMarketDataResult } from "./api";

export type MarketSnapshotSource = "predict_server" | "mock" | "unavailable";
export type RuntimeMode = "mock" | "real";
export type HealthStatus = "ok" | "warning" | "blocked";

export interface MarketSnapshotMetadata {
  competitionId: string;
  source: MarketSnapshotSource;
  fetchedAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface MarketFreshnessSummary {
  status: HealthStatus;
  summary: string;
  source: MarketSnapshotSource;
  ageMs: number | null;
  lastErrorCode: string | null;
}

export function createMarketDataTracker({
  source,
  now = Date.now,
  provider
}: {
  source: MarketSnapshotSource;
  now?: () => number;
  provider: () => Promise<AgentMarketDataResult>;
}) {
  let metadata: MarketSnapshotMetadata | null = null;

  return {
    async getMarketData(): Promise<AgentMarketDataResult> {
      try {
        const result = await provider();
        const fetchedAt = new Date(now()).toISOString();
        metadata = {
          competitionId: result.competition.id,
          source,
          fetchedAt,
          lastSuccessAt: fetchedAt,
          lastErrorAt: null,
          lastErrorCode: null,
          lastErrorMessage: null
        };
        return result;
      } catch (error) {
        const failedAt = new Date(now()).toISOString();
        metadata = {
          competitionId: metadata?.competitionId ?? "unknown",
          source: "unavailable",
          fetchedAt: metadata?.fetchedAt ?? failedAt,
          lastSuccessAt: metadata?.lastSuccessAt ?? null,
          lastErrorAt: failedAt,
          lastErrorCode: error instanceof Error ? error.message : "MARKET_PROVIDER_FAILED",
          lastErrorMessage: error instanceof Error ? error.message : "Market provider failed."
        };
        throw error;
      }
    },
    getMetadata(): MarketSnapshotMetadata | null {
      return metadata ? { ...metadata } : null;
    }
  };
}

export function evaluateMarketFreshness({
  metadata,
  nowMs,
  staleThresholdMs,
  runtimeMode
}: {
  metadata: MarketSnapshotMetadata | null;
  nowMs: number;
  staleThresholdMs: number;
  runtimeMode: RuntimeMode;
}): MarketFreshnessSummary {
  if (!metadata?.lastSuccessAt) {
    return {
      status: runtimeMode === "real" ? "blocked" : "warning",
      summary: "No successful market snapshot is available.",
      source: metadata?.source ?? "unavailable",
      ageMs: null,
      lastErrorCode: metadata?.lastErrorCode ?? "MARKET_SNAPSHOT_MISSING"
    };
  }

  const ageMs = Math.max(0, nowMs - Date.parse(metadata.lastSuccessAt));
  if (runtimeMode === "real" && ageMs > staleThresholdMs) {
    return {
      status: "blocked",
      summary: "Market snapshot is stale.",
      source: metadata.source,
      ageMs,
      lastErrorCode: metadata.lastErrorCode
    };
  }

  return {
    status: "ok",
    summary: metadata.source === "mock" ? "Mock market snapshot is available." : "Market snapshot is fresh.",
    source: metadata.source,
    ageMs,
    lastErrorCode: metadata.lastErrorCode
  };
}
```

- [ ] **Step 5: Wrap the server market data provider**

In `agent-arena/apps/backend/src/server.ts`, import `createMarketDataTracker` and wrap the real provider:

```ts
import { createMarketDataTracker } from "./platform/market-health";
```

In the real-mode platform options area:

```ts
    const marketDataTracker = createMarketDataTracker({
      source: "predict_server",
      provider: createPredictMarketDataProvider({
        config: predictConfig,
        now: Date.now
      })
    });
```

Pass both functions:

```ts
      marketDataProvider: marketDataTracker.getMarketData,
      marketSnapshotMetadataReader: marketDataTracker.getMetadata,
```

- [ ] **Step 6: Run the market-health tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/market-health.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/market-health.ts agent-arena/apps/backend/src/platform/market-health.test.ts agent-arena/apps/backend/src/server.ts
git commit -m "feat: track market snapshot freshness"
```

---

### Task 3: Runtime Health Service And Internal Endpoint

**Files:**
- Create: `agent-arena/apps/backend/src/platform/runtime-health.test.ts`
- Create: `agent-arena/apps/backend/src/platform/runtime-health.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Write failing runtime-health service tests**

Create `agent-arena/apps/backend/src/platform/runtime-health.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createRuntimeHealthSnapshot } from "./runtime-health";
import { PlatformMockStore } from "./mock-store";
import { createMockCompetition } from "./types";

describe("runtime health", () => {
  it("blocks real runtime health when Predict submit is disabled", () => {
    const store = new PlatformMockStore();
    store.seedCompetition(createMockCompetition("btc-15m-001"));

    const snapshot = createRuntimeHealthSnapshot({
      store,
      nowMs: Date.parse("2026-06-25T00:00:00.000Z"),
      runtimeMode: "real",
      network: "testnet",
      predictSubmitEnabled: false,
      registrySubmitEnabled: true,
      internalTokenConfigured: true,
      walletSecretConfigured: true,
      marketFreshness: {
        status: "ok",
        summary: "Market snapshot is fresh.",
        source: "predict_server",
        ageMs: 500,
        lastErrorCode: null
      }
    });

    expect(snapshot.overallStatus).toBe("blocked");
    expect(snapshot.categories.runtime.status).toBe("blocked");
    expect(JSON.stringify(snapshot)).not.toContain("suiprivkey");
  });

  it("reports wallet funding warnings without exposing secrets", () => {
    const store = new PlatformMockStore();
    const draft = store.createPairingDraft({
      displayName: "Low Balance Agent",
      claimUrl: "https://arena.test/claim/PAIR",
      expiresAt: "2026-06-25T01:00:00.000Z",
      createdAt: "2026-06-25T00:00:00.000Z"
    });
    const agent = store.createAgentFromDraft({
      draft,
      ownerAddress: "0xowner",
      twitterHandle: null,
      createdAt: "2026-06-25T00:00:00.000Z"
    });
    store.bindTradingWallet(agent.id, "0xwallet", {
      testnetSuiBalance: "1",
      quoteBalance: "1",
      predictManagerStatus: "missing",
      predictManagerId: null
    });

    const snapshot = createRuntimeHealthSnapshot({
      store,
      nowMs: Date.parse("2026-06-25T00:00:00.000Z"),
      runtimeMode: "real",
      network: "testnet",
      predictSubmitEnabled: true,
      registrySubmitEnabled: true,
      internalTokenConfigured: true,
      walletSecretConfigured: true,
      marketFreshness: {
        status: "ok",
        summary: "Market snapshot is fresh.",
        source: "predict_server",
        ageMs: 500,
        lastErrorCode: null
      }
    });

    expect(snapshot.categories.wallets.status).toBe("warning");
    expect(snapshot.categories.wallets.checks).toContainEqual(expect.objectContaining({
      code: "WALLET_NOT_FUNDED"
    }));
    expect(JSON.stringify(snapshot)).not.toContain("runtimeCredential");
  });
});
```

- [ ] **Step 2: Run the focused backend test and verify it fails**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/runtime-health.test.ts
```

Expected: FAIL because `./runtime-health` does not exist.

- [ ] **Step 3: Add wallet list reader to the platform store**

Modify `agent-arena/apps/backend/src/platform/mock-store.ts` after `getTradingWalletById`:

```ts
  listTradingWallets(): TradingWallet[] {
    return [...this.tradingWallets.values()].map(cloneTradingWallet);
  }
```

- [ ] **Step 4: Implement runtime-health service**

Create `agent-arena/apps/backend/src/platform/runtime-health.ts`:

```ts
import { createExecutionHealth } from "./execution-health";
import type { MarketFreshnessSummary, RuntimeMode } from "./market-health";
import type { PlatformMockStore } from "./mock-store";

export type HealthStatus = "ok" | "warning" | "blocked";

export interface HealthCheck {
  code: string;
  status: HealthStatus;
  message: string;
}

export interface HealthCategory {
  status: HealthStatus;
  summary: string;
  checks: HealthCheck[];
}

export interface RuntimeHealthSnapshot {
  service: "agent-arena-platform";
  generatedAt: string;
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
}: {
  store: PlatformMockStore;
  nowMs: number;
  runtimeMode: RuntimeMode;
  network: string;
  predictSubmitEnabled: boolean;
  registrySubmitEnabled: boolean;
  internalTokenConfigured: boolean;
  walletSecretConfigured: boolean;
  marketFreshness: MarketFreshnessSummary;
}): RuntimeHealthSnapshot {
  const categories = {
    runtime: createRuntimeCategory({
      runtimeMode,
      network,
      predictSubmitEnabled,
      registrySubmitEnabled,
      internalTokenConfigured,
      walletSecretConfigured
    }),
    market: createMarketCategory(marketFreshness),
    execution: createExecutionCategory(store, nowMs),
    settlement: createSettlementCategory(store),
    registry: createRegistryCategory(registrySubmitEnabled),
    wallets: createWalletCategory(store)
  };

  return {
    service: "agent-arena-platform",
    generatedAt: new Date(nowMs).toISOString(),
    overallStatus: worstStatus(Object.values(categories).map((category) => category.status)),
    categories
  };
}

function createRuntimeCategory(input: {
  runtimeMode: RuntimeMode;
  network: string;
  predictSubmitEnabled: boolean;
  registrySubmitEnabled: boolean;
  internalTokenConfigured: boolean;
  walletSecretConfigured: boolean;
}): HealthCategory {
  const checks: HealthCheck[] = [];
  if (input.runtimeMode === "real" && !input.predictSubmitEnabled) {
    checks.push({
      code: "PREDICT_SUBMIT_DISABLED",
      status: "blocked",
      message: "Real runtime mode needs Predict submit enabled for live execution."
    });
  }
  if (!input.internalTokenConfigured) {
    checks.push({
      code: "INTERNAL_TOKEN_MISSING",
      status: "blocked",
      message: "Internal token is required for server-only operator routes."
    });
  }
  if (!input.walletSecretConfigured) {
    checks.push({
      code: "WALLET_SECRET_MISSING",
      status: "blocked",
      message: "Wallet secret is required for managed trading wallets."
    });
  }
  return categoryFromChecks(checks, `Runtime ${input.runtimeMode} on ${input.network}.`);
}

function createMarketCategory(marketFreshness: MarketFreshnessSummary): HealthCategory {
  return {
    status: marketFreshness.status,
    summary: marketFreshness.summary,
    checks: [{
      code: `MARKET_SOURCE_${marketFreshness.source.toUpperCase()}`,
      status: marketFreshness.status,
      message: marketFreshness.ageMs === null
        ? marketFreshness.summary
        : `${marketFreshness.summary} Age ${marketFreshness.ageMs}ms.`
    }]
  };
}

function createExecutionCategory(store: PlatformMockStore, nowMs: number): HealthCategory {
  const executions = store.listExecutions();
  const pending = executions
    .map((execution) => createExecutionHealth({ execution, nowMs }))
    .filter((execution) => !execution.terminal);
  const oldest = pending.sort((left, right) => right.ageMs - left.ageMs)[0];
  return categoryFromChecks(oldest ? [{
    code: "PENDING_EXECUTION_EXISTS",
    status: oldest.ageMs > 20000 ? "warning" : "ok",
    message: `Oldest pending execution ${oldest.executionId} is ${oldest.ageMs}ms old.`
  }] : [], "Execution queue has no pending jobs.");
}

function createSettlementCategory(store: PlatformMockStore): HealthCategory {
  const claimRows = store.listPerformanceLedger().filter((row) => row.kind === "claim");
  return categoryFromChecks([], `Settlement claim rows recorded: ${claimRows.length}.`);
}

function createRegistryCategory(registrySubmitEnabled: boolean): HealthCategory {
  return {
    status: registrySubmitEnabled ? "ok" : "warning",
    summary: registrySubmitEnabled ? "Registry proof mode is enabled." : "Registry proof mode is disabled.",
    checks: []
  };
}

function createWalletCategory(store: PlatformMockStore): HealthCategory {
  const checks = store.listTradingWallets().flatMap((wallet): HealthCheck[] => {
    const walletChecks: HealthCheck[] = [];
    if (BigInt(wallet.quoteBalance) < 10_000_000n) {
      walletChecks.push({
        code: "WALLET_NOT_FUNDED",
        status: "warning",
        message: `Wallet ${wallet.id} is below 10000000 raw DUSDC.`
      });
    }
    if (BigInt(wallet.testnetSuiBalance) < 1_000_000_000n) {
      walletChecks.push({
        code: "GAS_BALANCE_TOO_LOW",
        status: "warning",
        message: `Wallet ${wallet.id} is below 1000000000 MIST.`
      });
    }
    if (wallet.predictManagerStatus !== "ready") {
      walletChecks.push({
        code: "PREDICT_MANAGER_MISSING",
        status: "warning",
        message: `Wallet ${wallet.id} has no ready PredictManager.`
      });
    }
    return walletChecks;
  });
  return categoryFromChecks(checks, "Wallet readiness checked.");
}

function categoryFromChecks(checks: HealthCheck[], okSummary: string): HealthCategory {
  return {
    status: worstStatus(checks.map((check) => check.status)),
    summary: checks.length === 0 ? okSummary : checks[0].message,
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
```

- [ ] **Step 5: Add internal health route test**

Append to `agent-arena/apps/backend/src/platform/api.test.ts`:

```ts
it("protects internal runtime health behind the internal token", async () => {
  const fetch = createPlatformFetchHandler(undefined, {
    internalToken: "operator-secret",
    runtimeMode: "real",
    predictSubmitEnabled: false,
    registrySubmitEnabled: true,
    walletSecretConfigured: true,
    marketSnapshotMetadataReader: () => ({
      competitionId: "btc-15m-001",
      source: "predict_server",
      fetchedAt: "2026-06-25T00:00:00.000Z",
      lastSuccessAt: "2026-06-25T00:00:00.000Z",
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    })
  });

  const unauthorized = await fetch(new Request("http://localhost/api/arena/internal/health"));
  expect(unauthorized.status).toBe(401);

  const authorized = await fetch(new Request("http://localhost/api/arena/internal/health", {
    headers: {
      "x-agent-arena-internal-token": "operator-secret"
    }
  }));
  expect(authorized.status).toBe(200);
  const body = await authorized.json();
  expect(body.overallStatus).toBe("blocked");
  expect(JSON.stringify(body)).not.toContain("operator-secret");
});
```

- [ ] **Step 6: Implement internal health route**

In `agent-arena/apps/backend/src/platform/api.ts`, extend `CreatePlatformFetchHandlerOptions`:

```ts
  internalToken?: string;
  runtimeMode?: "mock" | "real";
  predictSubmitEnabled?: boolean;
  registrySubmitEnabled?: boolean;
  walletSecretConfigured?: boolean;
  marketSnapshotMetadataReader?: () => MarketSnapshotMetadata | null;
  marketStaleMs?: number;
```

Add route handling before settlement routes:

```ts
      if (request.method === "GET" && matchesRoute(route, ["internal", "health"])) {
        return getInternalHealth(request, store, options);
      }
```

Add helper:

```ts
function getInternalHealth(
  request: Request,
  store: PlatformMockStore,
  options: CreatePlatformFetchHandlerOptions
): Response {
  const expectedToken = options.internalToken ?? options.settlementInternalToken;
  if (!expectedToken || request.headers.get(internalTokenHeader) !== expectedToken) {
    return errorResponse(401, "UNAUTHORIZED", "Internal token is required");
  }

  const nowMs = options.now?.() ?? Date.now();
  const marketFreshness = evaluateMarketFreshness({
    metadata: options.marketSnapshotMetadataReader?.() ?? null,
    nowMs,
    staleThresholdMs: options.marketStaleMs ?? 5000,
    runtimeMode: options.runtimeMode ?? "mock"
  });
  const snapshot = createRuntimeHealthSnapshot({
    store,
    nowMs,
    runtimeMode: options.runtimeMode ?? "mock",
    network: "testnet",
    predictSubmitEnabled: options.predictSubmitEnabled ?? false,
    registrySubmitEnabled: options.registrySubmitEnabled ?? false,
    internalTokenConfigured: Boolean(expectedToken),
    walletSecretConfigured: options.walletSecretConfigured ?? false,
    marketFreshness
  });
  return jsonResponse(snapshot);
}
```

Import `evaluateMarketFreshness`, `MarketSnapshotMetadata`, and `createRuntimeHealthSnapshot`.

- [ ] **Step 7: Pass health options from server**

In `agent-arena/apps/backend/src/server.ts`, pass:

```ts
      internalToken: config.internalToken,
      runtimeMode: "real",
      predictSubmitEnabled: config.enablePredictSubmit,
      registrySubmitEnabled: config.registry.enabled,
      walletSecretConfigured: Boolean(config.walletSecret),
      marketSnapshotMetadataReader: marketDataTracker.getMetadata,
      marketStaleMs: Number(process.env.AGENT_ARENA_MARKET_STALE_MS ?? "5000"),
```

- [ ] **Step 8: Run runtime-health and route tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/runtime-health.test.ts src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git add agent-arena/apps/backend/src/platform/runtime-health.ts agent-arena/apps/backend/src/platform/runtime-health.test.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/server.ts
git commit -m "feat: add internal runtime health"
```

---

### Task 4: Agent Readiness Service And Endpoint

**Files:**
- Create: `agent-arena/apps/backend/src/platform/agent-readiness.test.ts`
- Create: `agent-arena/apps/backend/src/platform/agent-readiness.ts`
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Write failing readiness service tests**

Create `agent-arena/apps/backend/src/platform/agent-readiness.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createAgentReadiness } from "./agent-readiness";
import { createMarketSnapshot } from "./market-snapshot";
import { PlatformMockStore } from "./mock-store";
import { createMockCompetition } from "./types";

describe("agent readiness", () => {
  it("blocks open_range when executableMarkets.range is missing", () => {
    const store = new PlatformMockStore();
    const competition = createMockCompetition("btc-15m-001");
    const marketState = createMarketSnapshot(competition, Date.parse("2026-06-25T00:00:00.000Z"));

    const readiness = createAgentReadiness({
      store,
      agentId: "agent_1",
      competition,
      marketState,
      wallet: {
        id: "wallet_1",
        agentId: "agent_1",
        address: "0xwallet",
        status: "active",
        testnetSuiBalance: "1000000000",
        quoteBalance: "10000000",
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager",
        createdAt: "2026-06-25T00:00:00.000Z"
      },
      positions: [],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-25T00:00:00.000Z")
    });

    expect(readiness.actions.open_range).toMatchObject({
      status: "blocked",
      reasons: [expect.objectContaining({ code: "NO_EXECUTABLE_RANGE_MARKET" })]
    });
  });

  it("blocks exposure changes when quote balance is below 10000000 raw DUSDC", () => {
    const store = new PlatformMockStore();
    const competition = createMockCompetition("btc-15m-001");
    const marketState = createMarketSnapshot(competition, Date.parse("2026-06-25T00:00:00.000Z"));

    const readiness = createAgentReadiness({
      store,
      agentId: "agent_1",
      competition,
      marketState,
      wallet: {
        id: "wallet_1",
        agentId: "agent_1",
        address: "0xwallet",
        status: "active",
        testnetSuiBalance: "1000000000",
        quoteBalance: "9999999",
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager",
        createdAt: "2026-06-25T00:00:00.000Z"
      },
      positions: [],
      pendingExecutions: [],
      nowMs: Date.parse("2026-06-25T00:00:00.000Z")
    });

    expect(readiness.actions.open_directional.reasons).toContainEqual(expect.objectContaining({
      code: "WALLET_NOT_FUNDED"
    }));
  });
});
```

- [ ] **Step 2: Run readiness service test and verify it fails**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/agent-readiness.test.ts
```

Expected: FAIL because `./agent-readiness` does not exist.

- [ ] **Step 3: Implement readiness service**

Modify `agent-arena/apps/backend/src/platform/types.ts` inside `MarketSnapshot["executableMarkets"]`:

```ts
    range?: {
      oracleId: string;
      expiry: string;
      lowerStrikeRaw: string;
      higherStrikeRaw: string;
    };
```

Create `agent-arena/apps/backend/src/platform/agent-readiness.ts`:

```ts
import type {
  AgentAction,
  AgentPositionSnapshot,
  Competition,
  ExecutionRecord,
  MarketSnapshot,
  TradingWallet
} from "./types";
import type { PlatformMockStore } from "./mock-store";

export type ActionReadinessStatus = "executable" | "risky" | "blocked";

export interface ActionReadinessReason {
  code: string;
  message: string;
  recommendedAgentAction: string;
}

export interface ActionReadiness {
  status: ActionReadinessStatus;
  markets?: string[];
  reasons: ActionReadinessReason[];
}

export interface AgentReadiness {
  competitionId: string;
  agentId: string;
  asOfMs: string;
  actions: Record<AgentAction, ActionReadiness>;
}

export function createAgentReadiness({
  agentId,
  competition,
  marketState,
  wallet,
  positions,
  pendingExecutions,
  nowMs
}: {
  store: PlatformMockStore;
  agentId: string;
  competition: Competition;
  marketState: MarketSnapshot;
  wallet: TradingWallet | null;
  positions: AgentPositionSnapshot[];
  pendingExecutions: ExecutionRecord[];
  nowMs: number;
}): AgentReadiness {
  const baseReasons = baseBlockingReasons({ competition, marketState, wallet, pendingExecutions });
  const hasPosition = positions.some((position) => position.status === "open" || position.status === "reduced");

  return {
    competitionId: competition.id,
    agentId,
    asOfMs: String(nowMs),
    actions: {
      hold: { status: "executable", reasons: [] },
      open_directional: actionReadiness([
        ...baseReasons,
        ...directionalReasons(marketState)
      ], marketState.lateWindow.openMayFailOnPredictQuote ? "risky" : "executable", ["directional"]),
      open_range: actionReadiness([
        ...baseReasons,
        ...rangeReasons(marketState)
      ], marketState.lateWindow.openMayFailOnPredictQuote ? "risky" : "executable", marketState.executableMarkets?.range ? ["range"] : []),
      reduce: actionReadiness([
        ...pendingReasons(pendingExecutions),
        ...positionReasons(hasPosition)
      ], "executable"),
      close: actionReadiness([
        ...pendingReasons(pendingExecutions),
        ...positionReasons(hasPosition)
      ], "executable")
    }
  };
}

function actionReadiness(
  reasons: ActionReadinessReason[],
  executableStatus: ActionReadinessStatus,
  markets: string[] = []
): ActionReadiness {
  return {
    status: reasons.length > 0 ? "blocked" : executableStatus,
    markets,
    reasons
  };
}

function baseBlockingReasons({
  competition,
  marketState,
  wallet,
  pendingExecutions
}: {
  competition: Competition;
  marketState: MarketSnapshot;
  wallet: TradingWallet | null;
  pendingExecutions: ExecutionRecord[];
}): ActionReadinessReason[] {
  return [
    ...(competition.status !== "live" ? [reason("ROUND_NOT_LIVE", "Round is not live.", "submit_hold_and_refresh_market_state")] : []),
    ...(marketState.oracleStatus !== "active" ? [reason("ORACLE_NOT_TRADEABLE", "Oracle is not tradeable.", "submit_hold_and_refresh_market_state")] : []),
    ...walletReasons(wallet),
    ...pendingReasons(pendingExecutions)
  ];
}

function walletReasons(wallet: TradingWallet | null): ActionReadinessReason[] {
  if (!wallet) {
    return [reason("WALLET_NOT_BOUND", "No trading wallet is bound.", "ask_owner_to_claim_or_rotate")];
  }

  const reasons: ActionReadinessReason[] = [];
  if (BigInt(wallet.quoteBalance) < 10_000_000n) {
    reasons.push(reason("WALLET_NOT_FUNDED", "Trading wallet has less than 10000000 raw DUSDC.", "ask_owner_to_fund_wallet"));
  }
  if (BigInt(wallet.testnetSuiBalance) < 1_000_000_000n) {
    reasons.push(reason("GAS_BALANCE_TOO_LOW", "Trading wallet has less than 1000000000 MIST.", "ask_owner_to_fund_wallet"));
  }
  if (wallet.predictManagerStatus !== "ready") {
    reasons.push(reason("PREDICT_MANAGER_MISSING", "PredictManager is not ready.", "wait_for_manager_setup"));
  }
  return reasons;
}

function directionalReasons(marketState: MarketSnapshot): ActionReadinessReason[] {
  return marketState.executableMarkets?.directional
    ? []
    : [reason("NO_EXECUTABLE_DIRECTIONAL_MARKET", "No directional market is published.", "submit_hold_and_refresh_market_state")];
}

function rangeReasons(marketState: MarketSnapshot): ActionReadinessReason[] {
  return marketState.executableMarkets?.range
    ? []
    : [reason("NO_EXECUTABLE_RANGE_MARKET", "No range market is published.", "submit_hold_and_refresh_market_state")];
}

function pendingReasons(pendingExecutions: ExecutionRecord[]): ActionReadinessReason[] {
  return pendingExecutions.length > 0
    ? [reason("PENDING_EXECUTION_EXISTS", "A trade execution is already pending.", "wait_for_execution_result")]
    : [];
}

function positionReasons(hasPosition: boolean): ActionReadinessReason[] {
  return hasPosition
    ? []
    : [reason("NO_OPEN_POSITION", "No backend-confirmed open position exists.", "submit_hold_and_refresh_positions")];
}

function reason(code: string, message: string, recommendedAgentAction: string): ActionReadinessReason {
  return { code, message, recommendedAgentAction };
}
```

- [ ] **Step 4: Add Agent readiness route tests**

Append to `agent-arena/apps/backend/src/platform/api.test.ts`:

```ts
it("returns Agent readiness only for the authenticated runtime credential", async () => {
  const store = new PlatformMockStore();
  const claimed = await claimTestAgent(createPlatformFetchHandler(store));
  const fetch = createPlatformFetchHandler(store);

  const missingAuth = await fetch(new Request(
    "http://localhost/api/arena/agent/readiness?competitionId=btc-15m-001"
  ));
  expect(missingAuth.status).toBe(401);

  const response = await fetch(new Request(
    "http://localhost/api/arena/agent/readiness?competitionId=btc-15m-001",
    {
      headers: {
        "x-agent-arena-agent-token": claimed.runtimeCredential.token
      }
    }
  ));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.readiness.agentId).toBe(claimed.agent.id);
  expect(body.readiness.actions.open_range.reasons).toContainEqual(expect.objectContaining({
    code: "NO_EXECUTABLE_RANGE_MARKET"
  }));
});
```

- [ ] **Step 5: Implement Agent readiness route**

In `agent-arena/apps/backend/src/platform/api.ts`, add to introspection:

```ts
"GET /api/arena/agent/readiness?competitionId=btc-15m-001"
```

Add route:

```ts
      if (request.method === "GET" && matchesRoute(route, ["agent", "readiness"])) {
        const auth = authenticateAgentRuntimeRequest(request, store);
        return getAgentReadiness(url, store, auth.agentId, options);
      }
```

Add helper:

```ts
async function getAgentReadiness(
  url: URL,
  store: PlatformMockStore,
  agentId: string,
  options: Pick<CreatePlatformFetchHandlerOptions, "agentWalletReader" | "marketDataProvider" | "now">
): Promise<Response> {
  const competitionId = url.searchParams.get("competitionId")?.trim();
  if (!competitionId) {
    return errorResponse(400, "INVALID_INPUT", "competitionId query parameter is required");
  }

  const competition = store.getCompetition(competitionId);
  if (!competition) {
    return errorResponse(404, "COMPETITION_NOT_FOUND", "Competition not found");
  }

  const wallet = store.getTradingWalletByAgentId(agentId) ?? null;
  if (wallet) {
    await refreshTradingWallet(store, wallet, options.agentWalletReader);
  }
  const refreshedWallet = store.getTradingWalletByAgentId(agentId) ?? wallet;
  const marketState = options.marketDataProvider && competitionId === defaultCompetitionId
    ? (await options.marketDataProvider()).marketState
    : createMarketSnapshot(competition, options.now?.() ?? Date.now());
  const pendingExecutions = store.listExecutions().filter((execution) => (
    execution.agentId === agentId &&
    execution.competitionId === competitionId &&
    (execution.status === "queued" || execution.status === "signed" || execution.status === "submitted")
  ));
  const positions = store.listPositionSnapshots({ agentId, competitionId });

  return jsonResponse({
    readiness: createAgentReadiness({
      store,
      agentId,
      competition,
      marketState,
      wallet: refreshedWallet,
      positions,
      pendingExecutions,
      nowMs: options.now?.() ?? Date.now()
    })
  });
}
```

Import `createAgentReadiness` and `createMarketSnapshot`.

- [ ] **Step 6: Run readiness tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/agent-readiness.test.ts src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add agent-arena/apps/backend/src/platform/agent-readiness.ts agent-arena/apps/backend/src/platform/agent-readiness.test.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/types.ts
git commit -m "feat: add agent readiness endpoint"
```

---

### Task 5: Frontend Readiness Display

**Files:**
- Modify: `agent-arena/apps/frontend/src/features/platform/types.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/client.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/client.test.ts`
- Create: `agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.test.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`

- [ ] **Step 1: Add frontend readiness types**

Modify `agent-arena/apps/frontend/src/features/platform/types.ts`:

```ts
export type ActionReadinessStatus = "executable" | "risky" | "blocked";

export interface ActionReadinessReason {
  code: string;
  message: string;
  recommendedAgentAction: string;
}

export interface ActionReadiness {
  status: ActionReadinessStatus;
  markets?: string[];
  reasons: ActionReadinessReason[];
}

export interface AgentReadiness {
  competitionId: string;
  agentId: string;
  asOfMs: string;
  actions: Record<"hold" | "open_directional" | "open_range" | "reduce" | "close", ActionReadiness>;
}
```

- [ ] **Step 2: Write failing client test**

Append to `agent-arena/apps/frontend/src/features/platform/client.test.ts`:

```ts
it("loads Agent readiness with the runtime credential header", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    readiness: {
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      asOfMs: "1781700650123",
      actions: {
        hold: { status: "executable", reasons: [] },
        open_directional: { status: "executable", markets: ["directional"], reasons: [] },
        open_range: { status: "blocked", markets: [], reasons: [{ code: "NO_EXECUTABLE_RANGE_MARKET", message: "No range.", recommendedAgentAction: "submit_hold_and_refresh_market_state" }] },
        reduce: { status: "blocked", reasons: [] },
        close: { status: "blocked", reasons: [] }
      }
    }
  }), { status: 200 }));
  const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

  await client.getAgentReadiness("agent_runtime_test_token", "btc-15m-001");

  expect(fetcher).toHaveBeenCalledWith(
    "https://platform.test/api/arena/agent/readiness?competitionId=btc-15m-001",
    {
      headers: {
        "x-agent-arena-agent-token": "agent_runtime_test_token"
      }
    }
  );
});
```

- [ ] **Step 3: Implement frontend client method**

Modify imports in `client.ts`:

```ts
  AgentReadiness,
```

Add response interface:

```ts
interface AgentReadinessResponse {
  readiness: AgentReadiness;
}
```

Add method near other Agent runtime reads:

```ts
    getAgentReadiness: (runtimeCredential: string, competitionId: string) =>
      requestJson<AgentReadinessResponse>(
        fetcher,
        `${root}/agent/readiness?competitionId=${encodeURIComponent(competitionId)}`,
        {
          headers: createRuntimeHeaders(runtimeCredential)
        }
      ).then((response) => response.readiness),
```

- [ ] **Step 4: Add readiness panel tests**

Create `agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentReadinessPanel } from "./AgentReadinessPanel";
import type { AgentReadiness } from "../../features/platform/types";

const readiness: AgentReadiness = {
  competitionId: "btc-15m-001",
  agentId: "agent_1",
  asOfMs: "1781700650123",
  actions: {
    hold: { status: "executable", reasons: [] },
    open_directional: { status: "risky", markets: ["directional"], reasons: [] },
    open_range: {
      status: "blocked",
      markets: [],
      reasons: [{
        code: "NO_EXECUTABLE_RANGE_MARKET",
        message: "No range candidate is currently published.",
        recommendedAgentAction: "submit_hold_and_refresh_market_state"
      }]
    },
    reduce: { status: "blocked", reasons: [] },
    close: { status: "blocked", reasons: [] }
  }
};

describe("AgentReadinessPanel", () => {
  it("renders public action readiness without internal health data", () => {
    render(<AgentReadinessPanel readiness={readiness} />);

    expect(screen.getByText("open range")).toBeInTheDocument();
    expect(screen.getByText("NO_EXECUTABLE_RANGE_MARKET")).toBeInTheDocument();
    expect(screen.queryByText(/internal token/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement readiness panel**

Create `agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.tsx`:

```tsx
import type { AgentReadiness, ActionReadinessStatus } from "../../features/platform/types";

export function AgentReadinessPanel({ readiness }: { readiness: AgentReadiness }) {
  return (
    <section aria-label="Agent action readiness" className="paper-inset grid gap-2 p-3">
      <p className="paper-label text-on-surface-variant">Action readiness</p>
      <div className="grid gap-2">
        {Object.entries(readiness.actions).map(([action, state]) => (
          <article className="flex flex-wrap items-start justify-between gap-2" key={action}>
            <div className="min-w-0">
              <p className="font-display text-[11px] font-black uppercase text-on-surface">
                {formatAction(action)}
              </p>
              {state.reasons.map((reason) => (
                <p className="mt-1 font-mono text-[11px] font-bold text-on-surface-variant" key={`${action}-${reason.code}`}>
                  {reason.code}
                </p>
              ))}
            </div>
            <span className={`paper-chip px-2 py-1 ${statusClass(state.status)}`}>
              {state.status}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ");
}

function statusClass(status: ActionReadinessStatus): string {
  if (status === "executable") {
    return "paper-chip-green";
  }
  if (status === "risky") {
    return "paper-chip-orange";
  }
  return "paper-chip-red";
}
```

- [ ] **Step 6: Wire readiness into claim panel only after claim**

Modify `AgentClaimPanel.tsx`:

```ts
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AgentReadinessPanel } from "./AgentReadinessPanel";
import type { AgentReadiness } from "../../features/platform/types";
```

Add state:

```ts
  const [readiness, setReadiness] = useState<AgentReadiness | null>(null);
```

Add effect:

```ts
  useEffect(() => {
    let cancelled = false;
    if (!claimResult?.runtimeCredential.token) {
      setReadiness(null);
      return;
    }

    client.getAgentReadiness(claimResult.runtimeCredential.token, "btc-15m-001")
      .then((nextReadiness) => {
        if (!cancelled) {
          setReadiness(nextReadiness);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [claimResult?.runtimeCredential.token, client]);
```

Render below funding section:

```tsx
          {readiness ? <AgentReadinessPanel readiness={readiness} /> : null}
```

Do not store the runtime credential in local storage, session storage, URL params, or global app state.

- [ ] **Step 7: Add claim panel test for readiness timing**

Add to `AgentClaimPanel.test.tsx`:

```tsx
it("fetches readiness only after the shown-once runtime credential is available", async () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
  const platformFetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/owner/agents/claim/prepare")) {
      return json({
        pendingClaimId: "pending_claim_readiness",
        agent: agent("agent_readiness", ownerAddress, tradingWalletAddress),
        tradingWallet: tradingWallet("wallet_readiness", "agent_readiness", tradingWalletAddress),
        registryProof: registerProof
      }, 201);
    }
    if (url.endsWith("/owner/agents/claim/finalize")) {
      return json({
        agent: agent("agent_readiness", ownerAddress, tradingWalletAddress),
        tradingWallet: tradingWallet("wallet_readiness", "agent_readiness", tradingWalletAddress),
        runtimeCredential: {
          token: "agent_runtime_test_token",
          shownOnce: true,
          scopes: ["competition:read"]
        },
        registry: {
          status: "submitted",
          txDigest: "0xreadinessdigest"
        }
      }, 201);
    }
    if (url.includes("/agent/readiness")) {
      expect(init?.headers).toMatchObject({
        "x-agent-arena-agent-token": "agent_runtime_test_token"
      });
      return json({
        readiness: {
          competitionId: "btc-15m-001",
          agentId: "agent_readiness",
          asOfMs: "1781700650123",
          actions: {
            hold: { status: "executable", reasons: [] },
            open_directional: { status: "executable", markets: ["directional"], reasons: [] },
            open_range: {
              status: "blocked",
              markets: [],
              reasons: [{
                code: "NO_EXECUTABLE_RANGE_MARKET",
                message: "No range candidate is currently published.",
                recommendedAgentAction: "submit_hold_and_refresh_market_state"
              }]
            },
            reduce: { status: "blocked", reasons: [] },
            close: { status: "blocked", reasons: [] }
          }
        }
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  });
  const walletProvider: ClaimWalletProvider = {
    connect: vi.fn(async () => ({ accounts: [{ address: ownerAddress }] })),
    signAndExecuteTransaction: vi.fn(async () => ({ digest: "0xreadinessdigest" }))
  };

  render(
    <AgentClaimPanel
      apiBaseUrl="http://127.0.0.1:8787/api/arena"
      fetcher={platformFetcher}
      registrationCode="PAIR-READINESS"
      walletProvider={walletProvider}
    />
  );
  expect(platformFetcher.mock.calls.some(([url]) => String(url).includes("/agent/readiness"))).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: /Connect wallet and claim/i }));
  expect(await screen.findByLabelText("Agent action readiness")).toBeInTheDocument();
  await waitFor(() => {
    expect(platformFetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/api/arena/agent/readiness?competitionId=btc-15m-001",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-agent-arena-agent-token": "agent_runtime_test_token"
        })
      })
    );
  });
});
```

- [ ] **Step 8: Run frontend focused tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/features/platform/client.test.ts src/components/platform/AgentReadinessPanel.test.tsx src/components/platform/AgentClaimPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```powershell
git add agent-arena/apps/frontend/src/features/platform/types.ts agent-arena/apps/frontend/src/features/platform/client.ts agent-arena/apps/frontend/src/features/platform/client.test.ts agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentReadinessPanel.test.tsx agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx
git commit -m "feat: show agent action readiness"
```

---

### Task 6: Skill Docs And Operations Runbook

**Files:**
- Modify: `agent-arena/skills/agent-arena.md`
- Modify: `agent-arena/skills/deepbook-predict-btc-15m.md`
- Modify: `agent-arena/OPERATE.md`

- [ ] **Step 1: Update Agent skill route guidance**

In `agent-arena/skills/agent-arena.md`, add a runtime-loop step before non-hold intent submission:

````markdown
Before any non-hold intent, call:

```text
GET /api/arena/agent/readiness?competitionId=<competitionId>
x-agent-arena-agent-token: <runtime credential>
```

Use the readiness response to decide whether the action is `executable`, `risky`, or `blocked`. `allowedActions` is only the action vocabulary. It is not proof that a market identifier, wallet balance, PredictManager, or position reference is executable right now.

If an action is `blocked`, submit `hold` and follow the reason's `recommendedAgentAction`. Do not invent range strikes or position refs.
````

- [ ] **Step 2: Update BTC 15m skill market guidance**

In `agent-arena/skills/deepbook-predict-btc-15m.md`, add:

```markdown
Range opens require both:

- `allowedActions` includes `open_range`
- the current market state or readiness response publishes an executable range market

If no executable range market is published, submit `hold`. Do not derive `lowerStrike` or `higherStrike` from directional examples.

Exposure-changing intents require the trading wallet to meet the current funding floor: at least `10000000` raw DUSDC and the configured SUI gas floor.
```

- [ ] **Step 3: Update operations runbook**

In `agent-arena/OPERATE.md`, add a section after Useful Verification:

````markdown
## Runtime Health Check

Run from the production server so the internal token stays server-side:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml exec -T backend sh -lc 'curl -fsS -H "x-agent-arena-internal-token: $AGENT_ARENA_INTERNAL_TOKEN" http://127.0.0.1:8787/api/arena/internal/health'
```

If the response is `blocked`, check the category summaries before allowing external Agents to submit exposure-changing intents.

### Competition Is Live But Agents Cannot Execute

Check these in order:

1. `runtime.predictSubmitEnabled` is true.
2. `market.source` is `predict_server` and snapshot age is below the stale threshold.
3. `wallets` has no `WALLET_NOT_FUNDED`, `GAS_BALANCE_TOO_LOW`, or `PREDICT_MANAGER_MISSING` warnings for the Agent.
4. `execution` has no stale pending execution for the Agent.
5. Agent readiness publishes the requested action as `executable` or intentionally `risky`.

### Settlement Expired But Leaderboard Did Not Finalize

Check these in order:

1. `settlement` category last reconcile time.
2. queued, submitted, confirmed, and skipped settlement claim counts.
3. last Predict settlement-not-ready result.
4. backend logs for settlement claim executor errors.

Backend `.env` gate changes require backend recreate:

```bash
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml up -d --force-recreate --no-deps backend
```
````

- [ ] **Step 4: Run skill validation**

Run:

```powershell
bun run --cwd agent-arena validate:skills
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add agent-arena/skills/agent-arena.md agent-arena/skills/deepbook-predict-btc-15m.md agent-arena/OPERATE.md
git commit -m "docs: document runtime health readiness"
```

---

### Task 7: Full Verification

**Files:**
- No file edits unless verification exposes a defect.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test
```

Expected: PASS with no failing backend tests.

- [ ] **Step 2: Run frontend tests**

Run:

```powershell
bun run --cwd agent-arena test:frontend
```

Expected: PASS with no failing frontend tests.

- [ ] **Step 3: Run skill validation**

Run:

```powershell
bun run --cwd agent-arena validate:skills
```

Expected: PASS.

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
bun run --cwd agent-arena typecheck
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```powershell
bun run --cwd agent-arena build
```

Expected: PASS.

- [ ] **Step 6: Run git diff checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` shows only intended files before the final commit, and shows clean after the final commit.

- [ ] **Step 7: Resolve verification defects if any were required**

If verification exposes a defect, return to the task that introduced the failing behavior, apply the smallest fix there, stage the exact files listed in that task's commit step, and re-run Task 7 from Step 1.

If verification required no edits, do not create an empty commit.

---

## Spec Coverage Self-Review

- Operator health is covered by Tasks 2, 3, and 6.
- Agent action readiness is covered by Tasks 4 and 5.
- Execution job visibility and retryability are covered by Task 1.
- Market freshness based on provider metadata is covered by Task 2.
- Funding thresholds are covered by Tasks 3, 4, and 6.
- Server-only operator boundary is covered by Tasks 3, 5, and 6.
- Skill docs and runbook updates are covered by Task 6.
- Full verification is covered by Task 7.
