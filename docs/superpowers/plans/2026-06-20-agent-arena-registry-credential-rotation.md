# Agent Arena Registry Credential Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reviewed MVP for a proof-only Agent Arena registry contract plus owner-authorized runtime credential rotation.

**Current registry authorization update:** the AdminCap approach in the original draft has been superseded. The implemented MVP uses a shared `Registry`, a package-embedded Ed25519 authority public key, backend-signed BCS authorization payload hashes, and per-registry replay protection.

**Architecture:** Keep the registry as a proof/attribution layer and keep backend SQLite/runtime state authoritative for auth, custody, and execution. Add a contained backend registry adapter, atomic runtime credential rotation in the platform store, and a small frontend owner control that requests a rotation challenge before wallet signing. Registry submit stays disabled by default and hard-gated to Testnet.

**Tech Stack:** Sui Move, Bun test, TypeScript backend, SQLite snapshot store, React/Vite/Vitest frontend.

---

## File Map

Contract:

- Create `agent-arena/contracts/agent_arena/Move.toml`
- Create `agent-arena/contracts/agent_arena/sources/registry.move`
- Create `agent-arena/contracts/agent_arena/tests/registry_tests.move`

Backend registry:

- Create `agent-arena/apps/backend/src/platform/registry.ts`
- Create `agent-arena/apps/backend/src/platform/registry.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/types.ts`
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify `agent-arena/apps/backend/src/platform/sqlite-store.ts`
- Modify `agent-arena/apps/backend/src/server.ts`
- Modify `agent-arena/.env.production.example`
- Modify `agent-arena/README.md`

Backend credential rotation:

- Modify `agent-arena/apps/backend/src/platform/auth.ts`
- Modify `agent-arena/apps/backend/src/platform/auth.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify `agent-arena/apps/backend/src/platform/types.ts`
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify `agent-arena/apps/backend/src/platform/sqlite-store.ts`

Frontend:

- Modify `agent-arena/apps/frontend/src/features/platform/types.ts`
- Modify `agent-arena/apps/frontend/src/features/platform/client.ts`
- Modify `agent-arena/apps/frontend/src/features/platform/client.test.ts`
- Modify `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.test.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`
- Modify `agent-arena/apps/frontend/src/App.tsx` only if the profile panel needs existing wallet provider context.

Docs/skills:

- Modify `agent-arena/skills/agent-arena.md`
- Modify `agent-arena/skills/agent-wallet.md`
- Modify `README.md`

## Task 1: Add Proof-Only Move Registry Package

**Files:**
- Create: `agent-arena/contracts/agent_arena/Move.toml`
- Create: `agent-arena/contracts/agent_arena/sources/registry.move`
- Create: `agent-arena/contracts/agent_arena/tests/registry_tests.move`

- [ ] **Step 1: Write failing Move tests**

Create tests that prove:

- package init creates shared `Registry`
- a valid backend authority signature can call `register_agent`
- duplicate `register_agent` fails
- replayed authorizations fail
- invalid signatures fail
- wrong-owner `record_runtime_credential_rotation` fails
- every successful write increments `version`

Use test-only helpers to create `Registry` if package-init object capture is too heavy for local tests. Use fixed signature fixtures generated from the backend BCS/hash helper; do not commit the authority private key.

- [ ] **Step 2: Run contract tests and verify RED**

Run:

```powershell
sui move test --path agent-arena/contracts/agent_arena
```

Expected: fail because the Move package and module do not exist yet.

- [ ] **Step 3: Implement minimal `agent_arena::registry`**

Implement:

- `Registry has key`
- `version: u64`
- `registered_agents: table::Table<vector<u8>, address>`
- `bound_wallets: table::Table<vector<u8>, address>`
- `consumed_authorizations: table::Table<vector<u8>, bool>`
- embedded Ed25519 authority public key
- events from the spec
- `register_agent`
- `record_runtime_credential_rotation`

The contract must not store registration-code hashes, runtime credentials, signatures, or private key material.

- [ ] **Step 4: Run contract tests and verify GREEN**

Run:

```powershell
sui move test --path agent-arena/contracts/agent_arena
```

Expected: registry tests pass. If `sui` is unavailable, record the exact tool failure and continue with backend tests; do not claim contract tests passed.

- [ ] **Step 5: Commit contract package**

```powershell
git add agent-arena/contracts/agent_arena
git commit -m "feat: add agent arena registry contract"
```

## Task 2: Add Backend Registry Adapter And Claim Anchoring

**Files:**
- Create: `agent-arena/apps/backend/src/platform/registry.ts`
- Create: `agent-arena/apps/backend/src/platform/registry.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/sqlite-store.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`
- Modify: `agent-arena/.env.production.example`

- [ ] **Step 1: Write failing registry adapter tests**

Add tests for:

- disabled submit returns `{ status: "disabled" }`
- enabled submit with non-Testnet config returns `UNSUPPORTED_NETWORK`
- `createRegisterAgentRegistryRequest` omits registration-code-derived material
- successful mock registry submit returns `status` and `txDigest`

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/registry.test.ts
```

Expected: fail because `registry.ts` does not exist.

- [ ] **Step 2: Implement registry adapter types and disabled/Testnet behavior**

Add `RegistryWriteResult`, `RegistrySubmitter`, `RegistryConfig`, and helpers in `registry.ts`.

Keep a dependency-injected submitter function so tests do not need live Sui network access.

- [ ] **Step 3: Run registry adapter tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/registry.test.ts
```

Expected: pass.

- [ ] **Step 4: Write failing claim anchoring API tests**

In `api.test.ts`, add tests that:

- claim response includes `registry.status: "disabled"` when registry submit is disabled
- claim response includes successful registry `txDigest` when adapter succeeds
- registry payload passed from claim does not contain `registrationCode` or `registrationCodeHash`
- claim still succeeds when registry adapter returns failed substatus

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/api.test.ts
```

Expected: fail because `claimAgent` does not call registry adapter.

- [ ] **Step 5: Wire registry adapter into `createPlatformFetchHandler`**

Add `registryService` or `registryAdapter` to `CreatePlatformFetchHandlerOptions`.

After claim creates Agent, trading wallet, identity binding, ledger rows, and credential, call registry register with:

- `agentId`
- `agentDraftId`
- `ownerAddress`
- `tradingWalletAddress`
- `metadataHash`
- `platformCreatedAtMs`

Return:

```json
{
  "registry": {
    "status": "disabled",
    "txDigest": null
  }
}
```

- [ ] **Step 6: Run backend API tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/api.test.ts src/platform/registry.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit backend registry adapter**

```powershell
git add agent-arena/apps/backend/src/platform/registry.ts agent-arena/apps/backend/src/platform/registry.test.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/sqlite-store.ts agent-arena/apps/backend/src/server.ts agent-arena/.env.production.example
git commit -m "feat: anchor agent claims in registry"
```

## Task 3: Implement Runtime Credential Rotation Backend

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/auth.ts`
- Modify: `agent-arena/apps/backend/src/platform/auth.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/sqlite-store.ts`

- [ ] **Step 1: Write failing auth/store tests**

Add tests that prove:

- credentials have `credentialVersion`
- revoked credentials are not returned by `findRuntimeCredentialByToken`
- `rotateRuntimeCredentialForAgent` invalidates old credentials and returns one new credential
- version conflict rejects rotation
- consumed nonce rejects rotation
- SQLite persisted snapshots store hashed new credential and keep old raw token out of storage

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/auth.test.ts src/platform/api.test.ts
```

Expected: fail because rotation APIs do not exist.

- [ ] **Step 2: Add credential model fields**

Extend `AgentRuntimeCredential` with:

- `credentialVersion: number`
- `revokedAt?: string | null`
- `revocationReason?: string | null`

Update clone/persist/parse paths to tolerate old snapshots where these fields are missing.

- [ ] **Step 3: Add rotation challenge state to store**

Add `RuntimeCredentialRotationChallenge` type with:

- `agentId`
- `ownerAddress`
- `reason`
- `domain`
- `chainId`
- `currentCredentialVersion`
- `nextCredentialVersion`
- `nonce`
- `expiresAt`
- `message`
- `consumedAt`

Add snapshot persistence and clone helpers.

- [ ] **Step 4: Implement atomic store rotation**

Implement `rotateRuntimeCredentialForAgent` on `PlatformMockStore` and persistence hooks in `SQLitePlatformStore`.

For the JSON-snapshot SQLite store, atomicity means the in-memory operation mutates all related maps together before one `persist()` call. If future normalized SQLite tables are introduced, they must use a real transaction.

- [ ] **Step 5: Add rotation challenge and rotate routes**

Routes:

```text
POST /api/arena/owner/agents/:agentId/runtime-credential/rotation-challenge
POST /api/arena/owner/agents/:agentId/runtime-credential/rotate
```

Challenge route validates owner and reason, creates nonce and canonical message.

Rotate route validates:

- owner match
- signature present
- real mode signature contract placeholder fails closed unless explicitly mock mode
- nonce scoped to Agent/owner
- expiry
- reason match
- domain match
- `testnet` chain
- version match

Then atomically rotates credential and calls registry rotation after local commit.

- [ ] **Step 6: Add API tests for route behavior**

Tests:

- challenge response shape
- wrong owner challenge rejected
- rotate rejects Agent runtime token only
- rotate rejects wrong reason
- rotate rejects wrong domain
- rotate invalidates old token
- rotate authenticates new token
- concurrent rotate simulation yields one success and one conflict/nonce error
- registry failure returns success with `registry.status: "failed"`

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/api.test.ts src/platform/auth.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit credential rotation backend**

```powershell
git add agent-arena/apps/backend/src/platform/auth.ts agent-arena/apps/backend/src/platform/auth.test.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/sqlite-store.ts
git commit -m "feat: rotate agent runtime credentials"
```

## Task 4: Add Lightweight Frontend Rotation Control

**Files:**
- Modify: `agent-arena/apps/frontend/src/features/platform/types.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/client.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/client.test.ts`
- Modify: `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.test.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`

- [ ] **Step 1: Write failing platform client tests**

Add tests that:

- `createRuntimeCredentialRotationChallenge` posts owner address and reason
- `rotateRuntimeCredential` posts owner address, signature, nonce, expiry, reason, and message
- claim response accepts optional `registry`

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/features/platform/client.test.ts
```

Expected: fail because methods/types do not exist.

- [ ] **Step 2: Implement platform client methods and types**

Add:

- `RegistryWriteSummary`
- `RuntimeCredentialRotationChallenge`
- `RuntimeCredentialRotationResponse`
- `createRuntimeCredentialRotationChallenge`
- `rotateRuntimeCredential`

- [ ] **Step 3: Run client tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/features/platform/client.test.ts
```

Expected: pass.

- [ ] **Step 4: Write failing profile panel tests**

In `UserAgentProfilePanel.test.tsx`, test:

- owner profile shows rotate button only when `profile.agentId` and owner wallet match
- clicking rotate requests challenge, signs challenge with wallet provider, posts rotate, displays new token once
- copy handoff uses the rotated token

If wallet provider plumbing is not available in this component, move the orchestration to a small `RuntimeCredentialRotationPanel` child and pass callbacks from `ArenaPage` or `App.tsx`.

- [ ] **Step 5: Implement lightweight rotate UI**

Add a compact button in the full profile wallet/owner section and compact profile section only when owner wallet matches.

Do not add SFT/NFT UI or old credential history.

- [ ] **Step 6: Run frontend component tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/components/platform/UserAgentProfilePanel.test.tsx src/features/platform/client.test.ts
```

Expected: pass.

- [ ] **Step 7: Update claim panel registry summary**

Add optional registry status/tx digest display to `AgentClaimPanel`.

Write/update tests that claim page shows registry tx digest when present.

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/components/platform/AgentClaimPanel.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit frontend rotation UI**

```powershell
git add agent-arena/apps/frontend/src/features/platform/types.ts agent-arena/apps/frontend/src/features/platform/client.ts agent-arena/apps/frontend/src/features/platform/client.test.ts agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.test.tsx agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx agent-arena/apps/frontend/src/App.tsx
git commit -m "feat: add owner credential rotation UI"
```

## Task 5: Update Agent Docs And Run Focused Verification

**Files:**
- Modify: `agent-arena/skills/agent-arena.md`
- Modify: `agent-arena/skills/agent-wallet.md`
- Modify: `README.md`
- Modify: `agent-arena/README.md`

- [ ] **Step 1: Write docs updates**

Update skills so an Agent with a rejected credential tells the owner to rotate the credential from the owner profile, then stores the new handoff privately.

Update README to mention:

- proof-only registry contract
- owner credential rotation
- registry submit disabled by default and Testnet-only

- [ ] **Step 2: Run skill validation**

Run:

```powershell
bun run --cwd agent-arena validate:skills
```

If `validate:skills` is unavailable, run:

```powershell
bun run --cwd agent-arena scripts/validate-skills.ts
```

Expected: pass.

- [ ] **Step 3: Run backend focused tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/registry.test.ts src/platform/auth.test.ts src/platform/api.test.ts
```

Expected: pass.

- [ ] **Step 4: Run frontend focused tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/features/platform/client.test.ts src/components/platform/AgentClaimPanel.test.tsx src/components/platform/UserAgentProfilePanel.test.tsx
```

Expected: pass.

- [ ] **Step 5: Run typechecks**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test
bun run --cwd agent-arena/apps/frontend typecheck
```

Expected: pass or report existing unrelated failures with exact output.

- [ ] **Step 6: Commit docs and verification updates**

```powershell
git add agent-arena/skills/agent-arena.md agent-arena/skills/agent-wallet.md README.md agent-arena/README.md
git commit -m "docs: document registry and credential rotation"
```

## Execution Notes

- Keep existing unrelated demo changes out of every commit.
- Do not enable registry submit by default.
- Do not introduce SFT/NFT Agent ownership.
- Do not expose registration-code-derived fields in registry events.
- Do not claim Sui signature verification is production-ready unless the actual verification path is implemented and tested.
- Prefer dependency injection for registry submitter and wallet signing tests.
