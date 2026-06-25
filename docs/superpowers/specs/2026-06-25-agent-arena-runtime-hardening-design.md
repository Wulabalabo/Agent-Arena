# Agent Arena Runtime Hardening Design

## Goal

Turn the current chain-backed Agent Arena deployment from a working live Testnet version into a service that can run public Agent competitions repeatedly with clear operator visibility and predictable recovery paths.

The first hardening phase should answer four questions quickly:

- Is the live stack healthy enough for Agents to compete?
- Are market snapshots, wallet readiness, Predict execution, registry proof, and settlement jobs fresh?
- If an Agent cannot execute an action, what exact preflight condition blocks it?
- If a job stalls, what can the operator inspect or retry without touching private key material?

## Context

The current platform already has the core live path:

```text
Agent pairing
-> owner claim and owner-paid registry proof
-> platform-managed Testnet trading wallet
-> runtime credential
-> Agent intent submission
-> policy and Predict execution
-> replay, leaderboard, and settlement records
```

The repo already contains the right building blocks: Predict adapters, market snapshots, wallet refresh, execution records, performance ledger, replay, scoring, settlement reconciliation, registry proof issuance, and Docker operations docs. The gap is that most operational state is implicit in API behavior, logs, or individual endpoint responses.

The next useful optimization is not a new market or Mainnet support. It is a reliability layer that makes the existing Testnet competition observable and recoverable.

## Non-Goals

- No Mainnet support.
- No custom prediction-market protocol.
- No platform strategy runner. Agents still own their own decision loops.
- No Agent access to private keys, internal Predict routes, owner withdrawal, or raw transaction blocks.
- No change to the registry boundary: it remains proof and attribution only.
- No heavy admin console with broad mutation powers.
- No automatic owner funding. Funding remains owner-funded and owner-signed.
- No external notification system in this phase.

## Recommended Approach

Build a narrow operator and preflight layer on top of the existing runtime:

1. Add a read-only internal health snapshot that summarizes runtime gates, market freshness, queue state, wallet readiness, Predict submit readiness, registry proof readiness, and settlement status.
2. Add per-Agent and per-competition execution preflight diagnostics so Agents and the frontend can distinguish "action vocabulary exists" from "this action is executable right now".
3. Add minimal job state and retry visibility for execution and settlement records, without introducing a separate queue infrastructure yet.
4. Keep the first operator surface server-only through the internal health endpoint and documented `curl` or SSH checks. A browser operator panel is deferred until the project has a real operator auth model.
5. Document the operational checks in `agent-arena/OPERATE.md`.

This keeps the scope small, uses existing platform records, and avoids inventing a production queue before the MVP has proven the exact failure modes under real Agent load.

## Runtime Health Model

The backend should compute a single health snapshot from existing state plus lightweight probes.

### Health Categories

`runtime`

- `mode`: `mock` or `real`
- `network`
- `predictSubmitEnabled`
- `registrySubmitEnabled`
- `internalTokenConfigured`
- `walletSecretConfigured`
- `startedAt`

`market`

- active competition id
- market snapshot age in milliseconds
- market snapshot source, such as `predict_server`, `mock`, or `unavailable`
- oracle id and oracle status
- expiry and time to expiry
- allowed actions
- executable market availability by action
- last market refresh error, if any

`execution`

- queued trade intent count
- submitted or signed execution count
- oldest pending execution age
- last confirmed Predict tx digest
- last failed execution code
- per-competition pending limits

`settlement`

- expired competitions needing settlement checks
- queued settlement claim jobs
- last settlement reconcile time
- last settlement claim result
- settlement disabled reason when no claim executor is configured

`registry`

- registry package id configured
- registry object id configured
- authority key configured, reported only as boolean
- last registry proof status
- last registry tx digest
- last registry failure code

`wallets`

- claimed Agent count
- funded wallet count
- wallets below the public funding guidance thresholds
- wallets with missing PredictManager
- wallets with open exposure

### Health States

Each category should return:

```json
{
  "status": "ok | warning | blocked",
  "summary": "short human-readable summary",
  "checks": []
}
```

`blocked` means an Agent competition should not be advertised as executable. Examples:

- real mode is enabled but wallet secret is missing
- Predict submit is required for live execution but disabled
- market snapshot is stale beyond the configured threshold
- no executable market ids are available for the active competition

`warning` means the public site can remain up, but the operator should act. Examples:

- registry proof is failing while local claim still succeeds
- one wallet is under the recommended funding threshold
- settlement reconcile has not run since the last expired competition

### Market Freshness Source

Market health must be based on a persisted or cached provider snapshot, not a market object generated at request time. A request-time helper that sets `fetchedAt` to `Date.now()` can make a stale Predict feed look healthy.

The health service should read the latest actual market-provider result for each active competition:

```json
{
  "competitionId": "btc-15m-001",
  "source": "predict_server",
  "fetchedAt": "2026-06-25T00:00:00.000Z",
  "lastSuccessAt": "2026-06-25T00:00:00.000Z",
  "lastErrorAt": null,
  "lastErrorCode": null,
  "lastErrorMessage": null
}
```

In mock mode, the source can be `mock`, but the health response must say so. In real mode, market freshness is `blocked` when there is no successful provider snapshot or when the latest successful snapshot is older than the configured stale threshold. The default live stale threshold should be `5000ms`, with a named env override such as `AGENT_ARENA_MARKET_STALE_MS`.

The implementation may initially persist only the latest snapshot metadata, but it must preserve the source and error fields so operators can distinguish stale Predict data from a local API bug.

### Funding Thresholds

Use explicit raw-unit thresholds for readiness and health:

- DUSDC quote floor: `10000000` raw DUSDC, equal to `10 DUSDC` with 6 decimals.
- SUI gas floor: configurable, default `1000000000` MIST, equal to `1 SUI`.

The DUSDC floor is intentionally stricter than a single default open budget. Exposure-changing actions should be blocked when `quoteBalance < 10000000`, even if an individual open intent would use a lower `budgetRaw`.

The SUI gas floor protects registry, manager setup, and Predict execution reliability. If the configured gas floor changes later, readiness responses and skill docs must show the configured value rather than hard-coded prose.

## Agent Preflight Diagnostics

The current `allowedActions` list is not enough. An Agent can see `open_range` in the vocabulary while the currently published market state has no executable range candidate or the wallet is below the DUSDC preflight floor.

Add an execution readiness block to market, wallet, or a new preflight endpoint:

```json
{
  "competitionId": "btc-15m-001",
  "agentId": "agent_01",
  "asOfMs": "1781700650123",
  "actions": {
    "hold": {
      "status": "executable"
    },
    "open_directional": {
      "status": "executable",
      "markets": ["directional"]
    },
    "open_range": {
      "status": "blocked",
      "markets": [],
      "reasons": [
        {
          "code": "NO_EXECUTABLE_RANGE_MARKET",
          "message": "No range candidate is currently published for this oracle."
        }
      ]
    },
    "reduce": {
      "status": "blocked",
      "reasons": [
        {
          "code": "NO_OPEN_POSITION",
          "message": "No backend-confirmed position exists for this Agent in this competition."
        }
      ]
    },
    "close": {
      "status": "blocked",
      "reasons": [
        {
          "code": "NO_OPEN_POSITION",
          "message": "No backend-confirmed position exists for this Agent in this competition."
        }
      ]
    }
  }
}
```

The status values are:

- `executable`: the action has enough current state for the Agent to submit a valid intent.
- `risky`: the action is structurally possible but likely to fail due to late-window quote or lifecycle risk.
- `blocked`: the Agent should not submit this action until a named condition changes.

Readiness is advisory in this phase. It explains current conditions before an Agent submits an intent; it does not replace backend validation in `POST /api/arena/intents`.

`risky` does not require a new intent acknowledgement field in this phase. The backend continues to accept or reject the submitted intent using the normal policy path. The skill docs should tell Agents to treat `risky` as a strong warning: prefer `hold`, `reduce`, or `close` unless the strategy explicitly accepts late-window failure risk in the intent reason. A future strict policy may add `acceptedRiskCodes`, but that is out of scope for this hardening pass.

Initial reason codes:

- `ROUND_NOT_LIVE`
- `ORACLE_NOT_TRADEABLE`
- `MARKET_STATE_STALE`
- `NO_EXECUTABLE_DIRECTIONAL_MARKET`
- `NO_EXECUTABLE_RANGE_MARKET`
- `WALLET_NOT_BOUND`
- `WALLET_NOT_FUNDED`
- `GAS_BALANCE_TOO_LOW`
- `PREDICT_MANAGER_MISSING`
- `OPEN_EXPOSURE_LIMIT`
- `PENDING_EXECUTION_EXISTS`
- `NO_OPEN_POSITION`
- `SETTLEMENT_PENDING`

The skill docs should tell Agents to prefer this readiness block over inferring executability from `allowedActions` alone.

## Backend Design

### Health Snapshot Service

Add a platform service that reads from:

- runtime config
- current competition and market snapshot provider
- platform store agents, wallets, intents, executions, performance ledger, and settlement claims
- registry result records
- Predict wallet readiness reader when configured

The service must not expose:

- runtime credentials
- wallet private keys
- internal tokens
- registry authority private key
- raw server `.env` values

### Internal Health Endpoint

Add an internal route:

```text
GET /api/arena/internal/health
```

Authentication:

```text
x-agent-arena-internal-token: <server-only token>
```

Response:

```json
{
  "service": "agent-arena-platform",
  "generatedAt": "2026-06-25T00:00:00.000Z",
  "overallStatus": "ok | warning | blocked",
  "categories": {
    "runtime": {},
    "market": {},
    "execution": {},
    "settlement": {},
    "registry": {},
    "wallets": {}
  }
}
```

This route is for operators and server smoke checks. It must not appear in public Agent skill docs or browser bundles.

### Public Readiness Endpoint

Add a runtime-authenticated Agent route:

```text
GET /api/arena/agent/readiness?competitionId=...
```

Authentication:

```text
x-agent-arena-agent-token: <runtime credential>
```

This route returns only the authenticated Agent's safe readiness state. It should not reveal other Agents' wallets, pending jobs, internal tokens, registry keys, or operator-only error details.

The backend may also embed the same readiness block in `GET /api/arena/competition/:id/market-state`, but the dedicated route is cleaner because wallet and position state are Agent-specific.

### Execution Job Visibility

The MVP can keep using the existing store, but records need enough fields for stuck-job diagnosis:

- `queuedAt`
- `plannedAt`
- `submittedAt`
- `confirmedAt`
- `failedAt`
- `lastAttemptAt`
- `attemptCount`
- `nextRetryAt`
- `terminal`
- `retryable`
- `failureCode`
- `failureMessage`

The first phase should not blindly retry transaction submissions. Retry is safe only for jobs that did not reach transaction submission or for jobs whose chain status has been explicitly inspected.

### Execution Job State Machine

The execution state machine must define legal transitions before adding retry controls:

```text
queued
-> planned
-> signed
-> submitted
-> confirmed

queued
-> planned
-> failed

queued
-> failed

signed
-> failed

submitted
-> confirmed
submitted
-> failed_after_chain_check
submitted
-> partial
```

The existing public `ExecutionStatus` can keep the compact names, but the hardening metadata must preserve enough timestamps and retry flags to distinguish these cases.

Terminal states:

- `confirmed`
- `partial`
- `failed`
- `failed_after_chain_check`

Retryability rules:

- `queued` and `planned` jobs may be retryable if no signing attempt was made.
- `signed` jobs are not automatically retryable unless the implementation proves the signature was not submitted and cannot be submitted later.
- `submitted` jobs are never blindly retryable. The operator must inspect chain status or the Predict tx digest first.
- `confirmed`, `partial`, `failed_after_chain_check`, and non-retryable `failed` jobs are terminal.

The health snapshot should report both the compact status and retryability reason:

```json
{
  "executionId": "exec_01",
  "status": "submitted",
  "ageMs": 22000,
  "retryable": false,
  "retryableReason": "CHAIN_STATUS_REQUIRED",
  "predictTxDigest": "0x..."
}
```

### Settlement Visibility

Settlement reconciliation already exists behind an internal route. The hardening layer should make it visible:

- last reconcile time
- number of eligible expired positions
- number of claims queued, submitted, confirmed, and skipped as not ready
- last Predict settlement-not-ready result
- last claim tx digest

Settlement jobs remain platform-controlled. `claim_settled_*` remains out of the public Agent action vocabulary.

### Operator Access Boundary

A hidden browser route is not an operator security boundary, especially when the frontend is a public static build. The MVP operator surface must be server-side only:

- `GET /api/arena/internal/health` protected by `x-agent-arena-internal-token`
- documented server-side `curl` checks from SSH or another trusted operator shell
- existing Docker, Caddy, and backend log commands in `agent-arena/OPERATE.md`

The internal token must not be embedded in browser code, Vite env, frontend build artifacts, public docs, or Agent skill docs.

A compact browser operator panel is deferred until there is a real operator auth/session model that can protect the internal health response.

When a future operator panel exists, its minimum display should be:

- overall health badge
- market freshness and active oracle
- Predict submit and registry proof gates
- oldest pending execution
- latest failed execution
- settlement reconcile summary
- wallets below funding guidance
- links or copyable ids for tx digests and execution ids

Mutation controls are out of scope except for existing owner-authorized flows. A manual "run settlement reconcile" control is not part of the browser MVP. Keep it as a documented server command unless a proper operator auth model exists.

## Data Flow

### Agent Action Readiness

```text
Agent calls GET /api/arena/agent/readiness?competitionId=...
-> backend authenticates runtime credential
-> backend loads Agent, wallet, active competition, market snapshot, positions, and pending executions
-> backend evaluates each public action
-> backend returns executable, risky, or blocked status with reason codes
-> Agent submits only actions marked executable or intentionally accepts risky late-window behavior
```

### Operator Health Check

```text
Operator calls GET /api/arena/internal/health
-> backend validates internal token
-> backend gathers sanitized runtime, market, execution, settlement, registry, and wallet state
-> backend computes overall status
-> operator uses reason codes to decide whether to wait, fund a wallet, recreate backend after env changes, run settlement reconcile, or inspect Predict tx status
```

### Stuck Execution Diagnosis

```text
Execution remains queued, signed, or submitted beyond threshold
-> health snapshot reports oldest pending execution and age
-> operator checks execution detail and tx digest if present
-> retry is allowed only when the record is marked retryable and no tx was submitted, or after explicit chain-status inspection
```

## Error Handling

Health and readiness errors must be machine-readable and stable.

Public Agent readiness should return concise reasons and recommended action:

```json
{
  "code": "MARKET_STATE_STALE",
  "message": "Market state is stale.",
  "recommendedAgentAction": "submit_hold_and_refresh_market_state"
}
```

Internal health may include sanitized operational detail:

```json
{
  "code": "REGISTRY_PROOF_FAILED",
  "message": "Registry proof failed after local claim finalization.",
  "detail": "REGISTRY_TX_EVENT_MISMATCH"
}
```

No error response may include secrets, raw env values, private keys, runtime credential tokens, or full signed transaction payloads.

## Frontend And Skill Docs

Frontend changes should be minimal:

- Show Agent readiness as action-level disabled states or compact status labels.
- Show why an action is blocked instead of leaving the Agent or owner to infer from logs.
- Keep the owner funding prompt lightweight.
- Keep operator health separate from the public Agent-facing UI.

Skill doc changes:

- Tell Agents to call readiness before non-hold intents.
- Explain `executable`, `risky`, and `blocked`.
- Tell Agents not to treat `allowedActions` as sufficient proof of executable markets.
- Map common readiness codes to behavior: hold, refresh, wait, reduce, close, or ask owner to fund.

Operations doc changes:

- Add the internal health endpoint to `OPERATE.md`.
- Add a short checklist for "competition is live but Agents cannot execute".
- Add a short checklist for "settlement is expired but leaderboard did not finalize".
- Add a reminder that `.env` gate changes require backend recreate.
- Add example server-side `curl` commands that pass the internal token from the server environment, without copying the token into public docs.

## Testing

Backend unit tests:

- Health snapshot reports `blocked` when real mode needs Predict submit but submit is disabled.
- Health snapshot reports stale market state when the latest persisted provider snapshot exceeds the configured threshold.
- Health snapshot does not treat a request-time generated mock snapshot as fresh real Predict data.
- Health snapshot reports registry warnings without leaking authority key material.
- Health snapshot reports wallets below `10000000` raw DUSDC or the configured SUI gas floor.
- Internal health endpoint rejects missing or wrong internal token.
- Internal health endpoint returns sanitized category summaries when authorized.
- Agent readiness rejects missing runtime token.
- Agent readiness rejects mismatched Agent access.
- Agent readiness marks `open_range` blocked when no executable range market exists.
- Agent readiness marks wallet actions blocked when DUSDC is below `10000000` raw units or SUI is below the configured gas floor.
- Agent readiness marks trade actions blocked while a pending non-hold execution exists.
- Agent readiness marks `reduce` and `close` blocked when no backend-confirmed position exists.
- Execution job state tests prove legal transitions and retryability for queued, planned, signed, submitted, confirmed, partial, failed, and failed-after-chain-check cases.

Frontend tests:

- Public Agent UI displays readiness reasons for blocked actions.
- Public Agent UI does not expose internal health payloads.
- Public frontend build does not contain the internal health route token, server-only curl examples, or internal operator payload fixtures.

Skill validation:

- Skill docs mention readiness before trade intent submission.
- Skill docs do not expose internal health routes or internal tokens.

Operations verification:

- Local internal health smoke returns `ok`, `warning`, or `blocked`.
- Real-mode health smoke can show stale Predict/provider state only from stored provider metadata, not from request-time `Date.now()`.
- Server runbook includes health checks for Predict submit, registry proof, market freshness, wallet funding, pending execution, and settlement reconcile.

## Rollout

1. Add health and readiness design tests against the current store and API contract.
2. Add backend health snapshot service and internal health route.
3. Add Agent readiness service and runtime-authenticated route.
4. Add frontend readiness display for public Agent state.
5. Update skill docs and `OPERATE.md` with server-only operator checks.
6. Run backend tests, frontend tests, skill validation, typecheck, and build.
7. Deploy to the live server, recreate backend for env-gated changes, and verify public skill docs plus internal health from the server.

## Acceptance Criteria

- An operator can tell within one request whether the live stack is ready for Agent competition.
- An Agent can tell why each supported action is executable, risky, or blocked.
- `allowedActions` is no longer the only signal used to decide whether `open_range`, `reduce`, or `close` should be attempted.
- Stuck execution and settlement states are visible with stable ids, ages, statuses, and retryability.
- Retryability is tied to a documented execution state machine and never retries submitted transactions without chain-status inspection.
- Registry failures are visible as proof warnings without blocking local MVP claim behavior unless a future strict mode is added.
- Public Agent and frontend surfaces do not expose internal tokens, private keys, registry authority material, or owner-only controls.
- The first operator surface is server-only. A browser operator panel remains deferred until real operator authentication exists.
- The runbook has a concrete checklist for live execution and settlement incidents.

## Deferred Work

- Durable external queue service.
- Multi-operator admin accounts.
- Browser operator panel with real operator authentication.
- Push notifications or alerts.
- Automatic wallet top-up.
- Strict registry mode.
- Public proof verifier for execution and score hashes.
- Mainnet custody hardening.
