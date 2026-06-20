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
- Publish a shared `Registry` object and platform-owned `AdminCap`.
- Allow only the platform admin to write registry facts in MVP.
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

`AdminCap`

- Owned object minted at package initialization.
- Held by the platform operator wallet.
- Required for all registry writes in MVP.

`Registry`

- Shared object created at package initialization.
- Stores a monotonic `version`.
- Stores counters if needed for deterministic event sequencing.
- Does not store private keys, runtime credential tokens, raw registration codes, or user funds.

### Events

`AgentRegistered`

Fields:

- `version`
- `agent_id`
- `agent_draft_id`
- `registration_code_hash`
- `owner`
- `trading_wallet`
- `metadata_hash`
- `created_at_ms`

`TradingWalletBound`

Fields:

- `version`
- `agent_id`
- `owner`
- `trading_wallet`
- `predict_manager_id`
- `bound_at_ms`

`RuntimeCredentialRotated`

Fields:

- `version`
- `agent_id`
- `owner`
- `credential_version`
- `rotated_at_ms`
- `reason_hash`

No event may include the raw runtime credential, raw registration code, wallet private key, owner signature, or platform internal token.

### Entry Functions

`register_agent`

Inputs:

- `&AdminCap`
- `&mut Registry`
- `agent_id: vector<u8>`
- `agent_draft_id: vector<u8>`
- `registration_code_hash: vector<u8>`
- `owner: address`
- `trading_wallet: address`
- `metadata_hash: vector<u8>`
- `created_at_ms: u64`

Behavior:

- Emits `AgentRegistered`.
- May also emit `TradingWalletBound` if the first binding is known at claim time.
- Does not create an ownership token.

`bind_trading_wallet`

Inputs:

- `&AdminCap`
- `&mut Registry`
- `agent_id: vector<u8>`
- `owner: address`
- `trading_wallet: address`
- `predict_manager_id: option::Option<address>`
- `bound_at_ms: u64`

Behavior:

- Emits `TradingWalletBound`.
- Used after initial claim or after a future wallet replacement.

`record_runtime_credential_rotation`

Inputs:

- `&AdminCap`
- `&mut Registry`
- `agent_id: vector<u8>`
- `owner: address`
- `credential_version: u64`
- `reason_hash: vector<u8>`
- `rotated_at_ms: u64`

Behavior:

- Emits `RuntimeCredentialRotated`.
- Does not prove the new credential value. It proves that the platform recorded a rotation for that Agent and owner.

## Backend Design

### Config

Add backend config for:

- `AGENT_ARENA_REGISTRY_PACKAGE_ID`
- `AGENT_ARENA_REGISTRY_OBJECT_ID`
- `AGENT_ARENA_REGISTRY_ADMIN_CAP_ID`
- `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT`

Registry submit must be disabled by default. When disabled, backend operations still succeed and record a local `registryStatus: "skipped"` or `registryStatus: "disabled"` fact.

### Registry Adapter

Add a contained backend adapter that can:

- Build PTBs for `register_agent`, `bind_trading_wallet`, and `record_runtime_credential_rotation`.
- Submit only when `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true`.
- Return structured results:
  - `status: "submitted" | "confirmed" | "failed" | "disabled" | "skipped"`
  - `txDigest`
  - `errorCode`
  - `errorMessage`

Registry write failures must not leak private key material or raw request bodies.

### Claim Integration

After `POST /api/arena/owner/agents/claim` creates the Agent, binds the trading wallet, stores identity binding, and creates the shown-once runtime credential:

1. Build registry metadata from existing backend records.
2. Submit or skip `register_agent`.
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
  "reason": "lost_credential"
}
```

Backend requirements:

1. Validate `agentId` exists.
2. Validate `ownerAddress` matches the Agent's current owner address.
3. Validate the owner signature over a deterministic rotation message. Mock mode may keep the current non-empty signature rule, but the message format must be stable so live Sui signature verification can replace it.
4. Reject Agent runtime-token-only requests.
5. Revoke or invalidate all previous runtime credentials for that Agent.
6. Create a new runtime credential with incremented `credentialVersion`.
7. Store only a hash of the new credential in persistent storage.
8. Record a local performance ledger or security audit row.
9. Submit or skip `record_runtime_credential_rotation`.
10. Return the new credential exactly once.

The signed rotation message must bind the request to the Agent and the next credential version so an old signature cannot be replayed after a successful rotation. The frontend can construct this from the owner profile response once the backend exposes `credentialVersion`.

Canonical message shape:

```text
Agent Arena Credential Rotation
agentId: agent_01
ownerAddress: 0xowner
currentCredentialVersion: 1
nextCredentialVersion: 2
reason: lost_credential
```

Backend validation must reject the request if `currentCredentialVersion` does not match the stored Agent credential version or if `nextCredentialVersion` is not exactly `current + 1`.

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
- `REGISTRY_WRITE_FAILED`
- `ROTATION_DISABLED`

`REGISTRY_WRITE_FAILED` should not prevent token rotation in MVP unless strict registry mode is later added.

### Credential Store Changes

The store needs Agent-scoped credential invalidation:

- `listRuntimeCredentialsByAgentId(agentId)`
- `revokeRuntimeCredentialsForAgent(agentId, revokedAt, reason)`
- `saveRuntimeCredential(credential)` with `credentialVersion`

Authentication must reject revoked credentials.

Persistent SQLite snapshots must continue to store credential hashes rather than raw tokens.

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
- Registry events must never include runtime credentials, private keys, raw registration codes, or signatures.
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
-> frontend asks connected wallet to authorize deterministic rotation message
-> backend verifies owner address and signature
-> backend revokes old Agent credentials
-> backend creates new shown-once runtime credential
-> backend records local audit and optional registry rotation event
-> frontend shows and copies new handoff once
```

## Testing

Contract tests:

- Package init creates `Registry` and `AdminCap`.
- Admin can emit `AgentRegistered`.
- Admin can emit `TradingWalletBound`.
- Admin can emit `RuntimeCredentialRotated`.
- Non-admin calls fail.
- Events never contain forbidden secret fields.

Backend tests:

- Claim still succeeds when registry submit is disabled.
- Claim records registry result when adapter succeeds.
- Claim does not include raw private key material or internal tokens.
- Rotate rejects missing Agent.
- Rotate rejects owner mismatch.
- Rotate rejects missing signature.
- Rotate returns a new shown-once credential.
- Old credential stops authenticating after rotation.
- New credential authenticates the same Agent.
- Rotation records a local audit or ledger row.
- Rotation can record registry result.
- Agent runtime token cannot call the rotation endpoint.

Frontend tests:

- Claim page still displays and copies runtime handoff.
- Claim page displays registry tx digest when present.
- Owner profile hides rotation action for non-owner wallet.
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
