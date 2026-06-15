# Agent Arena Backend Platform Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend API and data model for Agent registration, platform-managed Testnet trading wallets, competitions, intents, risk decisions, executions, scoring, and leaderboard using mock execution first.

**Architecture:** Add a new platform domain next to the existing attribution backend instead of rewriting attribution in place. Use small TypeScript modules for types, validation, store, API routing, risk, mock execution, and scoring. Keep mock execution deterministic so frontend and skill work can proceed before DeepBook signing is live.

**Tech Stack:** Bun, TypeScript, built-in `Request`/`Response`, existing backend test runner `bun test`, SQLite-compatible store boundary.

---

## File Structure

- Create `agent-arena/apps/backend/src/platform/types.ts`: shared domain types and API response types.
- Create `agent-arena/apps/backend/src/platform/validation.ts`: request validation, Twitter handle normalization, decimal string checks, idempotency checks.
- Create `agent-arena/apps/backend/src/platform/auth.ts`: Agent API key generation, hashing, and request authentication.
- Create `agent-arena/apps/backend/src/platform/mock-store.ts`: in-memory store for tests and mock runtime.
- Create `agent-arena/apps/backend/src/platform/competitions.ts`: BTC 15m mock competition fixtures and lifecycle helpers.
- Create `agent-arena/apps/backend/src/platform/risk.ts`: risk decision engine and rejection codes.
- Create `agent-arena/apps/backend/src/platform/execution.ts`: mock execution engine and execution group handling.
- Create `agent-arena/apps/backend/src/platform/scoring.ts`: MVP score formula and leaderboard sorting.
- Create `agent-arena/apps/backend/src/platform/api.ts`: `/api/arena/*` route handling.
- Create matching `*.test.ts` files in `agent-arena/apps/backend/src/platform/`.
- Modify `agent-arena/apps/backend/src/server.ts`: route existing attribution endpoints and new platform endpoints.

### Task 1: Domain Types

**Files:**
- Create: `agent-arena/apps/backend/src/platform/types.ts`
- Test: `agent-arena/apps/backend/src/platform/types.test.ts`

- [ ] **Step 1: Write the failing type/runtime shape test**

```ts
import { describe, expect, it } from "bun:test";
import { createMockCompetition, isAgentAction } from "./types";

describe("platform types", () => {
  it("recognizes the MVP Agent actions", () => {
    expect(isAgentAction("open_directional")).toBe(true);
    expect(isAgentAction("adjust_range")).toBe(true);
    expect(isAgentAction("transfer")).toBe(false);
  });

  it("creates the BTC 15m competition shape used by API fixtures", () => {
    const competition = createMockCompetition("btc-15m-001");

    expect(competition.gameType).toBe("DeepBookPredictBtc15m");
    expect(competition.allowedActions).toContain("open_directional");
    expect(competition.allowedActions).toContain("hold");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd agent-arena/apps/backend
bun test src/platform/types.test.ts
```

Expected:

- Fails because `src/platform/types.ts` does not exist.

- [ ] **Step 3: Implement `types.ts`**

Implement these exported symbols:

```ts
export const agentActions = [
  "hold",
  "open_directional",
  "open_range",
  "add",
  "reduce",
  "close",
  "switch_direction",
  "adjust_range"
] as const;

export type AgentAction = (typeof agentActions)[number];
export type RoundStatus = "pre_open" | "live" | "expired" | "settled";
export type IntentStatus = "accepted" | "rejected" | "executed" | "partial";
export type ExecutionStatus = "queued" | "signed" | "submitted" | "confirmed" | "failed" | "partial";
export type PositionKind = "directional" | "range";

export interface Competition {
  id: string;
  name: string;
  gameType: "DeepBookPredictBtc15m";
  marketSymbol: "BTC-USD";
  durationSeconds: 900;
  predictObjectId: string;
  oracleId: string;
  expiry: string;
  allowedActions: AgentAction[];
  status: RoundStatus;
  skillFile: string;
  startsAt: string;
  expiresAt: string;
  settlesAt: string | null;
}

export interface AgentProfile {
  id: string;
  name: string;
  normalizedName: string;
  twitterHandle: string | null;
  normalizedTwitterHandle: string | null;
  tradingWalletId: string | null;
  createdAt: string;
}

export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  status: "active" | "detached";
  createdAt: string;
}

export interface DirectionalMarket {
  kind: "directional";
  oracleId: string;
  expiry: string;
  strike: string;
  isUp: boolean;
}

export interface RangeMarket {
  kind: "range";
  oracleId: string;
  expiry: string;
  lowerStrike: string;
  higherStrike: string;
}

export type IntentMarket = DirectionalMarket | RangeMarket;

export interface PositionRef {
  kind: PositionKind;
  marketKey?: string;
  rangeKey?: string;
  openExecutionId?: string;
  quantity: string;
}

export interface AgentIntent {
  id: string;
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  market?: IntentMarket;
  positionRef?: PositionRef;
  quantity?: string;
  maxCost?: string;
  minProceeds?: string;
  confidence: number;
  reason: string;
  createdAt: string;
  status: IntentStatus;
  rejectionCode: string | null;
}

export interface RiskDecision {
  id: string;
  intentId: string;
  accepted: boolean;
  rejectionCode: string | null;
  createdAt: string;
}

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
}

export function isAgentAction(value: string): value is AgentAction {
  return (agentActions as readonly string[]).includes(value);
}

export function createMockCompetition(id: string): Competition {
  return {
    id,
    name: "BTC 15m Testnet Arena",
    gameType: "DeepBookPredictBtc15m",
    marketSymbol: "BTC-USD",
    durationSeconds: 900,
    predictObjectId: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
    oracleId: "0xbtc15m",
    expiry: "2026-06-15T10:15:00.000Z",
    allowedActions: [...agentActions],
    status: "live",
    skillFile: "/skills/deepbook-predict-btc-15m.md",
    startsAt: "2026-06-15T10:00:00.000Z",
    expiresAt: "2026-06-15T10:15:00.000Z",
    settlesAt: null
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
cd agent-arena/apps/backend
bun test src/platform/types.test.ts
```

Expected:

- Passes with 2 tests.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/types.test.ts
git commit -m "feat: add agent arena platform domain types"
```

### Task 2: Validation And Twitter Normalization

**Files:**
- Create: `agent-arena/apps/backend/src/platform/validation.ts`
- Test: `agent-arena/apps/backend/src/platform/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, it } from "bun:test";
import { normalizeTwitterHandle, validateDecimalString, validateIntentPayload } from "./validation";

describe("platform validation", () => {
  it("normalizes optional Twitter handles as display and lookup values", () => {
    expect(normalizeTwitterHandle("@Sui_Agent42")).toEqual({
      twitterHandle: "Sui_Agent42",
      normalizedTwitterHandle: "sui_agent42"
    });
    expect(normalizeTwitterHandle("")).toEqual({
      twitterHandle: null,
      normalizedTwitterHandle: null
    });
  });

  it("rejects invalid Twitter handles", () => {
    expect(() => normalizeTwitterHandle("@this_handle_is_too_long")).toThrow("twitterHandle must be 1 to 15 characters");
    expect(() => normalizeTwitterHandle("@bad-name")).toThrow("twitterHandle can contain only letters, numbers, and underscores");
  });

  it("validates decimal strings without raw integer assumptions", () => {
    expect(validateDecimalString("5.00", "maxCost")).toBe("5.00");
    expect(() => validateDecimalString("-1", "maxCost")).toThrow("maxCost must be a positive decimal string");
  });

  it("validates open_directional intent requirements", () => {
    const payload = validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-1",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z"
    });

    expect(payload.action).toBe("open_directional");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd agent-arena/apps/backend
bun test src/platform/validation.test.ts
```

Expected:

- Fails because `validation.ts` does not exist.

- [ ] **Step 3: Implement validation**

Implement:

- `normalizeTwitterHandle(value: string | null | undefined)`
- `validateDecimalString(value: unknown, field: string)`
- `validateIntentPayload(payload: unknown)`
- A local `PlatformInputError` class.

Rules:

- Strip leading `@`.
- Allow 1 to 15 characters, letters/numbers/underscore only.
- Decimal strings must be positive and match `/^\d+(\.\d+)?$/`.
- `confidence` must be `0 <= confidence <= 1`.
- `reason` must be non-empty and at most 1,000 characters.
- `open_directional` requires directional market, `quantity`, `maxCost`.
- `open_range` requires range market, `quantity`, `maxCost`.
- `reduce` requires `positionRef`, `quantity`.
- `close` requires `positionRef`.
- `hold` requires no market.

- [ ] **Step 4: Run validation tests**

```powershell
cd agent-arena/apps/backend
bun test src/platform/validation.test.ts
```

Expected:

- Passes with 4 tests.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/validation.ts agent-arena/apps/backend/src/platform/validation.test.ts
git commit -m "feat: validate agent arena platform payloads"
```

### Task 3: Authentication And Agent Registration

**Files:**
- Create: `agent-arena/apps/backend/src/platform/auth.ts`
- Create: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Test: `agent-arena/apps/backend/src/platform/auth.test.ts`

- [ ] **Step 1: Write failing auth tests**

```ts
import { describe, expect, it } from "bun:test";
import { authenticateAgentRequest, createAgentCredential } from "./auth";
import { PlatformMockStore } from "./mock-store";

describe("Agent API auth", () => {
  it("creates one visible API key and authenticates by header", () => {
    const store = new PlatformMockStore();
    const agent = store.createAgent({ name: "Trend Ranger", twitterHandle: "Sui_Agent" });
    const credential = createAgentCredential(store, agent.id, "2026-06-15T10:00:00.000Z");

    expect(credential.apiKey).toStartWith("agent_arena_sk_");

    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { "x-agent-arena-api-key": credential.apiKey }
    });

    expect(authenticateAgentRequest(request, store).agentId).toBe(agent.id);
  });

  it("rejects missing credentials", () => {
    const store = new PlatformMockStore();
    const request = new Request("http://localhost/api/arena/agent/me");

    expect(() => authenticateAgentRequest(request, store)).toThrow("UNAUTHORIZED");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd agent-arena/apps/backend
bun test src/platform/auth.test.ts
```

Expected:

- Fails because `auth.ts` and `mock-store.ts` do not exist.

- [ ] **Step 3: Implement auth and mock store**

Implement `PlatformMockStore` methods:

- `createAgent({ name, twitterHandle })`
- `getAgent(agentId)`
- `saveCredential(credential)`
- `findCredentialByApiKey(apiKey)`

Implement `createAgentCredential(store, agentId, now)`:

- API key prefix: `agent_arena_sk_`.
- Use `crypto.randomUUID()` twice and strip dashes for enough entropy.
- Store the full key only in mock store for MVP tests.
- Return the full key once.

Implement `authenticateAgentRequest(request, store)`:

- Read `x-agent-arena-api-key`.
- Throw `PlatformAuthError("UNAUTHORIZED")` when missing or unknown.
- Return `{ agentId }`.

- [ ] **Step 4: Run auth tests**

```powershell
cd agent-arena/apps/backend
bun test src/platform/auth.test.ts
```

Expected:

- Passes with 2 tests.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/auth.ts agent-arena/apps/backend/src/platform/auth.test.ts agent-arena/apps/backend/src/platform/mock-store.ts
git commit -m "feat: add agent arena platform auth"
```

### Task 4: Competitions And Lifecycle

**Files:**
- Create: `agent-arena/apps/backend/src/platform/competitions.ts`
- Test: `agent-arena/apps/backend/src/platform/competitions.test.ts`

- [ ] **Step 1: Write failing competition tests**

```ts
import { describe, expect, it } from "bun:test";
import { getAllowedOperations, resolveRoundStatus } from "./competitions";

describe("competition lifecycle", () => {
  it("uses the more restrictive status between platform time and oracle state", () => {
    expect(resolveRoundStatus({
      platformStatus: "live",
      oracleState: "PendingSettlement"
    })).toBe("expired");
  });

  it("rejects new exposure after expiry but can allow close", () => {
    const operations = getAllowedOperations("expired");

    expect(operations.canOpen).toBe(false);
    expect(operations.canClose).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd agent-arena/apps/backend
bun test src/platform/competitions.test.ts
```

Expected:

- Fails because `competitions.ts` does not exist.

- [ ] **Step 3: Implement lifecycle helpers**

Implement:

- `type OracleState = "Inactive" | "Active" | "PendingSettlement" | "Settled"`
- `resolveRoundStatus({ platformStatus, oracleState })`
- `getAllowedOperations(status)`

Rules:

- `Active` can map to `live` only when platform status is `live`.
- `PendingSettlement` maps to `expired`.
- `Settled` maps to `settled`.
- The more restrictive status wins.

- [ ] **Step 4: Run competition tests**

```powershell
cd agent-arena/apps/backend
bun test src/platform/competitions.test.ts
```

Expected:

- Passes with 2 tests.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/competitions.ts agent-arena/apps/backend/src/platform/competitions.test.ts
git commit -m "feat: model agent arena competition lifecycle"
```

### Task 5: Intent, Risk, And Mock Execution

**Files:**
- Create: `agent-arena/apps/backend/src/platform/risk.ts`
- Create: `agent-arena/apps/backend/src/platform/execution.ts`
- Test: `agent-arena/apps/backend/src/platform/execution.test.ts`

- [ ] **Step 1: Write failing execution tests**

```ts
import { describe, expect, it } from "bun:test";
import { PlatformMockStore } from "./mock-store";
import { submitIntentWithMockExecution } from "./execution";

describe("mock intent execution", () => {
  it("executes an accepted directional intent and records risk first", () => {
    const store = new PlatformMockStore();
    const agent = store.createAgent({ name: "Trend Ranger", twitterHandle: null });
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-1",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z"
    });

    expect(result.status).toBe("executed");
    expect(result.executionId).toStartWith("exec_");
    expect(store.listRiskDecisions()).toHaveLength(1);
  });

  it("rejects exposure when no wallet is bound", () => {
    const store = new PlatformMockStore();
    const agent = store.createAgent({ name: "No Wallet", twitterHandle: null });
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-2",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.7,
      reason: "Valid idea without a wallet.",
      createdAt: "2026-06-15T10:04:12.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("WALLET_NOT_BOUND");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd agent-arena/apps/backend
bun test src/platform/execution.test.ts
```

Expected:

- Fails because `execution.ts` and `risk.ts` do not exist.

- [ ] **Step 3: Implement risk and mock execution**

Implement risk rules:

- Reject missing wallet with `WALLET_NOT_BOUND`.
- Reject non-live competition with `ROUND_NOT_LIVE`.
- Reject over limit with `RISK_LIMIT_EXCEEDED`.
- Accept `hold` without wallet signing.

Implement mock execution:

- Store intent first.
- Store risk decision second.
- Store execution third only when accepted and action is not `hold`.
- Create deterministic digest: `0xmock_${executionId}`.
- Return the response shape from the spec.

- [ ] **Step 4: Run execution tests**

```powershell
cd agent-arena/apps/backend
bun test src/platform/execution.test.ts
```

Expected:

- Passes with 2 tests.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/risk.ts agent-arena/apps/backend/src/platform/execution.ts agent-arena/apps/backend/src/platform/execution.test.ts
git commit -m "feat: add mock agent arena intent execution"
```

### Task 6: Scoring And Leaderboard

**Files:**
- Create: `agent-arena/apps/backend/src/platform/scoring.ts`
- Test: `agent-arena/apps/backend/src/platform/scoring.test.ts`

- [ ] **Step 1: Write failing scoring tests**

```ts
import { describe, expect, it } from "bun:test";
import { calculateMvpScore, sortLeaderboard } from "./scoring";

describe("MVP scoring", () => {
  it("applies the fixed score formula", () => {
    const score = calculateMvpScore({
      netPnlPct: 0.1842,
      maxDrawdownPct: 0.031,
      capitalEfficiencyPct: 0.8,
      hitRatePct: 0.6,
      executionCount: 6,
      invalidIntentCount: 0
    });

    expect(score).toBeCloseTo(28.49, 2);
  });

  it("breaks ties by higher pnl then lower drawdown", () => {
    const sorted = sortLeaderboard([
      { agentId: "a", score: 10, netPnlPct: 0.1, maxDrawdownPct: 0.03, finalExecutionAt: "2026-06-15T10:10:00.000Z" },
      { agentId: "b", score: 10, netPnlPct: 0.2, maxDrawdownPct: 0.04, finalExecutionAt: "2026-06-15T10:11:00.000Z" }
    ]);

    expect(sorted[0]?.agentId).toBe("b");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd agent-arena/apps/backend
bun test src/platform/scoring.test.ts
```

Expected:

- Fails because `scoring.ts` does not exist.

- [ ] **Step 3: Implement scoring**

Implement the spec formula:

```text
score =
  (netPnlPct * 100)
  - (maxDrawdownPct * 30)
  + (capitalEfficiencyPct * 10)
  + (hitRatePct * 5)
  - (overtradePenalty)
  - (invalidIntentCount * 2)
```

Where:

- `overtradePenalty = Math.max(0, executionCount - 6) * 1.5`

- [ ] **Step 4: Run scoring tests**

```powershell
cd agent-arena/apps/backend
bun test src/platform/scoring.test.ts
```

Expected:

- Passes with 2 tests.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/scoring.ts agent-arena/apps/backend/src/platform/scoring.test.ts
git commit -m "feat: add agent arena mvp scoring"
```

### Task 7: Platform API Routes

**Files:**
- Create: `agent-arena/apps/backend/src/platform/api.ts`
- Test: `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Write failing API tests**

```ts
import { describe, expect, it } from "bun:test";
import { createPlatformFetchHandler } from "./api";

describe("Agent Arena platform API", () => {
  it("registers an Agent and returns the API key once", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Trend Ranger", twitterHandle: "@Sui_Agent" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.apiKey).toStartWith("agent_arena_sk_");
    expect(body.agent.twitterHandle).toBe("Sui_Agent");
  });

  it("submits an authenticated intent", async () => {
    const fetch = createPlatformFetchHandler();
    const registered = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Trend Ranger" })
    }))).json();

    const walletResponse = await fetch(new Request(`http://localhost/api/arena/owner/agents/${registered.agent.id}/wallet`, {
      method: "POST"
    }));
    expect(walletResponse.status).toBe(201);

    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: registered.agent.id,
        idempotencyKey: "intent-api-1",
        action: "hold",
        confidence: 0.5,
        reason: "Waiting for cleaner signal.",
        createdAt: "2026-06-15T10:03:12.000Z"
      })
    }));

    expect(intentResponse.status).toBe(201);
    const body = await intentResponse.json();
    expect(body.status).toBe("accepted");
  });
});
```

- [ ] **Step 2: Run API tests to verify failure**

```powershell
cd agent-arena/apps/backend
bun test src/platform/api.test.ts
```

Expected:

- Fails because `api.ts` does not exist.

- [ ] **Step 3: Implement API handler**

Implement endpoints:

- `GET /api/arena/__introspection`
- `POST /api/arena/auth/register`
- `GET /api/arena/agent/me`
- `GET /api/arena/agent/wallet`
- `POST /api/arena/owner/agents/:id/wallet`
- `GET /api/arena/competition/list-active`
- `GET /api/arena/competition/:id`
- `GET /api/arena/competition/:id/market-state`
- `POST /api/arena/intents`
- `GET /api/arena/leaderboard?competitionId=...`

JSON response rules:

- Include CORS headers.
- Use `x-agent-arena-api-key` for Agent endpoints.
- Use common error response shape from the spec.

- [ ] **Step 4: Wire `server.ts`**

Change `createAttributionFetchHandler` into a combined handler or add `createAgentArenaFetchHandler` that routes:

- `/api/arena/*` to platform API.
- Existing `/health` and `/attributions` to attribution handler for backward compatibility.

- [ ] **Step 5: Run backend tests**

```powershell
cd agent-arena
bun run test:backend
```

Expected:

- Existing attribution tests still pass.
- New platform API tests pass.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/server.ts
git commit -m "feat: expose agent arena platform api"
```

## Final Verification

Run:

```powershell
cd agent-arena
bun run test:backend
```

Expected:

- All backend tests pass, including existing attribution tests and new platform tests.
