# Agent Arena Registry Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal `agent_arena::registry` Move package that anchors Agent, trading wallet, competition, execution, and score facts without custody or prediction-market logic.

**Architecture:** Create a standalone Move package under `agent-arena/contracts/agent_arena`. The registry exposes admin-gated functions that emit events and store small records. It never holds funds, never signs transactions, and never prices or settles markets.

**Tech Stack:** Sui Move, `sui move test`, Agent Arena backend registry anchors.

---

## File Structure

- Create `agent-arena/contracts/agent_arena/Move.toml`: Move package manifest.
- Create `agent-arena/contracts/agent_arena/sources/registry.move`: `Registry`, `AdminCap`, records, events, and admin functions.
- Create `agent-arena/contracts/agent_arena/tests/registry_tests.move`: Move unit tests.
- Create `agent-arena/contracts/agent_arena/README.md`: contract boundary and deployment notes.

### Task 1: Move Package Scaffold

**Files:**
- Create: `agent-arena/contracts/agent_arena/Move.toml`
- Create: `agent-arena/contracts/agent_arena/README.md`

- [ ] **Step 1: Create package manifest**

Add:

```toml
[package]
name = "agent_arena"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "testnet" }

[addresses]
agent_arena = "0x0"
```

- [ ] **Step 2: Add contract README**

Document:

- Registry is proof and attribution only.
- Registry does not custody funds.
- Registry does not replace DeepBook Predict.
- Backend remains responsible for signing, private keys, risk checks, and score calculation.

- [ ] **Step 3: Verify package discovery**

Run:

```powershell
cd agent-arena/contracts/agent_arena
sui move test
```

Expected:

- Fails because no source module exists, or reports no tests depending on Sui CLI behavior.

- [ ] **Step 4: Commit scaffold**

```powershell
git add agent-arena/contracts/agent_arena/Move.toml agent-arena/contracts/agent_arena/README.md
git commit -m "chore: scaffold agent arena registry package"
```

### Task 2: Registry Objects And Events

**Files:**
- Create: `agent-arena/contracts/agent_arena/sources/registry.move`
- Test: `agent-arena/contracts/agent_arena/tests/registry_tests.move`

- [ ] **Step 1: Write failing Move tests**

Create tests that call:

- `init_for_testing`
- `register_agent`
- `register_competition`
- `record_execution`
- `commit_score`

Test assertions:

- Agent record stores owner, trading wallet, display name, and Twitter handle.
- Competition record stores game type, Predict object, oracle id, and expiry.
- Execution recording requires admin.
- Score commitment requires admin.

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/contracts/agent_arena
sui move test
```

Expected:

- Fails because `registry.move` does not exist.

- [ ] **Step 3: Implement registry module**

Implement:

- `public struct Registry has key`
- `public struct AdminCap has key`
- `public struct AgentRecord has store`
- `public struct CompetitionRecord has store`
- Events: `AgentRegistered`, `AgentProfileUpdated`, `AgentWalletUnbound`, `CompetitionRegistered`, `ExecutionRecorded`, `ScoreCommitted`

Function signatures:

```move
public entry fun register_agent(
    registry: &mut Registry,
    _cap: &AdminCap,
    agent_id: vector<u8>,
    owner: address,
    trading_wallet: address,
    display_name: vector<u8>,
    twitter_handle: vector<u8>,
    ctx: &mut TxContext
)
```

```move
public entry fun record_execution(
    registry: &mut Registry,
    _cap: &AdminCap,
    agent_id: vector<u8>,
    competition_id: vector<u8>,
    intent_hash: vector<u8>,
    predict_tx_digest: vector<u8>,
    action: vector<u8>,
    timestamp_ms: u64,
    ctx: &mut TxContext
)
```

Rules:

- Do not accept coins.
- Do not transfer funds.
- Do not calculate score onchain.
- Store only lightweight records and emit events.

- [ ] **Step 4: Run Move tests**

```powershell
cd agent-arena/contracts/agent_arena
sui move test
```

Expected:

- All registry tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/contracts/agent_arena/sources/registry.move agent-arena/contracts/agent_arena/tests/registry_tests.move
git commit -m "feat: add agent arena registry contract"
```

### Task 3: Registry Hash Compatibility Notes

**Files:**
- Modify: `agent-arena/contracts/agent_arena/README.md`
- Create: `agent-arena/apps/backend/src/platform/registry/hash.ts`
- Test: `agent-arena/apps/backend/src/platform/registry/hash.test.ts`

- [ ] **Step 1: Write failing backend hash tests**

```ts
import { describe, expect, it } from "bun:test";
import { canonicalJson, createIntentHash } from "./hash";

describe("registry hashes", () => {
  it("uses stable lexicographic canonical json", () => {
    expect(canonicalJson({ b: "2", a: "1" })).toBe('{"a":"1","b":"2"}');
  });

  it("creates versioned intent hashes", async () => {
    const hash = await createIntentHash({
      intentId: "intent_1",
      agentId: "agent_1",
      competitionId: "btc-15m-001",
      idempotencyKey: "key_1",
      action: "hold",
      confidence: 0.5,
      reason: "Waiting.",
      createdAt: "2026-06-15T10:00:00.000Z"
    });

    expect(hash).toMatch(/^0x[0-9a-f]+$/);
  });
});
```

- [ ] **Step 2: Run hash tests to verify failure**

```powershell
cd agent-arena/apps/backend
bun test src/platform/registry/hash.test.ts
```

Expected:

- Fails because `hash.ts` does not exist.

- [ ] **Step 3: Implement backend hash helpers**

Implement:

- `canonicalJson(value)`
- `createIntentHash(intent)`
- `createScoreHash(scoreSnapshot)`

Rules:

- UTF-8 canonical JSON.
- Lexicographic object key order.
- Omit `null` fields.
- Prefix returned hashes with `0x`.
- Use Web Crypto `crypto.subtle.digest("SHA-256", bytes)` for MVP if Blake2b is not locally available; document the selected algorithm in README and spec before contract integration.

- [ ] **Step 4: Update README**

Document the backend hash algorithm and the compatibility rule:

- Changing hash fields or algorithm requires a new version string.

- [ ] **Step 5: Run backend hash tests**

```powershell
cd agent-arena/apps/backend
bun test src/platform/registry/hash.test.ts
```

Expected:

- Hash tests pass.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/contracts/agent_arena/README.md agent-arena/apps/backend/src/platform/registry/hash.ts agent-arena/apps/backend/src/platform/registry/hash.test.ts
git commit -m "feat: add registry proof hash helpers"
```

## Final Verification

Run:

```powershell
cd agent-arena/contracts/agent_arena
sui move test
cd ..\..\apps\backend
bun test src/platform/registry/hash.test.ts
```

Expected:

- Move registry tests pass.
- Backend registry hash tests pass.
