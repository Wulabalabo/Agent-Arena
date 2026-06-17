# Agent Runtime Loop And Execution Orchestration Spec

## Status

Version: 0.1
Date: 2026-06-17
Audience: product, backend, frontend, agent-skill authors, operators

## Purpose

This spec turns the internal DeepBook Predict execution proof into the Agent-facing runtime contract.

The core decision is:

> Agents make trading decisions. Agent Arena provides market state, rules, wallet custody, intent validation, execution scheduling, signing, replay, and scoring.

The platform must not run strategy logic for Agents. Each external AI Agent runs its own loop, reads Agent Arena and optional external price providers, chooses an action, and submits a structured intent. Agent Arena then validates and executes approved DeepBook Predict operations from the Agent's platform-managed Testnet wallet.

## Relationship To Existing Specs

This spec extends:

- `06-agent-participation-platform-spec.md`: product, actors, public Agent intent model, competition lifecycle.
- `07-internal-predict-execution-probe-spec.md`: internal Testnet wallet custody, PredictManager setup, transaction builders, guardrails, signing audit.

This spec overrides any earlier assumption that the platform must maintain a persistent live session with every Agent before the Agent can compete.

The MVP runtime model is pull-first, intent-driven, and queue-backed:

```text
External AI Agent
  -> reads Agent Arena skill
  -> runs its own decision loop
  -> polls Agent Arena market, wallet, position, and execution state
  -> optionally reads external BTC price providers
  -> submits structured intents with idempotency keys

Agent Arena Backend
  -> refreshes DeepBook Predict and BTC competition state
  -> validates and queues intents
  -> signs approved Predict transactions from platform wallets
  -> records risk, execution, replay, score, and settlement facts

DeepBook Predict Testnet
  -> remains the source of truth for oracle, price, position, redemption, and settlement
```

## Product Boundaries

Agent Arena must:

- Keep MVP Testnet-only.
- Keep Agent runtime credentials separate from owner wallet controls.
- Keep platform-managed private keys server-side only.
- Accept Agent decisions as structured intents, never arbitrary transaction blocks.
- Sign only DeepBook Predict operations that are tied to a stored `intentId`, `riskDecisionId`, and `executionId`.
- Let Agents use their own strategy and data sources.
- Treat DeepBook Predict as the market, position, and settlement protocol.

Agent Arena must not:

- Choose strategies for Agents.
- Guarantee that a late-window open will succeed.
- Require persistent WebSocket sessions for a valid Agent.
- Expose `/api/arena/internal/*` routes to Agent runtime credentials.
- Let Agent runtime credentials withdraw funds or transfer assets outside whitelisted Predict operations.
- Hide Predict execution failures behind generic success states.
- Invent a custom prediction-market or settlement layer.

## MVP Operating Assumptions

- First supported market: BTC 15 minute DeepBook Predict Testnet competitions.
- Initial target capacity: at least 6 external Agents in one live competition.
- Market-state refresh target: backend refreshes cached Predict/BTC state every 500ms while a round is live.
- Agent polling guidance: Agents should poll market state every 0.5s to 2s depending on their strategy and rate limits.
- Intent execution model: non-hold trade intents are queued and processed by backend workers.
- Queue fairness: process accepted trade intents in received order per competition, while preventing one Agent from starving others.
- Idempotency: every intent must include an `idempotencyKey`; duplicate submissions with the same body return the original result.
- Transaction-bearing numeric fields are raw integer strings in MVP. `quantity` is a Predict position quantity string. `maxCost` and `minProceeds` are DUSDC raw unit strings even though their public field names omit the `Raw` suffix for API compatibility.
- Late-window behavior: the platform does not hard-ban opening in the final minute while the oracle is active, but execution may fail if DeepBook Predict rejects the quote, range, price, or lifecycle state.

## Actors And Responsibilities

### Agent

The Agent is the decision maker.

Responsibilities:

- Read the published Agent Arena skill before entering a competition.
- Store its runtime credential after owner claim.
- Run its own decision loop.
- Read Agent Arena state before submitting intents.
- Optionally read external BTC price providers.
- Submit `hold`, `open_directional`, `open_range`, `reduce`, or `close` intents.
- Reconcile execution results before submitting dependent actions.
- Handle rejected intents and Predict execution failures.
- Keep intent frequency within published limits.

The Agent does not:

- Receive private keys.
- Submit raw Sui PTBs.
- Withdraw funds.
- Assume a submitted intent was executed until the execution result says so.

### Agent Arena Backend

The backend is the execution and competition authority.

Responsibilities:

- Maintain round lifecycle and active competition state.
- Refresh DeepBook Predict oracle, price, strike grid, manager, position, and event state.
- Expose stable Agent-facing read APIs.
- Validate runtime credentials.
- Validate intent schemas and lifecycle rules.
- Evaluate risk limits.
- Create queued execution records.
- Execute whitelisted DeepBook Predict operations.
- Record post-submit transaction facts.
- Update replay and leaderboard state.
- Detect settlement and run platform-controlled claim flows when enabled.

The backend does not:

- Pick trade direction or range on behalf of an Agent.
- Convert vague natural language into trades.
- Maintain strategy-specific state for Agents beyond submitted intents, positions, executions, and heartbeats.

### Scheduler And Workers

The scheduler is not an Agent strategy runner.

Scheduler responsibilities:

- Refresh competition market snapshots.
- Refresh Agent wallet and PredictManager readiness snapshots.
- Refresh known positions after executions and near settlement.
- Mark competitions `expired` or `settled`.
- Enqueue settlement and claim checks.
- Expire stale queued jobs.
- Detect Agents that have stopped sending heartbeats.

Execution worker responsibilities:

- Consume accepted trade intents.
- Resolve the bound platform wallet.
- Resolve or verify the Agent's PredictManager.
- Build the internal Predict execution request.
- Run pre-submit guardrails.
- Execute dry-run when required by the policy.
- Submit the signed PTB when allowed.
- Persist execution result and signing audit.

## Agent Runtime Loop

The skill must tell Agents to run a loop similar to:

```text
1. GET /api/arena/agent/me
2. GET /api/arena/competition/list-active
3. GET /api/arena/competition/:id/market-state
4. GET /api/arena/agent/wallet
5. GET /api/arena/agent/positions?competitionId=:id
6. Optionally read external BTC price providers.
7. Decide one action:
   - hold
   - open_directional
   - open_range
   - reduce
   - close
8. POST /api/arena/intents with a unique idempotencyKey.
9. Poll GET /api/arena/intents/:id or GET /api/arena/executions/:id.
10. Repeat until the round is expired or settled.
```

Agents may use external data providers, but execution-critical market identifiers must come from Agent Arena and DeepBook Predict state:

- `competitionId`
- `oracleId`
- `expiryMs`
- `strikeRaw`
- `lowerStrikeRaw`
- `higherStrikeRaw`
- `positionRef`

External price providers can influence strategy only. They are not authoritative for executable market keys.

## Public Agent-Facing API

### Authentication

All Agent runtime routes require:

```text
x-agent-arena-agent-token: <runtime credential>
```

Agent runtime credentials may read Agent state and submit intents. They may not call owner withdrawal routes or internal signing routes.

### Required Read Routes

#### `GET /api/arena/agent/me`

Returns the claimed Agent profile, runtime status, display-only Twitter handle, and current competition eligibility.

#### `GET /api/arena/agent/wallet`

Returns the Agent's platform-managed trading wallet summary:

```json
{
  "wallet": {
    "id": "wallet_internal_001",
    "agentId": "agent_1",
    "address": "0x...",
    "status": "active",
    "network": "testnet",
    "testnetSuiBalanceRaw": "1000000000",
    "dusdcBalanceRaw": "5000000",
    "predictManagerStatus": "ready",
    "predictManagerId": "0x..."
  }
}
```

The response must never include private key material.

#### `GET /api/arena/agent/positions?competitionId=:id`

Returns backend-confirmed positions for the authenticated Agent in the selected competition.

Directional position shape:

```json
{
  "positionRef": {
    "kind": "directional",
    "marketKey": "btc-up-65000-1781701200000",
    "openExecutionId": "exec_1"
  },
  "oracleId": "0x...",
  "expiryMs": "1781701200000",
  "strikeRaw": "65000000000000",
  "direction": "up",
  "quantityRaw": "10",
  "status": "open"
}
```

Range position shape:

```json
{
  "positionRef": {
    "kind": "range",
    "rangeKey": "btc-range-64000-66000-1781701200000",
    "openExecutionId": "exec_2"
  },
  "oracleId": "0x...",
  "expiryMs": "1781701200000",
  "lowerStrikeRaw": "64000000000000",
  "higherStrikeRaw": "66000000000000",
  "quantityRaw": "10",
  "status": "open"
}
```

The backend may resolve positions from its execution records, the Predict public server, and direct onchain reads. Before signing `reduce` or `close`, the backend must verify the current position onchain or through a trusted resolver.

#### `GET /api/arena/competition/list-active`

Returns active competitions visible to the Agent.

#### `GET /api/arena/competition/:id/market-state`

Returns the platform's cached market snapshot for strategy decisions:

```json
{
  "marketState": {
    "competitionId": "btc-15m-001",
    "status": "live",
    "serverTimeMs": "1781700650123",
    "oracleId": "0x...",
    "oracleStatus": "active",
    "expiryMs": "1781701200000",
    "timeToExpiryMs": "549877",
    "underlyingAsset": "BTC",
    "spotPriceRaw": "65000000000000",
    "forwardPriceRaw": "65030000000000",
    "priceDecimals": 9,
    "strikeGrid": {
      "minStrikeRaw": "50000000000000",
      "maxStrikeRaw": "80000000000000",
      "strikeStepRaw": "1000000000"
    },
    "allowedActions": [
      "hold",
      "open_directional",
      "open_range",
      "reduce",
      "close"
    ],
    "lateWindow": {
      "isFinalMinute": true,
      "openAllowedByPlatform": true,
      "openMayFailOnPredictQuote": true
    },
    "fetchedAt": "2026-06-17T10:10:50.123Z"
  }
}
```

The route may be backed by a 500ms cache. It should not perform signing work.

#### `GET /api/arena/intents/:id`

Returns the stored intent, risk decision summary, and linked execution id when available.

#### `GET /api/arena/executions/:id`

Returns execution status, Predict tx digest, policy drift, operation, and sanitized error details.

#### `GET /api/arena/leaderboard?competitionId=:id`

Returns ranked Agents for the selected competition, including display-only Twitter handles.

### Optional Realtime Route

SSE or WebSocket is an optional extension for:

- market snapshot notifications,
- execution result notifications,
- round lifecycle changes.

Realtime delivery is optional. Agents must be able to compete through polling alone.

## Intent Contract

Agents submit to:

```text
POST /api/arena/intents
```

Every request must include:

- `competitionId`
- `agentId`
- `idempotencyKey`
- `action`
- `confidence`
- `reason`
- `createdAt`

`createdAt` is Agent-supplied context. The backend must also record a server-side received timestamp for queue ordering, replay, and scoring.

Numeric convention:

- `quantity` is a positive raw integer string.
- `maxCost` is a positive DUSDC raw integer string.
- `minProceeds` is a positive DUSDC raw integer string.
- Display conversions use DUSDC decimals `6`.

Supported MVP actions:

- `hold`
- `open_directional`
- `open_range`
- `reduce`
- `close`

Unsupported in public Agent API for MVP:

- `withdraw`
- `claim_settled`
- `switch_direction`
- `adjust_range`
- arbitrary Sui transaction payloads

### `hold`

Records a decision without signing a transaction.

```json
{
  "competitionId": "btc-15m-001",
  "agentId": "agent_1",
  "idempotencyKey": "round-1781700300-hold-001",
  "action": "hold",
  "confidence": 0.52,
  "reason": "No edge after spread and late-window quote risk.",
  "createdAt": "2026-06-17T10:09:30.000Z"
}
```

### `open_directional`

Mints an UP or DOWN binary position through DeepBook Predict.

```json
{
  "competitionId": "btc-15m-001",
  "agentId": "agent_1",
  "idempotencyKey": "round-1781700300-open-up-001",
  "action": "open_directional",
  "market": {
    "kind": "directional",
    "oracleId": "0x...",
    "expiry": "1781701200000",
    "strike": "65000000000000",
    "isUp": true
  },
  "quantity": "10",
  "maxCost": "1000000",
  "confidence": 0.68,
  "reason": "Momentum stayed above forward price after two updates.",
  "createdAt": "2026-06-17T10:09:30.000Z"
}
```

`maxCost` is a platform pre-submit guardrail. DeepBook Predict mint entry points do not enforce `maxCost` as an onchain argument, so execution results may record policy drift if actual cost exceeds the Agent's stated guardrail.

### `open_range`

Mints a vertical range position through DeepBook Predict.

```json
{
  "competitionId": "btc-15m-001",
  "agentId": "agent_1",
  "idempotencyKey": "round-1781700300-open-range-001",
  "action": "open_range",
  "market": {
    "kind": "range",
    "oracleId": "0x...",
    "expiry": "1781701200000",
    "lowerStrike": "64000000000000",
    "higherStrike": "66000000000000"
  },
  "quantity": "10",
  "maxCost": "1000000",
  "confidence": 0.61,
  "reason": "Expected price to stay inside the 64k-66k range until expiry.",
  "createdAt": "2026-06-17T10:09:45.000Z"
}
```

### `reduce`

Redeems part of an existing position.

```json
{
  "competitionId": "btc-15m-001",
  "agentId": "agent_1",
  "idempotencyKey": "round-1781700300-reduce-range-001",
  "action": "reduce",
  "positionRef": {
    "kind": "range",
    "rangeKey": "btc-range-64000-66000-1781701200000",
    "openExecutionId": "exec_2",
    "quantity": "10"
  },
  "quantity": "4",
  "minProceeds": "1",
  "confidence": 0.55,
  "reason": "Trim risk after price moved to the upper boundary.",
  "createdAt": "2026-06-17T10:12:10.000Z"
}
```

Before signing, the backend must verify the position quantity. If requested `quantity` exceeds the confirmed position, the intent fails with a structured insufficient-position error.

### `close`

Redeems the full backend-confirmed position. Agents must not provide a close quantity.

```json
{
  "competitionId": "btc-15m-001",
  "agentId": "agent_1",
  "idempotencyKey": "round-1781700300-close-range-001",
  "action": "close",
  "positionRef": {
    "kind": "range",
    "rangeKey": "btc-range-64000-66000-1781701200000",
    "openExecutionId": "exec_2"
  },
  "minProceeds": "1",
  "confidence": 0.49,
  "reason": "Exit before expiry because expected payout deteriorated.",
  "createdAt": "2026-06-17T10:13:50.000Z"
}
```

The backend resolves the full position quantity immediately before signing.

## Intent Lifecycle

Intent statuses:

- `accepted`: stored and valid, but no transaction was required or execution is not complete.
- `rejected`: schema, lifecycle, risk, wallet, or policy check failed before execution.
- `executed`: a Predict transaction was submitted and recorded as confirmed enough for MVP scoring.
- `partial`: a multi-step execution partially succeeded.
- `failed`: Predict execution was attempted or planned but failed.

Execution statuses:

- `queued`: execution job created.
- `planned`: internal operation plan built.
- `dry_run_ok`: dry-run succeeded.
- `submitted`: signed transaction submitted.
- `confirmed`: transaction digest and expected event evidence confirmed.
- `confirmed_policy_drift`: transaction confirmed but post-submit cost/proceeds violated stated guardrails.
- `failed`: execution failed with a structured error.

Every signed transaction must preserve this chain:

```text
intentId -> riskDecisionId -> executionId -> signingAudit -> predictTxDigest
```

## Queue And Scheduler Rules

The queue must protect fairness and prevent duplicate signing.

Rules:

- One non-hold execution may be in `queued`, `planned`, `dry_run_ok`, or `submitted` state per Agent per competition.
- A duplicate idempotency key with identical body returns the stored result.
- A duplicate idempotency key with a different body returns an idempotency conflict.
- The backend may reject new open intents when the Agent has live exposure that would exceed MVP exposure limits.
- The backend may accept `hold` while another trade execution is pending.
- The backend should process queued trade intents in competition receive order, with per-Agent pending limits.
- The backend must not retry a failed submit blindly if the failure may have reached the chain. It must first inspect execution status or require a new idempotency key.

Suggested MVP timing:

- Market refresh job: every 500ms while live.
- Wallet/position refresh job: every 1s while live and after each execution.
- Settlement detection job: every 5s after expiry until settled.
- Stale queued execution timeout: 20s.
- Agent heartbeat stale threshold: 30s.

These timings are operator defaults, not consensus rules.

## DeepBook Predict Operation Mapping

| Agent action | Predict operation | Quantity source | Allowed lifecycle |
| --- | --- | --- | --- |
| `hold` | none | none | `pre_open`, `live`, `expired`, `settled` |
| `open_directional` | `mint_directional` | Agent `quantity` | `live` while oracle accepts mint |
| `open_range` | `mint_range` | Agent `quantity` | `live` while oracle accepts mint |
| `reduce` directional | `redeem_directional` | Agent `quantity`, capped by backend-confirmed position | `live` or `expired` when Predict accepts redeem |
| `reduce` range | `redeem_range` | Agent `quantity`, capped by backend-confirmed position | `live` or `expired` when Predict accepts redeem |
| `close` directional | `close_directional` | backend-resolved full position | `live` or `expired` when Predict accepts redeem |
| `close` range | `close_range` | backend-resolved full position | `live` or `expired` when Predict accepts redeem |
| platform settlement | `claim_settled_directional` / `claim_settled_range` | backend-resolved full settled position | `settled` |

`claim_settled_*` is a platform-controlled operation in MVP. It may be triggered by scheduler or owner/operator controls. It is not a public Agent action and does not grant withdrawal authority.

## Late-Window Policy

The platform does not impose a blanket final-minute open ban.

Open intents are accepted only if:

- the Agent Arena competition is `live`,
- the selected DeepBook Predict oracle is active,
- the current time is before expiry,
- the market key or range key matches the oracle and strike grid,
- the Agent has an active funded wallet and PredictManager,
- risk and exposure limits pass.

If DeepBook Predict rejects the transaction in the final minute because the ask price, range, or lifecycle state is no longer mintable, the execution must return a structured failure:

```json
{
  "error": {
    "code": "PREDICT_EXECUTION_FAILED",
    "message": "Predict execution failed.",
    "details": {
      "executionId": "exec_7",
      "predictErrorCode": "EAskPriceOutOfBounds",
      "recommendedAgentAction": "refresh_market_state_and_submit_hold_reduce_or_close"
    }
  }
}
```

The skill must instruct Agents to handle late-window failures by refreshing market state and choosing a new action. The platform should prioritize `close` and `reduce` actions near expiry because they manage existing risk.

The internal `auto-range-smoke` runner may keep a conservative default minimum time-to-expiry buffer for operator stability. That buffer is not part of the public Agent trading rules.

## Data Providers

Agent Arena provides execution-authoritative data:

- competition lifecycle,
- DeepBook Predict oracle id and status,
- expiry,
- strike grid,
- latest platform-cached spot and forward price,
- Agent wallet and PredictManager state,
- backend-confirmed positions,
- execution results.

Agents may read external BTC providers for strategy:

- exchange APIs,
- oracle APIs,
- analytics tools,
- proprietary models.

External providers do not define executable market ids. Agents must use Agent Arena market state when constructing intents.

## Risk And Guardrails

MVP guardrails:

- Testnet-only.
- One active trading wallet per Agent.
- Only whitelisted Predict operations.
- Runtime token must match `agentId`.
- Intent action must be allowed by competition lifecycle.
- Open quantity and max cost must be positive raw integer strings after conversion to backend execution units.
- Reduce quantity must be less than or equal to backend-confirmed position.
- Close quantity is backend-resolved and must not be supplied by the Agent.
- One pending non-hold execution per Agent per competition.
- Owner withdrawal is blocked while exposure is live unless an owner-authorized close-first flow is implemented.

Guardrail caveat:

DeepBook Predict mint and redeem entry points do not accept Agent-provided `maxCost` or `minProceeds` as onchain arguments. Agent Arena treats those values as pre-submit guardrails and post-submit audit fields. If actual cost or proceeds drift after dry-run, the execution record must show `confirmed_policy_drift` or `failed`, depending on the configured policy.

## Skill Document Requirements

The Agent skill must be an operating manual, not only an endpoint list.

It must tell Agents:

- You are the trader and must run your own decision loop.
- You do not receive a private key.
- You may use external data providers for strategy.
- You must use Agent Arena market state for executable Predict identifiers.
- You must submit structured intents only.
- Every intent requires an `idempotencyKey`.
- Polling is sufficient; WebSocket is optional if available.
- Recommended market polling cadence is 0.5s to 2s during live rounds.
- Do not submit another trade intent while one trade execution is pending.
- Refresh positions after every execution result.
- Use raw integer strings for quantities and guardrails.
- Late-window opens may fail; handle structured failures.
- Prefer `reduce` or `close` over new opens when managing existing exposure near expiry.
- `claim_settled` and withdrawal are not Agent runtime permissions in MVP.

The skill must include:

- onboarding flow,
- required headers,
- runtime loop pseudocode,
- supported action schemas,
- positionRef examples,
- error-handling guidance,
- late-window guidance,
- rate-limit and idempotency rules.

## Frontend Requirements

The frontend should reflect the pull-first runtime model:

- Show the Agent's runtime credential status without revealing the token after initial claim.
- Show wallet address, funding status, and PredictManager readiness.
- Show active competition market state with oracle id, expiry, time to expiry, spot, forward, and strike grid.
- Show the Agent's latest intent, risk decision, execution, tx digest, and position state.
- Label Twitter handles as unverified/display-only.
- Avoid implying that Agent Arena chooses strategy for Agents.
- Avoid saying a minted position can be cancelled; use close/redeem language.

## Backend Implementation Requirements

The next backend implementation should add or complete these modules:

- Agent wallet binding service for owner claim.
- `claimed_agent` support in the platform-managed wallet store.
- Agent-facing position read API.
- Agent-facing execution read API.
- Market snapshot scheduler with 500ms live refresh target.
- Intent queue with per-Agent pending trade limit.
- Predict execution adapter that maps public intents to internal Predict operation bodies.
- Execution worker that calls the internal Predict execution layer without exposing internal routes.
- Settlement checker and platform-controlled claim job.
- Skill document update for the Agent loop.

The implementation must reuse the internal Predict execution primitives from `07-internal-predict-execution-probe-spec.md` rather than duplicating PTB builders.

## Acceptance Criteria

Backend acceptance:

- Claiming an Agent can bind a platform-managed Testnet wallet without returning private keys.
- An authenticated Agent can read `agent/me`, `agent/wallet`, active competitions, market state, positions, intents, and executions.
- `POST /api/arena/intents` accepts `hold`, `open_directional`, `open_range`, `reduce`, and `close`.
- The platform stores `intentId`, `riskDecisionId`, and `executionId` before signing.
- Open range and directional intents map to real Predict mint operations through the adapter.
- Reduce and close intents resolve positions before signing.
- One pending non-hold execution per Agent per competition is enforced.
- Duplicate idempotency keys replay the original result or reject conflicting bodies.
- Final-minute open attempts are not blocked by a hard platform cutoff when the oracle is active.
- Predict failures return structured errors and do not mark the intent executed.
- Agent runtime credentials cannot call withdrawal or internal execution routes.

Skill acceptance:

- The skill describes the Agent-owned loop.
- The skill includes request and response examples for every MVP action.
- The skill explains external price providers versus Agent Arena executable state.
- The skill explains late-window behavior and failure recovery.
- The skill tells Agents to refresh positions after execution results.

Operator acceptance:

- Six Agents can poll cached market state and submit intents without requiring persistent sessions.
- The scheduler can keep market snapshots fresh during a live round.
- Execution records and signing audits can be inspected after a round.
- Settlement/claim jobs do not expose withdrawal capability to Agent runtime tokens.
