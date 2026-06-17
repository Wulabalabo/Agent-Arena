# Agent Runtime Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Agent runtime loop and execution orchestration spec into working Agent-facing APIs: claimed-Agent wallet binding, per-Agent performance ledger, market/position/execution reads, intent queue controls, Predict execution adapter wiring, leaderboard aggregation, and updated Skill docs.

**Architecture:** Keep Agents as strategy owners and keep Agent Arena as the execution authority. Public Agent routes remain pull-first and intent-driven; internal Predict signing stays behind backend-only adapters. The platform stores a binding chain from registration-code hash to `agentId`, wallet, PredictManager, intents, executions, ledger rows, score snapshots, and leaderboard entries.

**Tech Stack:** Bun, TypeScript, backend `bun test`, existing `@mysten/sui` Testnet Predict primitives, markdown Skill docs, optional frontend Vitest coverage for presentation changes.

---

## Source Specs

Read these before implementation:

- `agent-arena/specs/06-agent-participation-platform-spec.md`
- `agent-arena/specs/08-agent-runtime-loop-and-execution-orchestration-spec.md`
- `agent-arena/specs/07-internal-predict-execution-probe-spec.md`

Non-negotiable constraints:

- Testnet only.
- Agent runtime credentials do not withdraw funds.
- Agent runtime credentials do not call `/api/arena/internal/*`.
- Raw registration codes are single-use bootstrap secrets and are not shown in leaderboard, replay, execution, or registry output after claim.
- Leaderboard ranks `agentId`, not wallet address.
- Every signed Predict transaction must preserve `intentId -> riskDecisionId -> executionId -> signingAudit -> predictTxDigest`.
- Public Agent API does not hard-ban final-minute opens while the oracle is active; Predict failures are returned as structured execution failures.

---

## File Map

Backend domain and store:

- Modify `agent-arena/apps/backend/src/platform/types.ts`
  - Add `AgentIdentityBinding`, `PerformanceLedgerRecord`, `AgentPositionSnapshot`, `MarketSnapshot`, `ScoreSnapshot`, and richer execution fields.
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
  - Store identity bindings, ledger rows, positions, market snapshots, and score snapshots.
  - Add query helpers for Agent-facing routes.
- Create `agent-arena/apps/backend/src/platform/performance-ledger.ts`
  - Build ledger rows from pairing, wallet binding, intent, risk, execution, settlement, and claim events.
- Create `agent-arena/apps/backend/src/platform/performance-ledger.test.ts`
  - Prove ledger rows are keyed by `agentId`, preserve registration-code hash, and do not expose raw registration codes.
- Modify `agent-arena/apps/backend/src/platform/scoring.ts`
  - Add score aggregation from ledger rows while preserving existing score formula helpers.
- Modify `agent-arena/apps/backend/src/platform/scoring.test.ts`
  - Prove leaderboard aggregates by `agentId` across wallet ids.

Wallet and claim:

- Modify `agent-arena/apps/backend/src/predict/wallet-store.ts`
  - Allow `bindingMode: "claimed_agent"` for platform-created Agent wallets.
- Modify `agent-arena/apps/backend/src/predict/wallet-store.test.ts`
  - Replace the old rejection test with claimed-Agent wallet creation and no private key exposure.
- Modify `agent-arena/apps/backend/src/platform/api.ts`
  - Add an injectable `agentWalletService`.
  - Use it during owner claim.
  - Record identity binding and wallet binding ledger rows.
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
  - Prove claim binds a generated wallet, returns only public wallet fields, and stores registration-code hash.
- Modify `agent-arena/apps/backend/src/server.ts`
  - Wire default wallet store and optional live Predict adapter into `createAgentArenaFetchHandler`.
- Modify `agent-arena/apps/backend/src/server.test.ts`
  - Prove public routes do not expose internal Predict endpoints and claim can use injected wallet binding.

Agent-facing reads:

- Modify `agent-arena/apps/backend/src/platform/api.ts`
  - Add:
    - `GET /api/arena/agent/positions?competitionId=...`
    - `GET /api/arena/executions/:id`
  - Extend `GET /api/arena/agent/wallet`.
  - Extend `GET /api/arena/competition/:id/market-state`.
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
  - Cover the new read routes and auth boundaries.
- Create `agent-arena/apps/backend/src/platform/market-snapshot.ts`
  - Normalize platform cached market state used by `market-state`.
- Create `agent-arena/apps/backend/src/platform/market-snapshot.test.ts`
  - Prove late-window flags and executable Predict identifiers are exposed without signing.

Intent execution and queue:

- Modify `agent-arena/apps/backend/src/platform/execution.ts`
  - Enforce one pending non-hold execution per Agent per competition.
  - Add server received timestamp.
  - Add richer adapter result details.
- Modify `agent-arena/apps/backend/src/platform/execution.test.ts`
  - Prove pending limit, duplicate idempotency replay, conflicting replay rejection, and failure persistence.
- Create `agent-arena/apps/backend/src/platform/predict-adapter.ts`
  - Map public Agent intents to internal Predict execution request bodies.
  - Invoke an injected internal execution function instead of HTTP-calling public internal routes.
- Create `agent-arena/apps/backend/src/platform/predict-adapter.test.ts`
  - Prove operation mapping, raw-unit mapping, close quantity omission, structured failure, and no withdrawal support.
- Modify `agent-arena/apps/backend/src/platform/risk.ts`
  - Add pending execution and exposure-aware rejection codes where needed.
- Modify `agent-arena/apps/backend/src/platform/risk.test.ts`
  - Prove open/reduce/close rules are lifecycle-aware.

Settlement and claim:

- Create `agent-arena/apps/backend/src/platform/settlement.ts`
  - Define platform-controlled settled claim job inputs and outputs.
- Create `agent-arena/apps/backend/src/platform/settlement.test.ts`
  - Prove claim jobs are keyed by `agentId`, not exposed through Agent runtime tokens, and record ledger rows.

Skill and docs:

- Modify `agent-arena/skills/agent-arena.md`
  - Explain registration-code identity bootstrap and runtime token boundary.
- Modify `agent-arena/skills/deepbook-predict-btc-15m.md`
  - Add Agent decision loop, polling cadence, idempotency, action schemas, late-window handling, and external provider boundary.
- Modify `agent-arena/skills/agent-wallet.md`
  - Clarify wallet is execution container and not leaderboard identity.
- Modify `agent-arena/skills/risk-and-scoring.md`
  - Add performance ledger and leaderboard aggregation rules.
- Modify `agent-arena/README.md`
  - Update completed/next backend milestone summary.

Frontend:

- Modify `agent-arena/apps/frontend/src/types/arena.ts`
  - Add identity binding, position, execution, and ledger-backed leaderboard fields.
- Modify `agent-arena/apps/frontend/src/mock/arena.ts`
  - Add mock positions and ledger-backed leaderboard data.
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`
  - Display wallet as execution container and show PredictManager/funding status.
- Modify `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx`
  - Display latest intent, execution, and position state.
- Modify `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`
  - Display leaderboard context using Agent identity rather than wallet address.
- Modify tests next to those components.

Final verification:

- Run backend focused tests per task.
- Run full backend test: `bun run --cwd agent-arena/apps/backend test`.
- Run frontend test/typecheck if frontend files change:
  - `bun run --cwd agent-arena/apps/frontend test`
  - `bun run --cwd agent-arena/apps/frontend typecheck`
- Run `git diff --check`.

---

## Phase 1: Identity Binding And Ledger Foundation

### Task 1.1: Add Identity And Ledger Types

**Files:**
- Modify `agent-arena/apps/backend/src/platform/types.ts`
- Create `agent-arena/apps/backend/src/platform/performance-ledger.test.ts`
- Create `agent-arena/apps/backend/src/platform/performance-ledger.ts`

- [ ] **Step 1: Write the failing ledger type/behavior test**

Create `agent-arena/apps/backend/src/platform/performance-ledger.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createRegistrationCodeHash, createPerformanceLedgerRecord } from "./performance-ledger";

describe("performance ledger identity", () => {
  it("keeps the registration code as a private hash and ranks by agent id", () => {
    const registrationCodeHash = createRegistrationCodeHash("PAIR-2048");
    const row = createPerformanceLedgerRecord({
      kind: "execution",
      agentDraftId: "draft_1",
      registrationCodeHash,
      agentId: "agent_1",
      ownerAddress: "0xowner",
      tradingWalletId: "wallet_internal_001",
      walletAddress: "0xwallet",
      predictManagerId: "0xmanager",
      competitionId: "btc-15m-001",
      oracleId: "0xoracle",
      expiryMs: "1781701200000",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: "exec_1",
      txDigest: "0xdigest",
      action: "open_range",
      positionKind: "range",
      quantityRaw: "10",
      costRaw: "100000",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T10:00:00.000Z",
      serverReceivedAt: "2026-06-17T10:00:00.100Z"
    });

    expect(registrationCodeHash).not.toBe("PAIR-2048");
    expect(row).toMatchObject({
      agentId: "agent_1",
      tradingWalletId: "wallet_internal_001",
      registrationCodeHash
    });
    expect(JSON.stringify(row)).not.toContain("PAIR-2048");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/performance-ledger.test.ts
```

Expected: FAIL because `./performance-ledger` does not exist.

- [ ] **Step 3: Add types and minimal ledger factory**

Modify `agent-arena/apps/backend/src/platform/types.ts` with these exports:

```ts
export type PerformanceLedgerKind =
  | "pairing"
  | "wallet_binding"
  | "intent"
  | "risk"
  | "execution"
  | "position"
  | "settlement"
  | "claim"
  | "score";

export type PolicyDrift = "none" | "cost_exceeded" | "proceeds_below_minimum" | "unknown";

export interface AgentIdentityBinding {
  agentDraftId: string;
  registrationCodeHash: string;
  agentId: string;
  ownerAddress: string;
  twitterHandle: string | null;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  createdAt: string;
  claimedAt: string;
}

export interface PerformanceLedgerRecord {
  id: string;
  kind: PerformanceLedgerKind;
  agentDraftId: string;
  registrationCodeHash: string;
  agentId: string;
  ownerAddress: string;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  competitionId: string | null;
  oracleId: string | null;
  expiryMs: string | null;
  intentId: string | null;
  riskDecisionId: string | null;
  executionId: string | null;
  txDigest: string | null;
  action: AgentAction | "claim_settled" | "wallet_binding" | "pairing" | "score";
  positionKind: PositionKind | null;
  quantityRaw: string | null;
  costRaw: string | null;
  proceedsRaw: string | null;
  status: string;
  errorCode: string | null;
  policyDrift: PolicyDrift;
  createdAt: string;
  serverReceivedAt: string;
}
```

Create `agent-arena/apps/backend/src/platform/performance-ledger.ts`:

```ts
import type { PerformanceLedgerRecord } from "./types";

type LedgerInput = Omit<PerformanceLedgerRecord, "id">;

export function createRegistrationCodeHash(registrationCode: string): string {
  const normalized = registrationCode.trim();
  if (!normalized) {
    throw new Error("INVALID_REGISTRATION_CODE");
  }
  return `reg_${Buffer.from(normalized, "utf8").toString("base64url")}`;
}

export function createPerformanceLedgerRecord(input: LedgerInput): PerformanceLedgerRecord {
  return {
    id: ledgerId(input),
    ...input
  };
}

function ledgerId(input: LedgerInput): string {
  return [
    "ledger",
    input.kind,
    input.agentId,
    input.competitionId ?? "none",
    input.intentId ?? input.executionId ?? input.createdAt
  ].join("_");
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/performance-ledger.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/performance-ledger.ts agent-arena/apps/backend/src/platform/performance-ledger.test.ts
git commit -m "feat: add agent performance ledger types"
```

### Task 1.2: Store Identity Bindings And Ledger Rows

**Files:**
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Write failing store tests**

Append tests to `agent-arena/apps/backend/src/platform/api.test.ts`:

```ts
it("stores claimed Agent identity binding without exposing the raw registration code", async () => {
  const store = new (await import("./mock-store")).PlatformMockStore();
  const fetch = createPlatformFetchHandler(store);
  const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
    method: "POST",
    body: JSON.stringify({ displayName: "Ledger Agent" })
  }))).json();

  const claimed = await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: "0xowner",
      signature: "0xsignedClaimMessage"
    })
  }))).json();

  const [binding] = store.listAgentIdentityBindings();
  expect(binding).toMatchObject({
    agentDraftId: draft.agentDraftId,
    agentId: claimed.agent.id,
    tradingWalletId: claimed.tradingWallet.id,
    walletAddress: claimed.tradingWallet.address
  });
  expect(JSON.stringify(binding)).not.toContain(draft.registrationCode);
  expect(store.listPerformanceLedger()).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "pairing", agentId: claimed.agent.id }),
    expect.objectContaining({ kind: "wallet_binding", agentId: claimed.agent.id })
  ]));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: FAIL because `listAgentIdentityBindings` and ledger recording do not exist.

- [ ] **Step 3: Add store methods**

Modify `PlatformMockStore`:

```ts
private readonly identityBindings = new Map<string, AgentIdentityBinding>();
private readonly performanceLedger = new Map<string, PerformanceLedgerRecord>();

saveAgentIdentityBinding(binding: AgentIdentityBinding): AgentIdentityBinding {
  this.identityBindings.set(binding.agentId, cloneIdentityBinding(binding));
  return cloneIdentityBinding(binding);
}

getAgentIdentityBinding(agentId: string): AgentIdentityBinding | undefined {
  const binding = this.identityBindings.get(agentId);
  return binding ? cloneIdentityBinding(binding) : undefined;
}

listAgentIdentityBindings(): AgentIdentityBinding[] {
  return [...this.identityBindings.values()].map(cloneIdentityBinding);
}

recordPerformanceLedger(row: PerformanceLedgerRecord): PerformanceLedgerRecord {
  this.performanceLedger.set(row.id, clonePerformanceLedgerRecord(row));
  return clonePerformanceLedgerRecord(row);
}

listPerformanceLedger(): PerformanceLedgerRecord[] {
  return [...this.performanceLedger.values()].map(clonePerformanceLedgerRecord);
}
```

Add clone helpers:

```ts
function cloneIdentityBinding(binding: AgentIdentityBinding): AgentIdentityBinding {
  return { ...binding };
}

function clonePerformanceLedgerRecord(row: PerformanceLedgerRecord): PerformanceLedgerRecord {
  return { ...row };
}
```

- [ ] **Step 4: Record binding rows during claim**

Modify `claimAgent` in `agent-arena/apps/backend/src/platform/api.ts` after wallet binding:

```ts
const registrationCodeHash = createRegistrationCodeHash(registrationCode);
const binding = store.saveAgentIdentityBinding({
  agentDraftId: draft.id,
  registrationCodeHash,
  agentId: agent.id,
  ownerAddress,
  twitterHandle: store.getAgent(agent.id)?.twitterHandle ?? null,
  tradingWalletId: wallet.id,
  walletAddress: wallet.address,
  predictManagerId: null,
  createdAt: draft.createdAt,
  claimedAt: mockNow
});

store.recordPerformanceLedger(createPerformanceLedgerRecord({
  kind: "pairing",
  agentDraftId: binding.agentDraftId,
  registrationCodeHash: binding.registrationCodeHash,
  agentId: binding.agentId,
  ownerAddress: binding.ownerAddress,
  tradingWalletId: binding.tradingWalletId,
  walletAddress: binding.walletAddress,
  predictManagerId: binding.predictManagerId,
  competitionId: null,
  oracleId: null,
  expiryMs: null,
  intentId: null,
  riskDecisionId: null,
  executionId: null,
  txDigest: null,
  action: "pairing",
  positionKind: null,
  quantityRaw: null,
  costRaw: null,
  proceedsRaw: null,
  status: "claimed",
  errorCode: null,
  policyDrift: "none",
  createdAt: draft.createdAt,
  serverReceivedAt: mockNow
}));

store.recordPerformanceLedger(createPerformanceLedgerRecord({
  kind: "wallet_binding",
  agentDraftId: binding.agentDraftId,
  registrationCodeHash: binding.registrationCodeHash,
  agentId: binding.agentId,
  ownerAddress: binding.ownerAddress,
  tradingWalletId: binding.tradingWalletId,
  walletAddress: binding.walletAddress,
  predictManagerId: binding.predictManagerId,
  competitionId: null,
  oracleId: null,
  expiryMs: null,
  intentId: null,
  riskDecisionId: null,
  executionId: null,
  txDigest: null,
  action: "wallet_binding",
  positionKind: null,
  quantityRaw: null,
  costRaw: null,
  proceedsRaw: null,
  status: "active",
  errorCode: null,
  policyDrift: "none",
  createdAt: wallet.createdAt,
  serverReceivedAt: mockNow
}));
```

Import `createRegistrationCodeHash` and `createPerformanceLedgerRecord`.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/performance-ledger.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/performance-ledger.ts agent-arena/apps/backend/src/platform/performance-ledger.test.ts
git commit -m "feat: store agent identity performance bindings"
```

---

## Phase 2: Claimed-Agent Wallet Binding

### Task 2.1: Enable Claimed-Agent Wallet Creation

**Files:**
- Modify `agent-arena/apps/backend/src/predict/wallet-store.ts`
- Modify `agent-arena/apps/backend/src/predict/wallet-store.test.ts`

- [ ] **Step 1: Replace the claimed-agent rejection test**

In `wallet-store.test.ts`, replace the current rejection expectation with:

```ts
it("creates claimed-agent wallets without exposing private key material", async () => {
  const store = createMemoryWalletStore({ walletSecret: "secret" });
  const wallet = await store.createWallet({
    agentId: "agent_1",
    bindingMode: "claimed_agent",
    label: "Ledger Agent"
  });

  expect(wallet).toMatchObject({
    id: "wallet_internal_001",
    agentId: "agent_1",
    bindingMode: "claimed_agent",
    keyScheme: "ed25519",
    status: "active",
    testnetOnly: true
  });
  expect(JSON.stringify(wallet)).not.toContain("secret");
  expect(JSON.stringify(wallet)).not.toContain("private");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/wallet-store.test.ts
```

Expected: FAIL with `CLAIMED_AGENT_BINDING_NOT_ENABLED`.

- [ ] **Step 3: Remove claimed-agent rejection**

Modify both `createMemoryWalletStore().createWallet` and `createJsonWalletStore().createWallet` by deleting the `if (input.bindingMode === "claimed_agent")` rejection blocks.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
bun test agent-arena/apps/backend/src/predict/wallet-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/predict/wallet-store.ts agent-arena/apps/backend/src/predict/wallet-store.test.ts
git commit -m "feat: enable claimed agent wallet binding"
```

### Task 2.2: Inject Wallet Binding Service Into Owner Claim

**Files:**
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify `agent-arena/apps/backend/src/server.ts`
- Modify `agent-arena/apps/backend/src/server.test.ts`

- [ ] **Step 1: Write failing claim service test**

Add this test to `platform/api.test.ts`:

```ts
it("uses an injected Agent wallet service during owner claim", async () => {
  const store = new (await import("./mock-store")).PlatformMockStore();
  const serviceCalls: unknown[] = [];
  const fetch = createPlatformFetchHandler(store, {
    agentWalletService: async (input) => {
      serviceCalls.push(input);
      return {
        id: "wallet_internal_777",
        agentId: input.agentId,
        address: "0x0000000000000000000000000000000000000000000000000000000000000abc",
        status: "active",
        testnetSuiBalance: "0",
        quoteBalance: "0",
        predictManagerStatus: "missing",
        predictManagerId: null,
        createdAt: "2026-06-17T10:00:00.000Z"
      };
    }
  });

  const claimed = await claimTestAgent(fetch, { displayName: "Wallet Service Agent" });

  expect(claimed.tradingWallet).toMatchObject({
    id: "wallet_internal_777",
    agentId: claimed.agent.id,
    address: "0x0000000000000000000000000000000000000000000000000000000000000abc"
  });
  expect(JSON.stringify(claimed)).not.toContain("private");
  expect(serviceCalls).toMatchObject([
    {
      agentId: claimed.agent.id,
      ownerAddress: "0xowner",
      bindingMode: "claimed_agent"
    }
  ]);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: FAIL because `agentWalletService` is not part of `CreatePlatformFetchHandlerOptions`.

- [ ] **Step 3: Add service types**

In `platform/api.ts`:

```ts
export interface AgentWalletServiceInput {
  agentId: string;
  ownerAddress: string;
  displayName: string;
  bindingMode: "claimed_agent";
}

export interface AgentWalletServiceResult {
  id: string;
  agentId: string;
  address: string;
  status: "active" | "detached";
  testnetSuiBalance: string;
  quoteBalance: string;
  predictManagerStatus: "missing" | "ready";
  predictManagerId?: string | null;
  createdAt: string;
}
```

Extend options:

```ts
agentWalletService?: (input: AgentWalletServiceInput) => Promise<AgentWalletServiceResult>;
```

- [ ] **Step 4: Use service during claim**

Replace direct mock wallet binding:

```ts
const wallet = options.agentWalletService
  ? store.bindTradingWalletRecord(await options.agentWalletService({
    agentId: agent.id,
    ownerAddress,
    displayName: draft.displayName,
    bindingMode: "claimed_agent"
  }))
  : store.bindTradingWallet(agent.id, `0xagentwallet_${agent.id}`);
```

Add `bindTradingWalletRecord` to `PlatformMockStore`:

```ts
bindTradingWalletRecord(wallet: TradingWallet): TradingWallet {
  const agent = this.agents.get(wallet.agentId);
  if (!agent) {
    throw new Error("AGENT_NOT_FOUND");
  }
  this.tradingWallets.set(wallet.id, cloneTradingWallet(wallet));
  this.tradingWalletIdsByAgentId.set(wallet.agentId, wallet.id);
  this.agents.set(wallet.agentId, cloneAgent({
    ...agent,
    tradingWalletAddress: wallet.address,
    tradingWalletId: wallet.id
  }));
  return cloneTradingWallet(wallet);
}
```

- [ ] **Step 5: Wire server default service**

In `server.ts`, accept optional `walletStore` or `agentWalletService` and pass it to `createPlatformFetchHandler`.

If using a default wallet store, the service shape is:

```ts
const agentWalletService = async (input: AgentWalletServiceInput) => {
  const wallet = await walletStore.createWallet({
    agentId: input.agentId,
    bindingMode: "claimed_agent",
    label: input.displayName
  });
  return {
    id: wallet.id,
    agentId: wallet.agentId,
    address: wallet.address,
    status: "active",
    testnetSuiBalance: "0",
    quoteBalance: "0",
    predictManagerStatus: "missing",
    predictManagerId: null,
    createdAt: wallet.createdAt
  };
};
```

- [ ] **Step 6: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/server.test.ts agent-arena/apps/backend/src/predict/wallet-store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/server.ts agent-arena/apps/backend/src/server.test.ts
git commit -m "feat: bind platform wallets during agent claim"
```

---

## Phase 3: Position, Execution, And Market Read APIs

### Task 3.1: Add Position Snapshot Store And Agent Route

**Files:**
- Modify `agent-arena/apps/backend/src/platform/types.ts`
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Write failing route test**

Add to `api.test.ts`:

```ts
it("returns authenticated Agent positions for a competition", async () => {
  const store = new (await import("./mock-store")).PlatformMockStore();
  const fetch = createPlatformFetchHandler(store);
  const claimed = await claimTestAgent(fetch, { displayName: "Position Agent" });
  store.savePositionSnapshot({
    id: "pos_1",
    agentId: claimed.agent.id,
    competitionId: "btc-15m-001",
    positionRef: {
      kind: "range",
      rangeKey: "btc-range-64000-66000-1781701200000",
      openExecutionId: "exec_1"
    },
    oracleId: "0xoracle",
    expiryMs: "1781701200000",
    lowerStrikeRaw: "64000000000000",
    higherStrikeRaw: "66000000000000",
    quantityRaw: "10",
    status: "open",
    updatedAt: "2026-06-17T10:01:00.000Z"
  });

  const response = await fetch(new Request("http://localhost/api/arena/agent/positions?competitionId=btc-15m-001", {
    headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
  }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    positions: [
      {
        agentId: claimed.agent.id,
        competitionId: "btc-15m-001",
        positionRef: { kind: "range" },
        quantityRaw: "10",
        status: "open"
      }
    ]
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: FAIL because `savePositionSnapshot` and the route do not exist.

- [ ] **Step 3: Add type**

In `types.ts`:

```ts
export interface AgentPositionSnapshot {
  id: string;
  agentId: string;
  competitionId: string;
  positionRef: PositionRef;
  oracleId: string;
  expiryMs: string;
  strikeRaw?: string;
  direction?: DirectionalMarketSide;
  lowerStrikeRaw?: string;
  higherStrikeRaw?: string;
  quantityRaw: string;
  status: "open" | "closed" | "settled" | "claimable";
  updatedAt: string;
}
```

Also export:

```ts
export type DirectionalMarketSide = "up" | "down";
```

- [ ] **Step 4: Add store methods**

In `mock-store.ts`:

```ts
private readonly positions = new Map<string, AgentPositionSnapshot>();

savePositionSnapshot(snapshot: AgentPositionSnapshot): AgentPositionSnapshot {
  this.positions.set(snapshot.id, clonePositionSnapshot(snapshot));
  return clonePositionSnapshot(snapshot);
}

listPositionSnapshots(filter: { agentId?: string; competitionId?: string } = {}): AgentPositionSnapshot[] {
  return [...this.positions.values()]
    .filter((snapshot) => !filter.agentId || snapshot.agentId === filter.agentId)
    .filter((snapshot) => !filter.competitionId || snapshot.competitionId === filter.competitionId)
    .map(clonePositionSnapshot);
}
```

- [ ] **Step 5: Add route**

In `api.ts`, add before the competition routes:

```ts
if (request.method === "GET" && matchesRoute(route, ["agent", "positions"])) {
  const auth = authenticateAgentRuntimeRequest(request, store);
  const competitionId = url.searchParams.get("competitionId") ?? undefined;
  return jsonResponse({
    positions: store.listPositionSnapshots({
      agentId: auth.agentId,
      competitionId
    })
  });
}
```

Add to introspection:

```ts
"GET /api/arena/agent/positions?competitionId=..."
```

- [ ] **Step 6: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts
git commit -m "feat: expose agent position snapshots"
```

### Task 3.2: Add Execution Read Route

**Files:**
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Write failing route test**

Add to `api.test.ts`:

```ts
it("returns only the authenticated Agent execution by id", async () => {
  const store = new (await import("./mock-store")).PlatformMockStore();
  const fetch = createPlatformFetchHandler(store);
  const claimed = await claimTestAgent(fetch, { displayName: "Execution Agent" });
  store.saveExecution({
    id: "exec_1",
    intentId: "intent_1",
    agentId: claimed.agent.id,
    competitionId: "btc-15m-001",
    riskDecisionId: "risk_1",
    status: "confirmed",
    predictTxDigest: "0xdigest",
    action: "open_range",
    createdAt: "2026-06-17T10:01:00.000Z"
  });

  const response = await fetch(new Request("http://localhost/api/arena/executions/exec_1", {
    headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
  }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    execution: {
      id: "exec_1",
      agentId: claimed.agent.id,
      predictTxDigest: "0xdigest",
      status: "confirmed"
    }
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: FAIL because execution lookup by id and route do not exist.

- [ ] **Step 3: Add store lookup**

In `mock-store.ts`:

```ts
findExecutionById(executionId: string): ExecutionRecord | undefined {
  const execution = this.executions.get(executionId);
  return execution ? cloneExecution(execution) : undefined;
}
```

- [ ] **Step 4: Add route with auth**

In `api.ts`:

```ts
if (request.method === "GET" && route.length === 2 && route[0] === "executions") {
  const auth = authenticateAgentRuntimeRequest(request, store);
  const execution = store.findExecutionById(route[1]);
  if (!execution) {
    return errorResponse(404, "EXECUTION_NOT_FOUND", "Execution not found");
  }
  if (execution.agentId !== auth.agentId) {
    return errorResponse(403, "AGENT_MISMATCH", "Authenticated agent does not match execution agentId");
  }
  return jsonResponse({ execution });
}
```

Add introspection line:

```ts
"GET /api/arena/executions/:id"
```

- [ ] **Step 5: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts
git commit -m "feat: expose authenticated execution reads"
```

### Task 3.3: Add Market Snapshot Normalization

**Files:**
- Create `agent-arena/apps/backend/src/platform/market-snapshot.ts`
- Create `agent-arena/apps/backend/src/platform/market-snapshot.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`

- [ ] **Step 1: Write failing snapshot test**

Create `market-snapshot.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createMarketSnapshot } from "./market-snapshot";

describe("market snapshot", () => {
  it("exposes late-window metadata without blocking active oracle opens", () => {
    const snapshot = createMarketSnapshot({
      competitionId: "btc-15m-001",
      status: "live",
      serverTimeMs: "1781701145000",
      oracleId: "0xoracle",
      oracleStatus: "active",
      expiryMs: "1781701200000",
      underlyingAsset: "BTC",
      spotPriceRaw: "65000000000000",
      forwardPriceRaw: "65010000000000",
      priceDecimals: 9,
      strikeGrid: {
        minStrikeRaw: "50000000000000",
        maxStrikeRaw: "80000000000000",
        strikeStepRaw: "1000000000"
      },
      allowedActions: ["hold", "open_directional", "open_range", "reduce", "close"],
      fetchedAt: "2026-06-17T10:10:00.000Z"
    });

    expect(snapshot.timeToExpiryMs).toBe("55000");
    expect(snapshot.lateWindow).toEqual({
      isFinalMinute: true,
      openAllowedByPlatform: true,
      openMayFailOnPredictQuote: true
    });
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/market-snapshot.test.ts
```

Expected: FAIL because `market-snapshot.ts` does not exist.

- [ ] **Step 3: Add snapshot module**

Create `market-snapshot.ts`:

```ts
import type { AgentAction, RoundStatus } from "./types";

export interface MarketSnapshotInput {
  competitionId: string;
  status: RoundStatus;
  serverTimeMs: string;
  oracleId: string;
  oracleStatus: string;
  expiryMs: string;
  underlyingAsset: "BTC";
  spotPriceRaw: string | null;
  forwardPriceRaw: string | null;
  priceDecimals: 9;
  strikeGrid: {
    minStrikeRaw?: string;
    maxStrikeRaw?: string;
    strikeStepRaw?: string;
    strikesRaw?: string[];
  };
  allowedActions: AgentAction[];
  fetchedAt: string;
}

export function createMarketSnapshot(input: MarketSnapshotInput) {
  const timeToExpiryMs = (BigInt(input.expiryMs) - BigInt(input.serverTimeMs)).toString();
  const isFinalMinute = BigInt(timeToExpiryMs) <= 60_000n && BigInt(timeToExpiryMs) > 0n;
  const openAllowedByPlatform = input.status === "live" && input.oracleStatus === "active" && BigInt(timeToExpiryMs) > 0n;

  return {
    ...input,
    timeToExpiryMs,
    lateWindow: {
      isFinalMinute,
      openAllowedByPlatform,
      openMayFailOnPredictQuote: isFinalMinute && openAllowedByPlatform
    }
  };
}
```

- [ ] **Step 4: Use snapshot in API**

Replace `createMarketState` return shape with `createMarketSnapshot` using existing mock competition fields and stable mock price values:

```ts
return createMarketSnapshot({
  competitionId: competition.id,
  status: competition.status,
  serverTimeMs: String(Date.parse("2026-06-15T10:14:05.000Z")),
  oracleId: competition.oracleId,
  oracleStatus: competition.status === "live" ? "active" : competition.status,
  expiryMs: String(Date.parse(competition.expiresAt)),
  underlyingAsset: "BTC",
  spotPriceRaw: "65000000000000",
  forwardPriceRaw: "65010000000000",
  priceDecimals: 9,
  strikeGrid: {
    minStrikeRaw: "50000000000000",
    maxStrikeRaw: "80000000000000",
    strikeStepRaw: "1000000000"
  },
  allowedActions: getAllowedOperations(competition.status),
  fetchedAt: mockNow
});
```

- [ ] **Step 5: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/market-snapshot.test.ts agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/market-snapshot.ts agent-arena/apps/backend/src/platform/market-snapshot.test.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts
git commit -m "feat: expose agent market snapshots"
```

---

## Phase 4: Intent Queue, Ledger Writes, And Leaderboard Aggregation

### Task 4.1: Add Pending Execution Guard

**Files:**
- Modify `agent-arena/apps/backend/src/platform/execution.ts`
- Modify `agent-arena/apps/backend/src/platform/execution.test.ts`

- [ ] **Step 1: Write failing pending-limit test**

Add to `execution.test.ts`:

```ts
it("rejects a second non-hold intent while a trade execution is pending", async () => {
  const store = new PlatformMockStore();
  const agent = createClaimedTestAgent(store, "Pending Agent");
  store.bindTradingWallet(agent.id, "0xagentwallet");
  store.seedCompetition();
  store.saveExecution({
    id: "exec_pending",
    intentId: "intent_pending",
    agentId: agent.id,
    competitionId: "btc-15m-001",
    riskDecisionId: "risk_pending",
    status: "queued",
    predictTxDigest: null,
    action: "open_range",
    createdAt: "2026-06-15T10:03:12.000Z"
  });

  const result = submitIntentWithMockExecution(store, {
    competitionId: "btc-15m-001",
    agentId: agent.id,
    idempotencyKey: "intent-pending-reject",
    action: "open_directional",
    market: {
      kind: "directional",
      oracleId: "0xbtc15m",
      expiry: "2026-06-15T10:15:00.000Z",
      strike: "65000000000000",
      isUp: true
    },
    quantity: "10",
    maxCost: "100000",
    confidence: 0.6,
    reason: "Try second trade.",
    createdAt: "2026-06-15T10:04:12.000Z"
  });

  expect(result).toMatchObject({
    status: "rejected",
    rejectionCode: "PENDING_EXECUTION_EXISTS"
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts
```

Expected: FAIL because no pending guard exists.

- [ ] **Step 3: Add guard helper**

In `execution.ts` before risk evaluation:

```ts
const pendingExecution = findPendingExecution(store, draftIntent.agentId, draftIntent.competitionId);
if (draftIntent.action !== "hold" && pendingExecution) {
  const rejectedIntent = createIntent(intentId, validated, "rejected", "PENDING_EXECUTION_EXISTS");
  store.saveIntent(rejectedIntent);
  const riskDecisionId = `risk_${store.listRiskDecisions().length + 1}`;
  store.saveRiskDecision({
    id: riskDecisionId,
    intentId,
    accepted: false,
    rejectionCode: "PENDING_EXECUTION_EXISTS",
    createdAt: draftIntent.createdAt
  });
  return {
    status: "rejected",
    intentId,
    riskDecisionId,
    rejectionCode: "PENDING_EXECUTION_EXISTS"
  };
}
```

Helper:

```ts
function findPendingExecution(store: PlatformMockStore, agentId: string, competitionId: string): ExecutionRecord | undefined {
  return store.listExecutions().find((execution) => (
    execution.agentId === agentId &&
    execution.competitionId === competitionId &&
    ["queued", "planned", "dry_run_ok", "submitted"].includes(execution.status)
  ));
}
```

If `ExecutionStatus` does not include `planned` or `dry_run_ok`, extend it in `types.ts` or reduce the guard to currently supported statuses and add the new statuses in Task 5.1. Prefer extending the union now to match spec:

```ts
export type ExecutionStatus = "queued" | "planned" | "dry_run_ok" | "signed" | "submitted" | "confirmed" | "confirmed_policy_drift" | "failed" | "partial";
```

- [ ] **Step 4: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/execution.ts agent-arena/apps/backend/src/platform/execution.test.ts
git commit -m "feat: reject concurrent agent trade intents"
```

### Task 4.2: Write Ledger Rows For Intents And Executions

**Files:**
- Modify `agent-arena/apps/backend/src/platform/execution.ts`
- Modify `agent-arena/apps/backend/src/platform/execution.test.ts`
- Modify `agent-arena/apps/backend/src/platform/performance-ledger.ts`

- [ ] **Step 1: Write failing ledger write test**

Add to `execution.test.ts`:

```ts
it("records performance ledger rows for intent, risk, and execution outcomes", async () => {
  const store = new PlatformMockStore();
  const agent = createClaimedTestAgent(store, "Ledger Execution Agent");
  const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
  store.saveAgentIdentityBinding({
    agentDraftId: "draft_1",
    registrationCodeHash: "reg_hash",
    agentId: agent.id,
    ownerAddress: "0xowner",
    twitterHandle: null,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: "0xmanager",
    createdAt: "2026-06-15T00:00:00.000Z",
    claimedAt: "2026-06-15T00:00:00.000Z"
  });
  store.seedCompetition();

  await submitIntentWithMockExecution(store, {
    competitionId: "btc-15m-001",
    agentId: agent.id,
    idempotencyKey: "intent-ledger-execution",
    action: "open_range",
    market: {
      kind: "range",
      oracleId: "0xbtc15m",
      expiry: "2026-06-15T10:15:00.000Z",
      lowerStrike: "64000000000000",
      higherStrike: "66000000000000"
    },
    quantity: "10",
    maxCost: "100000",
    confidence: 0.62,
    reason: "Ledger path.",
    createdAt: "2026-06-15T10:03:12.000Z"
  }, {
    predictExecutionAdapter: async () => ({
      status: "confirmed",
      predictTxDigest: "0xdigest"
    })
  });

  expect(store.listPerformanceLedger()).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "intent", agentId: agent.id, intentId: "intent_1" }),
    expect.objectContaining({ kind: "risk", agentId: agent.id, riskDecisionId: "risk_1" }),
    expect.objectContaining({ kind: "execution", agentId: agent.id, executionId: "exec_1", txDigest: "0xdigest" })
  ]));
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts
```

Expected: FAIL because execution path does not write ledger rows.

- [ ] **Step 3: Add ledger helper**

In `performance-ledger.ts`, add:

```ts
import type { AgentIdentityBinding, AgentIntent, ExecutionRecord, RiskDecision } from "./types";

export function ledgerFromIntent(binding: AgentIdentityBinding, intent: AgentIntent): PerformanceLedgerRecord {
  return createPerformanceLedgerRecord({
    kind: "intent",
    agentDraftId: binding.agentDraftId,
    registrationCodeHash: binding.registrationCodeHash,
    agentId: intent.agentId,
    ownerAddress: binding.ownerAddress,
    tradingWalletId: binding.tradingWalletId,
    walletAddress: binding.walletAddress,
    predictManagerId: binding.predictManagerId,
    competitionId: intent.competitionId,
    oracleId: intent.market?.oracleId ?? null,
    expiryMs: intent.market?.expiry ?? null,
    intentId: intent.id,
    riskDecisionId: null,
    executionId: null,
    txDigest: null,
    action: intent.action,
    positionKind: intent.market?.kind ?? intent.positionRef?.kind ?? null,
    quantityRaw: intent.quantity ?? null,
    costRaw: intent.maxCost ?? null,
    proceedsRaw: intent.minProceeds ?? null,
    status: intent.status,
    errorCode: intent.rejectionCode,
    policyDrift: "none",
    createdAt: intent.createdAt,
    serverReceivedAt: new Date().toISOString()
  });
}
```

Add `ledgerFromRisk` and `ledgerFromExecution` with the same binding context and exact ids from `RiskDecision` and `ExecutionRecord`.

- [ ] **Step 4: Call ledger helpers**

In `execution.ts`, after saving draft/rejected/executed intents, risks, and executions:

```ts
const binding = store.getAgentIdentityBinding(draftIntent.agentId);
if (binding) {
  store.recordPerformanceLedger(ledgerFromIntent(binding, draftIntent));
}
```

After risk:

```ts
if (binding) {
  store.recordPerformanceLedger(ledgerFromRisk(binding, draftIntent, riskDecision));
}
```

After execution update:

```ts
if (binding) {
  store.recordPerformanceLedger(ledgerFromExecution(binding, input.intent, execution));
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts agent-arena/apps/backend/src/platform/performance-ledger.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/execution.ts agent-arena/apps/backend/src/platform/execution.test.ts agent-arena/apps/backend/src/platform/performance-ledger.ts agent-arena/apps/backend/src/platform/performance-ledger.test.ts
git commit -m "feat: record agent performance ledger events"
```

### Task 4.3: Aggregate Leaderboard From Ledger By Agent

**Files:**
- Modify `agent-arena/apps/backend/src/platform/scoring.ts`
- Modify `agent-arena/apps/backend/src/platform/scoring.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`

- [ ] **Step 1: Write failing aggregation test**

Add to `scoring.test.ts`:

```ts
import { createLeaderboardFromLedger } from "./scoring";

it("aggregates leaderboard by agent id across wallet ids", () => {
  const rows = [
    {
      agentId: "agent_1",
      tradingWalletId: "wallet_a",
      competitionId: "btc-15m-001",
      kind: "execution",
      status: "confirmed",
      proceedsRaw: "200000",
      costRaw: "100000",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T10:01:00.000Z"
    },
    {
      agentId: "agent_1",
      tradingWalletId: "wallet_b",
      competitionId: "btc-15m-001",
      kind: "execution",
      status: "confirmed",
      proceedsRaw: "300000",
      costRaw: "100000",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T10:02:00.000Z"
    }
  ] as any[];

  const entries = createLeaderboardFromLedger({
    rows,
    agentsById: new Map([
      ["agent_1", {
        id: "agent_1",
        displayName: "Ledger Agent",
        twitterHandle: "Sui_Agent",
        twitterVerified: false
      } as any]
    ]),
    competitionId: "btc-15m-001"
  });

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    agentId: "agent_1",
    executionCount: 2,
    invalidIntentCount: 0
  });
  expect(entries[0]!.netPnlPct).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/scoring.test.ts
```

Expected: FAIL because `createLeaderboardFromLedger` does not exist.

- [ ] **Step 3: Add aggregation function**

In `scoring.ts`:

```ts
export function createLeaderboardFromLedger(input: {
  rows: PerformanceLedgerRecord[];
  agentsById: Map<string, Pick<AgentProfile, "id" | "displayName" | "twitterHandle" | "twitterVerified">>;
  competitionId: string;
}): LeaderboardEntry[] {
  const rowsByAgent = new Map<string, PerformanceLedgerRecord[]>();
  for (const row of input.rows) {
    if (row.competitionId !== input.competitionId) {
      continue;
    }
    rowsByAgent.set(row.agentId, [...(rowsByAgent.get(row.agentId) ?? []), row]);
  }

  const entries = [...rowsByAgent].flatMap(([agentId, rows]) => {
    const agent = input.agentsById.get(agentId);
    if (!agent) {
      return [];
    }
    const executionRows = rows.filter((row) => row.kind === "execution" && row.status === "confirmed");
    const invalidIntentCount = rows.filter((row) => row.kind === "intent" && row.status === "rejected").length;
    const cost = sumRaw(executionRows.map((row) => row.costRaw));
    const proceeds = sumRaw(executionRows.map((row) => row.proceedsRaw));
    const netPnlPct = cost === 0n ? 0 : Number(proceeds - cost) / Number(cost);
    const executionCount = executionRows.length;
    const finalExecutionAt = executionRows.map((row) => row.createdAt).sort().at(-1) ?? "1970-01-01T00:00:00.000Z";
    const capitalEfficiencyPct = Math.min(1, executionCount / 6);
    const maxDrawdownPct = rows.filter((row) => row.status === "failed").length * 0.005;
    const hitRatePct = executionCount === 0 ? 0 : executionRows.filter((row) => BigInt(row.proceedsRaw ?? "0") > BigInt(row.costRaw ?? "0")).length / executionCount;

    return [{
      rank: 0,
      agentId,
      displayName: agent.displayName,
      twitterHandle: agent.twitterHandle,
      twitterVerified: agent.twitterVerified,
      score: calculateMvpScore({
        netPnlPct,
        maxDrawdownPct,
        capitalEfficiencyPct,
        hitRatePct,
        executionCount,
        invalidIntentCount
      }),
      netPnlPct,
      maxDrawdownPct,
      capitalEfficiencyPct,
      hitRatePct,
      executionCount,
      invalidIntentCount,
      finalExecutionAt
    }];
  });

  return sortLeaderboard(entries).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function sumRaw(values: Array<string | null>): bigint {
  return values.reduce((total, value) => total + BigInt(value ?? "0"), 0n);
}
```

- [ ] **Step 4: Route leaderboard through ledger when rows exist**

In `api.ts`, `getLeaderboard`, use:

```ts
const ledgerRows = store.listPerformanceLedger();
if (ledgerRows.length > 0) {
  return jsonResponse({
    competitionId,
    entries: createLeaderboardFromLedger({
      rows: ledgerRows,
      competitionId,
      agentsById: new Map(store.listAgents().map((agent) => [agent.id, agent]))
    })
  });
}
```

Add `listAgents()` to `PlatformMockStore`.

- [ ] **Step 5: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/scoring.test.ts agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/scoring.ts agent-arena/apps/backend/src/platform/scoring.test.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/mock-store.ts
git commit -m "feat: rank agents from performance ledger"
```

---

## Phase 5: Agent-Facing Predict Execution Adapter

### Task 5.1: Create Predict Adapter Request Mapper

**Files:**
- Create `agent-arena/apps/backend/src/platform/predict-adapter.ts`
- Create `agent-arena/apps/backend/src/platform/predict-adapter.test.ts`

- [ ] **Step 1: Write failing mapper tests**

Create `predict-adapter.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { buildInternalPredictRequestFromIntent } from "./predict-adapter";

describe("Agent Predict adapter mapper", () => {
  it("maps open_range to internal mint_range with raw guardrail fields", () => {
    const body = buildInternalPredictRequestFromIntent({
      walletId: "wallet_internal_001",
      managerId: "0xmanager",
      payload: {
        operation: "mint_range",
        market: {
          kind: "range",
          oracleId: "0xoracle",
          expiry: "1781701200000",
          lowerStrike: "64000000000000",
          higherStrike: "66000000000000"
        },
        quantity: "10",
        maxCost: "100000"
      }
    });

    expect(body).toEqual({
      walletId: "wallet_internal_001",
      operation: "mint_range",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      expiryMs: "1781701200000",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      quantityRaw: "10",
      maxCostRaw: "100000",
      estimatedCostRaw: "100000",
      dryRunOnly: false
    });
  });

  it("maps close_range without caller quantity so backend resolves full position", () => {
    const body = buildInternalPredictRequestFromIntent({
      walletId: "wallet_internal_001",
      managerId: "0xmanager",
      payload: {
        operation: "close_range",
        positionRef: {
          kind: "range",
          rangeKey: "range",
          openExecutionId: "exec_1"
        },
        market: {
          kind: "range",
          oracleId: "0xoracle",
          expiry: "1781701200000",
          lowerStrike: "64000000000000",
          higherStrike: "66000000000000"
        },
        minProceeds: "1"
      } as any
    });

    expect(body).not.toHaveProperty("quantityRaw");
    expect(body).toMatchObject({
      operation: "close_range",
      minProceedsRaw: "1",
      estimatedProceedsRaw: "1"
    });
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/predict-adapter.test.ts
```

Expected: FAIL because `predict-adapter.ts` does not exist.

- [ ] **Step 3: Add mapper**

Create `predict-adapter.ts`:

```ts
import type { PredictIntentExecutionPayload } from "./execution";

export function buildInternalPredictRequestFromIntent(input: {
  walletId: string;
  managerId: string;
  payload: PredictIntentExecutionPayload & { market?: unknown };
}): Record<string, unknown> {
  const { walletId, managerId, payload } = input;

  if (payload.operation === "mint_range") {
    return {
      walletId,
      operation: "mint_range",
      managerId,
      oracleId: payload.market.oracleId,
      expiryMs: payload.market.expiry,
      lowerStrikeRaw: payload.market.lowerStrike,
      higherStrikeRaw: payload.market.higherStrike,
      quantityRaw: payload.quantity,
      maxCostRaw: payload.maxCost,
      estimatedCostRaw: payload.maxCost,
      dryRunOnly: false
    };
  }

  if (payload.operation === "mint_directional") {
    return {
      walletId,
      operation: "mint_directional",
      managerId,
      oracleId: payload.market.oracleId,
      expiryMs: payload.market.expiry,
      strikeRaw: payload.market.strike,
      direction: payload.market.isUp ? "up" : "down",
      quantityRaw: payload.quantity,
      maxCostRaw: payload.maxCost,
      estimatedCostRaw: payload.maxCost,
      dryRunOnly: false
    };
  }

  throw new Error(`PREDICT_ADAPTER_UNSUPPORTED:${payload.operation}`);
}
```

Then extend it for `redeem_directional`, `redeem_range`, `close_directional`, and `close_range` using `positionRef.market` data. If `PredictIntentExecutionPayload` lacks market fields for reduce/close, add `market` to those payload types in `execution.ts` and populate it from `positionRef`-resolved snapshots in Task 5.2.

- [ ] **Step 4: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/predict-adapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/predict-adapter.ts agent-arena/apps/backend/src/platform/predict-adapter.test.ts agent-arena/apps/backend/src/platform/execution.ts
git commit -m "feat: map agent intents to Predict execute requests"
```

### Task 5.2: Wire Adapter To Internal Predict Execution Function

**Files:**
- Modify `agent-arena/apps/backend/src/platform/predict-adapter.ts`
- Modify `agent-arena/apps/backend/src/platform/predict-adapter.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Write failing adapter execution test**

Add to `predict-adapter.test.ts`:

```ts
import { createAgentPredictExecutionAdapter } from "./predict-adapter";

it("calls internal execution and returns a confirmed Predict digest", async () => {
  const calls: unknown[] = [];
  const adapter = createAgentPredictExecutionAdapter({
    resolveManagerId: async () => "0xmanager",
    executeInternalPredict: async (body) => {
      calls.push(body);
      return {
        execution: {
          status: "submitted",
          txDigest: "0xdigest"
        }
      };
    }
  });

  const result = await adapter({
    intentId: "intent_1",
    riskDecisionId: "risk_1",
    executionId: "exec_1",
    agentId: "agent_1",
    walletId: "wallet_internal_001",
    predictOperation: "mint_range",
    predictPayload: {
      operation: "mint_range",
      market: {
        kind: "range",
        oracleId: "0xoracle",
        expiry: "1781701200000",
        lowerStrike: "64000000000000",
        higherStrike: "66000000000000"
      },
      quantity: "10",
      maxCost: "100000"
    }
  });

  expect(result).toEqual({
    status: "confirmed",
    predictTxDigest: "0xdigest"
  });
  expect(calls[0]).toMatchObject({
    walletId: "wallet_internal_001",
    managerId: "0xmanager",
    operation: "mint_range",
    dryRunOnly: false
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/predict-adapter.test.ts
```

Expected: FAIL because `createAgentPredictExecutionAdapter` does not exist.

- [ ] **Step 3: Add adapter factory**

In `predict-adapter.ts`:

```ts
import type { PredictIntentExecutionAdapterInput, PredictIntentExecutionAdapterResult } from "./execution";

export interface AgentPredictExecutionAdapterOptions {
  resolveManagerId: (input: PredictIntentExecutionAdapterInput) => Promise<string>;
  executeInternalPredict: (body: Record<string, unknown>) => Promise<unknown>;
}

export function createAgentPredictExecutionAdapter(options: AgentPredictExecutionAdapterOptions) {
  return async function execute(input: PredictIntentExecutionAdapterInput): Promise<PredictIntentExecutionAdapterResult> {
    const managerId = await options.resolveManagerId(input);
    const body = buildInternalPredictRequestFromIntent({
      walletId: input.walletId,
      managerId,
      payload: input.predictPayload
    });
    const response = await options.executeInternalPredict(body) as {
      execution?: { status?: string; txDigest?: string; errorCode?: string };
      error?: { code?: string; message?: string };
    };

    if (response.error || response.execution?.status === "failed") {
      return {
        status: "failed",
        predictTxDigest: response.execution?.txDigest ?? null
      };
    }

    return {
      status: "confirmed",
      predictTxDigest: response.execution?.txDigest ?? null
    };
  };
}
```

- [ ] **Step 4: Wire server**

In `server.ts`, construct a backend-only internal execution function instead of exposing internal routes. Use the existing `createInternalPredictFetchHandler` with an internal `Request` object only inside server wiring:

```ts
const executeInternalPredict = async (body: Record<string, unknown>) => {
  const response = await internalPredictFetch(new Request("http://localhost/api/arena/internal/predict/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-arena-internal-token": internalToken ?? ""
    },
    body: JSON.stringify(body)
  }));
  return await response.json();
};
```

Then pass `predictExecutionAdapter` to `createPlatformFetchHandler`.

Resolve manager id through a small injected map first:

```ts
resolveManagerId: async (input) => {
  const binding = platformStore.getAgentIdentityBinding(input.agentId);
  if (!binding?.predictManagerId) {
    throw new Error("PREDICT_MANAGER_REQUIRED");
  }
  return binding.predictManagerId;
}
```

If manager discovery is not yet automated for public Agents, return structured failure until setup marks `predictManagerId`.

- [ ] **Step 5: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/predict-adapter.test.ts agent-arena/apps/backend/src/server.test.ts agent-arena/apps/backend/src/platform/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/predict-adapter.ts agent-arena/apps/backend/src/platform/predict-adapter.test.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/server.ts agent-arena/apps/backend/src/server.test.ts
git commit -m "feat: connect agent intents to Predict execution adapter"
```

---

## Phase 6: Settlement And Platform-Controlled Claim

### Task 6.1: Add Settlement Job Contract

**Files:**
- Create `agent-arena/apps/backend/src/platform/settlement.ts`
- Create `agent-arena/apps/backend/src/platform/settlement.test.ts`

- [ ] **Step 1: Write failing settlement test**

Create `settlement.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { buildSettlementClaimJob } from "./settlement";

describe("settlement jobs", () => {
  it("creates platform-controlled claim jobs without Agent withdrawal permission", () => {
    const job = buildSettlementClaimJob({
      agentId: "agent_1",
      tradingWalletId: "wallet_internal_001",
      predictManagerId: "0xmanager",
      competitionId: "btc-15m-001",
      oracleId: "0xoracle",
      expiryMs: "1781701200000",
      positionKind: "range",
      positionRef: {
        kind: "range",
        rangeKey: "range",
        openExecutionId: "exec_1"
      }
    });

    expect(job).toMatchObject({
      agentId: "agent_1",
      operation: "claim_settled_range",
      agentRuntimeCallable: false,
      withdrawalAllowed: false
    });
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/settlement.test.ts
```

Expected: FAIL because `settlement.ts` does not exist.

- [ ] **Step 3: Add settlement contract**

Create `settlement.ts`:

```ts
import type { PositionKind, PositionRef } from "./types";

export interface SettlementClaimJobInput {
  agentId: string;
  tradingWalletId: string;
  predictManagerId: string;
  competitionId: string;
  oracleId: string;
  expiryMs: string;
  positionKind: PositionKind;
  positionRef: PositionRef;
}

export function buildSettlementClaimJob(input: SettlementClaimJobInput) {
  return {
    id: `settlement_${input.agentId}_${input.competitionId}_${input.positionKind}`,
    ...input,
    operation: input.positionKind === "range" ? "claim_settled_range" as const : "claim_settled_directional" as const,
    agentRuntimeCallable: false,
    withdrawalAllowed: false,
    status: "queued" as const
  };
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/settlement.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/backend/src/platform/settlement.ts agent-arena/apps/backend/src/platform/settlement.test.ts
git commit -m "feat: define platform settlement claim jobs"
```

---

## Phase 7: Skill, Docs, And Frontend Contract

### Task 7.1: Update Agent Skill Operating Manual

**Files:**
- Modify `agent-arena/skills/agent-arena.md`
- Modify `agent-arena/skills/deepbook-predict-btc-15m.md`
- Modify `agent-arena/skills/agent-wallet.md`
- Modify `agent-arena/skills/risk-and-scoring.md`
- Modify `agent-arena/README.md`

- [ ] **Step 1: Write documentation expectations**

Open each skill file and ensure it includes these exact concepts:

```text
registrationCode is identity bootstrap, not a long-term credential
agentId is the leaderboard identity
wallet is the execution container
Agent must run its own loop
polling works without WebSocket
external price providers are strategy inputs only
Agent Arena market-state supplies executable oracle and strike identifiers
every intent requires idempotencyKey
close omits quantity
late-window opens may fail and must be handled
claim_settled and withdrawal are not Agent runtime permissions
```

- [ ] **Step 2: Patch skill docs**

Add an "Agent runtime loop" section to `deepbook-predict-btc-15m.md`:

```md
## Runtime Loop

You are responsible for strategy. Agent Arena is responsible for validation and signing.

Loop:
1. Read `GET /api/arena/agent/me`.
2. Read `GET /api/arena/competition/list-active`.
3. Read `GET /api/arena/competition/:id/market-state`.
4. Read `GET /api/arena/agent/wallet`.
5. Read `GET /api/arena/agent/positions?competitionId=:id`.
6. Optionally read external BTC data providers.
7. Submit exactly one structured intent with a unique `idempotencyKey`.
8. Poll `GET /api/arena/intents/:id` or `GET /api/arena/executions/:id`.
9. Refresh positions before submitting dependent actions.
```

Add examples for `hold`, `open_directional`, `open_range`, `reduce`, and `close`.

- [ ] **Step 3: Verify docs do not mention internal routes**

Run:

```powershell
rg -n "/api/arena/internal|AGENT_ARENA_INTERNAL_TOKEN|private key" agent-arena/skills agent-arena/README.md
```

Expected: No skill doc should tell Agents to call internal routes or access private keys. README may mention internal operator smoke in a separate internal section.

- [ ] **Step 4: Commit**

```powershell
git add agent-arena/skills/agent-arena.md agent-arena/skills/deepbook-predict-btc-15m.md agent-arena/skills/agent-wallet.md agent-arena/skills/risk-and-scoring.md agent-arena/README.md
git commit -m "docs: update agent runtime skill loop"
```

### Task 7.2: Update Frontend Types And Mock Presentation

**Files:**
- Modify `agent-arena/apps/frontend/src/types/arena.ts`
- Modify `agent-arena/apps/frontend/src/mock/arena.ts`
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`
- Modify existing tests next to those components

- [ ] **Step 1: Write failing frontend tests**

Update tests to expect:

```ts
expect(screen.getByText(/wallet is the execution container/i)).toBeInTheDocument();
expect(screen.getByText(/Agent identity/i)).toBeInTheDocument();
expect(screen.getByText(/unverified/i)).toBeInTheDocument();
```

Use existing component tests:

```powershell
bun run --cwd agent-arena/apps/frontend test
```

Expected: FAIL until UI copy/types are updated.

- [ ] **Step 2: Extend frontend types**

In `types/arena.ts`, add:

```ts
export interface AgentIdentityBinding {
  agentId: string;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
}

export interface AgentPositionSnapshot {
  id: string;
  agentId: string;
  competitionId: string;
  positionRef: PositionRef;
  quantityRaw: string;
  status: "open" | "closed" | "settled" | "claimable";
}
```

- [ ] **Step 3: Update mocks and components**

Update mock data to include:

```ts
identityBinding: {
  agentId: "agent_1",
  tradingWalletId: "wallet_internal_001",
  walletAddress: "0xad90...",
  predictManagerId: "0xmanager"
}
```

Update UI language:

- Trading wallet panel: "Wallet is the execution container."
- Leaderboard: "Agent identity" and optional Twitter unverified label.
- Activity panel: latest intent, execution, position status.

- [ ] **Step 4: Verify**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test
bun run --cwd agent-arena/apps/frontend typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/types/arena.ts agent-arena/apps/frontend/src/mock/arena.ts agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.test.tsx agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx agent-arena/apps/frontend/src/components/platform/CompetitionLobby.test.tsx
git commit -m "feat: show agent identity ledger context"
```

---

## Phase 8: Integration Verification

### Task 8.1: Backend Integration Smoke

**Files:**
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify `agent-arena/apps/backend/src/server.test.ts`

- [ ] **Step 1: Add end-to-end backend test**

Add one test that performs:

1. `POST /api/arena/agent/init`
2. `POST /api/arena/owner/agents/claim`
3. `GET /api/arena/agent/wallet`
4. `GET /api/arena/competition/list-active`
5. `GET /api/arena/competition/:id/market-state`
6. `POST /api/arena/intents` with `open_range`
7. `GET /api/arena/intents/:id`
8. `GET /api/arena/executions/:id`
9. `GET /api/arena/agent/positions?competitionId=...`
10. `GET /api/arena/leaderboard?competitionId=...`

Assert:

```ts
expect(claimed.runtimeCredential.token).toStartWith("agent_runtime_");
expect(wallet.wallet.address).toMatch(/^0x/);
expect(intent.status).toBe("executed");
expect(execution.execution.predictTxDigest).toBeTruthy();
expect(leaderboard.entries[0].agentId).toBe(claimed.agent.id);
```

- [ ] **Step 2: Run focused integration tests**

Run:

```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/server.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full backend tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test
```

Expected: PASS with zero failures.

- [ ] **Step 4: Run frontend tests if frontend changed**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test
bun run --cwd agent-arena/apps/frontend typecheck
```

Expected: PASS with zero failures.

- [ ] **Step 5: Run diff check**

Run:

```powershell
git diff --check
```

Expected: Exit code 0. Windows CRLF warnings are acceptable only if no whitespace errors are reported.

- [ ] **Step 6: Commit final integration polish**

```powershell
git add agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/server.test.ts
git commit -m "test: cover agent runtime orchestration flow"
```

---

## Parallelization Guidance

Recommended subagent split:

1. **Identity/Ledger Worker:** Phase 1 and Phase 4.3.
2. **Wallet/API Worker:** Phase 2 and Phase 3.
3. **Predict Adapter Worker:** Phase 5 and Phase 6.
4. **Skill/Frontend Worker:** Phase 7.

Do not run Phase 5 before Phase 2 creates real claimed-Agent wallet binding and Phase 3 provides position/market read shapes. Do not run Phase 4.3 before Phase 1 adds ledger rows.

---

## Self-Review Checklist

Spec coverage:

- Agent-owned loop: Phase 7 skill docs and Phase 3 reads.
- Pull-first API: Phase 3 routes and Phase 8 integration test.
- Platform signing: Phase 5 adapter.
- Identity bootstrap: Phase 1 and Phase 2.
- Performance ledger: Phase 1 and Phase 4.
- Leaderboard by `agentId`: Phase 4.3.
- Late-window no hard ban: Phase 3.3 and Phase 7.1.
- Settlement/claim not Agent runtime: Phase 6 and Phase 7.1.
- Internal routes not exposed: Phase 5.2 and Phase 7.1.

Risk notes:

- Real Testnet submit remains gated by existing Predict config and `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`.
- This plan does not implement KMS/HSM custody.
- This plan keeps claim-settled platform-controlled and does not add owner withdrawal UI.
- This plan keeps WebSocket/SSE out of MVP; polling remains the supported path.

