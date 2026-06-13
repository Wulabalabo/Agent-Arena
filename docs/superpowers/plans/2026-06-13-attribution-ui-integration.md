# Attribution UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing frontend Back Agent flow to the lightweight SQLite attribution backend once a Predict transaction digest is available.

**Architecture:** Keep official Sui Predict reads and future wallet transactions on the frontend side. The backend remains attribution-only: `GET /health`, `POST /attributions`, and `GET /attributions?userAddress=...`; no chain indexer. The frontend will build one deterministic attribution payload from the selected round, agent, amount, user address, manager id, and transaction digest, then store the resulting attribution status in local arena state for the demo flow.

**Tech Stack:** React, Vite, Vitest, Bun, SQLite via `bun:sqlite`, existing Agent Arena mock state and Predict config.

---

## File Structure

- Modify: `agent-arena/apps/frontend/src/types/arena.ts`
  - Add optional attribution metadata to `BackingPositionBase` so the UI can show whether a local backed position has a backend attribution record.
- Modify: `agent-arena/apps/frontend/src/state/arena.ts`
  - Add a pure transition for recording a completed Back Agent action with digest plus attribution metadata.
- Test: `agent-arena/apps/frontend/src/state/arena.test.ts`
  - Cover the state transition, locked-round guard, and clearing the draft after a submitted backing.
- Create: `agent-arena/apps/frontend/src/features/attribution/payload.ts`
  - Convert selected round, agent, amount, digest, and user context into `CreateAttributionInput`.
- Create: `agent-arena/apps/frontend/src/features/attribution/payload.test.ts`
  - Cover directional and range payloads.
- Modify: `agent-arena/apps/frontend/src/components/arena/BackAgentPanel.tsx`
  - Make the primary Back Agent action async and surface pending/success/failure attribution status.
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.tsx`
  - Inject the attribution client, build the payload after digest generation, call `createAttribution`, and update local state.
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.test.tsx`
  - Cover successful attribution write and failed backend attribution write.
- Modify: `agent-arena/apps/frontend/src/components/arena/BetManagementPanel.tsx`
  - Show attribution status and attribution id/digest for backed positions.
- Modify: `agent-arena/README.md`
  - Document the local end-to-end smoke flow with backend plus frontend.

---

### Task 1: Add Attribution Metadata To Local Backing State

**Files:**
- Modify: `agent-arena/apps/frontend/src/types/arena.ts`
- Modify: `agent-arena/apps/frontend/src/state/arena.ts`
- Test: `agent-arena/apps/frontend/src/state/arena.test.ts`

- [ ] **Step 1: Write failing state tests**

Add tests that assert:

```ts
recordBackedPosition(state, {
  roundId: "round-btc-upcoming",
  agentId: "volatility-sniper",
  userAddress: "0xuser",
  managerId: "0xmanager",
  amount: 100,
  predictTxDigest: "0xdigest",
  attributionId: "attr_0xdigest_volatility-sniper",
  attributionStatus: "submitted",
  predictPositionType: "directional",
  marketKey: "BTC_UP_5M",
  rangeKey: null
});
```

Expected behavior:
- Adds or updates one `BackingPosition`.
- Sets `status` to `"backed"`.
- Stores `predictTxDigest`, `attributionId`, and `attributionStatus`.
- Clears `backingDraft`.
- Does nothing for locked rounds.

- [ ] **Step 2: Run targeted test and confirm failure**

Run from `agent-arena/apps/frontend`:

```powershell
bun run test -- src/state/arena.test.ts
```

Expected: FAIL with `recordBackedPosition` not exported or attribution fields missing.

- [ ] **Step 3: Implement minimal types and state transition**

In `types/arena.ts`, add:

```ts
export type AttributionSyncStatus = "not_started" | "pending" | "submitted" | "failed";
```

Extend `BackingPositionBase` with:

```ts
attributionId: string | null;
attributionStatus: AttributionSyncStatus;
attributionError: string | null;
```

In `state/arena.ts`, add `recordBackedPosition(state, backingInput)` as a pure function. It should validate round and agent through existing helpers, guard locked rounds with `isRoundLocked`, and use `setBackingAtIndex` when replacing an existing position for the same `roundId` plus `agentId`.

- [ ] **Step 4: Run targeted test and confirm pass**

```powershell
bun run test -- src/state/arena.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add agent-arena/apps/frontend/src/types/arena.ts agent-arena/apps/frontend/src/state/arena.ts agent-arena/apps/frontend/src/state/arena.test.ts
git commit -m "feat: track attribution state on backed positions"
```

---

### Task 2: Build Attribution Payloads From Arena Context

**Files:**
- Create: `agent-arena/apps/frontend/src/features/attribution/payload.ts`
- Create: `agent-arena/apps/frontend/src/features/attribution/payload.test.ts`

- [ ] **Step 1: Write failing payload tests**

Cover directional agents:

```ts
expect(buildCreateAttributionInput({
  round,
  agent,
  amount: 100,
  digest: "0xdigest",
  userAddress: "0xuser",
  managerId: "0xmanager"
})).toMatchObject({
  userAddress: "0xuser",
  managerId: "0xmanager",
  roundId: round.id,
  agentId: agent.id,
  oracleId: round.predictOracleId,
  digest: "0xdigest",
  predictPositionType: "directional",
  marketKey: expect.any(String),
  rangeKey: null,
  amount: 100
});
```

Cover range agents:

```ts
expect(payload.predictPositionType).toBe("range");
expect(payload.marketKey).toBeNull();
expect(payload.rangeKey).toContain(round.marketSymbol);
```

- [ ] **Step 2: Run targeted test and confirm failure**

```powershell
bun run test -- src/features/attribution/payload.test.ts
```

Expected: FAIL because the file/function does not exist.

- [ ] **Step 3: Implement payload builder**

Export:

```ts
export interface BuildCreateAttributionInputOptions {
  round: ArenaRound;
  agent: Agent;
  amount: number;
  digest: string;
  userAddress: string;
  managerId: string;
}

export function buildCreateAttributionInput(options: BuildCreateAttributionInputOptions): CreateAttributionInput;
```

Rules:
- Use `round.predictOracleId` as `oracleId`.
- Prefer `"range"` if the agent supports range; otherwise use `"directional"`.
- Build `marketKey` or `rangeKey` with the same shape currently used by `createLocalDraftBacking`.
- Include a short `strategySnapshot` with agent name, strategy type, round id, and amount.
- Throw a normal `Error` if amount is not positive or digest is empty.

- [ ] **Step 4: Run targeted test and confirm pass**

```powershell
bun run test -- src/features/attribution/payload.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add agent-arena/apps/frontend/src/features/attribution/payload.ts agent-arena/apps/frontend/src/features/attribution/payload.test.ts
git commit -m "feat: build agent attribution payloads"
```

---

### Task 3: Wire Back Agent To Attribution Client

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/arena/BackAgentPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.tsx`
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.test.tsx`

- [ ] **Step 1: Write failing component tests**

In `ArenaShell.test.tsx`, inject a fake attribution client and assert that clicking the primary action after readiness steps:
- Calls `createAttribution` once.
- Shows a submitted attribution message.
- Adds a backed position with transaction digest.

Also add a failure test:
- Fake client rejects with `new Error("Attribution backend error")`.
- UI shows a retryable failure message.
- State does not create a backed position as submitted.

- [ ] **Step 2: Run targeted test and confirm failure**

```powershell
bun run test -- src/components/arena/ArenaShell.test.tsx
```

Expected: FAIL because `ArenaShell` does not accept an attribution client and `BackAgentPanel` does not call one.

- [ ] **Step 3: Add injection seams**

In `ArenaShell.tsx`, add optional props:

```ts
interface ArenaShellProps {
  attributionClient?: ReturnType<typeof createAttributionClient>;
  createPredictDigest?: () => string;
  userAddress?: string;
  managerId?: string;
}
```

Defaults:
- `attributionClient = createAttributionClient()`
- `createPredictDigest = () => "0xmock-predict-digest-" + Date.now().toString(16)`
- `userAddress = "mock-wallet"`
- `managerId = "mock-manager"`

- [ ] **Step 4: Replace save-only Back Agent action**

Change `BackAgentPanel` props:

```ts
onBackAgent: () => Promise<void>;
attributionError: string | null;
attributionDigest: string | null;
```

Keep `onSaveDraft` for the secondary draft button.

The primary action should:
- Set stage to `"Confirming"`.
- Await `onBackAgent`.
- Set stage to `"Backed"` on success.
- Set stage to `"Failed"` on error.

- [ ] **Step 5: Implement ArenaShell handler**

In `ArenaShell`, implement:

```ts
const handleBackAgent = async () => {
  const amount = Number(amountInput);
  const digest = createPredictDigest();
  const input = buildCreateAttributionInput({
    round: selectedRound,
    agent: selectedAgent,
    amount,
    digest,
    userAddress,
    managerId
  });
  const attribution = await attributionClient.createAttribution(input);
  setArenaState((current) => recordBackedPosition(current, {
    ...input,
    predictTxDigest: digest,
    attributionId: attribution.id,
    attributionStatus: attribution.status,
    attributionError: null
  }));
  setManagementTab("upcoming");
};
```

Adapt exact field names to the implementation from Task 1.

- [ ] **Step 6: Run targeted tests and confirm pass**

```powershell
bun run test -- src/components/arena/ArenaShell.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit checkpoint**

```powershell
git add agent-arena/apps/frontend/src/components/arena/BackAgentPanel.tsx agent-arena/apps/frontend/src/components/arena/ArenaShell.tsx agent-arena/apps/frontend/src/components/arena/ArenaShell.test.tsx
git commit -m "feat: submit attribution from back agent flow"
```

---

### Task 4: Surface Attribution Status In Position Management

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/arena/BetManagementPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.test.tsx`

- [ ] **Step 1: Write failing UI assertion**

Assert that a backed position displays:

```text
Agent attribution: submitted
Attribution id: attr_...
Transaction digest: 0x...
```

For failure states, assert:

```text
Agent attribution: failed
```

- [ ] **Step 2: Run targeted test and confirm failure**

```powershell
bun run test -- src/components/arena/ArenaShell.test.tsx
```

Expected: FAIL because `BetManagementPanel` does not show attribution metadata.

- [ ] **Step 3: Add compact status rendering**

In each position row/card, display attribution metadata only when `predictTxDigest` exists or `attributionStatus !== "not_started"`.

Avoid adding a new card; keep this inside the existing position item.

- [ ] **Step 4: Run targeted test and confirm pass**

```powershell
bun run test -- src/components/arena/ArenaShell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add agent-arena/apps/frontend/src/components/arena/BetManagementPanel.tsx agent-arena/apps/frontend/src/components/arena/ArenaShell.test.tsx
git commit -m "feat: show agent attribution status"
```

---

### Task 5: End-To-End Local Smoke And Docs

**Files:**
- Modify: `agent-arena/README.md`

- [ ] **Step 1: Update README smoke instructions**

Document two terminals:

Terminal A:

```powershell
cd agent-arena/apps/backend
$env:AGENT_ARENA_DB_PATH="$PWD\data\agent-arena-smoke.sqlite"
bun run dev
```

Terminal B:

```powershell
cd agent-arena/apps/backend
$env:AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run smoke:attribution
```

Frontend:

```powershell
cd agent-arena/apps/frontend
$env:VITE_AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run dev
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
cd agent-arena/apps/backend
bun test
```

Expected: all backend tests pass.

Run:

```powershell
cd agent-arena/apps/frontend
bun run typecheck
bun run test
```

Expected: typecheck passes and all frontend tests pass.

- [ ] **Step 3: Run live smoke against backend**

Start backend in one terminal, then run:

```powershell
cd agent-arena/apps/backend
$env:AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run smoke:attribution
```

Expected output includes:

```json
{
  "userAddress": "0xsmoke",
  "digest": "0xsmoke-digest",
  "agentId": "volatility-sniper"
}
```

- [ ] **Step 4: Commit checkpoint**

```powershell
git add agent-arena/README.md
git commit -m "docs: document attribution smoke flow"
```

---

## Final Verification Gate

Run from the repo root:

```powershell
git diff --check
```

Run from `agent-arena/apps/backend`:

```powershell
bun test
```

Run from `agent-arena/apps/frontend`:

```powershell
bun run typecheck
bun run test
```

Run live backend smoke:

```powershell
cd agent-arena/apps/backend
$env:AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run smoke:attribution
```

Acceptance criteria:
- Back Agent primary action writes attribution after a digest is available.
- Failed attribution write is visible and retryable.
- Backed positions show digest plus attribution status.
- Backend health still returns `indexer: false`.
- No custom chain indexer is introduced.
- All tests pass.
