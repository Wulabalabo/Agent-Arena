# Agent Arena Backend Contract Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the backend mock platform API with the Agent participation contract used by the frontend and skill docs.

**Architecture:** Keep the current Bun backend and in-memory `PlatformMockStore`, but migrate the primary API from API-key-first registration to pairing-code initialization plus owner wallet claim. Runtime calls authenticate with `x-agent-arena-agent-token`; deprecated `/auth/register` behavior must not appear in introspection, frontend, skill docs, or smoke tests. Registry contract work stays out of this plan and starts only after the backend contract smoke passes.

**Tech Stack:** Bun, TypeScript, `bun:test`, current `apps/backend/src/platform/*` modules, frontend `features/platform` contract as consumer.

---

## Source Of Truth

- Spec: `agent-arena/specs/06-agent-participation-platform-spec.md` version 0.2.
- Frontend client: `agent-arena/apps/frontend/src/features/platform/client.ts`.
- Skill docs: `agent-arena/skills/agent-arena.md`, `deepbook-predict-btc-15m.md`, `agent-wallet.md`, `risk-and-scoring.md`.

## Contract Target

Canonical flow:

```text
POST /api/arena/agent/init
-> POST /api/arena/owner/agents/claim
-> GET /api/arena/agent/me with x-agent-arena-agent-token
-> GET /api/arena/agent/wallet with x-agent-arena-agent-token
-> GET /api/arena/competition/list-active
-> POST /api/arena/intents with x-agent-arena-agent-token
-> GET /api/arena/leaderboard?competitionId=btc-15m-001
-> GET /api/arena/owner/agents/:id/replay
```

Backend contract v1 implements these intent action schemas:

- `hold`
- `open_directional`
- `open_range`
- `reduce`
- `close`

`add`, `switch_direction`, and `adjust_range` remain product requirements, but they must stay out of `allowedActions` until explicit validation and execution group tests exist.

## File Structure

- Modify `agent-arena/apps/backend/src/platform/types.ts`: Agent profile shape, pairing draft, runtime credential, wallet balance fields, replay event types, allowed action subset.
- Create `agent-arena/apps/backend/src/platform/types.test.ts`: contract v1 allowed action coverage.
- Modify `agent-arena/apps/backend/src/platform/auth.ts`: replace API-key terminology with runtime-token terminology and `x-agent-arena-agent-token`.
- Modify `agent-arena/apps/backend/src/platform/auth.test.ts`: runtime-token tests.
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`: pairing draft lifecycle, owner claim, runtime credential storage, replay query helpers.
- Modify `agent-arena/apps/backend/src/platform/api.ts`: new routes, CORS headers, response shapes, introspection.
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`: canonical contract tests and deprecated-route guard.
- Modify `agent-arena/apps/backend/src/platform/execution.test.ts`: ensure seeded competition exposes only contract v1 actions.
- Modify `agent-arena/apps/backend/src/platform/scoring.ts`: frontend-compatible leaderboard entry shape.
- Create `agent-arena/apps/backend/src/platform/replay.ts`: derive replay events from intents, risk decisions, and executions.
- Create `agent-arena/apps/backend/src/platform/replay.test.ts`: replay ordering and tx digest tests.
- Create `agent-arena/apps/backend/src/platform-contract-smoke.ts`: end-to-end backend contract smoke.
- Create `agent-arena/scripts/validate-skills.ts`: parse skill JSON blocks and validate intent examples through backend validator.
- Modify `agent-arena/package.json`: add `smoke:platform` and `validate:skills`.
- Modify `agent-arena/README.md` and `agent-arena/CHANGES.md`: document the new backend contract commands after implementation.

## Command Convention

Run every command in this plan from the workspace root:

```powershell
C:\Users\user\Documents\Sui-Overflow-2026
```

Do not `cd agent-arena` before `git add`; all staged paths in this plan are workspace-root-relative.

---

### Task 1: Contract Tests For Pairing And Runtime Auth

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/auth.test.ts`

- [ ] **Step 1: Replace old registration happy-path test with pairing test**

In `api.test.ts`, replace the test named `registers an Agent and returns the API key once` with:

```ts
it("initializes an Agent pairing without issuing runtime credentials", async () => {
  const fetch = createPlatformFetchHandler();
  const response = await fetch(new Request("http://localhost/api/arena/agent/init", {
    method: "POST",
    body: JSON.stringify({ displayName: "Trend Ranger" })
  }));

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body).toMatchObject({
    displayName: "Trend Ranger"
  });
  expect(body.agentDraftId).toStartWith("draft_");
  expect(body.registrationCode).toMatch(/^PAIR-/);
  expect(body.claimUrl).toContain(body.registrationCode);
  expect(body.expiresAt).toBe("2026-06-15T00:15:00.000Z");
  expect(body).not.toHaveProperty("apiKey");
  expect(body).not.toHaveProperty("runtimeCredential");
});
```

- [ ] **Step 2: Add owner claim test**

Add this test to `api.test.ts`:

```ts
it("claims a pairing code and returns the runtime credential once", async () => {
  const fetch = createPlatformFetchHandler();
  const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
    method: "POST",
    body: JSON.stringify({ displayName: "Trend Ranger" })
  }))).json();

  const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: "0xowner",
      signature: "0xsignedClaimMessage",
      twitterHandle: "@Sui_Agent"
    })
  }));

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.agent).toMatchObject({
    displayName: "Trend Ranger",
    twitterHandle: "Sui_Agent",
    twitterVerified: false,
    ownerAddress: "0xowner",
    runtimeStatus: "active",
    exposureStatus: "flat"
  });
  expect(body.tradingWallet).toMatchObject({
    agentId: body.agent.id,
    status: "active",
    testnetSuiBalance: "0",
    quoteBalance: "0",
    predictManagerStatus: "missing"
  });
  expect(body.runtimeCredential.token).toStartWith("agent_runtime_");
  expect(body.runtimeCredential.shownOnce).toBe(true);
  expect(body.runtimeCredential.scopes).toEqual([
    "agent:read",
    "agent:intent:write",
    "competition:read",
    "execution:read"
  ]);
  expect(body).not.toHaveProperty("apiKey");
});
```

- [ ] **Step 3: Add runtime token request test**

Replace old `x-agent-arena-api-key` request assertions with `x-agent-arena-agent-token`:

```ts
async function claimTestAgent(fetch: ReturnType<typeof createPlatformFetchHandler>) {
  const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
    method: "POST",
    body: JSON.stringify({ displayName: "Trend Ranger" })
  }))).json();

  return await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: "0xowner",
      signature: "0xsignedClaimMessage"
    })
  }))).json();
}
```

Use the helper in authenticated tests:

```ts
const claimed = await claimTestAgent(fetch);
const meResponse = await fetch(new Request("http://localhost/api/arena/agent/me", {
  headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
}));
expect(meResponse.status).toBe(200);
await expect(meResponse.json()).resolves.toMatchObject({
  id: claimed.agent.id,
  displayName: "Trend Ranger"
});
```

- [ ] **Step 4: Add deprecated-route guard**

Add:

```ts
it("does not expose deprecated API-key registration in introspection", async () => {
  const fetch = createPlatformFetchHandler();
  const response = await fetch(new Request("http://localhost/api/arena/__introspection"));
  const body = await response.json();

  expect(body.authHeader).toBe("x-agent-arena-agent-token");
  expect(JSON.stringify(body)).not.toContain("x-agent-arena-api-key");
  expect(JSON.stringify(body)).not.toContain("/api/arena/auth/register");
});
```

- [ ] **Step 5: Run tests to verify failure**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test
```

Expected: tests fail because routes, store methods, and auth header are still old.

- [ ] **Step 6: Commit tests**

```powershell
git add agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/auth.test.ts
git commit -m "test: define backend agent pairing contract"
```

---

### Task 2: Runtime Token Auth Primitives

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/auth.ts`
- Modify: `agent-arena/apps/backend/src/platform/auth.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`

- [ ] **Step 1: Update auth types and constants**

In `auth.ts`, replace API-key names with runtime-token names:

```ts
export interface AgentRuntimeCredential {
  agentId: string;
  token: string;
  createdAt: string;
  scopes: string[];
}

export interface AgentCredentialStore {
  getAgent(agentId: string): AgentProfile | undefined;
  saveRuntimeCredential(credential: AgentRuntimeCredential): void;
  findRuntimeCredentialByToken(token: string): AgentRuntimeCredential | undefined;
}

const runtimeTokenPrefix = "agent_runtime_";
export const runtimeTokenHeader = "x-agent-arena-agent-token";
```

- [ ] **Step 2: Replace credential factory**

Use:

```ts
export function createAgentRuntimeCredential(
  store: AgentCredentialStore,
  agentId: string,
  now: string
): AgentRuntimeCredential {
  if (!store.getAgent(agentId)) {
    throw new PlatformAuthError();
  }

  const credential: AgentRuntimeCredential = {
    agentId,
    token: `${runtimeTokenPrefix}${randomKeyPart()}${randomKeyPart()}`,
    createdAt: now,
    scopes: ["agent:read", "agent:intent:write", "competition:read", "execution:read"]
  };

  store.saveRuntimeCredential(credential);
  return credential;
}
```

- [ ] **Step 3: Replace request authenticator**

Use:

```ts
export function authenticateAgentRuntimeRequest(
  request: Request,
  store: Pick<AgentCredentialStore, "findRuntimeCredentialByToken">
): AuthenticatedAgentRequest {
  const token = request.headers.get(runtimeTokenHeader);
  if (!token) {
    throw new PlatformAuthError();
  }

  const credential = store.findRuntimeCredentialByToken(token);
  if (!credential) {
    throw new PlatformAuthError();
  }

  return { agentId: credential.agentId };
}
```

- [ ] **Step 4: Update mock-store credential methods**

In `mock-store.ts`, replace `credentialsByApiKey` with `credentialsByRuntimeToken` and implement:

```ts
saveRuntimeCredential(credential: AgentRuntimeCredential): void {
  this.credentialsByRuntimeToken.set(credential.token, cloneRuntimeCredential(credential));
}

findRuntimeCredentialByToken(token: string): AgentRuntimeCredential | undefined {
  const credential = this.credentialsByRuntimeToken.get(token);
  return credential ? cloneRuntimeCredential(credential) : undefined;
}
```

- [ ] **Step 5: Update auth tests**

`auth.test.ts` must assert:

- created tokens start with `agent_runtime_`
- missing `x-agent-arena-agent-token` rejects
- unknown token rejects
- returned auth contains the claimed `agentId`
- mutating returned credential does not mutate store state

- [ ] **Step 6: Run auth tests**

```powershell
bun --cwd agent-arena/apps/backend test src/platform/auth.test.ts
```

Expected: auth tests pass.

- [ ] **Step 7: Commit auth primitives**

```powershell
git add agent-arena/apps/backend/src/platform/auth.ts agent-arena/apps/backend/src/platform/auth.test.ts agent-arena/apps/backend/src/platform/mock-store.ts
git commit -m "feat: add agent runtime token auth"
```

---

### Task 3: Pairing Draft And Owner Claim Store

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Create: `agent-arena/apps/backend/src/platform/types.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/validation.ts`
- Modify: `agent-arena/apps/backend/src/platform/validation.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/auth.test.ts`

- [ ] **Step 1: Add backend contract types**

Add to `types.ts`:

```ts
export type AgentRuntimeStatus = "waiting" | "active" | "cooldown" | "rejected" | "offline";
export type ExposureStatus = "flat" | "directional" | "range" | "closing" | "settled";

export interface AgentPairingDraft {
  id: string;
  displayName: string;
  registrationCode: string;
  claimUrl: string;
  expiresAt: string;
  status: "pending" | "claimed" | "expired";
  createdAt: string;
}
```

Create `types.test.ts` with the backend contract v1 action guard:

```ts
import { describe, expect, it } from "bun:test";
import { createMockCompetition } from "./types";

describe("platform contract types", () => {
  it("exposes only backend contract v1 actions in seeded competitions", () => {
    expect(createMockCompetition("btc-15m-001").allowedActions).toEqual([
      "hold",
      "open_directional",
      "open_range",
      "reduce",
      "close"
    ]);
    expect(createMockCompetition("btc-15m-001").allowedActions).not.toContain("add");
    expect(createMockCompetition("btc-15m-001").allowedActions).not.toContain("switch_direction");
    expect(createMockCompetition("btc-15m-001").allowedActions).not.toContain("adjust_range");
  });
});
```

Update `createMockCompetition` to return the same v1 action subset in `allowedActions`. Do not narrow `agentActions`; the full vocabulary remains reserved for future schemas and validation errors.

Update `AgentProfile` to expose frontend-compatible fields:

```ts
export interface AgentProfile {
  id: string;
  displayName: string;
  normalizedName: string;
  twitterHandle: string | null;
  normalizedTwitterHandle: string | null;
  twitterVerified: false;
  ownerAddress: string;
  tradingWalletAddress: string;
  tradingWalletId: string | null;
  runtimeStatus: AgentRuntimeStatus;
  exposureStatus: ExposureStatus;
  createdAt: string;
}
```

Update `TradingWallet`:

```ts
export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  status: "active" | "detached";
  testnetSuiBalance: string;
  quoteBalance: string;
  predictManagerStatus: "missing" | "ready";
  createdAt: string;
}
```

- [ ] **Step 2: Add validation helpers**

In `validation.ts`, export `validateNonEmptyString` if it is currently local, and add:

```ts
export function validateDisplayName(value: unknown): string {
  const displayName = validateNonEmptyString(value, "displayName").trim();
  if (displayName.length > 80) {
    throw new PlatformInputError("displayName must be at most 80 characters");
  }
  return displayName;
}
```

Add tests for empty and overlong display names.

- [ ] **Step 3: Add pairing draft store methods**

In `mock-store.ts`, add maps:

```ts
private readonly pairingDrafts = new Map<string, AgentPairingDraft>();
private readonly pairingDraftIdsByCode = new Map<string, string>();
private nextDraftNumber = 1;
```

Add:

```ts
createPairingDraft(displayName: string): AgentPairingDraft {
  const id = `draft_${this.nextDraftNumber}`;
  this.nextDraftNumber += 1;
  const registrationCode = `PAIR-${String(this.nextDraftNumber + 2047)}`;
  const draft: AgentPairingDraft = {
    id,
    displayName,
    registrationCode,
    claimUrl: `http://127.0.0.1:8787/agent-arena/claim/${registrationCode}`,
    expiresAt: "2026-06-15T00:15:00.000Z",
    status: "pending",
    createdAt: "2026-06-15T00:00:00.000Z"
  };
  this.pairingDrafts.set(id, clonePairingDraft(draft));
  this.pairingDraftIdsByCode.set(registrationCode, id);
  return clonePairingDraft(draft);
}
```

Add `findPairingDraftByRegistrationCode`, `markPairingDraftClaimed`, and clone helpers.

- [ ] **Step 4: Add owner-aware agent creation**

Replace `createAgent({ name, twitterHandle })` use sites with `createClaimedAgent`:

```ts
createClaimedAgent(input: {
  displayName: string;
  ownerAddress: string;
  twitterHandle?: string | null;
}): AgentProfile {
  const id = `agent_${this.nextAgentNumber}`;
  this.nextAgentNumber += 1;
  const twitter = normalizeTwitterHandle(input.twitterHandle);
  const agent: AgentProfile = {
    id,
    displayName: input.displayName.trim(),
    normalizedName: input.displayName.trim().toLowerCase(),
    twitterHandle: twitter.twitterHandle,
    normalizedTwitterHandle: twitter.normalizedTwitterHandle,
    twitterVerified: false,
    ownerAddress: input.ownerAddress,
    tradingWalletAddress: "",
    tradingWalletId: null,
    runtimeStatus: "active",
    exposureStatus: "flat",
    createdAt: "2026-06-15T00:00:00.000Z"
  };
  this.agents.set(agent.id, cloneAgent(agent));
  return cloneAgent(agent);
}
```

When `bindTradingWallet` succeeds, set `tradingWalletAddress` on the Agent.

- [ ] **Step 5: Preserve execution tests**

Update execution and auth tests that call `store.createAgent` to use a helper:

```ts
function createClaimedTestAgent(store: PlatformMockStore, displayName = "Trend Ranger") {
  return store.createClaimedAgent({
    displayName,
    ownerAddress: "0xowner",
    twitterHandle: null
  });
}
```

- [ ] **Step 6: Run backend tests**

```powershell
bun --cwd agent-arena/apps/backend test src/platform/types.test.ts src/platform/validation.test.ts src/platform/auth.test.ts src/platform/execution.test.ts
```

Expected: types, validation, auth, and execution tests pass.

- [ ] **Step 7: Commit store changes**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/types.test.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/validation.ts agent-arena/apps/backend/src/platform/validation.test.ts agent-arena/apps/backend/src/platform/auth.test.ts agent-arena/apps/backend/src/platform/execution.test.ts
git commit -m "feat: add pairing draft store"
```

---

### Task 4: API Route Migration

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Update CORS and introspection**

In `api.ts`, set:

```ts
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type, x-agent-arena-agent-token"
};
```

Introspection must return:

```ts
authHeader: "x-agent-arena-agent-token",
endpoints: [
  "GET /api/arena/__introspection",
  "POST /api/arena/agent/init",
  "POST /api/arena/owner/agents/claim",
  "GET /api/arena/agent/me",
  "GET /api/arena/agent/wallet",
  "GET /api/arena/competition/list-active",
  "GET /api/arena/competition/:id",
  "GET /api/arena/competition/:id/market-state",
  "POST /api/arena/intents",
  "GET /api/arena/intents/:id",
  "GET /api/arena/leaderboard?competitionId=...",
  "GET /api/arena/owner/agents/:id/replay"
]
```

- [ ] **Step 2: Implement `POST /agent/init`**

Add route:

```ts
if (request.method === "POST" && matchesRoute(route, ["agent", "init"])) {
  return await initAgentPairing(request, store);
}
```

Implementation:

```ts
async function initAgentPairing(request: Request, store: PlatformMockStore): Promise<Response> {
  const body = await readJsonObject(request);
  const displayName = validateDisplayName(body.displayName);
  const draft = store.createPairingDraft(displayName);
  return jsonResponse({
    agentDraftId: draft.id,
    displayName: draft.displayName,
    registrationCode: draft.registrationCode,
    claimUrl: draft.claimUrl,
    expiresAt: draft.expiresAt
  }, 201);
}
```

- [ ] **Step 3: Implement `POST /owner/agents/claim`**

Add route:

```ts
if (request.method === "POST" && matchesRoute(route, ["owner", "agents", "claim"])) {
  return await claimAgent(request, store);
}
```

Implementation must:

- read `registrationCode`, `ownerAddress`, `signature`, optional `twitterHandle`
- reject missing or already-claimed code with `INVALID_REGISTRATION_CODE`
- validate `signature` as a non-empty string in backend contract v1 mock mode
- create claimed Agent
- bind trading wallet at `0xagentwallet_${agent.id}`
- create runtime credential
- return `{ agent, tradingWallet, runtimeCredential }`

Use response:

```ts
return jsonResponse({
  agent: store.getAgent(agent.id),
  tradingWallet: wallet,
  runtimeCredential: {
    token: credential.token,
    shownOnce: true,
    scopes: credential.scopes
  }
}, 201);
```

- [ ] **Step 4: Update runtime-authenticated routes**

Replace every call to `authenticateAgentRequest` with `authenticateAgentRuntimeRequest`.

`GET /agent/me` must return the Agent object directly:

```ts
return jsonResponse(agent);
```

`GET /agent/wallet` stays:

```ts
return jsonResponse({ wallet: store.getTradingWalletByAgentId(auth.agentId) ?? null });
```

- [ ] **Step 5: Remove primary `/auth/register` behavior**

Either delete the route or return:

```ts
return errorResponse(410, "DEPRECATED_ENDPOINT", "Use POST /api/arena/agent/init and owner claim");
```

Do not include it in introspection.

- [ ] **Step 6: Run API tests**

```powershell
bun --cwd agent-arena/apps/backend test src/platform/api.test.ts
```

Expected: API tests pass.

- [ ] **Step 7: Commit API migration**

```powershell
git add agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts
git commit -m "feat: align platform api with pairing contract"
```

---

### Task 5: Leaderboard, Replay, And Runtime Read Endpoints

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Modify: `agent-arena/apps/backend/src/platform/scoring.ts`
- Create: `agent-arena/apps/backend/src/platform/replay.ts`
- Create: `agent-arena/apps/backend/src/platform/replay.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Add leaderboard and replay contract types**

In `types.ts`, add `ReplayEvent` and make sure leaderboard responses can expose the frontend contract shape:

```ts
export interface ReplayEvent {
  id: string;
  timestamp: string;
  label: string;
  summary: string;
  recordId: string;
  copyValue: string | null;
  txDigest: string | null;
}
```

In `scoring.ts`, update `LeaderboardEntry` to include frontend-required fields:

```ts
export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
  score: number;
  netPnlPct: number;
  maxDrawdownPct: number;
  capitalEfficiencyPct: number;
  hitRatePct: number;
  executionCount: number;
  invalidIntentCount: number;
  finalExecutionAt: string;
}
```

Keep `sortLeaderboard` deterministic by sorting on `score`, `netPnlPct`, `maxDrawdownPct`, `finalExecutionAt`, and `agentId`, then assign `rank` after sorting.

- [ ] **Step 2: Update leaderboard response builder**

In `api.ts`, update `createLeaderboardEntries` to join Agent profile fields:

```ts
const agent = store.getAgent(agentId);
if (!agent) {
  return null;
}

return {
  rank: 0,
  agentId,
  displayName: agent.displayName,
  twitterHandle: agent.twitterHandle,
  twitterVerified: agent.twitterVerified,
  score,
  netPnlPct,
  maxDrawdownPct,
  capitalEfficiencyPct,
  hitRatePct,
  executionCount,
  invalidIntentCount,
  finalExecutionAt
};
```

Filter null entries, sort them, then map ranks:

```ts
return sortLeaderboard(entries).map((entry, index) => ({
  ...entry,
  rank: index + 1
}));
```

Add or update `api.test.ts` leaderboard assertions:

```ts
await expect(leaderboard.json()).resolves.toMatchObject({
  entries: [{
    rank: 1,
    agentId: claimed.agent.id,
    displayName: "Directional Agent",
    twitterVerified: false,
    executionCount: 1,
    invalidIntentCount: 0
  }]
});
```

- [ ] **Step 3: Implement replay builder**

Create `replay.ts`:

```ts
import type { AgentIntent, ExecutionRecord, ReplayEvent, RiskDecision } from "./types";

export function buildReplayEvents({
  agentId,
  intents,
  riskDecisions,
  executions
}: {
  agentId: string;
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  executions: ExecutionRecord[];
}): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const riskByIntentId = new Map(riskDecisions.map((risk) => [risk.intentId, risk]));
  const executionsByIntentId = new Map(executions.map((execution) => [execution.intentId, execution]));

  for (const intent of intents.filter((item) => item.agentId === agentId)) {
    events.push({
      id: `replay_intent_${intent.id}`,
      timestamp: intent.createdAt,
      label: "Intent submitted",
      summary: `${intent.action} intent submitted by ${intent.agentId}.`,
      recordId: intent.id,
      copyValue: intent.id,
      txDigest: null
    });

    const risk = riskByIntentId.get(intent.id);
    if (risk) {
      events.push({
        id: `replay_risk_${risk.id}`,
        timestamp: risk.createdAt,
        label: risk.accepted ? "Risk accepted" : "Risk rejected",
        summary: risk.accepted ? "Arena policy accepted the intent." : `Arena policy rejected the intent: ${risk.rejectionCode}.`,
        recordId: risk.id,
        copyValue: risk.id,
        txDigest: null
      });
    }

    const execution = executionsByIntentId.get(intent.id);
    if (execution) {
      events.push({
        id: `replay_execution_${execution.id}`,
        timestamp: execution.createdAt,
        label: "Predict transaction confirmed",
        summary: "DeepBook Predict transaction confirmed on Testnet.",
        recordId: execution.id,
        copyValue: execution.predictTxDigest,
        txDigest: execution.predictTxDigest
      });
    }
  }

  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
```

- [ ] **Step 4: Add replay tests**

`replay.test.ts` should create one intent, one risk decision, one execution, and assert labels in order:

```ts
expect(events.map((event) => event.label)).toEqual([
  "Intent submitted",
  "Risk accepted",
  "Predict transaction confirmed"
]);
```

- [ ] **Step 5: Add API replay route**

In `api.ts`, implement:

```ts
if (
  request.method === "GET" &&
  route.length === 4 &&
  route[0] === "owner" &&
  route[1] === "agents" &&
  route[3] === "replay"
) {
  return getAgentReplay(route[2], store);
}
```

Use `buildReplayEvents` and return `{ events }`.

- [ ] **Step 6: Add intent read route**

Implement `GET /api/arena/intents/:id`:

```ts
const intent = store.findIntentById(route[1]);
if (!intent) {
  return errorResponse(404, "INTENT_NOT_FOUND", "Intent not found");
}
return jsonResponse({ intent });
```

- [ ] **Step 7: Run leaderboard, replay, and API tests**

```powershell
bun --cwd agent-arena/apps/backend test src/platform/replay.test.ts src/platform/api.test.ts
```

Expected: tests pass.

- [ ] **Step 8: Commit leaderboard and replay endpoints**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/scoring.ts agent-arena/apps/backend/src/platform/replay.ts agent-arena/apps/backend/src/platform/replay.test.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts
git commit -m "feat: add platform leaderboard and replay endpoints"
```

---

### Task 6: Backend Contract Smoke

**Files:**
- Create: `agent-arena/apps/backend/src/platform-contract-smoke.ts`
- Modify: `agent-arena/package.json`

- [ ] **Step 1: Add package script**

In `agent-arena/package.json`, add:

```json
"smoke:platform": "bun run apps/backend/src/platform-contract-smoke.ts"
```

- [ ] **Step 2: Implement smoke**

Create `platform-contract-smoke.ts` that:

1. Creates `const fetch = createAgentArenaFetchHandler()`.
2. Calls `POST /api/arena/agent/init`.
3. Calls `POST /api/arena/owner/agents/claim`.
4. Stores `runtimeCredential.token`.
5. Calls `/agent/me`, `/agent/wallet`, `/competition/list-active`.
6. Submits an executable `open_directional` intent with `x-agent-arena-agent-token`:

```ts
{
  competitionId: "btc-15m-001",
  agentId: claimed.agent.id,
  idempotencyKey: "smoke-btc-15m-open-001",
  action: "open_directional",
  market: {
    kind: "directional",
    oracleId: "0xsmoke_oracle_btc_15m",
    expiry: "2026-06-15T10:15:00.000Z",
    strike: "65000",
    isUp: true
  },
  quantity: "1",
  maxCost: "1.00",
  confidence: 0.61,
  reason: "Smoke verifies executable backend contract flow.",
  createdAt: "2026-06-15T10:03:12.000Z"
}
```

7. Reads leaderboard and asserts at least one entry includes the claimed Agent display name.
8. Reads replay and asserts it includes `Predict transaction confirmed` and a non-empty `predictTxDigest`.
9. Throws if any response body contains `apiKey` or if any request needs `x-agent-arena-api-key`.

The final output must be:

```text
Platform contract smoke passed
```

- [ ] **Step 3: Run smoke**

```powershell
bun run --cwd agent-arena smoke:platform
```

Expected: `Platform contract smoke passed`.

- [ ] **Step 4: Commit smoke**

```powershell
git add agent-arena/apps/backend/src/platform-contract-smoke.ts agent-arena/package.json
git commit -m "test: add platform contract smoke"
```

---

### Task 7: Skill JSON Validation

**Files:**
- Create: `agent-arena/scripts/validate-skills.ts`
- Modify: `agent-arena/package.json`

- [ ] **Step 1: Add validation script**

Create `scripts/validate-skills.ts` that:

- requires the four skill files
- parses every fenced `json` block
- validates any JSON block with an `action` field through `validateIntentPayload`
- prints `Skill docs validated`

Core loop:

```ts
for (const file of requiredFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)) {
    const payload = JSON.parse(match[1]);
    if (payload.action) {
      validateIntentPayload(payload);
    }
  }
}
```

- [ ] **Step 2: Add package script**

In `agent-arena/package.json`, add:

```json
"validate:skills": "bun run scripts/validate-skills.ts"
```

- [ ] **Step 3: Run validation**

```powershell
bun run --cwd agent-arena validate:skills
```

Expected: `Skill docs validated`.

- [ ] **Step 4: Commit skill validation**

```powershell
git add agent-arena/scripts/validate-skills.ts agent-arena/package.json
git commit -m "test: validate agent skill examples"
```

---

### Task 8: Docs And Final Verification

**Files:**
- Modify: `agent-arena/README.md`
- Modify: `agent-arena/CHANGES.md`

- [ ] **Step 1: Update README commands**

Document:

```powershell
bun run --cwd agent-arena/apps/backend test
bun run --cwd agent-arena smoke:platform
bun run --cwd agent-arena validate:skills
```

Also document that runtime auth uses `x-agent-arena-agent-token`, not `x-agent-arena-api-key`.

- [ ] **Step 2: Update CHANGES**

Add a concise checkpoint:

```markdown
## Backend Contract Alignment

- Replaced primary API-key registration with pairing-code init and owner claim.
- Runtime calls now use `x-agent-arena-agent-token`.
- Added platform contract smoke and skill JSON validation.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test
bun run --cwd agent-arena smoke:platform
bun run --cwd agent-arena validate:skills
bun run --cwd agent-arena typecheck
bun run --cwd agent-arena test:frontend
bun run --cwd agent-arena build
git diff --check
git status --short
```

Expected:

- backend tests pass
- smoke prints `Platform contract smoke passed`
- skills validation prints `Skill docs validated`
- frontend typecheck/tests/build pass
- `git diff --check` has no whitespace errors
- `git status --short` shows only intended README/CHANGES edits before commit, then clean after commit

- [ ] **Step 4: Commit docs**

```powershell
git add agent-arena/README.md agent-arena/CHANGES.md
git commit -m "docs: document backend contract alignment"
```

## Final Review Checklist

- `POST /api/arena/auth/register` is not in introspection.
- `x-agent-arena-api-key` is not used by frontend, skill docs, smoke, or primary backend tests.
- `POST /api/arena/agent/init` does not return a runtime credential.
- `POST /api/arena/owner/agents/claim` returns Agent, trading wallet, and shown-once runtime credential.
- Runtime endpoints require `x-agent-arena-agent-token`.
- Intent examples in skill docs validate through backend `validateIntentPayload`.
- Replay returns intent, risk, and execution evidence for demo.
- `agent_arena::registry` remains out of scope for this backend contract plan.
