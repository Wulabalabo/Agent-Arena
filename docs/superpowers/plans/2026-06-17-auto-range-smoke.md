# Auto Range Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal Testnet smoke mode that automatically discovers the current BTC Predict oracle, selects a safe test range, dry-runs range mint, and optionally submits mint, close, and tiny manager withdrawal.

**Architecture:** Keep the smoke workflow internal and CLI-only. Add a focused auto-range module for market selection and step orchestration, extend the existing Predict server client with oracle-state reads, then wire a new `--auto-range-smoke` mode into `internal-predict-execution-smoke.ts` without exposing anything through public Agent APIs.

**Tech Stack:** Bun, TypeScript, backend `bun:test`, existing internal Predict API handler, DeepBook Predict Testnet public server, Sui Testnet RPC.

---

## Source SPEC

- `docs/superpowers/specs/2026-06-17-auto-range-smoke-design.md`

## File Map

- Modify `agent-arena/apps/backend/src/predict/predict-server-client.ts`
  - Add `getOracleState(oracleId)` for `/oracles/:oracleId/state`.
- Modify `agent-arena/apps/backend/src/predict/oracle.test.ts`
  - Extend existing Predict server client URL coverage.
- Create `agent-arena/apps/backend/src/predict/auto-range-smoke.ts`
  - Pure market selection, range derivation, request body builders, and ordered smoke-step orchestration.
- Create `agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts`
  - Unit tests for selection, safety, dry-run/submit flow, and redaction-safe output shape.
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
  - Add CLI mode `auto-range-smoke` and parse optional tuning flags.
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`
  - Prove CLI helper redaction and auto-range mode behavior where useful.
- Modify `agent-arena/README.md`
  - Add auto range smoke examples and clarify dry-run versus submit.
- Modify `docs/superpowers/specs/2026-06-17-auto-range-smoke-design.md`
  - Only if implementation choices need documented clarification.

---

## Task 1: Extend Backend Predict Server Client

**Files:**
- Modify `agent-arena/apps/backend/src/predict/predict-server-client.ts`
- Modify `agent-arena/apps/backend/src/predict/oracle.test.ts`

- [ ] **Step 1: Write failing URL coverage test**

In `agent-arena/apps/backend/src/predict/oracle.test.ts`, extend the existing `createPredictServerClient > normalizes URL joining for Predict public server endpoints` test:

```ts
await client.getOracleState("0xoracle");
```

and extend `requestedUrls` with:

```ts
"https://predict.example/api/oracles/0xoracle/state"
```

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/oracle.test.ts
```

Expected: FAIL because `getOracleState` is not on `PredictServerClient`.

- [ ] **Step 2: Add client method**

In `agent-arena/apps/backend/src/predict/predict-server-client.ts`, update the interface and factory:

```ts
export interface PredictServerClient {
  getStatus: () => Promise<unknown>;
  getPredictOracles: (predictId: string) => Promise<unknown>;
  getOracleState: (oracleId: string) => Promise<unknown>;
  getManagers: () => Promise<unknown>;
  getMintedPositions: () => Promise<unknown>;
  getRedeemedPositions: () => Promise<unknown>;
  getMintedRanges: () => Promise<unknown>;
  getRedeemedRanges: () => Promise<unknown>;
}
```

```ts
getOracleState: (oracleId: string) =>
  requestJson(fetcher, baseUrl, `/oracles/${encodeURIComponent(oracleId)}/state`),
```

- [ ] **Step 3: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/oracle.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit client endpoint**

```powershell
git add agent-arena/apps/backend/src/predict/predict-server-client.ts agent-arena/apps/backend/src/predict/oracle.test.ts
git commit -m "feat: add predict oracle state client"
```

---

## Task 2: Add Pure Auto Range Selection

**Files:**
- Create `agent-arena/apps/backend/src/predict/auto-range-smoke.ts`
- Create `agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts`

- [ ] **Step 1: Write failing selection tests**

Create `agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts` with tests for:

```ts
import { describe, expect, it } from "bun:test";
import {
  deriveAutoRangeFromPrice,
  selectAutoRangeMarket
} from "./auto-range-smoke";

const config = {
  predictObjectId: "0xpredict",
  priceDecimals: 9 as const
};

describe("auto range smoke market selection", () => {
  it("selects the nearest future active BTC oracle and prefers forward price", async () => {
    const selected = await selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          { oracle_id: "0xlater", underlying_asset: "BTC", expiry: "1781623800000", status: "active" },
          { oracle_id: "0xnearest", underlying_asset: "BTC", expiry: "1781622900000", status: "active" }
        ],
        getOracleState: async () => ({
          latest_price: {
            spot: "65611517258518",
            forward: "65611186326705",
            onchain_timestamp: "1781622054893"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    });

    expect(selected).toMatchObject({
      oracleId: "0xnearest",
      expiryMs: "1781622900000",
      priceSource: "forward",
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    });
    expect(BigInt(selected.lowerStrikeRaw)).toBeLessThan(BigInt(selected.higherStrikeRaw));
  });

  it("falls back to spot when forward is unavailable", () => {
    const range = deriveAutoRangeFromPrice({
      priceRaw: "65611517258518",
      priceSource: "spot",
      priceDecimals: 9,
      bandBps: 50
    });

    expect(range.priceSource).toBe("spot");
    expect(range.lowerStrikeRaw).toBe("65283000000000");
    expect(range.higherStrikeRaw).toBe("65940000000000");
  });
});
```

Also add tests for:
- `NO_ACTIVE_BTC_ORACLE`
- `ORACLE_PRICE_UNAVAILABLE`
- invalid `bandBps <= 0`
- invalid raw price values
- grid-aware snapping when the selected oracle has `strikeGrid.strikeStepRaw`

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
```

Expected: FAIL because `auto-range-smoke.ts` does not exist.

- [ ] **Step 2: Implement selection types and errors**

Create `agent-arena/apps/backend/src/predict/auto-range-smoke.ts` with:

```ts
import { selectNearestFutureBtcOracle } from "./oracle";

export class AutoRangeSmokeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AutoRangeSmokeError";
  }
}

export interface AutoRangeSmokeClient {
  getStatus: () => Promise<unknown>;
  getPredictOracles: (predictId: string) => Promise<unknown>;
  getOracleState: (oracleId: string) => Promise<unknown>;
}

export interface AutoRangeMarketSelection {
  oracleId: string;
  expiryMs: string;
  priceSource: "forward" | "spot";
  referencePriceRaw: string;
  referencePrice: string;
  lowerStrikeRaw: string;
  higherStrikeRaw: string;
  quantityRaw: string;
  maxCostRaw: string;
}
```

- [ ] **Step 3: Implement raw parsing helpers**

Add local helpers in the same file:

```ts
function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function rawInteger(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

function serverTimeMs(status: unknown): number {
  const raw = rawInteger(readRecord(status)?.current_time_ms);
  return raw ? Number(raw) : Date.now();
}
```

- [ ] **Step 4: Implement `deriveAutoRangeFromPrice`**

Implementation contract:

```ts
export function deriveAutoRangeFromPrice(input: {
  priceRaw: string;
  priceSource: "forward" | "spot";
  priceDecimals: 9;
  bandBps: number;
  strikeGrid?: {
    minStrikeRaw?: string;
    maxStrikeRaw?: string;
    strikeStepRaw?: string;
    strikesRaw?: string[];
  };
}): Omit<AutoRangeMarketSelection, "oracleId" | "expiryMs" | "quantityRaw" | "maxCostRaw"> {
  if (!/^\d+$/.test(input.priceRaw) || input.bandBps <= 0) {
    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  const scale = 10n ** BigInt(input.priceDecimals);
  const price = BigInt(input.priceRaw);
  const lower = (price * BigInt(10_000 - input.bandBps)) / 10_000n;
  const higher = (price * BigInt(10_000 + input.bandBps) + 9_999n) / 10_000n;
  let { lowerRounded, higherRounded } = snapRange({
    lower,
    higher,
    fallbackUnit: scale,
    strikeGrid: input.strikeGrid
  });

  if (lowerRounded >= higherRounded) {
    lowerRounded = price > wholeUnit ? ((price / wholeUnit) - 1n) * wholeUnit : 0n;
    higherRounded = ((price / wholeUnit) + 1n) * wholeUnit;
  }

  if (lowerRounded >= higherRounded) {
    throw new AutoRangeSmokeError("RANGE_SELECTION_INVALID");
  }

  return {
    priceSource: input.priceSource,
    referencePriceRaw: input.priceRaw,
    referencePrice: formatRawPrice(input.priceRaw, input.priceDecimals),
    lowerStrikeRaw: lowerRounded.toString(),
    higherStrikeRaw: higherRounded.toString()
  };
}
```

Add `formatRawPrice(raw, decimals)` that returns a trimmed decimal string such as `"65611.186326705"`.

Add `snapRange` below `deriveAutoRangeFromPrice`:

```ts
function snapRange(input: {
  lower: bigint;
  higher: bigint;
  fallbackUnit: bigint;
  strikeGrid?: {
    minStrikeRaw?: string;
    maxStrikeRaw?: string;
    strikeStepRaw?: string;
    strikesRaw?: string[];
  };
}): { lowerRounded: bigint; higherRounded: bigint } {
  const explicitStrikes = input.strikeGrid?.strikesRaw?.map(BigInt).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  if (explicitStrikes && explicitStrikes.length >= 2) {
    const lowerRounded = [...explicitStrikes].reverse().find((strike) => strike <= input.lower);
    const higherRounded = explicitStrikes.find((strike) => strike >= input.higher);
    if (lowerRounded !== undefined && higherRounded !== undefined && lowerRounded < higherRounded) {
      return { lowerRounded, higherRounded };
    }
  }

  const min = input.strikeGrid?.minStrikeRaw ? BigInt(input.strikeGrid.minStrikeRaw) : null;
  const max = input.strikeGrid?.maxStrikeRaw ? BigInt(input.strikeGrid.maxStrikeRaw) : null;
  const step = input.strikeGrid?.strikeStepRaw ? BigInt(input.strikeGrid.strikeStepRaw) : null;
  if (min !== null && max !== null && step !== null && step > 0n) {
    const lowerSteps = input.lower > min ? (input.lower - min) / step : 0n;
    const higherSteps = input.higher > min ? (input.higher - min + step - 1n) / step : 0n;
    const lowerRounded = min + lowerSteps * step;
    const higherRounded = min + higherSteps * step;
    if (lowerRounded >= min && higherRounded <= max && lowerRounded < higherRounded) {
      return { lowerRounded, higherRounded };
    }
  }

  return {
    lowerRounded: (input.lower / input.fallbackUnit) * input.fallbackUnit,
    higherRounded: ((input.higher + input.fallbackUnit - 1n) / input.fallbackUnit) * input.fallbackUnit
  };
}
```

- [ ] **Step 5: Implement `selectAutoRangeMarket`**

Use `selectNearestFutureBtcOracle` from `oracle.ts`:

```ts
export async function selectAutoRangeMarket(input: {
  config: { predictObjectId: string; priceDecimals: 9 };
  client: AutoRangeSmokeClient;
  bandBps: number;
  quantityRaw: string;
  maxCostRaw: string;
}): Promise<AutoRangeMarketSelection> {
  const [status, rawOracles] = await Promise.all([
    input.client.getStatus(),
    input.client.getPredictOracles(input.config.predictObjectId)
  ]);
  const oracles = Array.isArray(rawOracles) ? rawOracles : [];
  const oracle = selectNearestFutureBtcOracle({
    serverTimeMs: serverTimeMs(status),
    oracles
  });

  if (!oracle) {
    throw new AutoRangeSmokeError("NO_ACTIVE_BTC_ORACLE");
  }

  const state = readRecord(await input.client.getOracleState(oracle.oracleId));
  const latestPrice = readRecord(state?.latest_price);
  const forwardRaw = rawInteger(latestPrice?.forward);
  const spotRaw = rawInteger(latestPrice?.spot);
  const priceRaw = forwardRaw ?? spotRaw;

  if (!priceRaw) {
    throw new AutoRangeSmokeError("ORACLE_PRICE_UNAVAILABLE");
  }

  const range = deriveAutoRangeFromPrice({
    priceRaw,
    priceSource: forwardRaw ? "forward" : "spot",
    priceDecimals: input.config.priceDecimals,
    bandBps: input.bandBps,
    strikeGrid: oracle.strikeGrid
  });

  return {
    oracleId: oracle.oracleId,
    expiryMs: String(oracle.expiryMs),
    ...range,
    quantityRaw: input.quantityRaw,
    maxCostRaw: input.maxCostRaw
  };
}
```

- [ ] **Step 6: Verify selection tests**

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
```

Expected: all auto-range selection tests pass.

- [ ] **Step 7: Commit selection module**

```powershell
git add agent-arena/apps/backend/src/predict/auto-range-smoke.ts agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
git commit -m "feat: select auto range smoke market"
```

---

## Task 3: Add Auto Range Smoke Orchestration

**Files:**
- Modify `agent-arena/apps/backend/src/predict/auto-range-smoke.ts`
- Modify `agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts`

- [ ] **Step 1: Write failing orchestration tests**

Add tests proving:
- dry-run mode calls only `mint_range`.
- submit mode calls `mint_range`, then `close_range`, in order.
- submit mode does not call close when mint fails.
- withdrawal runs only when `withdrawAfterClose=true` and close succeeds.
- output includes `selectedMarket`, `steps`, and no private material fields.

Use a fake internal executor:

```ts
const calls: Record<string, unknown>[] = [];
const executeInternal = async (body: Record<string, unknown>) => {
  calls.push(body);
  return {
    httpStatus: 200,
    ok: true,
    execution: { status: body.dryRunOnly ? "dry_run_ok" : "confirmed", txDigest: "0xdigest" }
  };
};
```

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
```

Expected: FAIL because orchestration functions are missing.

- [ ] **Step 2: Add request body builders**

In `auto-range-smoke.ts`, export:

```ts
export function buildAutoRangeMintBody(input: {
  walletId: string;
  managerId: string;
  selectedMarket: AutoRangeMarketSelection;
  dryRunOnly: boolean;
}): Record<string, unknown> {
  return {
    walletId: input.walletId,
    operation: "mint_range",
    managerId: input.managerId,
    oracleId: input.selectedMarket.oracleId,
    quantityRaw: input.selectedMarket.quantityRaw,
    maxCostRaw: input.selectedMarket.maxCostRaw,
    estimatedCostRaw: input.selectedMarket.maxCostRaw,
    expiryMs: input.selectedMarket.expiryMs,
    lowerStrikeRaw: input.selectedMarket.lowerStrikeRaw,
    higherStrikeRaw: input.selectedMarket.higherStrikeRaw,
    dryRunOnly: input.dryRunOnly
  };
}
```

```ts
export function buildAutoRangeCloseBody(input: {
  walletId: string;
  managerId: string;
  selectedMarket: AutoRangeMarketSelection;
  minProceedsRaw: string;
  dryRunOnly: boolean;
}): Record<string, unknown> {
  return {
    walletId: input.walletId,
    operation: "close_range",
    managerId: input.managerId,
    oracleId: input.selectedMarket.oracleId,
    minProceedsRaw: input.minProceedsRaw,
    estimatedProceedsRaw: input.minProceedsRaw,
    expiryMs: input.selectedMarket.expiryMs,
    lowerStrikeRaw: input.selectedMarket.lowerStrikeRaw,
    higherStrikeRaw: input.selectedMarket.higherStrikeRaw,
    dryRunOnly: input.dryRunOnly
  };
}
```

Use existing `buildManagerWithdrawExecuteBody` from `internal-predict-execution-smoke.ts` only in the CLI layer to avoid circular imports; in this module build the withdrawal body locally if needed.

- [ ] **Step 3: Add orchestration types**

```ts
export interface AutoRangeSmokeStep {
  name: "mint_range" | "close_range_last" | "withdraw_manager_dusdc";
  ok: boolean;
  operation: string;
  status?: unknown;
  response?: Record<string, unknown>;
  request: Record<string, unknown>;
}

export interface AutoRangeSmokeResult {
  ok: boolean;
  mode: "dry_run" | "submit";
  selectedMarket: AutoRangeMarketSelection;
  steps: AutoRangeSmokeStep[];
  errors: string[];
}
```

- [ ] **Step 4: Implement `runAutoRangeSmoke`**

```ts
export async function runAutoRangeSmoke(input: {
  walletId: string;
  managerId: string;
  selectedMarket: AutoRangeMarketSelection;
  submit: boolean;
  minProceedsRaw: string;
  withdrawAfterClose: boolean;
  withdrawAmountRaw: string;
  recipientAddress?: string;
  executeInternal: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
}): Promise<AutoRangeSmokeResult> {
  const steps: AutoRangeSmokeStep[] = [];
  const errors: string[] = [];
  const mintBody = buildAutoRangeMintBody({
    walletId: input.walletId,
    managerId: input.managerId,
    selectedMarket: input.selectedMarket,
    dryRunOnly: !input.submit
  });
  const mintResponse = await input.executeInternal(mintBody);
  const mintOk = isSuccessfulInternalResponse(mintResponse);
  steps.push({ name: "mint_range", ok: mintOk, operation: "mint_range", status: mintResponse.execution, response: mintResponse, request: mintBody });

  if (!mintOk) {
    errors.push("AUTO_RANGE_MINT_FAILED");
    return { ok: false, mode: input.submit ? "submit" : "dry_run", selectedMarket: input.selectedMarket, steps, errors };
  }

  if (!input.submit) {
    return { ok: true, mode: "dry_run", selectedMarket: input.selectedMarket, steps, errors };
  }

  const closeBody = buildAutoRangeCloseBody({
    walletId: input.walletId,
    managerId: input.managerId,
    selectedMarket: input.selectedMarket,
    minProceedsRaw: input.minProceedsRaw,
    dryRunOnly: false
  });
  const closeResponse = await input.executeInternal(closeBody);
  const closeOk = isSuccessfulInternalResponse(closeResponse);
  steps.push({ name: "close_range_last", ok: closeOk, operation: "close_range", status: closeResponse.execution, response: closeResponse, request: closeBody });

  if (!closeOk) {
    errors.push("AUTO_RANGE_CLOSE_FAILED");
    return { ok: false, mode: "submit", selectedMarket: input.selectedMarket, steps, errors };
  }

  if (input.withdrawAfterClose) {
    const withdrawBody = {
      walletId: input.walletId,
      operation: "withdraw_manager_dusdc",
      managerId: input.managerId,
      amountRaw: input.withdrawAmountRaw,
      ...(input.recipientAddress ? { recipientAddress: input.recipientAddress } : {}),
      dryRunOnly: false
    };
    const withdrawResponse = await input.executeInternal(withdrawBody);
    const withdrawOk = isSuccessfulInternalResponse(withdrawResponse);
    steps.push({ name: "withdraw_manager_dusdc", ok: withdrawOk, operation: "withdraw_manager_dusdc", status: withdrawResponse.execution, response: withdrawResponse, request: withdrawBody });
    if (!withdrawOk) {
      errors.push("AUTO_RANGE_WITHDRAW_FAILED");
    }
  }

  return { ok: errors.length === 0, mode: "submit", selectedMarket: input.selectedMarket, steps, errors };
}
```

Implement `isSuccessfulInternalResponse` as:

```ts
function isSuccessfulInternalResponse(response: Record<string, unknown>): boolean {
  if (response.ok === false) {
    return false;
  }
  const execution = readRecord(response.execution);
  const status = execution?.status;
  return status === "dry_run_ok" || status === "confirmed" || status === "submitted";
}
```

- [ ] **Step 5: Verify orchestration tests**

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit orchestration**

```powershell
git add agent-arena/apps/backend/src/predict/auto-range-smoke.ts agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
git commit -m "feat: orchestrate auto range smoke"
```

---

## Task 4: Wire CLI Mode

**Files:**
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`

- [ ] **Step 1: Write failing CLI helper tests**

In `internal-predict-execution-smoke.test.ts`, add tests proving:
- `--auto-range-smoke` is recognized as a mode.
- `--withdraw-after-close` is treated as a boolean flag.
- auto-range output is still redacted by `redactSmokeOutput`.

Run:

```powershell
bun test agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts
```

Expected: FAIL because the CLI mode and boolean flag do not exist.

- [ ] **Step 2: Add mode and boolean flag**

In `internal-predict-execution-smoke.ts`:

```ts
import {
  runAutoRangeSmoke,
  selectAutoRangeMarket
} from "./predict/auto-range-smoke";
import { createPredictServerClient } from "./predict/predict-server-client";
```

Extend `CliMode` with:

```ts
| "auto-range-smoke"
```

Update `isMode`:

```ts
value === "auto-range-smoke" ||
```

Update `isBooleanFlag`:

```ts
return value === "submit" || value === "withdraw-after-close";
```

- [ ] **Step 3: Add CLI argument defaults**

Use these exact defaults in the auto-range branch:

```ts
const quantityRaw = valueOrDefault(parsed, "quantity-raw", "100000");
const maxCostRaw = valueOrDefault(parsed, "max-cost-raw", "1000000");
const minProceedsRaw = valueOrDefault(parsed, "min-proceeds-raw", "1");
const withdrawAmountRaw = valueOrDefault(parsed, "withdraw-amount-raw", "1");
const bandBps = Number(valueOrDefault(parsed, "band-bps", "50"));
```

Validate `bandBps`:

```ts
if (!Number.isSafeInteger(bandBps) || bandBps <= 0 || bandBps >= 10_000) {
  throw new Error("INVALID_BAND_BPS");
}
```

- [ ] **Step 4: Implement `auto-range-smoke` branch**

Add a case in `executeMode`:

```ts
case "auto-range-smoke": {
  const quantityRaw = valueOrDefault(parsed, "quantity-raw", "100000");
  const maxCostRaw = valueOrDefault(parsed, "max-cost-raw", "1000000");
  const minProceedsRaw = valueOrDefault(parsed, "min-proceeds-raw", "1");
  const withdrawAmountRaw = valueOrDefault(parsed, "withdraw-amount-raw", "1");
  const bandBps = Number(valueOrDefault(parsed, "band-bps", "50"));
  if (!Number.isSafeInteger(bandBps) || bandBps <= 0 || bandBps >= 10_000) {
    throw new Error("INVALID_BAND_BPS");
  }

  const submit = hasFlag(parsed, "submit");
  const predictServerClient = createPredictServerClient({
    baseUrl: config.predictServerUrl
  });
  const selectedMarket = await selectAutoRangeMarket({
    config,
    client: predictServerClient,
    bandBps,
    quantityRaw,
    maxCostRaw
  });

  return await runAutoRangeSmoke({
    walletId: requiredArg(parsed, "wallet-id"),
    managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
    selectedMarket,
    submit,
    minProceedsRaw,
    withdrawAfterClose: hasFlag(parsed, "withdraw-after-close"),
    withdrawAmountRaw,
    recipientAddress: optionalArg(parsed, "recipient-address"),
    executeInternal: (body) => callInternal(
      fetchInternal,
      "/api/arena/internal/predict/execute",
      body,
      "POST",
      config.internalToken
    )
  });
}
```

This branch intentionally calls `callInternal` directly instead of `executePredict`. The new `runAutoRangeSmoke` function owns the step summary, and it needs the original internal execute response to decide whether the next step can run.

- [ ] **Step 5: Verify CLI tests**

Run:

```powershell
bun test agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Verify focused backend tests**

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts agent-arena/apps/backend/src/predict/oracle.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit CLI wiring**

```powershell
git add agent-arena/apps/backend/src/internal-predict-execution-smoke.ts agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts agent-arena/apps/backend/src/predict/auto-range-smoke.ts agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts
git commit -m "feat: add auto range smoke cli"
```

---

## Task 5: Docs and End-to-End Verification

**Files:**
- Modify `agent-arena/README.md`
- Modify `docs/superpowers/specs/2026-06-17-auto-range-smoke-design.md` only if implementation changed the operator contract.

- [ ] **Step 1: Update README smoke examples**

In `agent-arena/README.md`, add a subsection under Predict smoke commands:

````markdown
### Auto range smoke

Dry-run current BTC range mint:

```powershell
bun run smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id>
```

Submit mint then close after dry-run succeeds and `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true` is set:

```powershell
bun run smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id> --submit
```

Submit mint, close, and a tiny manager withdrawal:

```powershell
bun run smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id> --submit --withdraw-after-close --withdraw-amount-raw 1
```

The runner selects the nearest active future BTC oracle, derives a test range around the current forward price or spot price, and prints `oracleId`, `expiryMs`, `lowerStrikeRaw`, and `higherStrikeRaw`. Dry-run mode does not close because dry-run mint creates no position.
````

- [ ] **Step 2: Run docs/diff checks**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Run full backend tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test
```

Expected: all backend tests pass.

- [ ] **Step 4: Run dry-run auto range smoke**

Run with actual existing Testnet ids:

```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id>
```

Expected:
- process exits `0`
- JSON has `ok=true`
- `mode="dry_run"`
- selected market has active future BTC oracle
- `steps[0].operation="mint_range"`
- `steps[0].ok=true`
- no private key, wallet secret, or internal token in output

- [ ] **Step 5: Run submit only after dry-run evidence**

Before this step, confirm:
- wallet has SUI for gas
- manager has enough DUSDC
- `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`

Run:

```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id> --submit
```

Expected:
- `mint_range` has confirmed digest
- `close_range_last` has confirmed digest
- no withdrawal runs unless `--withdraw-after-close` is passed

- [ ] **Step 6: Optional tiny withdrawal submit**

Run only after submit mode has minted and closed successfully:

```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id> --submit --withdraw-after-close --withdraw-amount-raw 1
```

Expected:
- `mint_range` confirmed
- `close_range_last` confirmed
- `withdraw_manager_dusdc` confirmed or returns a stable insufficient-balance style error from existing guardrails

- [ ] **Step 7: Commit docs and final verification**

```powershell
git add agent-arena/README.md docs/superpowers/specs/2026-06-17-auto-range-smoke-design.md
git commit -m "docs: document auto range smoke"
```

---

## Final Acceptance Checklist

- [ ] `bun test agent-arena/apps/backend/src/predict/oracle.test.ts`
- [ ] `bun test agent-arena/apps/backend/src/predict/auto-range-smoke.test.ts`
- [ ] `bun test agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`
- [ ] `bun run --cwd agent-arena/apps/backend test`
- [ ] Auto range smoke dry-run exits `0` against Testnet.
- [ ] Auto range smoke submit exits `0` against Testnet after explicit submit gate.
- [ ] Optional tiny withdrawal either confirms or fails with an expected guardrail error.
- [ ] No public Agent API or frontend route can invoke `auto-range-smoke`.
- [ ] Output contains selected raw market fields and no secret material.

## Suggested Commit Sequence

1. `feat: add predict oracle state client`
2. `feat: select auto range smoke market`
3. `feat: orchestrate auto range smoke`
4. `feat: add auto range smoke cli`
5. `docs: document auto range smoke`

Keep live smoke output out of committed files unless it is manually summarized in docs without digests or secret-adjacent values.
