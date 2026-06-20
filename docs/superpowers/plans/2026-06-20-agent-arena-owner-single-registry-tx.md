# Agent Arena Owner Single Registry Transaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace owner personal-message authorization plus backend registry submission with one owner wallet transaction that anchors the registry write and then unlocks the runtime credential.

**Architecture:** The backend prepares a registry authorization proof signed by the registry authority, but it does not submit a Sui transaction and does not issue a runtime credential at prepare time. The frontend builds a Sui transaction from that proof and asks the owner wallet to `signAndExecuteTransaction` once. The backend finalizes the claim or credential rotation only after verifying the owner-signed transaction digest and matching registry events.

**Tech Stack:** Sui Move, `@mysten/sui`, `@mysten/dapp-kit-react`, Bun backend tests, Vitest frontend tests, SQLite-backed platform store.

---

## File Structure

- Modify `agent-arena/contracts/agent_arena/sources/registry.move`
  - Add `ctx.sender() == owner` checks for registration and runtime credential rotation.
  - Keep authority signature verification and replay protection.
- Modify `agent-arena/contracts/agent_arena/tests/registry_tests.move`
  - Add sender mismatch coverage.
  - Update test contexts/signature fixtures if the sender-aware context changes the registry id used in the signed payload.
- Modify `agent-arena/apps/backend/src/platform/registry.ts`
  - Replace submitter-centric service types with proof issuance and tx verification types.
  - Keep Testnet-only and config validation.
- Modify `agent-arena/apps/backend/src/platform/registry-submitter.ts`
  - Convert this file into pure registry authorization helpers, or split helpers into `registry-authorization.ts` and leave a thin compatibility export.
  - Remove backend `signAndExecuteTransaction` use for registry writes.
- Create `agent-arena/apps/backend/src/platform/registry-verifier.ts`
  - Verify tx digest, sender, success status, package/module/function, and matching registry events.
- Modify `agent-arena/apps/backend/src/platform/types.ts`
  - Add `PendingAgentClaim`, `RegistryAuthorizationProof`, and tx-finalization response types.
- Modify `agent-arena/apps/backend/src/platform/mock-store.ts`
  - Persist pending claims and expose idempotent prepare/finalize helpers.
- Modify `agent-arena/apps/backend/src/platform/sqlite-store.ts`
  - Persist pending claims in the existing JSON snapshot.
- Modify `agent-arena/apps/backend/src/platform/api.ts`
  - Add claim prepare/finalize endpoints.
  - Change rotation from personal-message signature to registry tx prepare/finalize.
- Modify `agent-arena/apps/backend/src/server.ts`
  - Wire registry authority proof service and verifier, not a backend tx submitter.
- Modify backend tests:
  - `agent-arena/apps/backend/src/platform/api.test.ts`
  - `agent-arena/apps/backend/src/platform/registry.test.ts`
  - `agent-arena/apps/backend/src/platform/registry-submitter.test.ts`
- Modify frontend types/client:
  - `agent-arena/apps/frontend/src/features/platform/types.ts`
  - `agent-arena/apps/frontend/src/features/platform/client.ts`
  - `agent-arena/apps/frontend/src/features/platform/client.test.ts`
- Create `agent-arena/apps/frontend/src/features/platform/registry-transaction.ts`
  - Build owner-signed Sui transactions from backend proofs.
- Create `agent-arena/apps/frontend/src/features/platform/registry-transaction.test.ts`
  - Verify transaction targets and argument ordering.
- Modify frontend UI:
  - `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`
  - `agent-arena/apps/frontend/src/components/platform/SuiDappKitAgentClaimPanel.tsx`
  - `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`
  - `agent-arena/apps/frontend/src/App.tsx`
- Modify frontend tests:
  - `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`
  - `agent-arena/apps/frontend/src/components/platform/SuiDappKitAgentClaimPanel.test.tsx`
  - `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.test.tsx`
  - `agent-arena/apps/frontend/src/App.test.tsx`
- Modify deployment docs/env:
  - `agent-arena/.env.production.example`
  - `agent-arena/apps/backend/.env.example`
  - `agent-arena/OPERATE.md`
  - local ignored `agent-arena/.env` if production config should be updated after implementation.

---

## Endpoint Design

### Claim

`POST /api/arena/owner/agents/claim/prepare`

Request:

```json
{
  "registrationCode": "PAIR-2049",
  "ownerAddress": "0xowner",
  "twitterHandle": "@owner"
}
```

Response:

```json
{
  "pendingClaimId": "pending_claim_1",
  "agent": {
    "id": "agent_1",
    "displayName": "Trend Ranger",
    "ownerAddress": "0xowner"
  },
  "tradingWallet": {
    "id": "wallet_internal_001",
    "agentId": "agent_1",
    "address": "0xclaimedwallet",
    "status": "active",
    "testnetSuiBalance": "0",
    "quoteBalance": "0",
    "predictManagerStatus": "missing",
    "predictManagerId": null
  },
  "registryProof": {
    "kind": "register_agent",
    "packageId": "0x...",
    "registryObjectId": "0x...",
    "agentId": "agent_1",
    "ownerAddress": "0xowner",
    "tradingWalletAddress": "0xclaimedwallet",
    "metadataHash": "sha256:...",
    "nonceBase64": "...",
    "signatureBase64": "..."
  }
}
```

`POST /api/arena/owner/agents/claim/finalize`

Request:

```json
{
  "pendingClaimId": "pending_claim_1",
  "txDigest": "0xregistrydigest"
}
```

Response:

```json
{
  "agent": { "id": "agent_1" },
  "tradingWallet": { "id": "wallet_internal_001" },
  "runtimeCredential": {
    "token": "agent_runtime_...",
    "shownOnce": true,
    "credentialVersion": 1,
    "scopes": ["agent:read", "agent:intent:write", "competition:read", "execution:read"]
  },
  "registry": {
    "status": "submitted",
    "txDigest": "0xregistrydigest"
  }
}
```

### Runtime Credential Rotation

`POST /api/arena/owner/agents/:id/runtime-credential/rotation-prepare`

Request:

```json
{
  "ownerAddress": "0xowner",
  "reason": "owner requested runtime credential rotation"
}
```

Response:

```json
{
  "challenge": {
    "agentId": "agent_1",
    "ownerAddress": "0xowner",
    "reason": "owner requested runtime credential rotation",
    "domain": "agent-arena-runtime-credential-rotation:v1",
    "chainId": "sui:testnet",
    "currentCredentialVersion": 1,
    "nextCredentialVersion": 2,
    "nonce": "rotation_nonce",
    "expiresAt": "2026-06-20T00:10:00.000Z",
    "message": "Agent Arena runtime credential rotation..."
  },
  "registryProof": {
    "kind": "record_runtime_credential_rotation",
    "packageId": "0x...",
    "registryObjectId": "0x...",
    "agentId": "agent_1",
    "ownerAddress": "0xowner",
    "previousCredentialVersion": 1,
    "nextCredentialVersion": 2,
    "rotationHash": "sha256:...",
    "nonceBase64": "...",
    "signatureBase64": "..."
  }
}
```

`POST /api/arena/owner/agents/:id/runtime-credential/rotate`

Request:

```json
{
  "ownerAddress": "0xowner",
  "nonce": "rotation_nonce",
  "txDigest": "0xregistrydigest"
}
```

Response stays:

```json
{
  "runtimeCredential": {
    "token": "agent_runtime_...",
    "shownOnce": true,
    "credentialVersion": 2,
    "scopes": ["agent:read", "agent:intent:write", "competition:read", "execution:read"]
  },
  "registry": {
    "status": "submitted",
    "txDigest": "0xregistrydigest"
  }
}
```

---

## Task 1: Contract Sender Enforcement

**Files:**
- Modify: `agent-arena/contracts/agent_arena/sources/registry.move`
- Modify: `agent-arena/contracts/agent_arena/tests/registry_tests.move`

- [ ] **Step 1: Add failing Move tests for wrong sender**

Add this constant and tests in `registry_tests.move`:

```move
const E_SENDER_MISMATCH: u64 = 7;

#[test, expected_failure(abort_code = E_SENDER_MISMATCH, location = agent_arena::registry)]
fun test_register_agent_requires_owner_sender() {
    let ctx = &mut tx_context::dummy();
    let mut registry = registry::new_for_testing(ctx);

    registry::register_agent(
        &mut registry,
        agent_id(),
        OWNER,
        WALLET,
        metadata_hash(),
        register_nonce_1(),
        register_sig_1(),
        ctx
    );

    registry::destroy_for_testing(registry);
}

#[test, expected_failure(abort_code = E_SENDER_MISMATCH, location = agent_arena::registry)]
fun test_rotation_requires_owner_sender() {
    let ctx = &mut tx_context::dummy();
    let mut registry = registry::new_for_testing(ctx);

    registry::record_runtime_credential_rotation(
        &mut registry,
        agent_id(),
        OWNER,
        1,
        2,
        rotation_hash(),
        rotation_nonce_1(),
        rotation_sig_1(),
        ctx
    );

    registry::destroy_for_testing(registry);
}
```

- [ ] **Step 2: Run Move tests and confirm failure before implementation**

Run:

```powershell
sui move test --path agent-arena/contracts/agent_arena
```

Expected: the new tests fail because the contract does not yet abort on non-owner `ctx.sender()`.

- [ ] **Step 3: Add sender checks in the contract**

In `registry.move`, add:

```move
const E_SENDER_MISMATCH: u64 = 7;
```

Change both public entry functions to use `ctx`:

```move
public fun register_agent(
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    wallet: address,
    metadata_hash: vector<u8>,
    nonce: vector<u8>,
    sig: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == owner, E_SENDER_MISMATCH);
    verify_register_agent_authorization(
        registry,
        agent_id,
        owner,
        wallet,
        metadata_hash,
        nonce,
        &sig,
    );
    /* existing body continues unchanged */
}
```

```move
public fun record_runtime_credential_rotation(
    registry: &mut Registry,
    agent_id: vector<u8>,
    owner: address,
    previous_version: u64,
    next_version: u64,
    rotation_hash: vector<u8>,
    nonce: vector<u8>,
    sig: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == owner, E_SENDER_MISMATCH);
    verify_runtime_credential_rotation_authorization(
        registry,
        agent_id,
        owner,
        previous_version,
        next_version,
        rotation_hash,
        nonce,
        &sig,
    );
    /* existing body continues unchanged */
}
```

- [ ] **Step 4: Update successful tests to use an owner sender**

If `tx_context::dummy()` sender is not `OWNER`, add a test helper that creates the context with `OWNER` using the Sui Move test helper available in this project version. Use the same helper everywhere a success path needs owner sender. Keep wrong-sender tests on `tx_context::dummy()`.

- [ ] **Step 5: Regenerate signature fixtures if registry object ids changed**

Use the existing backend BCS/signing helper after Task 2 is implemented, or a one-off Bun script inside `agent-arena/apps/backend`, to sign these exact payloads:

```ts
const cases = [
  { kind: "register_agent", nonce: "register_nonce_1", ownerAddress: "0x00000000000000000000000000000000000000000000000000000000000a11ce" },
  { kind: "register_agent", nonce: "register_nonce_2", ownerAddress: "0x00000000000000000000000000000000000000000000000000000000000a11ce" },
  { kind: "record_runtime_credential_rotation", nonce: "rotation_nonce_1", ownerAddress: "0x00000000000000000000000000000000000000000000000000000000000a11ce" },
  { kind: "record_runtime_credential_rotation", nonce: "rotation_nonce_other_owner", ownerAddress: "0x0000000000000000000000000000000000000000000000000000000000000b0b" }
];
```

Expected: the Move tests use byte vectors generated from the same BCS struct definitions as production code.

- [ ] **Step 6: Run Move tests**

Run:

```powershell
sui move test --path agent-arena/contracts/agent_arena
```

Expected: all registry tests pass.

- [ ] **Step 7: Commit contract change**

```powershell
git add agent-arena/contracts/agent_arena/sources/registry.move agent-arena/contracts/agent_arena/tests/registry_tests.move
git commit -m "fix: require owner sender for registry writes"
```

---

## Task 2: Backend Registry Proof and Transaction Verifier

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/registry.ts`
- Modify or split: `agent-arena/apps/backend/src/platform/registry-submitter.ts`
- Create: `agent-arena/apps/backend/src/platform/registry-verifier.ts`
- Modify: `agent-arena/apps/backend/src/platform/registry.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/registry-submitter.test.ts`

- [ ] **Step 1: Write failing registry service tests**

Add tests that assert:

```ts
it("issues a register proof without submitting a backend transaction", async () => {
  const service = createRegistryService({
    enabled: true,
    network: "testnet",
    packageId: "0xpackage",
    registryObjectId: "0xregistry",
    authorityPrivateKey: TEST_AUTHORITY_PRIVATE_KEY
  });

  const proof = await service.createRegisterAgentProof(registerInput);

  expect(proof).toMatchObject({
    kind: "register_agent",
    packageId: "0xpackage",
    registryObjectId: "0xregistry",
    agentId: "agent_1",
    ownerAddress: "0xowner",
    tradingWalletAddress: "0xwallet",
    metadataHash: "sha256:metadata"
  });
  expect(proof.nonceBase64).toEqual(expect.any(String));
  expect(proof.signatureBase64).toEqual(expect.any(String));
});

it("fails closed when proof issuance is enabled without authority key", async () => {
  const service = createRegistryService({
    enabled: true,
    network: "testnet",
    packageId: "0xpackage",
    registryObjectId: "0xregistry"
  });

  await expect(service.createRegisterAgentProof(registerInput)).rejects.toThrow("REGISTRY_CONFIG_INCOMPLETE");
});
```

- [ ] **Step 2: Convert proof signing into pure helpers**

Keep the existing BCS definitions and expose this shape:

```ts
export interface RegistryAuthorizationProof {
  kind: RegistryWriteRequest["kind"];
  packageId: string;
  registryObjectId: string;
  agentId: string;
  ownerAddress: string;
  nonceBase64: string;
  signatureBase64: string;
}

export interface RegisterAgentRegistryProof extends RegistryAuthorizationProof {
  kind: "register_agent";
  tradingWalletAddress: string;
  metadataHash: string;
}

export interface RuntimeCredentialRotationRegistryProof extends RegistryAuthorizationProof {
  kind: "record_runtime_credential_rotation";
  previousCredentialVersion: number;
  nextCredentialVersion: number;
  rotationHash: string;
}
```

Use `Buffer.from(bytes).toString("base64")` for `nonceBase64` and `signatureBase64`.

- [ ] **Step 3: Remove backend registry tx submission**

Delete the `SuiJsonRpcClient.signAndExecuteTransaction` path from registry writes. `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY` must only sign authorization hashes.

- [ ] **Step 4: Add tx verifier tests**

In `registry-verifier.ts`, define:

```ts
export interface RegistryTransactionVerifier {
  verifyRegisterAgentTx(input: {
    txDigest: string;
    proof: RegisterAgentRegistryProof;
  }): Promise<void>;
  verifyRuntimeCredentialRotationTx(input: {
    txDigest: string;
    proof: RuntimeCredentialRotationRegistryProof;
  }): Promise<void>;
}
```

Tests must cover:

```ts
await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xok", proof })).resolves.toBeUndefined();
await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xfailed", proof })).rejects.toThrow("REGISTRY_TX_FAILED");
await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xwrong-sender", proof })).rejects.toThrow("REGISTRY_TX_SENDER_MISMATCH");
await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xwrong-event", proof })).rejects.toThrow("REGISTRY_TX_EVENT_MISMATCH");
```

- [ ] **Step 5: Implement Sui tx verification**

`registry-verifier.ts` should call `getTransactionBlock` with:

```ts
{
  digest: input.txDigest,
  options: {
    showEffects: true,
    showEvents: true,
    showInput: true
  }
}
```

Validation rules:

- `effects.status.status === "success"`
- transaction sender equals `proof.ownerAddress`
- at least one Move call target matches the expected function:
  - `${proof.packageId}::registry::register_agent`
  - `${proof.packageId}::registry::record_runtime_credential_rotation`
- event package/module/type matches:
  - `${proof.packageId}::registry::AgentRegistered`
  - `${proof.packageId}::registry::TradingWalletBound`
  - `${proof.packageId}::registry::RuntimeCredentialRotated`
- parsed event values match `agentId`, `ownerAddress`, wallet address, metadata hash, versions, and rotation hash.

- [ ] **Step 6: Run backend registry tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/registry.test.ts src/platform/registry-submitter.test.ts
```

Expected: all registry proof and verifier tests pass.

- [ ] **Step 7: Commit registry backend primitives**

```powershell
git add agent-arena/apps/backend/src/platform/registry.ts agent-arena/apps/backend/src/platform/registry-submitter.ts agent-arena/apps/backend/src/platform/registry-verifier.ts agent-arena/apps/backend/src/platform/registry.test.ts agent-arena/apps/backend/src/platform/registry-submitter.test.ts
git commit -m "refactor: issue registry proofs without backend gas"
```

---

## Task 3: Pending Claim Prepare and Finalize API

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/types.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/sqlite-store.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify: `agent-arena/apps/backend/src/server.ts`

- [ ] **Step 1: Add failing API tests for prepare/finalize**

Add tests with these expectations:

```ts
it("prepares an owner registry claim without issuing a runtime credential", async () => {
  const store = new PlatformMockStore();
  const verifierCalls: unknown[] = [];
  const fetch = createPlatformFetchHandler(store, {
    registryService: createTestRegistryProofService(),
    registryTransactionVerifier: createAcceptingVerifier(verifierCalls)
  });

  const draft = await initDraft(fetch, "Single Tx Agent");
  const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim/prepare", {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: "0xowner",
      twitterHandle: "@single_tx"
    })
  }));

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.pendingClaimId).toStartWith("pending_claim_");
  expect(body.registryProof.kind).toBe("register_agent");
  expect(body).not.toHaveProperty("runtimeCredential");
  expect(store.findLatestRuntimeCredentialByAgentId(body.agent.id)).toBeUndefined();
});

it("finalizes claim after verifying the owner registry tx", async () => {
  const store = new PlatformMockStore();
  const verifierCalls: unknown[] = [];
  const fetch = createPlatformFetchHandler(store, {
    registryService: createTestRegistryProofService(),
    registryTransactionVerifier: createAcceptingVerifier(verifierCalls)
  });

  const prepared = await prepareClaim(fetch);
  const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim/finalize", {
    method: "POST",
    body: JSON.stringify({
      pendingClaimId: prepared.pendingClaimId,
      txDigest: "0xregistrydigest"
    })
  }));

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.runtimeCredential.token).toStartWith("agent_runtime_");
  expect(body.registry).toEqual({ status: "submitted", txDigest: "0xregistrydigest" });
  expect(verifierCalls).toHaveLength(1);
});
```

Also add rejection tests:

- prepare rejects invalid or already claimed code.
- prepare is idempotent for the same `registrationCode + ownerAddress` and returns the same `pendingClaimId`.
- finalize rejects wrong digest verifier result.
- finalize does not issue a second credential for an already finalized pending claim.

- [ ] **Step 2: Add pending claim types**

In backend `types.ts`, add:

```ts
export interface PendingAgentClaim {
  id: string;
  status: "pending" | "finalized" | "expired";
  agentId: string;
  agentDraftId: string;
  registrationCodeHash: string;
  displayName: string;
  ownerAddress: string;
  twitterHandle: string | null;
  tradingWalletId: string;
  walletAddress: string;
  predictManagerId: string | null;
  metadataHash: string;
  registryProof: RegisterAgentRegistryProof;
  createdAt: string;
  expiresAt: string;
  finalizedAt: string | null;
  txDigest: string | null;
}
```

- [ ] **Step 3: Add store helpers**

Add methods:

```ts
createPendingAgentClaim(input: Omit<PendingAgentClaim, "id" | "status" | "createdAt" | "finalizedAt" | "txDigest">): PendingAgentClaim
findPendingAgentClaim(id: string): PendingAgentClaim | undefined
findPendingAgentClaimByDraftAndOwner(agentDraftId: string, ownerAddress: string): PendingAgentClaim | undefined
finalizePendingAgentClaim(id: string, txDigest: string, finalizedAt: string): PendingAgentClaim
```

`finalizePendingAgentClaim` only marks the pending record finalized. The API route creates the Agent, binds wallet, records ledger rows, and creates the runtime credential after tx verification succeeds.

- [ ] **Step 4: Implement prepare route**

Route:

```ts
if (request.method === "POST" && matchesRoute(route, ["owner", "agents", "claim", "prepare"])) {
  return await prepareAgentClaim(request, store, {
    agentWalletService: options.agentWalletService,
    now: options.now,
    registryService: options.registryService
  });
}
```

Prepare behavior:

- Validate `registrationCode`, `ownerAddress`, and optional `twitterHandle`.
- Reject missing or non-pending draft.
- If there is an existing pending claim for `draft.id + ownerAddress`, return it.
- Reserve `agentId` before wallet creation.
- Create the platform-managed trading wallet with that reserved `agentId`.
- Create metadata hash with agent id, draft id, display name, owner, twitter handle, wallet, and draft `createdAt`.
- Ask registry service for a register proof.
- Save pending claim.
- Return preview agent, trading wallet, and proof.
- Do not call `createAgentRuntimeCredential`.
- Do not call `markPairingDraftClaimed`.

- [ ] **Step 5: Implement finalize route**

Finalize behavior:

- Validate `pendingClaimId` and `txDigest`.
- Load pending claim.
- Reject expired pending claim.
- If already finalized, return the existing Agent plus a conflict error if no new credential can be shown again.
- Verify tx with `registryTransactionVerifier.verifyRegisterAgentTx({ txDigest, proof })`.
- Create the claimed Agent using the pending id's reserved `agentId`.
- Bind the pending trading wallet.
- Mark pairing draft claimed.
- Save identity binding.
- Record pairing and wallet_binding ledger rows with `txDigest`.
- Create runtime credential once.
- Return the same response shape as the old claim route.

- [ ] **Step 6: Keep old claim route explicitly legacy**

Keep `POST /api/arena/owner/agents/claim` for mock/manual local flows only when registry is disabled. When registry is enabled, return:

```json
{
  "error": {
    "code": "REGISTRY_TX_REQUIRED",
    "message": "Use claim prepare/finalize so the owner wallet signs the registry transaction."
  }
}
```

- [ ] **Step 7: Wire server options**

Add `registryTransactionVerifier` to `CreatePlatformFetchHandlerOptions`, and wire the real verifier from `server.ts` when registry is enabled.

- [ ] **Step 8: Run backend API tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/api.test.ts src/server.test.ts
```

Expected: claim prepare/finalize tests pass and legacy claim tests still pass when registry is disabled.

- [ ] **Step 9: Commit pending claim API**

```powershell
git add agent-arena/apps/backend/src/platform/types.ts agent-arena/apps/backend/src/platform/mock-store.ts agent-arena/apps/backend/src/platform/sqlite-store.ts agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/server.ts agent-arena/apps/backend/src/server.test.ts
git commit -m "feat: finalize owner claims from registry tx"
```

---

## Task 4: Runtime Credential Rotation Via Registry Transaction

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/api.ts`
- Modify: `agent-arena/apps/backend/src/platform/auth.ts`
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/types.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/client.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/client.test.ts`

- [ ] **Step 1: Add failing backend rotation tests**

Expected behavior:

```ts
it("prepares runtime credential rotation with a registry proof and no personal-message signature", async () => {
  const claimed = await claimAndFinalizeWithRegistry(fetch);
  const response = await fetch(new Request(
    `http://localhost/api/arena/owner/agents/${claimed.agent.id}/runtime-credential/rotation-prepare`,
    {
      method: "POST",
      body: JSON.stringify({
        ownerAddress: claimed.agent.ownerAddress,
        reason: "owner requested runtime credential rotation"
      })
    }
  ));

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.challenge.currentCredentialVersion).toBe(1);
  expect(body.registryProof.kind).toBe("record_runtime_credential_rotation");
  expect(body.registryProof.previousCredentialVersion).toBe(1);
  expect(body.registryProof.nextCredentialVersion).toBe(2);
});

it("rotates credential after verifying the owner registry tx", async () => {
  const prepared = await prepareRotation(fetch, agentId);
  const response = await fetch(new Request(
    `http://localhost/api/arena/owner/agents/${agentId}/runtime-credential/rotate`,
    {
      method: "POST",
      body: JSON.stringify({
        ownerAddress: prepared.challenge.ownerAddress,
        nonce: prepared.challenge.nonce,
        txDigest: "0xrotationdigest"
      })
    }
  ));

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.runtimeCredential.credentialVersion).toBe(2);
  expect(body.registry.txDigest).toBe("0xrotationdigest");
});
```

- [ ] **Step 2: Implement rotation prepare**

Add route:

```ts
POST /api/arena/owner/agents/:id/runtime-credential/rotation-prepare
```

It should reuse existing challenge creation, then generate a registry proof for:

```ts
{
  agentId,
  ownerAddress,
  previousCredentialVersion: currentCredential.credentialVersion,
  nextCredentialVersion: currentCredential.credentialVersion + 1,
  rotationHash,
  platformCreatedAtMs: nowMs
}
```

Save the proof or the proof hash on the challenge so finalize can verify the exact tx.

- [ ] **Step 3: Change rotate route to require txDigest**

When registry is enabled, `rotate` accepts `ownerAddress`, `nonce`, and `txDigest`. It does not require `signature`, `message`, `domain`, or `currentCredentialVersion` from the browser because those are already tied to the saved challenge and registry proof.

- [ ] **Step 4: Verify tx before rotating credential**

Call:

```ts
await options.registryTransactionVerifier.verifyRuntimeCredentialRotationTx({
  txDigest,
  proof: challenge.registryProof
});
```

Only after verification succeeds, call `store.rotateRuntimeCredentialForAgent`.

- [ ] **Step 5: Keep old personal-message rotation disabled in registry mode**

If registry is enabled and request body contains `signature` but no `txDigest`, return:

```json
{
  "error": {
    "code": "REGISTRY_TX_REQUIRED",
    "message": "Use registry transaction rotation so the owner wallet signs one Sui transaction."
  }
}
```

- [ ] **Step 6: Update frontend client types**

Update `RuntimeCredentialRotationChallenge` response to include `registryProof`, and change `rotateRuntimeCredential` input to:

```ts
{
  ownerAddress: string;
  nonce: string;
  txDigest: string;
}
```

- [ ] **Step 7: Run backend and frontend client tests**

Run:

```powershell
bun run --cwd agent-arena/apps/backend test src/platform/api.test.ts
bun run --cwd agent-arena/apps/frontend test src/features/platform/client.test.ts
```

Expected: rotation prepare/finalize uses registry tx digest and no personal-message signature.

- [ ] **Step 8: Commit rotation API**

```powershell
git add agent-arena/apps/backend/src/platform/api.ts agent-arena/apps/backend/src/platform/auth.ts agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/frontend/src/features/platform/types.ts agent-arena/apps/frontend/src/features/platform/client.ts agent-arena/apps/frontend/src/features/platform/client.test.ts
git commit -m "feat: rotate runtime credentials from registry tx"
```

---

## Task 5: Frontend Registry Transaction Builder and Claim UI

**Files:**
- Create: `agent-arena/apps/frontend/src/features/platform/registry-transaction.ts`
- Create: `agent-arena/apps/frontend/src/features/platform/registry-transaction.test.ts`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/SuiDappKitAgentClaimPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/SuiDappKitAgentClaimPanel.test.tsx`

- [ ] **Step 1: Add failing transaction builder tests**

Test cases:

```ts
it("builds a register_agent transaction from a backend proof", () => {
  const tx = buildRegistryTransaction(registerProof);
  expect(extractMoveTargetForTest(tx)).toBe(`${registerProof.packageId}::registry::register_agent`);
});

it("builds a record_runtime_credential_rotation transaction from a backend proof", () => {
  const tx = buildRegistryTransaction(rotationProof);
  expect(extractMoveTargetForTest(tx)).toBe(`${rotationProof.packageId}::registry::record_runtime_credential_rotation`);
});
```

- [ ] **Step 2: Implement transaction builder**

Use:

```ts
import { Transaction } from "@mysten/sui/transactions";
import type { RegistryAuthorizationProof } from "./types";

export function buildRegistryTransaction(proof: RegistryAuthorizationProof): Transaction {
  const tx = new Transaction();
  if (proof.kind === "register_agent") {
    tx.moveCall({
      target: `${proof.packageId}::registry::register_agent`,
      arguments: [
        tx.object(proof.registryObjectId),
        tx.pure.vector("u8", utf8Bytes(proof.agentId)),
        tx.pure.address(proof.ownerAddress),
        tx.pure.address(proof.tradingWalletAddress),
        tx.pure.vector("u8", utf8Bytes(proof.metadataHash)),
        tx.pure.vector("u8", base64Bytes(proof.nonceBase64)),
        tx.pure.vector("u8", base64Bytes(proof.signatureBase64))
      ]
    });
    return tx;
  }

  tx.moveCall({
    target: `${proof.packageId}::registry::record_runtime_credential_rotation`,
    arguments: [
      tx.object(proof.registryObjectId),
      tx.pure.vector("u8", utf8Bytes(proof.agentId)),
      tx.pure.address(proof.ownerAddress),
      tx.pure.u64(proof.previousCredentialVersion),
      tx.pure.u64(proof.nextCredentialVersion),
      tx.pure.vector("u8", utf8Bytes(proof.rotationHash)),
      tx.pure.vector("u8", base64Bytes(proof.nonceBase64)),
      tx.pure.vector("u8", base64Bytes(proof.signatureBase64))
    ]
  });
  return tx;
}
```

- [ ] **Step 3: Extend claim wallet provider**

Change provider type:

```ts
export interface ClaimWalletProvider {
  getAccounts?: () => Promise<ClaimWalletAccount[]> | ClaimWalletAccount[];
  signAndExecuteTransaction?: (input: { transaction: Transaction }) => Promise<{ digest?: string } | unknown>;
}
```

Remove claim use of `signPersonalMessage` for the Sui dAppKit path.

- [ ] **Step 4: Update claim UI flow**

State transitions:

- `idle`
- `preparing`
- `confirming`
- `finalizing`
- `claimed`
- `failed`

Submit flow:

```ts
const prepared = await client.prepareAgentClaim({ registrationCode, ownerAddress, twitterHandle });
const transaction = buildRegistryTransaction(prepared.registryProof);
const txResult = await provider.signAndExecuteTransaction({ transaction });
const txDigest = readTransactionDigest(txResult);
const result = await client.finalizeAgentClaim({ pendingClaimId: prepared.pendingClaimId, txDigest });
```

Button text:

- `preparing`: `Preparing claim`
- `confirming`: `Confirm in wallet`
- `finalizing`: `Finalizing claim`
- `claimed`: existing credential display

- [ ] **Step 5: Update Sui dAppKit adapter**

Use dAppKit:

```ts
signAndExecuteTransaction: async ({ transaction }) => await dAppKit.signAndExecuteTransaction({ transaction })
```

Keep `getAccounts` from `useCurrentAccount`.

- [ ] **Step 6: Update frontend claim tests**

Expect:

```ts
expect(dappKitState.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
expect(dappKitState.signPersonalMessage).not.toHaveBeenCalled();
expect(platformFetcher).toHaveBeenCalledWith(
  "http://127.0.0.1:8787/api/arena/owner/agents/claim/prepare",
  expect.any(Object)
);
expect(platformFetcher).toHaveBeenCalledWith(
  "http://127.0.0.1:8787/api/arena/owner/agents/claim/finalize",
  expect.any(Object)
);
```

- [ ] **Step 7: Run frontend claim tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/features/platform/registry-transaction.test.ts src/components/platform/AgentClaimPanel.test.tsx src/components/platform/SuiDappKitAgentClaimPanel.test.tsx
```

Expected: claim flow uses one wallet transaction and displays the runtime credential only after finalize.

- [ ] **Step 8: Commit frontend claim flow**

```powershell
git add agent-arena/apps/frontend/src/features/platform/registry-transaction.ts agent-arena/apps/frontend/src/features/platform/registry-transaction.test.ts agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx agent-arena/apps/frontend/src/components/platform/SuiDappKitAgentClaimPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx agent-arena/apps/frontend/src/components/platform/SuiDappKitAgentClaimPanel.test.tsx
git commit -m "feat: claim agent with one owner registry tx"
```

---

## Task 6: Frontend Runtime Credential Rotation UI

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.test.tsx`
- Modify: `agent-arena/apps/frontend/src/App.tsx`
- Modify: `agent-arena/apps/frontend/src/App.test.tsx`

- [ ] **Step 1: Add failing rotation UI tests**

Test:

```ts
it("rotates runtime credential with one registry transaction", async () => {
  const rotation = createRegistryTxRotationCallbacks();
  render(<UserAgentProfilePanel {...props} {...rotation} />);

  fireEvent.click(screen.getByRole("button", { name: /rotate runtime credential/i }));

  await waitFor(() => {
    expect(rotation.onPrepareRotation).toHaveBeenCalledTimes(1);
    expect(rotation.onSignAndExecuteRegistryTransaction).toHaveBeenCalledTimes(1);
    expect(rotation.onFinalizeRotation).toHaveBeenCalledTimes(1);
  });
  expect(rotation.onSignRuntimeCredentialRotationMessage).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Replace message signer props**

Use props:

```ts
onPrepareRuntimeCredentialRotation: (agentId: string, input: { ownerAddress: string; reason: string }) => Promise<RotationPrepareResponse>;
onFinalizeRuntimeCredentialRotation: (agentId: string, input: { ownerAddress: string; nonce: string; txDigest: string }) => Promise<RuntimeCredentialRotationResponse>;
onSignAndExecuteRegistryTransaction: (proof: RegistryAuthorizationProof) => Promise<string>;
```

- [ ] **Step 3: Implement rotation UI flow**

Flow:

```ts
const prepared = await onPrepareRuntimeCredentialRotation(profile.agentId, { ownerAddress, reason: rotationReason });
const txDigest = await onSignAndExecuteRegistryTransaction(prepared.registryProof);
const response = await onFinalizeRuntimeCredentialRotation(profile.agentId, {
  ownerAddress,
  nonce: prepared.challenge.nonce,
  txDigest
});
setRotatedCredential(response.runtimeCredential);
```

- [ ] **Step 4: Wire App to dAppKit signAndExecute**

In `WalletAwareApp`, create:

```ts
const dappKitRegistryTransactionSigner = useCallback(async (proof: RegistryAuthorizationProof) => {
  if (connection.status !== "connected") {
    throw new Error("Owner wallet is not connected");
  }
  const transaction = buildRegistryTransaction(proof);
  const result = await dAppKit.signAndExecuteTransaction({ transaction });
  const digest = readTransactionDigest(result);
  if (!digest) {
    throw new Error("Registry transaction digest is unavailable");
  }
  return digest;
}, [connection, dAppKit]);
```

Pass this into `ArenaPage` and then `UserAgentProfilePanel`.

- [ ] **Step 5: Run rotation UI tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test src/components/platform/UserAgentProfilePanel.test.tsx src/App.test.tsx
```

Expected: no rotation path calls personal-message signing.

- [ ] **Step 6: Commit rotation UI**

```powershell
git add agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.test.tsx agent-arena/apps/frontend/src/App.tsx agent-arena/apps/frontend/src/App.test.tsx
git commit -m "feat: rotate runtime credentials with owner registry tx"
```

---

## Task 7: Docs, Env, and Product Copy

**Files:**
- Modify: `agent-arena/.env.production.example`
- Modify: `agent-arena/apps/backend/.env.example`
- Modify: `agent-arena/OPERATE.md`
- Modify: `agent-arena/apps/frontend/src/components/arena/TestnetStatusPanel.tsx`
- Modify local ignored file if requested: `agent-arena/.env`

- [ ] **Step 1: Update env semantics**

Document:

```dotenv
AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true
AGENT_ARENA_REGISTRY_PACKAGE_ID=0x...
AGENT_ARENA_REGISTRY_OBJECT_ID=0x...
AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY=suiprivkey1...
```

Clarify:

- `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY` signs registry authorization hashes only.
- The authority address does not need Testnet SUI gas.
- Owner wallet pays gas for registry claim and rotation transactions.
- `AGENT_ARENA_WALLET_SECRET` still encrypts platform-managed Agent trading wallet private keys.

- [ ] **Step 2: Update copy that says no wallet transactions**

Replace copy like:

```tsx
<div>Uses the public Predict server and does not submit wallet transactions.</div>
```

with:

```tsx
<div>Owner wallet signs registry binding and credential rotation; Agent trading stays platform-managed on Testnet.</div>
```

- [ ] **Step 3: Update operation steps**

In `OPERATE.md`, add:

1. Deploy updated Move package.
2. Publish new registry object id.
3. Set package and registry env vars.
4. Set authority private key.
5. Confirm authority wallet needs no gas for registry writes.
6. Confirm owner wallet needs a small Testnet SUI balance for registry gas.
7. Recreate backend/frontend containers.

- [ ] **Step 4: Run docs-sensitive tests**

Run:

```powershell
bun run --cwd agent-arena validate:skills
bun run --cwd agent-arena/apps/frontend test src/components/arena/TestnetStatusPanel.test.tsx
```

Expected: skill docs validate and UI copy tests pass.

- [ ] **Step 5: Commit docs/env**

```powershell
git add agent-arena/.env.production.example agent-arena/apps/backend/.env.example agent-arena/OPERATE.md agent-arena/apps/frontend/src/components/arena/TestnetStatusPanel.tsx agent-arena/apps/frontend/src/components/arena/TestnetStatusPanel.test.tsx
git commit -m "docs: document owner-paid registry transactions"
```

---

## Task 8: Full Verification and Deployment Prep

**Files:**
- No code files unless verification reveals failures.

- [ ] **Step 1: Run backend tests**

```powershell
bun run --cwd agent-arena/apps/backend test
```

Expected: all backend tests pass.

- [ ] **Step 2: Run frontend tests**

```powershell
bun run --cwd agent-arena/apps/frontend test
```

Expected: all frontend tests pass.

- [ ] **Step 3: Run frontend typecheck/build**

```powershell
bun run --cwd agent-arena/apps/frontend typecheck
bun run --cwd agent-arena/apps/frontend build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Run Move tests**

```powershell
sui move test --path agent-arena/contracts/agent_arena
```

Expected: all Move tests pass.

- [ ] **Step 5: Validate compose config**

```powershell
docker compose --env-file agent-arena/.env -f agent-arena/docker-compose.yml config --quiet
```

Expected: compose config is valid.

- [ ] **Step 6: Redeploy contract**

Deploy the updated package and registry. Record:

```text
Package: 0x...
Registry: 0x...
Authority public key: 0x...
```

Expected: deployed contract has `ctx.sender() == owner` enforcement.

- [ ] **Step 7: Update production env**

Set:

```dotenv
AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true
AGENT_ARENA_REGISTRY_PACKAGE_ID=<new package>
AGENT_ARENA_REGISTRY_OBJECT_ID=<new registry>
AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY=<same server authority key matching contract PK>
```

- [ ] **Step 8: Manual smoke**

Use a Testnet owner wallet with gas:

1. Agent calls `POST /api/arena/agent/init`.
2. Owner opens `/agent-arena/claim/:code`.
3. Owner sees exactly one wallet transaction confirmation.
4. Backend finalizes and displays runtime credential.
5. Close browser.
6. Reopen Arena with same owner wallet.
7. Rotate runtime credential.
8. Owner sees exactly one wallet transaction confirmation.
9. Backend displays new runtime credential.

- [ ] **Step 9: Final commit if verification fixes were needed**

```powershell
git status --short
git add <only files changed by this task>
git commit -m "test: verify owner registry transaction flow"
```

---

## Risk Notes

- The owner will still need Testnet SUI for the registry transaction until sponsored transactions are added.
- `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY` remains required, but only for proof signing. It must not be used as a gas payer.
- `AGENT_ARENA_WALLET_SECRET` remains required when the backend creates and uses platform-managed Agent trading wallets.
- Prepare creates or reserves platform-managed wallet material before the owner tx is finalized. Pending claims must be idempotent and persisted so a page refresh can resume without creating another wallet.
- If the user closes the page after the wallet transaction succeeds but before finalize returns, recovery requires the tx digest. The frontend should save `pendingClaimId` and the returned digest in local storage before calling finalize.

---

## Self-Review

- Spec coverage:
  - Single wallet confirmation for owner claim: covered by Tasks 3 and 5.
  - Single wallet confirmation for credential refresh: covered by Tasks 4 and 6.
  - No backend gas payer for registry: covered by Task 2 and docs in Task 7.
  - Contract verifies owner is the transaction sender: covered by Task 1.
  - Runtime credential is issued only after registry tx verification: covered by Task 3.
  - Production env semantics: covered by Task 7.
- Placeholder scan:
  - No deferred implementation placeholders are left in task steps.
- Type consistency:
  - `RegistryAuthorizationProof` is the shared frontend/backend response shape.
  - Claim prepare/finalize and rotation prepare/finalize use the same proof and digest model.
