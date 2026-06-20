# Agent Arena Registry And Credential Rotation Design

## Goal

Ship the smallest useful MVP that fixes two current gaps:

1. Agent Arena has platform signing and execution records, but no Agent Arena contract write path.
2. A shown-once Agent runtime credential cannot be recovered if the owner closes the page before handing it to the Agent.

The MVP adds a proof-only Sui Move registry and an owner-authorized runtime credential rotation API. It does not introduce SFT, NFT, transferable Agent ownership, onchain custody, or onchain trading-wallet control.

## Context

The existing platform flow is:

```text
Agent calls POST /api/arena/agent/init
Owner opens /agent-arena/claim/:registrationCode
Owner signs claim message
Backend creates Agent, binds platform-managed Testnet trading wallet, and returns shown-once runtime credential
Agent submits intents with x-agent-arena-agent-token
Backend validates, signs, executes, records, and scores
```

Current docs already define `agent_arena::registry` as proof and attribution only. The backend remains responsible for API authentication, private-key custody, risk checks, DeepBook Predict transaction signing, replay, and scoring. Current docs also list runtime credential rotation as an owner-only control, but the route is not implemented.

## Non-Goals

- No SFT or NFT ownership token in this phase.
- No transferable Agent ownership.
- No onchain custody of Testnet SUI, DUSDC, Predict positions, or trading-wallet private keys.
- No onchain authorization for Agent runtime intents.
- No browser exposure of platform wallet private keys, internal Predict routes, or internal tokens.
- No claim that Twitter handles are verified.
- No Mainnet support.

## Recommended Approach

Use a backend-first contract anchoring model:

- Add a simple Move package under `agent-arena/contracts`.
- Publish a shared `Registry` object with a package-embedded Ed25519 authority public key.
- Allow only backend-signed authorization payloads to write registry facts in MVP.
- On owner claim, the backend calls the registry to anchor the Agent owner and trading-wallet binding.
- On credential rotation, the backend validates owner authorization, invalidates old runtime credentials for that Agent, creates a new shown-once credential, and optionally anchors a credential-rotation fact that contains no token material.

This gives us a real contract path and credential recovery without expanding the product into transferable onchain Agent ownership.

## Contract Design

### Package

Create a Move package:

```text
agent-arena/contracts/agent_arena/
  Move.toml
  sources/registry.move
```

### Module

Module name:

```move
agent_arena::registry
```

### Objects

`Registry Authority`

- Backend-held Ed25519 private key.
- Public key is embedded in `agent_arena::registry`.
- Signs BCS-encoded authorization payload hashes that include a domain string, registry object id, transition fields, and nonce.

`Registry`

- Shared object created at package initialization.
- Stores a monotonic `version`.
- Increments `version` for each emitted registry fact.
- Stores the set of registered `agent_id` values to reject duplicate `register_agent` calls.
- Stores the registered owner for each `agent_id`.
- Stores the first bound trading wallet for each Agent in MVP.
- Stores consumed authorization hashes for replay protection.
- Does not store private keys, runtime credential tokens, raw registration codes, or user funds.

### Events

`AgentRegistered`

Fields:

- `version`
- `agent_id`
- `owner`
- `metadata_hash`

`TradingWalletBound`

Fields:

- `version`
- `agent_id`
- `owner`
- `wallet`

`RuntimeCredentialRotated`

Fields:

- `version`
- `agent_id`
- `owner`
- `previous_version`
- `next_version`
- `rotation_hash`

No event may include the raw runtime credential, raw registration code, registration-code hash, wallet private key, owner signature, or platform internal token. Registration-code-derived material stays backend-local because registration codes are short bootstrap secrets and public hashes can be brute-forced.

### Entry Functions

`register_agent`

Inputs:

- `&mut Registry`
- `agent_id: vector<u8>`
- `owner: address`
- `trading_wallet: address`
- `metadata_hash: vector<u8>`
- `nonce: vector<u8>`
- `sig: vector<u8>`

Behavior:

- Verifies the backend authority signature over `domain + registry object id + agent_id + owner + trading_wallet + metadata_hash + nonce`.
- Rejects if the authorization hash was already consumed.
- Rejects if `agent_id` has already been registered.
- Increments `Registry.version` and emits `AgentRegistered`.
- Increments `Registry.version` and emits `TradingWalletBound`.
- Does not create an ownership token.

`bind_trading_wallet`

Not a separate MVP entry function. The initial platform-managed trading wallet is recorded by `register_agent`; wallet replacement is deferred until a separate owner-maintenance design covers custody, balances, PredictManager ownership, and open exposure handling.

`record_runtime_credential_rotation`

Inputs:

- `&mut Registry`
- `agent_id: vector<u8>`
- `owner: address`
- `previous_version: u64`
- `next_version: u64`
- `rotation_hash: vector<u8>`
- `nonce: vector<u8>`
- `sig: vector<u8>`

Behavior:

- Verifies the backend authority signature over `domain + registry object id + agent_id + owner + previous_version + next_version + rotation_hash + nonce`.
- Rejects if the authorization hash was already consumed.
- Rejects if the Agent is not registered.
- Rejects if `owner` does not match the owner registered for `agent_id`.
- Rejects if `next_version != previous_version + 1`.
- Increments `Registry.version`.
- Emits `RuntimeCredentialRotated`.
- Does not prove the new credential value. It proves that the platform recorded a rotation for that Agent and owner.

The `platform_*_at_ms` fields are backend assertions, not Sui consensus time. Event consumers must treat them as platform-reported timestamps. A later contract version may also include `Clock`-derived chain observation time, but that is not required for this MVP proof path.

## Backend Design

### Config

Add backend config for:

- `AGENT_ARENA_REGISTRY_PACKAGE_ID`
- `AGENT_ARENA_REGISTRY_OBJECT_ID`
- `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY`
- `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT`
- `AGENT_ARENA_SUI_NETWORK`
- `AGENT_ARENA_SIGNING_DOMAIN`

Registry submit must be disabled by default. When disabled, backend operations still succeed and record a local `registryStatus: "skipped"` or `registryStatus: "disabled"` fact.

When registry submit is enabled, startup and submit-time validation must require `AGENT_ARENA_SUI_NETWORK=testnet`. The adapter must reject Mainnet, devnet, localnet, or unknown network config before building or submitting a transaction. Tests must prove registry submit cannot start or execute against non-Testnet config.

`AGENT_ARENA_SIGNING_DOMAIN` is the configured audience for owner-signed messages. Production should use `arena.mindfrog.xyz`; local and preview deployments may use their own configured value. Signature validation must compare the signed `domain` field to this configured value.

### Registry Adapter

Add a contained backend adapter that can:

- Build PTBs for `register_agent` and `record_runtime_credential_rotation`.
- BCS-serialize authorization payloads with `domain + registry object id + transition fields + nonce`.
- Sign `keccak256(payload)` with `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY`.
- Submit only when `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true`.
- Refuse to submit unless the configured Sui network is Testnet.
- Return structured results:
  - `status: "submitted" | "confirmed" | "failed" | "disabled" | "skipped"`
  - `txDigest`
  - `errorCode`
  - `errorMessage`

Registry write failures must not leak private key material or raw request bodies.

### Claim Integration

After `POST /api/arena/owner/agents/claim` creates the Agent, binds the trading wallet, stores identity binding, and creates the shown-once runtime credential:

1. Build registry metadata from existing backend records.
2. Submit or skip `register_agent` without public registration-code-derived fields.
3. Store registry result on the identity binding or ledger row.
4. Include a small registry summary in the claim response:

```json
{
  "registry": {
    "status": "confirmed",
    "txDigest": "0x..."
  }
}
```

The runtime credential remains shown once. Registry failure must not block claim in MVP unless an operator explicitly enables a future strict mode.

### Credential Rotation API

Add an owner-only endpoint:

```text
POST /api/arena/owner/agents/:agentId/runtime-credential/rotate
```

Request body:

```json
{
  "ownerAddress": "0xowner",
  "signature": "0xsignedRotationMessage",
  "message": "Agent Arena credential rotation...",
  "nonce": "rotation_nonce_01",
  "expiresAt": "2026-06-20T12:15:00.000Z",
  "reason": "lost_credential"
}
```

Backend requirements:

1. Validate `agentId` exists.
2. Validate `ownerAddress` matches the Agent's current owner address.
3. Validate the owner signature over a deterministic rotation message using Sui personal-message verification in real mode.
4. Reject Agent runtime-token-only requests.
5. Verify the backend-issued nonce exists, is unexpired, is scoped to this Agent and owner, and has not been consumed.
6. Revoke or invalidate all previous runtime credentials for that Agent.
7. Create a new runtime credential with incremented `credentialVersion`.
8. Store only a hash of the new credential in persistent storage.
9. Record a local performance ledger or security audit row.
10. Consume the nonce.
11. Submit or skip `record_runtime_credential_rotation`.
12. Return the new credential exactly once.

The signed rotation message must bind the request to the Agent, deployment, route purpose, nonce, expiry, and next credential version so an old signature cannot be replayed after a successful rotation or reused across environments. The frontend must fetch a rotation challenge before asking the owner wallet to sign.

Challenge endpoint:

```text
POST /api/arena/owner/agents/:agentId/runtime-credential/rotation-challenge
```

Challenge request body:

```json
{
  "ownerAddress": "0xowner",
  "reason": "lost_credential"
}
```

Challenge response:

```json
{
  "agentId": "agent_01",
  "ownerAddress": "0xowner",
  "reason": "lost_credential",
  "domain": "arena.mindfrog.xyz",
  "currentCredentialVersion": 1,
  "nextCredentialVersion": 2,
  "nonce": "rotation_nonce_01",
  "expiresAt": "2026-06-20T12:15:00.000Z",
  "message": "Agent Arena Credential Rotation\n..."
}
```

Canonical message shape:

```text
Agent Arena Credential Rotation
domain: arena.mindfrog.xyz
chainId: testnet
route: POST /api/arena/owner/agents/agent_01/runtime-credential/rotate
agentId: agent_01
ownerAddress: 0xowner
currentCredentialVersion: 1
nextCredentialVersion: 2
nonce: rotation_nonce_01
expiresAt: 2026-06-20T12:15:00.000Z
reason: lost_credential
```

The `domain` value above is illustrative; implementations must use the configured `AGENT_ARENA_SIGNING_DOMAIN`.

Backend validation must reject the request if `currentCredentialVersion` does not match the stored Agent credential version, if `nextCredentialVersion` is not exactly `current + 1`, if the nonce is missing, expired, already consumed, or scoped to another Agent/owner, if the submitted `reason` differs from the challenge record, if the signed `domain` differs from `AGENT_ARENA_SIGNING_DOMAIN`, or if `chainId` is not `testnet`. Mock non-empty-signature behavior is allowed only when the backend is explicitly in mock runtime mode. Real mode must fail closed unless Sui signature verification succeeds.

Response body:

```json
{
  "agent": {
    "id": "agent_01",
    "ownerAddress": "0xowner",
    "runtimeStatus": "active"
  },
  "runtimeCredential": {
    "token": "agent_runtime_new_token",
    "shownOnce": true,
    "credentialVersion": 2,
    "scopes": ["agent:read", "agent:intent:write", "competition:read", "execution:read"]
  },
  "registry": {
    "status": "confirmed",
    "txDigest": "0x..."
  }
}
```

Error cases:

- `AGENT_NOT_FOUND`
- `OWNER_MISMATCH`
- `INVALID_OWNER_SIGNATURE`
- `ROTATION_NONCE_INVALID`
- `ROTATION_VERSION_CONFLICT`
- `UNSUPPORTED_NETWORK`
- `ROTATION_DISABLED`

Registry failure after token rotation commits returns HTTP success with `registry.status: "failed"` in MVP. `REGISTRY_WRITE_FAILED` is reserved for a future strict registry mode and should not be returned by the default MVP rotation route after the credential transaction commits.

### Credential Store Changes

The store needs Agent-scoped credential invalidation:

- `listRuntimeCredentialsByAgentId(agentId)`
- `revokeRuntimeCredentialsForAgent(agentId, revokedAt, reason)`
- `saveRuntimeCredential(credential)` with `credentialVersion`
- `rotateRuntimeCredentialForAgent(agentId, expectedCurrentVersion, newCredential, auditRow, consumedNonce)` as a single transactional operation.

Authentication must reject revoked credentials.

Persistent SQLite snapshots must continue to store credential hashes rather than raw tokens.

Rotation must be atomic inside the platform store. The store must verify the current credential version, revoke old active credentials, insert the new hashed credential, increment the Agent credential version, write the audit row, consume the nonce, and commit as one transaction. Concurrent rotation requests must produce exactly one successful rotation; the loser must receive `ROTATION_VERSION_CONFLICT` or `ROTATION_NONCE_INVALID`. Registry submission happens after the local transaction commits and is recorded as a substatus, so a chain write failure cannot roll back or duplicate the credential rotation.

## Frontend Design

Frontend changes stay small.

Claim page:

- Continue showing the runtime credential once.
- Add optional registry status and tx digest when present.
- Keep `Copy Agent handoff`.

Owner profile or Agent profile area:

- Add a compact owner-only `Rotate runtime credential` action.
- Require connected wallet.
- Show a warning that the old Agent handoff stops working.
- On success, display the new token once and offer `Copy Agent handoff`.
- Do not add SFT/NFT controls.
- Do not show old token history.

If there is no connected owner wallet or the wallet does not match the Agent owner, hide or disable the action.

## Security Rules

- Runtime credentials are machine credentials for Agents, not owner credentials.
- Agent runtime credentials cannot rotate credentials.
- Owner rotation uses owner wallet authorization, not the old Agent token.
- Registry events must never include runtime credentials, private keys, raw registration codes, registration-code hashes, or signatures.
- Registry proof does not grant custody or signing rights.
- The backend remains the source of truth for current owner binding during this MVP.
- All routes remain Testnet-only.

## Data Flow

### Claim With Registry

```text
Owner claim request
-> backend validates registration code and owner signature
-> backend creates Agent and managed trading wallet
-> backend creates shown-once runtime credential
-> backend records identity binding and ledger rows
-> backend submits or skips registry register_agent
-> backend returns Agent, wallet, shown-once credential, and registry summary
```

### Credential Rotation

```text
Owner clicks rotate
-> frontend requests a backend rotation challenge
-> frontend asks connected wallet to authorize the challenge message
-> backend verifies owner address, Sui signature, Testnet chain id, nonce, expiry, and credential version
-> backend atomically revokes old Agent credentials, creates a new shown-once runtime credential, consumes the nonce, and records local audit
-> backend records optional registry rotation event after the local transaction commits
-> frontend shows and copies new handoff once
```

## Testing

Contract tests:

- Package init creates shared `Registry`.
- Valid backend authority signature can emit `AgentRegistered` and `TradingWalletBound`.
- Valid backend authority signature can emit `RuntimeCredentialRotated`.
- Every emitted registry fact increments `Registry.version`.
- Duplicate `register_agent` calls for the same `agent_id` fail.
- Reusing the same authorization payload fails.
- Invalid signatures fail.
- Credential rotation proof with an owner different from the registered Agent owner fails.
- Credential rotation proof with a non-incrementing credential version fails.
- Events never contain forbidden secret fields or registration-code-derived fields.

Backend tests:

- Claim still succeeds when registry submit is disabled.
- Claim records registry result when adapter succeeds.
- Registry adapter rejects non-Testnet config when submit is enabled.
- Claim does not include raw private key material or internal tokens.
- Rotation challenge accepts a reason and returns a nonce, expiry, current version, next version, reason, configured signing domain, and canonical message.
- Rotate rejects missing Agent.
- Rotate rejects owner mismatch.
- Rotate rejects missing signature.
- Rotate rejects expired, consumed, or wrong-Agent nonce.
- Rotate rejects a reason that differs from the challenge record.
- Rotate rejects a signed domain that differs from `AGENT_ARENA_SIGNING_DOMAIN`.
- Rotate rejects credential version mismatch.
- Rotate returns a new shown-once credential.
- Old credential stops authenticating after rotation.
- New credential authenticates the same Agent.
- Rotation revokes old credentials, stores the new credential hash, increments the version, consumes the nonce, and records local audit in one transaction.
- Concurrent rotate requests produce one success and one `ROTATION_VERSION_CONFLICT` or `ROTATION_NONCE_INVALID`.
- Rotation records registry result as a substatus after the credential transaction commits.
- Registry failure after committed rotation returns success with `registry.status: "failed"`.
- Agent runtime token cannot call the rotation endpoint.

Frontend tests:

- Claim page still displays and copies runtime handoff.
- Claim page displays registry tx digest when present.
- Owner profile hides rotation action for non-owner wallet.
- Owner profile requests a rotation challenge before wallet signing.
- Owner profile rotation displays the new credential once.
- Copy handoff uses the new token after rotation.

## Rollout

1. Add Move package and local contract tests.
2. Add backend registry adapter with submit disabled by default.
3. Add credential revocation and rotation API.
4. Add frontend rotate action and registry summary display.
5. Update skill docs so Agents know a rejected credential means asking the owner to rotate or re-run pairing.
6. Deploy with registry submit disabled.
7. Publish Testnet registry package and set registry env vars.
8. Enable registry submit after claim and rotate smoke tests pass.

## Deferred Work

- SFT or NFT Agent ownership.
- Transferable Agent ownership.
- Onchain owner capability checks.
- Strict registry mode that blocks claim or rotation when registry writes fail.
- Mainnet deployment.
- Public explorer page for registry proofs.
