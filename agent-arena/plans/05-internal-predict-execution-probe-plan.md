# Internal Predict Execution Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal-only Testnet execution probe that can generate a platform-managed Sui wallet, receive operator-funded Testnet SUI/DUSDC, create or discover a DeepBook Predict `PredictManager`, deposit DUSDC, preview trades, and submit small whitelisted Predict operations with audit records.

**Architecture:** Keep live Sui execution behind a new backend Predict boundary. Public Agent runtime APIs continue to use structured intents and mock execution until the probe proves signing, manager setup, and guardrails. Internal routes stay separate from public `/api/arena` introspection and must require `x-agent-arena-internal-token`.

**Tech Stack:** Bun, TypeScript, Bun test, `@mysten/sui`, Sui Testnet RPC, DeepBook Predict Testnet public server, local JSON or SQLite persistence.

---

## Source Specs

- `agent-arena/specs/06-agent-participation-platform-spec.md`
- `agent-arena/specs/07-internal-predict-execution-probe-spec.md`

## Protocol References

- `https://docs.sui.io/onchain-finance/deepbook-predict/`
- `https://docs.sui.io/onchain-finance/deepbook-predict/contract-information`
- `https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/predict`
- `https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/predict-manager`
- `https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict`

## Non-Negotiable Boundaries

- Testnet only.
- No private key in HTTP responses, logs, frontend state, skill docs, or registry payloads.
- No public Agent runtime credential can call internal routes.
- No browser-accessible code can receive `x-agent-arena-internal-token`.
- No arbitrary Move calls; only typed operation plans are signed.
- `maxCostRaw` and `minProceedsRaw` are pre-submit platform guardrails, not atomic onchain slippage controls.
- Missing-manager setup is two-phase: create/confirm manager first, deposit only after the shared object exists.
- `PredictManager` discovery never uses owned-object lookup; it uses local binding, Predict server `/managers`, or event index plus onchain owner verification.

## File Structure

- Modify: `agent-arena/apps/backend/package.json`
  - Add `@mysten/sui`.
- Modify: `agent-arena/apps/backend/src/server.ts`
  - Route `/api/arena/internal/*` to the internal probe handler before the public platform handler.
- Create: `agent-arena/apps/backend/src/predict/config.ts`
  - Load and validate Testnet Predict config from env.
- Create: `agent-arena/apps/backend/src/predict/config.test.ts`
  - Unit tests for Testnet-only config validation.
- Create: `agent-arena/apps/backend/src/predict/types.ts`
  - Internal wallet, manager binding, execution, signing audit, quote, and operation plan types.
- Create: `agent-arena/apps/backend/src/predict/internal-auth.ts`
  - Internal token guard and route exposure helpers.
- Create: `agent-arena/apps/backend/src/predict/internal-auth.test.ts`
  - Tests for missing token, bad token, and public route isolation.
- Create: `agent-arena/apps/backend/src/predict/wallet-store.ts`
  - Key generation, encrypted local wallet persistence, and balance read abstractions.
- Create: `agent-arena/apps/backend/src/predict/wallet-store.test.ts`
  - Tests that wallet creation returns only address/public metadata and stores encrypted key material.
- Create: `agent-arena/apps/backend/src/predict/predict-server-client.ts`
  - Minimal Predict public server client for status, oracles, managers, and events.
- Create: `agent-arena/apps/backend/src/predict/oracle.ts`
  - Candidate oracle selection and onchain `OracleSVI` confirmation.
- Create: `agent-arena/apps/backend/src/predict/oracle.test.ts`
  - Tests for active future BTC selection, stale filtering, and server/onchain mismatch rejection.
- Create: `agent-arena/apps/backend/src/predict/manager.ts`
  - PredictManager discovery, owner verification, create-manager, and deposit setup planning.
- Create: `agent-arena/apps/backend/src/predict/manager.test.ts`
  - Tests for local/server/event discovery, no owned-object lookup, owner verification, and two-phase dry-run behavior.
- Create: `agent-arena/apps/backend/src/predict/transactions.ts`
  - PTB builders for preview, mint, redeem, mint_range, redeem_range, and deposit.
- Create: `agent-arena/apps/backend/src/predict/transactions.test.ts`
  - Tests for whitelisted operations, ABI fail-closed behavior, range validation, and no arbitrary Move calls.
- Create: `agent-arena/apps/backend/src/predict/guardrails.ts`
  - Raw amount validation, pre-submit guardrails, post-submit policy drift classification.
- Create: `agent-arena/apps/backend/src/predict/guardrails.test.ts`
  - Tests for integer-only values, max-cost/min-proceeds soft guardrails, and policy drift.
- Create: `agent-arena/apps/backend/src/predict/execution-store.ts`
  - Internal execution and signing audit persistence.
- Create: `agent-arena/apps/backend/src/predict/internal-api.ts`
  - Internal HTTP endpoints from the spec.
- Create: `agent-arena/apps/backend/src/predict/internal-api.test.ts`
  - Endpoint tests for auth, wallet creation, setup dry-run, preview, execute, and list executions.
- Create: `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
  - Operator CLI for create-wallet, check-balances, setup, mint, redeem, range mint, and range redeem.

## Task 1: Backend Dependency And Predict Config

**Files:**
- Modify: `agent-arena/apps/backend/package.json`
- Create: `agent-arena/apps/backend/src/predict/config.ts`
- Create: `agent-arena/apps/backend/src/predict/config.test.ts`
- Create: `agent-arena/apps/backend/src/predict/types.ts`

- [ ] **Step 1: Add backend Sui SDK dependency**

Run:

```bash
cd agent-arena/apps/backend
bun add @mysten/sui
```

Expected: `package.json` includes `@mysten/sui`; Bun may create or update a backend lockfile.

- [ ] **Step 2: Write config tests first**

Create `agent-arena/apps/backend/src/predict/config.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createPredictConfig } from "./config";

describe("createPredictConfig", () => {
  it("loads Testnet Predict config with DUSDC decimals", () => {
    const config = createPredictConfig({
      AGENT_ARENA_NETWORK: "testnet",
      AGENT_ARENA_SUI_RPC_URL: "https://fullnode.testnet.sui.io:443",
      AGENT_ARENA_PREDICT_SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
      AGENT_ARENA_PREDICT_PACKAGE_ID: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
      AGENT_ARENA_PREDICT_OBJECT_ID: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
      AGENT_ARENA_SUI_CLOCK_OBJECT_ID: "0x6",
      AGENT_ARENA_QUOTE_ASSET_TYPE: "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
      AGENT_ARENA_QUOTE_DECIMALS: "6",
      AGENT_ARENA_PRICE_DECIMALS: "9",
      AGENT_ARENA_INTERNAL_TOKEN: "local-secret",
      AGENT_ARENA_WALLET_SECRET: "local-wallet-secret"
    });

    expect(config.network).toBe("testnet");
    expect(config.quoteDecimals).toBe(6);
    expect(config.priceDecimals).toBe(9);
  });

  it("rejects non-Testnet network values", () => {
    expect(() => createPredictConfig({
      AGENT_ARENA_NETWORK: "mainnet"
    })).toThrow("TESTNET_ONLY");
  });
});
```

- [ ] **Step 3: Run config tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/config.test.ts
```

Expected: FAIL because `config.ts` does not exist.

- [ ] **Step 4: Implement config and core types**

Create `agent-arena/apps/backend/src/predict/types.ts` with small interfaces only:

```ts
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
```

Create `agent-arena/apps/backend/src/predict/config.ts`:

```ts
import type { PredictConfig } from "./types";

type Env = Record<string, string | undefined>;

export function createPredictConfig(env: Env = Bun.env): PredictConfig {
  if (env.AGENT_ARENA_NETWORK !== "testnet") {
    throw new Error("TESTNET_ONLY");
  }

  return {
    network: "testnet",
    suiRpcUrl: required(env, "AGENT_ARENA_SUI_RPC_URL"),
    predictServerUrl: required(env, "AGENT_ARENA_PREDICT_SERVER_URL"),
    predictPackageId: required(env, "AGENT_ARENA_PREDICT_PACKAGE_ID"),
    predictObjectId: required(env, "AGENT_ARENA_PREDICT_OBJECT_ID"),
    suiClockObjectId: required(env, "AGENT_ARENA_SUI_CLOCK_OBJECT_ID"),
    quoteAssetType: required(env, "AGENT_ARENA_QUOTE_ASSET_TYPE"),
    quoteDecimals: parseLiteralInt(required(env, "AGENT_ARENA_QUOTE_DECIMALS"), 6, "AGENT_ARENA_QUOTE_DECIMALS"),
    priceDecimals: parseLiteralInt(required(env, "AGENT_ARENA_PRICE_DECIMALS"), 9, "AGENT_ARENA_PRICE_DECIMALS"),
    internalToken: required(env, "AGENT_ARENA_INTERNAL_TOKEN"),
    walletSecret: required(env, "AGENT_ARENA_WALLET_SECRET")
  };
}

function required(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`MISSING_${key}`);
  }
  return value;
}

function parseLiteralInt<T extends 6 | 9>(value: string, expected: T, key: string): T {
  if (Number(value) !== expected) {
    throw new Error(`INVALID_${key}`);
  }
  return expected;
}
```

- [ ] **Step 5: Verify config tests pass**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/config.test.ts
```

Expected: PASS.

## Task 2: Internal Auth And Route Isolation

**Files:**
- Create: `agent-arena/apps/backend/src/predict/internal-auth.ts`
- Create: `agent-arena/apps/backend/src/predict/internal-auth.test.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Write auth tests**

Create `internal-auth.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { assertInternalRequest } from "./internal-auth";

describe("assertInternalRequest", () => {
  it("rejects missing internal token", () => {
    expect(() => assertInternalRequest(new Request("http://localhost/api/arena/internal/wallets"), "secret"))
      .toThrow("UNAUTHORIZED");
  });

  it("rejects invalid internal token", () => {
    const request = new Request("http://localhost/api/arena/internal/wallets", {
      headers: { "x-agent-arena-internal-token": "bad" }
    });

    expect(() => assertInternalRequest(request, "secret")).toThrow("UNAUTHORIZED");
  });

  it("accepts exact internal token", () => {
    const request = new Request("http://localhost/api/arena/internal/wallets", {
      headers: { "x-agent-arena-internal-token": "secret" }
    });

    expect(assertInternalRequest(request, "secret")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run auth tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/internal-auth.test.ts
```

Expected: FAIL because `internal-auth.ts` does not exist.

- [ ] **Step 3: Implement internal auth**

Create `internal-auth.ts`:

```ts
export const internalTokenHeader = "x-agent-arena-internal-token";

export function assertInternalRequest(request: Request, expectedToken: string): void {
  if (!expectedToken) {
    throw new Error("INTERNAL_API_DISABLED");
  }

  if (request.headers.get(internalTokenHeader) !== expectedToken) {
    throw new Error("UNAUTHORIZED");
  }
}

export function isInternalArenaPath(pathname: string): boolean {
  return pathname === "/api/arena/internal" || pathname.startsWith("/api/arena/internal/");
}
```

- [ ] **Step 4: Wire server route without exposing it in public introspection**

Modify `agent-arena/apps/backend/src/server.ts`:

- Import `isInternalArenaPath`.
- Import a temporary `createInternalPredictFetchHandler` from `./predict/internal-api`.
- In `createAgentArenaFetchHandler`, route `isInternalArenaPath(url.pathname)` to internal handler before `platformFetch`.
- Do not add internal routes to `platform/api.ts` introspection.

If `internal-api.ts` is not implemented yet, create a minimal handler that returns `501 NOT_IMPLEMENTED` after internal auth.

- [ ] **Step 5: Verify backend tests**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/internal-auth.test.ts src/server.test.ts src/platform/api.test.ts
```

Expected: PASS. Existing public API tests must not see internal routes in introspection.

## Task 3: Internal Wallet Store And Balance Reads

**Files:**
- Create: `agent-arena/apps/backend/src/predict/wallet-store.ts`
- Create: `agent-arena/apps/backend/src/predict/wallet-store.test.ts`
- Extend: `agent-arena/apps/backend/src/predict/types.ts`

- [ ] **Step 1: Write wallet creation test**

Create `wallet-store.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createMemoryWalletStore } from "./wallet-store";

describe("internal wallet store", () => {
  it("creates an internal probe wallet without returning private key material", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret" });
    const wallet = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe",
      label: "first-probe"
    });

    expect(wallet.address).toMatch(/^0x/);
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet).not.toHaveProperty("privateKey");
    expect(wallet).not.toHaveProperty("encryptedPrivateKey");
  });

  it("rejects claimed-agent mode until formal claim verification is implemented", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret" });
    await expect(store.createWallet({
      agentId: "agent_1",
      bindingMode: "claimed_agent",
      label: "should-not-work"
    })).rejects.toThrow("CLAIMED_AGENT_BINDING_NOT_ENABLED");
  });
});
```

- [ ] **Step 2: Run wallet tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/wallet-store.test.ts
```

Expected: FAIL because wallet store does not exist.

- [ ] **Step 3: Implement memory wallet store first**

Implement:

- `createMemoryWalletStore`
- `createWallet`
- `getWallet`
- `listWallets`
- encrypted/private material stored only inside the store record, not returned from public methods.

Use `Ed25519Keypair` from `@mysten/sui/keypairs/ed25519`.

- [ ] **Step 4: Add balance reader abstraction**

Add interfaces, not hardcoded RPC in tests:

```ts
export interface CoinBalanceReader {
  getSuiBalance(address: string): Promise<string>;
  getCoinBalance(address: string, coinType: string): Promise<string>;
}
```

The real implementation can wrap `SuiClient`; tests use a fake reader.

- [ ] **Step 5: Verify wallet tests**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/wallet-store.test.ts
```

Expected: PASS.

## Task 4: Predict Server Client And Oracle Confirmation

**Files:**
- Create: `agent-arena/apps/backend/src/predict/predict-server-client.ts`
- Create: `agent-arena/apps/backend/src/predict/oracle.ts`
- Create: `agent-arena/apps/backend/src/predict/oracle.test.ts`
- Extend: `agent-arena/apps/backend/src/predict/types.ts`

- [ ] **Step 1: Write oracle selection tests**

Create `oracle.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { selectNearestFutureBtcOracle } from "./oracle";

describe("selectNearestFutureBtcOracle", () => {
  it("selects nearest future active BTC oracle", () => {
    const selected = selectNearestFutureBtcOracle({
      serverTimeMs: 1000,
      oracles: [
        { oracleId: "0xold", underlyingAsset: "BTC", status: "active", expiryMs: 900 },
        { oracleId: "0xeth", underlyingAsset: "ETH", status: "active", expiryMs: 1100 },
        { oracleId: "0xbtc2", underlyingAsset: "BTC", status: "active", expiryMs: 1400 },
        { oracleId: "0xbtc1", underlyingAsset: "BTC", status: "active", expiryMs: 1200 }
      ]
    });

    expect(selected?.oracleId).toBe("0xbtc1");
  });
});
```

- [ ] **Step 2: Add onchain confirmation tests**

Append:

```ts
import { confirmOracleForExecution } from "./oracle";

describe("confirmOracleForExecution", () => {
  it("rejects server/onchain expiry mismatch", async () => {
    await expect(confirmOracleForExecution({
      request: { oracleId: "0xbtc1", expiryMs: 1200, operation: "mint_directional" },
      readOracle: async () => ({
        oracleId: "0xbtc1",
        expiryMs: 1300,
        status: "active",
        underlyingAsset: "BTC",
        strikeGridValid: true
      })
    })).rejects.toThrow("ORACLE_MISMATCH");
  });
});
```

- [ ] **Step 3: Run oracle tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/oracle.test.ts
```

Expected: FAIL because `oracle.ts` does not exist.

- [ ] **Step 4: Implement server client and pure oracle helpers**

Implement pure functions first:

- `selectNearestFutureBtcOracle`
- `normalizePredictOracle`
- `confirmOracleForExecution`

Then implement a small `PredictServerClient` wrapper with methods:

- `getStatus()`
- `getPredictOracles(predictId)`
- `getManagers()`
- `getMintedPositions()`
- `getRedeemedPositions()`
- `getMintedRanges()`
- `getRedeemedRanges()`

- [ ] **Step 5: Verify oracle tests**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/oracle.test.ts
```

Expected: PASS.

## Task 5: PredictManager Discovery And Two-Phase Setup

**Files:**
- Create: `agent-arena/apps/backend/src/predict/manager.ts`
- Create: `agent-arena/apps/backend/src/predict/manager.test.ts`
- Extend: `agent-arena/apps/backend/src/predict/types.ts`

- [ ] **Step 1: Write discovery tests**

Create `manager.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { discoverPredictManager, planManagerSetup } from "./manager";

describe("discoverPredictManager", () => {
  it("uses local binding before server discovery", async () => {
    const manager = await discoverPredictManager({
      walletAddress: "0xwallet",
      localBinding: { managerId: "0xlocal", owner: "0xwallet" },
      listServerManagers: async () => [{ managerId: "0xserver", owner: "0xwallet" }],
      verifyManagerOwner: async () => true
    });

    expect(manager).toMatchObject({ managerId: "0xlocal", source: "local" });
  });

  it("rejects manager candidates with mismatched owner", async () => {
    await expect(discoverPredictManager({
      walletAddress: "0xwallet",
      localBinding: null,
      listServerManagers: async () => [{ managerId: "0xserver", owner: "0xwallet" }],
      verifyManagerOwner: async () => false
    })).rejects.toThrow("MANAGER_OWNER_MISMATCH");
  });
});
```

- [ ] **Step 2: Write setup planning tests**

Append:

```ts
describe("planManagerSetup", () => {
  it("dry-runs only create_manager when manager is missing", () => {
    expect(planManagerSetup({
      hasManager: false,
      dryRunOnly: true,
      depositDusdcRaw: "5000000"
    })).toMatchObject({
      createManager: "dry_run_only",
      depositStatus: "blocked_until_manager_exists"
    });
  });

  it("allows deposit only when manager exists", () => {
    expect(planManagerSetup({
      hasManager: true,
      dryRunOnly: false,
      depositDusdcRaw: "5000000"
    })).toMatchObject({
      createManager: "skip",
      depositStatus: "ready_to_dry_run"
    });
  });
});
```

- [ ] **Step 3: Run manager tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/manager.test.ts
```

Expected: FAIL because `manager.ts` does not exist.

- [ ] **Step 4: Implement manager helpers**

Implement:

- `discoverPredictManager`
- `planManagerSetup`
- `verifyManagerOwner` interface for real onchain owner read
- `PredictManagerBinding` persistence shape

Do not implement direct owned-object lookup.

- [ ] **Step 5: Verify manager tests**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/manager.test.ts
```

Expected: PASS.

## Task 6: Transaction Builders And Guardrails

**Files:**
- Create: `agent-arena/apps/backend/src/predict/transactions.ts`
- Create: `agent-arena/apps/backend/src/predict/transactions.test.ts`
- Create: `agent-arena/apps/backend/src/predict/guardrails.ts`
- Create: `agent-arena/apps/backend/src/predict/guardrails.test.ts`
- Extend: `agent-arena/apps/backend/src/predict/types.ts`

- [ ] **Step 1: Write guardrail tests**

Create `guardrails.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { assertRawIntegerString, evaluatePreSubmitGuardrails, classifyPolicyDrift } from "./guardrails";

describe("raw amount validation", () => {
  it("rejects floats and unsafe strings", () => {
    expect(() => assertRawIntegerString("1.1", "quantityRaw")).toThrow("INVALID_RAW_AMOUNT");
    expect(() => assertRawIntegerString("-1", "quantityRaw")).toThrow("INVALID_RAW_AMOUNT");
    expect(() => assertRawIntegerString("100000", "quantityRaw")).not.toThrow();
  });
});

describe("pre-submit guardrails", () => {
  it("rejects estimated mint cost above maxCostRaw", () => {
    expect(() => evaluatePreSubmitGuardrails({
      operation: "mint_directional",
      estimatedCostRaw: "1000001",
      maxCostRaw: "1000000"
    })).toThrow("MAX_COST_EXCEEDED");
  });

  it("classifies post-submit policy drift", () => {
    expect(classifyPolicyDrift({
      maxCostRaw: "1000000",
      actualCostRaw: "1000001"
    })).toBe("cost_above_pre_submit_guard");
  });
});
```

- [ ] **Step 2: Write transaction builder tests**

Create `transactions.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { buildPredictOperationPlan } from "./transactions";

describe("buildPredictOperationPlan", () => {
  it("builds preview directional with get_trade_amounts", () => {
    const plan = buildPredictOperationPlan({
      operation: "preview_directional",
      oracleId: "0xoracle",
      expiryMs: 1200,
      strikeRaw: "65000000000000",
      isUp: true,
      quantityRaw: "100000"
    });

    expect(plan.moveTargets).toContain("predict::get_trade_amounts");
    expect(plan.moveTargets).not.toContain("arbitrary");
  });

  it("rejects invalid range bounds before RangeKey build", () => {
    expect(() => buildPredictOperationPlan({
      operation: "mint_range",
      oracleId: "0xoracle",
      expiryMs: 1200,
      lowerStrikeRaw: "66000000000000",
      higherStrikeRaw: "65000000000000",
      quantityRaw: "100000"
    })).toThrow("INVALID_RANGE_BOUNDS");
  });
});
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/guardrails.test.ts src/predict/transactions.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement pure guardrail helpers**

Implement:

- `assertRawIntegerString`
- `compareRawIntegers`
- `evaluatePreSubmitGuardrails`
- `classifyPolicyDrift`

Keep these independent of Sui SDK so tests are fast.

- [ ] **Step 5: Implement operation plan builders**

Implement typed operation plans first. Each plan should expose:

- `operation`
- `moveTargets`
- key inputs
- object ids required
- raw quantity values
- no arbitrary target input

Then add Sui `Transaction` builder functions that convert plans into PTBs. Keep PTB creation behind functions such as:

- `buildPreviewDirectionalTransaction`
- `buildPreviewRangeTransaction`
- `buildMintDirectionalTransaction`
- `buildRedeemDirectionalTransaction`
- `buildMintRangeTransaction`
- `buildRedeemRangeTransaction`
- `buildDepositDusdcTransaction`

- [ ] **Step 6: Verify transaction and guardrail tests**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/guardrails.test.ts src/predict/transactions.test.ts
```

Expected: PASS.

## Task 7: Internal API And Persistence

**Files:**
- Create: `agent-arena/apps/backend/src/predict/execution-store.ts`
- Create: `agent-arena/apps/backend/src/predict/internal-api.ts`
- Create: `agent-arena/apps/backend/src/predict/internal-api.test.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Write internal API auth tests**

Create `internal-api.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createInternalPredictFetchHandler } from "./internal-api";

describe("internal Predict API", () => {
  it("rejects requests without internal token", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken: "secret" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      body: JSON.stringify({ agentId: "agent_internal_001", bindingMode: "internal_probe" })
    }));

    expect(response.status).toBe(401);
  });

  it("creates an internal wallet without returning private key material", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken: "secret" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      headers: { "x-agent-arena-internal-token": "secret" },
      body: JSON.stringify({
        agentId: "agent_internal_001",
        bindingMode: "internal_probe",
        label: "first-probe"
      })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.wallet.address).toMatch(/^0x/);
    expect(JSON.stringify(body)).not.toContain("privateKey");
  });
});
```

- [ ] **Step 2: Add setup dry-run API test**

Append:

```ts
it("reports missing-manager setup dry-run as create-only", async () => {
  const fetch = createInternalPredictFetchHandler({ internalToken: "secret" });
  const created = await (await fetch(new Request("http://localhost/api/arena/internal/wallets", {
    method: "POST",
    headers: { "x-agent-arena-internal-token": "secret" },
    body: JSON.stringify({ agentId: "agent_internal_001", bindingMode: "internal_probe" })
  }))).json();

  const response = await fetch(new Request("http://localhost/api/arena/internal/predict/setup", {
    method: "POST",
    headers: { "x-agent-arena-internal-token": "secret" },
    body: JSON.stringify({
      walletId: created.wallet.id,
      depositDusdcRaw: "5000000",
      dryRunOnly: true
    })
  }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    setupPhases: {
      depositStatus: "blocked_until_manager_exists"
    }
  });
});
```

- [ ] **Step 3: Run internal API tests and confirm failure**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/internal-api.test.ts
```

Expected: FAIL because `internal-api.ts` does not exist.

- [ ] **Step 4: Implement execution store**

Implement memory-first persistence:

- `createExecution`
- `updateExecution`
- `listExecutions`
- `recordSigningAudit`

Use JSON persistence only after the memory implementation passes tests.

- [ ] **Step 5: Implement internal API endpoints**

Implement:

- `POST /api/arena/internal/wallets`
- `GET /api/arena/internal/wallets/:walletId/balances`
- `POST /api/arena/internal/predict/setup`
- `POST /api/arena/internal/predict/preview`
- `POST /api/arena/internal/predict/execute`
- `GET /api/arena/internal/predict/executions?walletId=...`

Keep real submit paths disabled until Task 8 wires the smoke script and required env values.

- [ ] **Step 6: Verify internal API tests and public API tests**

Run:

```bash
cd agent-arena/apps/backend
bun test src/predict/internal-api.test.ts src/platform/api.test.ts src/server.test.ts
```

Expected: PASS. Public introspection must still omit internal endpoints.

## Task 8: Smoke Script And Funded Testnet Handoff

**Files:**
- Create: `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
- Modify: `agent-arena/apps/backend/package.json`
- Modify: `agent-arena/package.json`
- Optional: `agent-arena/README.md`

- [ ] **Step 1: Add smoke script command**

Add backend script:

```json
{
  "scripts": {
    "smoke:predict": "bun run src/internal-predict-execution-smoke.ts"
  }
}
```

Add root script:

```json
{
  "scripts": {
    "smoke:predict": "bun run --cwd apps/backend smoke:predict"
  }
}
```

- [ ] **Step 2: Implement smoke CLI modes**

Implement modes:

```text
--create-wallet
--check-balances --wallet-id <id>
--setup --wallet-id <id> --deposit-dusdc-raw <raw>
--preview-up --wallet-id <id> --quantity-raw <raw>
--mint-up --wallet-id <id> --quantity-raw <raw> --max-cost-raw <raw>
--redeem-last --wallet-id <id> --quantity-raw <raw> --min-proceeds-raw <raw>
--close-last --wallet-id <id> --min-proceeds-raw <raw>
--mint-range --wallet-id <id> --quantity-raw <raw> --max-cost-raw <raw>
--redeem-range-last --wallet-id <id> --quantity-raw <raw> --min-proceeds-raw <raw>
```

The script must redact private key material in all output.

- [ ] **Step 3: Run create-wallet smoke**

Run with local env configured:

```bash
cd agent-arena
bun run smoke:predict -- --create-wallet
```

Expected: script prints wallet id, Testnet address, and funding instructions only. It must not print private key material.

- [ ] **Step 4: Human funding checkpoint**

Pause implementation and ask the operator to fund the generated address with:

- Testnet SUI for gas.
- Testnet DUSDC with decimals 6.

Do not proceed to live setup until funding is confirmed.

- [ ] **Step 5: Check funded balances**

Run:

```bash
cd agent-arena
bun run smoke:predict -- --check-balances --wallet-id <wallet-id>
```

Expected: nonzero SUI balance and nonzero DUSDC raw balance.

- [ ] **Step 6: Run setup**

Run:

```bash
cd agent-arena
bun run smoke:predict -- --setup --wallet-id <wallet-id> --deposit-dusdc-raw 5000000
```

Expected:

- manager discovered or created,
- owner verified,
- DUSDC deposit submitted only after manager exists,
- transaction digest recorded.

- [ ] **Step 7: Run small preview and directional mint**

Run:

```bash
cd agent-arena
bun run smoke:predict -- --preview-up --wallet-id <wallet-id> --quantity-raw 100000
bun run smoke:predict -- --mint-up --wallet-id <wallet-id> --quantity-raw 100000 --max-cost-raw 1000000
```

Expected: preview returns raw cost; mint submits only after guardrail passes and records digest.

- [ ] **Step 8: Run partial redeem and full close**

Run:

```bash
cd agent-arena
bun run smoke:predict -- --redeem-last --wallet-id <wallet-id> --quantity-raw 50000 --min-proceeds-raw 1
bun run smoke:predict -- --close-last --wallet-id <wallet-id> --min-proceeds-raw 1
```

Expected: each operation dry-runs, submits if guardrails pass, records digest and policy drift.

- [ ] **Step 9: Run range mint and range redeem**

Run:

```bash
cd agent-arena
bun run smoke:predict -- --mint-range --wallet-id <wallet-id> --quantity-raw 100000 --max-cost-raw 1000000
bun run smoke:predict -- --redeem-range-last --wallet-id <wallet-id> --quantity-raw 50000 --min-proceeds-raw 1
```

Expected: range bounds are valid, transaction uses `range_key::new`, and each submit records digest.

- [ ] **Step 10: Final verification**

Run:

```bash
cd agent-arena/apps/backend
bun test
```

Run:

```bash
cd agent-arena
bun run smoke:predict -- --check-balances --wallet-id <wallet-id>
```

Expected: backend tests pass and wallet/manager balances reflect submitted operations.

## Task 9: Documentation And Handoff

**Files:**
- Modify: `agent-arena/README.md`
- Modify: `agent-arena/CHANGES.md`
- Optional: `agent-arena/specs/README.md`

- [ ] **Step 1: Document internal-only setup**

Add a short README section:

- required env vars,
- internal token warning,
- create-wallet command,
- human funding checkpoint,
- setup and smoke commands.

- [ ] **Step 2: Document what is still not public**

Explicitly state:

- no external Agent can call live execution endpoints,
- public skill docs remain intent-based,
- no frontend code receives internal token,
- Mainnet unsupported.

- [ ] **Step 3: Update changelog**

Add a `CHANGES.md` entry:

```markdown
## Internal Predict Execution Probe

- Added internal Testnet-only wallet generation and execution probe plan.
- Kept DeepBook Predict as the market and settlement source of truth.
- Kept `agent_arena::registry` out of custody/signing scope.
```

- [ ] **Step 4: Run final docs and tests check**

Run:

```bash
cd agent-arena/apps/backend
bun test
```

Run:

```bash
cd agent-arena
bun run validate:skills
```

Expected: backend tests pass and skill docs remain valid.

## Execution Notes

- First implementation should use memory stores where possible, then add file persistence once behavior is proven.
- Avoid adding frontend UI until the backend probe can generate an address and report balances.
- Avoid implementing public Agent live execution in this plan.
- Treat official Testnet package/object IDs as configurable and provisional.
- If `@mysten/sui` SDK imports differ from examples, verify current exports locally before changing architecture.
