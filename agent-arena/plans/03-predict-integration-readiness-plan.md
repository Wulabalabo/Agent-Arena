# Predict Integration Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Predict-native configuration, server read adapters, transaction readiness state, and UI disclosure without implementing full live wallet execution.

**Architecture:** Introduce a small Predict feature boundary under `src/features/predict`. Keep network and transaction concerns behind interfaces so the UI can run in mock mode and later swap in generated bindings plus wallet PTBs.

**Tech Stack:** React, TypeScript, Vitest, browser `fetch`, existing Vite environment.

---

## Source Specs

- `agent-arena/specs/03-predict-integration-spec.md`
- `agent-arena/specs/05-data-state-and-acceptance-spec.md`

## Official Predict References

- `https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict`
- `https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/predict.move`

The plan follows the README guidance:

- Use public `predict-server` for render-ready lists, history, portfolio summaries, and oracle state.
- Use direct on-chain reads only for confirmation-critical wallet state.
- Use `predict::create_manager`, `predict::mint`, `predict::redeem`, `predict::mint_range`, and `predict::redeem_range` as the protocol actions.
- Do not hand-roll broad protocol parsing throughout the UI.

## File Structure

- Create: `agent-arena/apps/frontend/src/features/predict/config.ts`
  - Predict server URL, package id, object id, quote asset, network, and feature flags.
- Create: `agent-arena/apps/frontend/src/features/predict/types.ts`
  - Frontend-facing Predict server response types and transaction readiness types.
- Create: `agent-arena/apps/frontend/src/features/predict/client.ts`
  - Fetch wrapper for public Predict server endpoints used by the MVP.
- Create: `agent-arena/apps/frontend/src/features/predict/readiness.ts`
  - Pure function that maps wallet/manager/deposit/round state to UI action labels.
- Create: `agent-arena/apps/frontend/src/features/predict/client.test.ts`
  - Verifies endpoint construction and error behavior.
- Create: `agent-arena/apps/frontend/src/features/predict/readiness.test.ts`
  - Verifies checklist states.
- Modify: `agent-arena/apps/frontend/src/components/backing/BackAgentPanel.tsx`
  - Shows readiness checklist and underlying Predict action disclosure.
- Modify: `agent-arena/apps/frontend/src/components/portfolio/BetManagementPanel.tsx`
  - Labels close/redeem versus cancel correctly.

## Task 1: Predict Config

**Files:**
- Create: `agent-arena/apps/frontend/src/features/predict/config.ts`
- Create: `agent-arena/apps/frontend/src/features/predict/types.ts`
- Test: `agent-arena/apps/frontend/src/features/predict/readiness.test.ts`

- [ ] **Step 1: Write config test through readiness import**

Create `agent-arena/apps/frontend/src/features/predict/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { predictConfig } from "./config";

describe("predict config", () => {
  it("keeps public testnet integration values configurable", () => {
    expect(predictConfig.serverUrl).toBe("https://predict-server.testnet.mystenlabs.com");
    expect(predictConfig.predictPackageId).toMatch(/^0x/);
    expect(predictConfig.predictObjectId).toMatch(/^0x/);
    expect(predictConfig.quoteAssetType).toContain("::dusdc::DUSDC");
    expect(predictConfig.mockMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/readiness.test.ts
```

Expected: FAIL because `config.ts` does not exist.

- [ ] **Step 3: Add Predict types and config**

Create `agent-arena/apps/frontend/src/features/predict/types.ts`:

```ts
export interface PredictConfig {
  serverUrl: string;
  predictPackageId: string;
  predictObjectId: string;
  quoteAssetType: string;
  network: "testnet" | "mainnet" | "localnet";
  mockMode: boolean;
  liveWalletFlow: boolean;
}

export interface PredictOracleSummary {
  oracleId: string;
  symbol: string;
  expiry: string;
  status: "inactive" | "active" | "settled" | "unknown";
}

export interface PredictManagerSummary {
  managerId: string;
  owner: string;
  quoteBalance: number;
}

export interface PredictReadinessInput {
  walletConnected: boolean;
  hasManager: boolean;
  hasEnoughDeposit: boolean;
  roundLocked: boolean;
  mockMode: boolean;
}

export interface PredictReadiness {
  primaryAction: "connect_wallet" | "create_manager" | "deposit" | "back_agent" | "locked";
  label: string;
  disabled: boolean;
  reasons: string[];
}
```

Create `agent-arena/apps/frontend/src/features/predict/config.ts`:

```ts
import type { PredictConfig } from "./types";

export const predictConfig: PredictConfig = {
  serverUrl: "https://predict-server.testnet.mystenlabs.com",
  predictPackageId: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  predictObjectId: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  quoteAssetType: "e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
  network: "testnet",
  mockMode: true,
  liveWalletFlow: false
};
```

- [ ] **Step 4: Run config test**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/readiness.test.ts
```

Expected: PASS for the config test.

## Task 2: Readiness State Machine

**Files:**
- Modify: `agent-arena/apps/frontend/src/features/predict/readiness.test.ts`
- Create: `agent-arena/apps/frontend/src/features/predict/readiness.ts`

- [ ] **Step 1: Add readiness tests**

Append to `readiness.test.ts`:

```ts
import { getPredictReadiness } from "./readiness";

describe("getPredictReadiness", () => {
  it("asks the user to connect a wallet first", () => {
    expect(
      getPredictReadiness({
        walletConnected: false,
        hasManager: false,
        hasEnoughDeposit: false,
        roundLocked: false,
        mockMode: false
      }).label
    ).toBe("Connect wallet");
  });

  it("uses Back Agent in mock mode when the round is open", () => {
    expect(
      getPredictReadiness({
        walletConnected: false,
        hasManager: false,
        hasEnoughDeposit: false,
        roundLocked: false,
        mockMode: true
      }).label
    ).toBe("Back Agent");
  });

  it("blocks actions after lock", () => {
    const readiness = getPredictReadiness({
      walletConnected: true,
      hasManager: true,
      hasEnoughDeposit: true,
      roundLocked: true,
      mockMode: false
    });
    expect(readiness.disabled).toBe(true);
    expect(readiness.label).toBe("Round locked");
  });
});
```

- [ ] **Step 2: Run readiness tests to verify failure**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/readiness.test.ts
```

Expected: FAIL because `getPredictReadiness` does not exist.

- [ ] **Step 3: Implement readiness**

Create `agent-arena/apps/frontend/src/features/predict/readiness.ts`:

```ts
import type { PredictReadiness, PredictReadinessInput } from "./types";

export function getPredictReadiness(input: PredictReadinessInput): PredictReadiness {
  if (input.roundLocked) {
    return {
      primaryAction: "locked",
      label: "Round locked",
      disabled: true,
      reasons: ["Backing closes at T-30s before round start."]
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
      reasons: ["The PredictManager needs enough quote balance for this Agent backing."]
    };
  }

  return {
    primaryAction: "back_agent",
    label: "Back Agent",
    disabled: false,
    reasons: ["The app will build a Predict mint transaction from the selected Agent strategy."]
  };
}
```

- [ ] **Step 4: Run readiness tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/readiness.test.ts
```

Expected: PASS.

## Task 3: Predict Server Client

**Files:**
- Create: `agent-arena/apps/frontend/src/features/predict/client.ts`
- Create: `agent-arena/apps/frontend/src/features/predict/client.test.ts`

- [ ] **Step 1: Write client tests**

Create `client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPredictClient } from "./client";

describe("createPredictClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches predict state from the configured server", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "predict-state" })
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });
    await expect(client.getPredictState("0xpredict")).resolves.toEqual({ id: "predict-state" });
    expect(fetcher).toHaveBeenCalledWith("https://predict.example/predicts/0xpredict/state");
  });

  it("throws a readable error when the server returns a non-OK response", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error"
    });
    const client = createPredictClient({ serverUrl: "https://predict.example", fetcher });
    await expect(client.getOracleState("0xoracle")).rejects.toThrow("Predict server request failed: 500 Server Error");
  });
});
```

- [ ] **Step 2: Run client tests to verify failure**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/client.test.ts
```

Expected: FAIL because `client.ts` does not exist.

- [ ] **Step 3: Implement client**

Create `agent-arena/apps/frontend/src/features/predict/client.ts`:

```ts
interface CreatePredictClientOptions {
  serverUrl: string;
  fetcher?: typeof fetch;
}

async function requestJson<T>(fetcher: typeof fetch, url: string): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Predict server request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function createPredictClient({ serverUrl, fetcher = fetch }: CreatePredictClientOptions) {
  const root = serverUrl.replace(/\/$/, "");

  return {
    getStatus: () => requestJson(fetcher, `${root}/status`),
    getPredictState: (predictId: string) => requestJson(fetcher, `${root}/predicts/${predictId}/state`),
    getPredictOracles: (predictId: string) => requestJson(fetcher, `${root}/predicts/${predictId}/oracles`),
    getOracleState: (oracleId: string) => requestJson(fetcher, `${root}/oracles/${oracleId}/state`),
    getManagerSummary: (managerId: string) => requestJson(fetcher, `${root}/managers/${managerId}/summary`),
    getManagerPositionsSummary: (managerId: string) =>
      requestJson(fetcher, `${root}/managers/${managerId}/positions/summary`),
    getManagerPnl: (managerId: string) => requestJson(fetcher, `${root}/managers/${managerId}/pnl?range=ALL`),
    getOracleTrades: (oracleId: string) => requestJson(fetcher, `${root}/trades/${oracleId}`)
  };
}
```

- [ ] **Step 4: Run client tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/client.test.ts
```

Expected: PASS.

## Task 4: Wire Readiness Into Backing UI

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/backing/BackAgentPanel.tsx`
- Test: `agent-arena/apps/frontend/src/components/arena/ArenaShell.test.tsx`

- [ ] **Step 1: Update `BackAgentPanel` to call readiness**

Use:

```ts
const readiness = getPredictReadiness({
  walletConnected: false,
  hasManager: false,
  hasEnoughDeposit: false,
  roundLocked: isRoundLocked(round),
  mockMode: predictConfig.mockMode
});
```

Render:

- readiness label on the primary button.
- first readiness reason below the button.
- underlying Predict action: `mint` or `mint_range` based on Agent supported types.
- quote asset label from `predictConfig.quoteAssetType`.

- [ ] **Step 2: Add test expectation**

In `ArenaShell.test.tsx`, add:

```tsx
expect(screen.getByText(/Mock mode stores Agent attribution/i)).toBeInTheDocument();
expect(screen.getByText(/mint/i)).toBeInTheDocument();
```

- [ ] **Step 3: Run Arena tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/components/arena/ArenaShell.test.tsx
```

Expected: PASS.

## Task 5: Full Predict Readiness Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run Predict feature tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/features/predict/readiness.test.ts src/features/predict/client.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests and typecheck**

Run:

```bash
cd agent-arena/apps/frontend
bun run typecheck
bun run test
```

Expected: PASS.

- [ ] **Step 3: Commit this phase if committing is part of the execution session**

Run:

```bash
git add agent-arena/apps/frontend/src/features/predict agent-arena/apps/frontend/src/components/backing agent-arena/apps/frontend/src/components/portfolio agent-arena/apps/frontend/src/components/arena
git commit -m "feat: add Predict integration readiness"
```

Expected: commit contains Predict config/client/readiness and UI disclosure changes.
