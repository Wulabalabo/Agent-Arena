# Agent Arena Remaining Predict Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining DeepBook Predict execution surface for Agent Arena: range mint/redeem/close, PredictManager withdrawal, settled claim, and the Agent-facing API/Skill/frontend wiring needed to use them safely.

**Architecture:** Keep Agent Arena as an application layer over DeepBook Predict Testnet. The backend remains the only signer for platform-managed trading wallets, DeepBook Predict remains the source of truth for balances/positions/settlement, and `agent_arena::registry` remains proof/attribution only. Implement each protocol action behind planner validation, dry-run, submit gating, audit records, smoke commands, and docs before exposing it to Agents.

**Tech Stack:** Bun, TypeScript, `@mysten/sui`, Sui Testnet RPC, DeepBook Predict Testnet package, backend unit tests with `bun test`, frontend Vitest/React tests, markdown Skill docs.

---

## Current Completion Boundary

Already completed:
- Platform-managed Testnet wallet generation and signer restore.
- SUI/DUSDC wallet balance reads.
- PredictManager discovery, owner verification, creation, and DUSDC deposit.
- Directional up/down mint.
- Directional partial redeem.
- Directional full close with backend-resolved quantity.
- Backend tests and live Testnet smoke for directional mint plus close.

Still incomplete:
- Range mint/redeem execution.
- Range full close with backend-resolved quantity.
- PredictManager DUSDC withdrawal, split into internal operator smoke first and owner-authorized maintenance later.
- Settled claim flows.
- Agent Skill docs and API contract updates for the final action set.
- Frontend controls/status for range exposure, owner-only maintenance, and settled claim readiness.

Important protocol boundaries:
- `predict::withdraw` is LP-vault withdrawal and is not the MVP user withdrawal path.
- User withdrawal for Agent Arena means `predict_manager::withdraw<DUSDC>` from the platform-managed `PredictManager`.
- Directional settled claim can use `predict::redeem_permissionless<DUSDC>` when the oracle is settled.
- Range settled claim uses `predict::redeem_range<DUSDC>`; current Predict source does not expose a permissionless range redeem entry point.
- Oracle settlement itself is not our platform's authority. We can detect settled oracles and claim positions; we should not pretend to settle the oracle.
- External Agent actions must keep the existing v1 vocabulary: `hold`, `open_directional`, `open_range`, `reduce`, and `close`. Directional/range differences are selected through `positionRef.kind` and request shape, then mapped internally to Predict operations.
- Agent runtime-token flows must never call withdrawal. Withdrawal requires either an internal operator smoke path or a separate owner-authorized maintenance endpoint.
- Any Agent-facing live execution must bind signing to persisted `intentId`, `riskDecisionId`, and `executionId`; a raw internal execute body is acceptable only for the internal probe.

---

## File Map

Backend core:
- Create `agent-arena/apps/backend/src/predict/protocol-abi.ts`: centralize verified DeepBook Predict Move targets, event names, and function-shape notes.
- Create `agent-arena/apps/backend/src/predict/protocol-abi.test.ts`: prove expected operation metadata exists before executor code uses it.
- Modify `agent-arena/apps/backend/src/predict/transactions.ts`: add PTB builders for `mint_range`, `redeem_range`, `close_range`, `withdraw_manager_dusdc`, and settled claim operations.
- Modify `agent-arena/apps/backend/src/predict/transactions.test.ts`: prove target whitelisting and PTB structure for each new operation.
- Modify `agent-arena/apps/backend/src/predict/trade-executor.ts`: add range position resolution, range dry-run/submit, settled claim dry-run/submit, and event parsers.
- Modify `agent-arena/apps/backend/src/predict/trade-executor.test.ts`: prove range event parsing and u64 position parsing.
- Modify `agent-arena/apps/backend/src/predict/internal-api.ts`: expose the new internal probe execution operations through the internal execute route with dry-run/submit gating and oracle confirmation.
- Modify `agent-arena/apps/backend/src/predict/internal-api.test.ts`: prove API validation, backend-resolved full-close quantity, submit gating, oracle confirmation, and raw internal route isolation.
- Modify `agent-arena/apps/backend/src/predict/guardrails.ts`: classify range/withdraw/claim pre-submit guardrails.
- Modify `agent-arena/apps/backend/src/predict/guardrails.test.ts`: prove guardrail classifications and no silent skipping.
- Modify `agent-arena/apps/backend/src/predict/oracle.ts`: ensure settled claim operations use settled-oracle validation, while live close/redeem remains quoteable-only.
- Modify `agent-arena/apps/backend/src/predict/oracle.test.ts`: prove normal live operations reject stale settled oracles and claim operations require settled oracle state.
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`: complete existing range smoke flags and add internal-only withdrawal/settled claim flags.
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`: prove smoke payloads do not allow caller-resolved close quantities where backend resolution is required.

Backend docs/config:
- Modify `agent-arena/apps/backend/.env.example`: add any smoke-only defaults needed for claim/withdraw examples.
- Modify `agent-arena/README.md`: update completed/remaining operation matrix and smoke examples.
- Modify `agent-arena/specs/07-internal-predict-execution-probe-spec.md`: align operation contract with implementation.

Skill/API/frontend:
- Modify `agent-arena/skills/deepbook-predict-btc-15m.md`: document final Agent action schema.
- Modify `agent-arena/skills/agent-wallet.md`: document that Agents cannot withdraw; owner/operator withdrawal is outside the runtime-token action set.
- Modify `agent-arena/skills/agent-arena.md`: update registration-to-execution flow.
- Modify `agent-arena/scripts/validate-skills.ts`: extend validation only if schema examples are machine-checked.
- Modify `agent-arena/apps/backend/src/platform/types.ts`: keep the v1 Agent intent actions stable and extend only nested range/claim metadata if needed.
- Modify `agent-arena/apps/backend/src/platform/validation.ts`: validate final v1-compatible action schemas.
- Modify `agent-arena/apps/backend/src/platform/execution.ts`: map validated Agent intents to internal Predict execution through stored intent/risk/execution records.
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`: show manager balance, owner-only maintenance status, and claim readiness.
- Modify `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`: show range exposure and claimable settled state.
- Modify existing frontend tests next to those files.

---

## Plan 0: Protocol and Signing Preconditions

### Task 0.1: Freeze Verified Predict ABI Metadata

**Files:**
- Create `agent-arena/apps/backend/src/predict/protocol-abi.ts`
- Create `agent-arena/apps/backend/src/predict/protocol-abi.test.ts`
- Modify `agent-arena/specs/07-internal-predict-execution-probe-spec.md`

- [x] **Step 1: Write ABI metadata tests**

Add tests proving the implementation has explicit metadata for:
- `predict::mint_range`
- `predict::redeem_range`
- `predict::redeem_permissionless`
- `predict_manager::range_position`
- `predict_manager::balance`
- `predict_manager::withdraw`
- `RangeMinted.cost`
- `RangeRedeemed.payout`

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/protocol-abi.test.ts
```
Expected: FAIL because `protocol-abi.ts` does not exist.

- [x] **Step 2: Add metadata from verified Predict Testnet source**

Create `protocol-abi.ts` with operation names, target modules, return assumptions, and event fields. Keep this file descriptive; transaction construction still lives in `transactions.ts`.

- [x] **Step 3: Update spec evidence**

Update `07-internal-predict-execution-probe-spec.md` with a "Verified Predict ABI" subsection that records the checked source branch, function names, and event fields.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/protocol-abi.test.ts
```
Expected: all tests pass.

### Task 0.2: Confirm Oracle Before Preview and Execute

**Files:**
- Modify `agent-arena/apps/backend/src/predict/internal-api.ts`
- Modify `agent-arena/apps/backend/src/predict/internal-api.test.ts`
- Modify `agent-arena/apps/backend/src/predict/oracle.ts`
- Modify `agent-arena/apps/backend/src/predict/oracle.test.ts`

- [x] **Step 1: Write failing tests for oracle confirmation in execute**

Add tests proving:
- `handlePreview` calls oracle confirmation before returning a quoteable preview.
- `handleExecute` calls oracle confirmation before dry-run or submit.
- live mint/redeem/close operations reject settled or stale oracles.
- `claim_settled_*` operations require settled oracle state.

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts agent-arena/apps/backend/src/predict/oracle.test.ts
```
Expected: FAIL because execute currently does not confirm the oracle before routing trades.

- [x] **Step 2: Inject oracle confirmation dependencies**

Add an internal API dependency for `confirmOracleForExecution` so tests can inject a spy and production can use the existing Predict server/Sui RPC confirmation path.

- [x] **Step 3: Gate every operation class**

Map:
- `preview_directional`, `mint_directional`, `redeem_directional`, `close_directional` to live quoteable validation.
- `preview_range`, `mint_range`, `redeem_range`, `close_range` to live quoteable validation.
- `claim_settled_directional`, `claim_settled_range` to settled validation.
- setup and withdrawal operations do not require oracle confirmation.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts agent-arena/apps/backend/src/predict/oracle.test.ts
```
Expected: all tests pass.

### Task 0.3: Preserve the Formal Agent Signing Chain

**Files:**
- Modify `agent-arena/apps/backend/src/platform/execution.ts`
- Modify `agent-arena/apps/backend/src/platform/execution.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify `agent-arena/specs/06-agent-participation-platform-spec.md`

- [x] **Step 1: Write failing tests for execution identity binding**

Add tests proving real Predict signing requires:
- a stored accepted Agent intent.
- a stored risk decision for that intent.
- a stored execution record tied to the same `intentId` and `riskDecisionId`.
- a platform-managed wallet binding owned by the claimed Agent.

Run:
```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts agent-arena/apps/backend/src/platform/api.test.ts
```
Expected: FAIL because real Predict signing is not yet bound to the platform intent/risk/execution chain.

- [x] **Step 2: Add an execution adapter interface**

Add an adapter shape that accepts a typed object such as:
```ts
{
  intentId: string;
  riskDecisionId: string;
  executionId: string;
  agentId: string;
  walletId: string;
  predictOperation: string;
}
```
The adapter must not accept arbitrary external request bodies.

- [x] **Step 3: Keep internal probe separate**

Document and test that `/api/arena/internal/predict/execute` remains operator/internal-only and is not called directly from Agent runtime-token routes.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts agent-arena/apps/backend/src/platform/api.test.ts
```
Expected: all tests pass.

---

## Plan A: Range Execution

### Task A1: Add Range PTB Builders

**Files:**
- Modify `agent-arena/apps/backend/src/predict/transactions.ts`
- Modify `agent-arena/apps/backend/src/predict/transactions.test.ts`

- [x] **Step 1: Write failing tests for `mint_range` PTB**

Add assertions that `buildPredictTransactionFromPlan` creates:
- `range_key::new(oracle_id, expiry, lower_strike, higher_strike)`
- `predict::mint_range<DUSDC>(&mut Predict, &mut PredictManager, &OracleSVI, RangeKey, quantity, &Clock)`

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts
```
Expected: FAIL with `PREDICT_PTB_UNSUPPORTED_OPERATION` for `mint_range`.

- [x] **Step 2: Implement `mint_range` transaction builder**

In `buildPredictTransactionFromPlan`, add a `case "mint_range"` that mirrors directional mint but builds a `RangeKey` through `range_key::new`.

- [x] **Step 3: Write failing tests for `redeem_range` PTB**

Add assertions that the PTB calls:
- `range_key::new`
- `predict::redeem_range<DUSDC>`

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts
```
Expected: FAIL with `PREDICT_PTB_UNSUPPORTED_OPERATION` for `redeem_range`.

- [x] **Step 4: Implement `redeem_range` transaction builder**

Add a `case "redeem_range"` that passes Predict object, manager, oracle, RangeKey, quantity, and Clock.

- [x] **Step 5: Add `close_range` to the operation union**

Add `close_range` to `PredictOperation`, `predictOperations`, and planner tests. Like `close_directional`, reject caller `quantityRaw` and require `resolvedQuantityRaw`.

- [x] **Step 6: Implement `close_range` as `predict::redeem_range`**

Use the same PTB as `redeem_range`, but build the plan from `resolvedQuantityRaw`.

- [x] **Step 7: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts
```
Expected: all tests pass.

### Task A2: Add Range Position Resolver and Executor

**Files:**
- Modify `agent-arena/apps/backend/src/predict/trade-executor.ts`
- Modify `agent-arena/apps/backend/src/predict/trade-executor.test.ts`

- [x] **Step 1: Write failing parser tests**

Add tests for:
- `extractRangeMintActualCostRaw` reads `RangeMinted.cost`.
- `extractRangeRedeemActualProceedsRaw` reads `RangeRedeemed.payout`.
- `resolveRangePosition` reads a u64 from `predict_manager::range_position`.

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/trade-executor.test.ts
```
Expected: FAIL because range parser/resolver exports do not exist.

- [x] **Step 2: Add range input types**

Add `RangePositionInput`, `MintRangeExecutorInput`, `RedeemRangeExecutorInput`, and `RangePositionResolution`.

- [x] **Step 3: Implement `buildRangePositionReadTransaction`**

Build:
- `range_key::new(oracleId, expiryMs, lowerStrikeRaw, higherStrikeRaw)`
- `predict_manager::range_position(managerId, rangeKey)`

- [x] **Step 4: Add executor methods**

Extend `PredictTradeExecutor` with:
- `resolveRangePosition`
- `dryRunMintRange`
- `submitMintRange`
- `dryRunRedeemRange`
- `submitRedeemRange`

- [x] **Step 5: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/trade-executor.test.ts
```
Expected: all tests pass.

### Task A3: Wire Range Operations Through Internal API

**Files:**
- Modify `agent-arena/apps/backend/src/predict/internal-api.ts`
- Modify `agent-arena/apps/backend/src/predict/internal-api.test.ts`
- Modify `agent-arena/apps/backend/src/predict/guardrails.ts`
- Modify `agent-arena/apps/backend/src/predict/guardrails.test.ts`

- [x] **Step 1: Write failing API tests**

Add tests proving:
- `mint_range` dry-run calls `dryRunMintRange`.
- `mint_range` submit is blocked unless `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`.
- `redeem_range` verifies backend-confirmed range position before signing.
- `close_range` rejects caller `quantityRaw`.
- `close_range` resolves full range position through `resolveRangePosition`.
- `close_range` returns `RANGE_POSITION_NOT_FOUND` when resolved quantity is zero.

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts
```
Expected: FAIL because internal API still only executes directional trades.

- [x] **Step 2: Implement range execution branching**

Add `isRangeTradeOperation`, `dryRunRangeTrade`, `submitRangeTrade`, and range executor input builders.

- [x] **Step 3: Add guardrail support**

Classify:
- `mint_range` as max-cost checked.
- `redeem_range` and `close_range` as min-proceeds checked.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts agent-arena/apps/backend/src/predict/guardrails.test.ts
```
Expected: all tests pass.

### Task A4: Complete Range Smoke

**Files:**
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`
- Modify `agent-arena/README.md`

- [x] **Step 1: Audit existing range smoke flags**

Confirm whether these flags already exist and preserve their names if present:
- `--mint-range`
- `--redeem-range-last`
- `--close-range-last`
- `--lower-strike-raw`
- `--higher-strike-raw`

- [x] **Step 2: Fill missing range execution payloads**

If the flags exist but still route to unsupported execution, wire them to the internal execute endpoint using `mint_range`, `redeem_range`, and `close_range`.

- [x] **Step 3: Add smoke tests**

Prove `close-range-last` omits caller quantity and asks the backend to resolve it.

- [x] **Step 4: Run unit tests**

Run:
```powershell
bun test agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Run live Testnet dry-run**

Run dry-run first:
```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --mint-range --wallet-id <wallet-id> --manager-id <manager-id> --oracle-id <oracle-id> --lower-strike-raw <lower> --higher-strike-raw <higher> --quantity-raw 100000 --max-cost-raw 1000000
```
Expected: `ok=true`, `status=dry_run_ok`.

- [ ] **Step 6: Run live Testnet submit after dry-run passes**

Run with `--submit` only after dry-run passes and submit env is enabled.

---

## Plan B: PredictManager Withdrawal

### Task B1: Add Internal Operator Withdrawal PTB

**Files:**
- Modify `agent-arena/apps/backend/src/predict/transactions.ts`
- Modify `agent-arena/apps/backend/src/predict/transactions.test.ts`

- [x] **Step 1: Add `withdraw_manager_dusdc` operation**

Add the operation to `PredictOperation`, `predictOperations`, and tests.

- [x] **Step 2: Write failing PTB test**

Expected PTB:
- `predict_manager::withdraw<DUSDC>(&mut PredictManager, amount, &mut TxContext) -> Coin<DUSDC>`
- If `recipientAddress` is absent, leave the coin in the platform wallet.
- If `recipientAddress` is present, transfer the returned coin to that address.
- This operation is internal/operator-only at this stage.

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts
```
Expected: FAIL because withdrawal builder is missing.

- [x] **Step 3: Implement withdrawal builder**

Add `recipientAddress?: string` to plan inputs, include it in validated plan metadata, and build the transfer when provided.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts
```
Expected: all tests pass.

### Task B2: Add Internal Operator Withdrawal Executor

**Files:**
- Modify `agent-arena/apps/backend/src/predict/trade-executor.ts`
- Modify `agent-arena/apps/backend/src/predict/internal-api.ts`
- Modify `agent-arena/apps/backend/src/predict/internal-api.test.ts`

- [x] **Step 1: Write failing API tests**

Add tests proving:
- `withdraw_manager_dusdc` requires an explicit `amountRaw`.
- The backend reads manager balance before submit and rejects insufficient balance.
- Submit is blocked unless real submit is enabled.
- The endpoint is available only through `/api/arena/internal/*` with `AGENT_ARENA_INTERNAL_TOKEN`.
- No platform Agent runtime-token route can proxy to this operation.

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts
```
Expected: FAIL because withdrawal execution does not exist.

- [x] **Step 2: Implement manager balance read**

Use `devInspectTransactionBlock` with the verified `predict_manager::balance` signature from `protocol-abi.ts` and parse the u64 return value. Do not add a quote-asset type argument unless the ABI evidence proves the Testnet package requires one.

- [x] **Step 3: Implement dry-run and submit**

Use the same dry-run then sign-and-execute pattern as setup/trade execution.

- [x] **Step 4: Add audit fields**

Record:
- `transactionKind: "predict_manager_withdraw_dry_run"` or `"predict_manager_withdraw_submit"`
- `amountRaw`
- `recipientAddress`
- no private key material.

- [x] **Step 5: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts agent-arena/apps/backend/src/predict/trade-executor.test.ts
```
Expected: all tests pass.

### Task B3: Internal Withdrawal Smoke

**Files:**
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`
- Modify `agent-arena/README.md`

- [x] **Step 1: Add smoke flags**

Add:
- `--withdraw-manager-dusdc`
- `--amount-raw`
- `--recipient-address`

- [ ] **Step 2: Dry-run with a tiny amount**

Run:
```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --withdraw-manager-dusdc --wallet-id <wallet-id> --manager-id <manager-id> --amount-raw 1
```
Expected: `ok=true`, dry-run succeeds.

- [ ] **Step 3: Submit only after dry-run**

Run with `--submit` and confirm wallet DUSDC balance increases or recipient receives the coin.

### Task B4: Owner-Authorized Withdrawal Flow

**Files:**
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify `agent-arena/apps/backend/src/platform/validation.ts`
- Modify `agent-arena/apps/backend/src/platform/validation.test.ts`
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx`
- Modify `agent-arena/specs/06-agent-participation-platform-spec.md`

- [x] **Step 1: Write failing owner-auth tests**

Add tests proving:
- owner withdrawal requires the owner wallet claim/auth path, not an Agent runtime token.
- withdrawal is rejected while the Agent has live open exposure unless the owner explicitly chooses a close-first flow.
- recipient address must be a valid Sui Testnet address.
- the platform records withdrawal request id, owner id, wallet id, manager id, amount, recipient, digest, and status.

Run:
```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/validation.test.ts
```
Expected: FAIL because owner withdrawal endpoints do not exist.

- [x] **Step 2: Add owner maintenance endpoint**

Add a route separate from `/api/arena/internal/*`, for example:
```text
POST /api/arena/owner/trading-wallets/:walletId/withdraw
```
The route must call the withdrawal executor through an owner-authorized service method, not by forwarding raw internal execute bodies.

- [x] **Step 3: Add frontend owner-only status**

Show withdrawal state only in owner-maintenance UI. Do not expose a withdraw control in Agent Skill docs or runtime-token UI.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/platform/api.test.ts agent-arena/apps/backend/src/platform/validation.test.ts
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/TradingWalletPanel.test.tsx
```
Expected: all tests pass.

---

## Plan C: Settled Claim

### Task C1: Add Directional Settled Claim Operation

**Files:**
- Modify `agent-arena/apps/backend/src/predict/transactions.ts`
- Modify `agent-arena/apps/backend/src/predict/transactions.test.ts`
- Modify `agent-arena/apps/backend/src/predict/oracle.ts`
- Modify `agent-arena/apps/backend/src/predict/oracle.test.ts`

- [x] **Step 1: Add `claim_settled_directional` operation**

Plan shape:
- same key fields as directional redeem.
- no caller `quantityRaw` for full claim.
- uses backend `resolvedQuantityRaw`.
- Move target is `predict::redeem_permissionless`.

- [x] **Step 2: Write failing PTB test**

Expected calls:
- `market_key::new`
- `predict::redeem_permissionless<DUSDC>`

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts
```
Expected: FAIL because operation is missing.

- [x] **Step 3: Implement PTB builder**

Add a `claim_settled_directional` case that uses the verified `redeem_permissionless` signature from Plan 0. The claim still writes proceeds into the PredictManager; tests should assert this through the Move target and event parser, not through a hand-rolled balance assumption.

- [x] **Step 4: Add oracle validation tests**

Prove:
- `claim_settled_directional` requires `oracle.status === "settled"`.
- live `redeem_directional` still rejects settled oracle state unless the claim operation is used.

- [x] **Step 5: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/transactions.test.ts agent-arena/apps/backend/src/predict/oracle.test.ts
```
Expected: all tests pass.

### Task C2: Add Settled Range Claim Operation

**Files:**
- Modify `agent-arena/apps/backend/src/predict/transactions.ts`
- Modify `agent-arena/apps/backend/src/predict/internal-api.ts`
- Modify `agent-arena/apps/backend/src/predict/internal-api.test.ts`

- [x] **Step 1: Add `claim_settled_range` operation**

Plan shape:
- same key fields as range redeem.
- no caller `quantityRaw` for full claim.
- uses backend `resolvedQuantityRaw`.
- Move target is `predict::redeem_range<DUSDC>`.

- [x] **Step 2: Write failing API tests**

Prove the backend resolves range position and rejects zero quantity.

- [x] **Step 3: Implement through existing range executor**

Route `claim_settled_range` to the same PTB path as `close_range`, but require settled oracle confirmation.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/predict/internal-api.test.ts
```
Expected: all tests pass.

### Task C3: Settled Claim Smoke

**Files:**
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.ts`
- Modify `agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts`
- Modify `agent-arena/README.md`

- [x] **Step 1: Add smoke flags**

Add:
- `--claim-settled-directional`
- `--claim-settled-range`

- [ ] **Step 2: Dry-run against a settled oracle with an existing position**

Expected:
- If oracle is settled and compacted/claimable, dry-run succeeds.
- If settlement compaction is missing, return a stable error and document it as "wait for Predict settlement readiness", not an Agent Arena bug.

- [ ] **Step 3: Submit claim**

Submit after dry-run and confirm the manager position goes to zero and manager DUSDC balance increases.

---

## Plan D: Agent API, Skill, and Frontend Exposure

### Task D1: Preserve and Extend the v1 Agent Action Schema

**Files:**
- Modify `agent-arena/apps/backend/src/platform/types.ts`
- Modify `agent-arena/apps/backend/src/platform/validation.ts`
- Modify `agent-arena/apps/backend/src/platform/validation.test.ts`
- Modify `agent-arena/skills/deepbook-predict-btc-15m.md`

- [x] **Step 1: Preserve final MVP action set**

Keep the existing external Agent actions:
- `hold`
- `open_directional`
- `open_range`
- `reduce`
- `close`

Use `positionRef.kind` and nested fields to map:
- `reduce + positionRef.kind=directional` to internal `redeem_directional`.
- `close + positionRef.kind=directional` to internal `close_directional`.
- `reduce + positionRef.kind=range` to internal `redeem_range`.
- `close + positionRef.kind=range` to internal `close_range`.

Do not allow Agent actions for withdrawal. Do not add Agent-facing `claim_settled_*` actions until the product explicitly wants Agents to initiate claims; settled claim may be platform/owner maintenance first.

- [x] **Step 2: Add validation tests**

Prove:
- Range requires `lowerStrike < higherStrike` in the Agent-facing schema, with both fields carrying raw Predict strike strings.
- Close actions do not accept quantity.
- Reduce actions require quantity.
- `reduce` and `close` require a typed `positionRef.kind`.
- Claim operations are not accepted through Agent runtime-token schema in this phase.
- Unknown fields are rejected.

- [x] **Step 3: Implement validation**

Map external Agent action names to internal Predict operations.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/platform/validation.test.ts agent-arena/apps/backend/src/platform/types.test.ts
```
Expected: all tests pass.

### Task D2: Wire Platform Intent Execution to Real Predict Execution

**Files:**
- Modify `agent-arena/apps/backend/src/platform/execution.ts`
- Modify `agent-arena/apps/backend/src/platform/execution.test.ts`
- Modify `agent-arena/apps/backend/src/platform/api.ts`
- Modify `agent-arena/apps/backend/src/platform/api.test.ts`

- [x] **Step 1: Write failing tests for real execution mode**

Prove:
- Accepted `open_range` intent becomes internal `mint_range`.
- Accepted `reduce` with `positionRef.kind=range` becomes internal `redeem_range`.
- Accepted `close` with `positionRef.kind=range` becomes internal `close_range`.
- The adapter receives stored `intentId`, `riskDecisionId`, and `executionId`.
- Settled claim and withdrawal are not reachable from Agent runtime tokens in this phase.

- [ ] **Step 2: Implement execution adapter**

Add a small adapter that calls the Predict execution service after platform risk validation and execution-record creation. The adapter must build typed internal operation inputs itself; it must not forward arbitrary raw request bodies from the Agent route.

Current checkpoint: the platform now passes a typed, allowlisted `predictPayload` into an injected adapter after intent/risk/execution records are created. The concrete production bridge to internal Predict signing remains incomplete until claimed platform wallets are backed by the internal wallet store, PredictManager ids are bound to trading wallets, and user-unit quantities/costs are converted into raw Predict execution fields.

- [x] **Step 3: Preserve mock mode**

Keep existing mock execution path for local demos where Predict config is absent.

- [x] **Step 4: Verify**

Run:
```powershell
bun test agent-arena/apps/backend/src/platform/execution.test.ts agent-arena/apps/backend/src/platform/api.test.ts
```
Expected: all tests pass.

### Task D3: Update Skill Docs

**Files:**
- Modify `agent-arena/skills/agent-arena.md`
- Modify `agent-arena/skills/deepbook-predict-btc-15m.md`
- Modify `agent-arena/skills/agent-wallet.md`
- Modify `agent-arena/scripts/validate-skills.ts` if examples are validated.

- [x] **Step 1: Document action lifecycle**

Skill must tell Agents:
- Get registration code.
- Wait for owner claim.
- Use runtime token.
- Read market state and manager state.
- Submit intents.
- Never request private keys.
- Never request withdrawal.
- Use `reduce` and `close` with `positionRef.kind` rather than operation names like `redeem_range`.

- [x] **Step 2: Document raw units**

Spell out:
- DUSDC has 6 decimals.
- BTC price/strike uses Predict raw strike units already returned by API.
- Quantity is raw Predict quantity, not DUSDC amount.

- [x] **Step 3: Document range semantics**

Range settlement is `(lower, higher]` according to the verified Predict source. Direction is not part of `RangeKey`.

- [x] **Step 4: Validate docs**

Run:
```powershell
bun run --cwd agent-arena validate:skills
```
Expected: validation passes.

### Task D4: Frontend Controls and Status

**Files:**
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`
- Modify `agent-arena/apps/frontend/src/components/platform/LiveCompetition.test.tsx`
- Modify `agent-arena/apps/frontend/src/features/predict/live-market.ts`
- Modify `agent-arena/apps/frontend/src/features/predict/live-market.test.ts`

- [x] **Step 1: Add wallet status display**

Show:
- wallet DUSDC balance.
- manager DUSDC balance.
- open directional quantity.
- open range quantity.
- claimable settled state.

- [x] **Step 2: Add owner-only controls**

Show owner-only:
- withdraw from manager.
- copy deposit address.
- refresh balances.

Do not show withdrawal to Agent runtime-token flows, and do not call `/api/arena/internal/*` from browser UI.

- [x] **Step 3: Add range display**

Show selected range as lower/higher raw strike and normalized display price if available.

- [x] **Step 4: Verify frontend tests**

Run:
```powershell
bun run --cwd agent-arena/apps/frontend typecheck
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/TradingWalletPanel.test.tsx src/components/platform/LiveCompetition.test.tsx src/features/predict/live-market.test.ts
```
Expected: all tests pass.

---

## End-to-End Acceptance

- [x] Backend unit tests pass:
```powershell
bun run --cwd agent-arena/apps/backend test
```

- [x] Skill docs validate:
```powershell
bun run --cwd agent-arena validate:skills
```

- [x] Frontend typecheck and targeted tests pass:
```powershell
bun run --cwd agent-arena/apps/frontend typecheck
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/TradingWalletPanel.test.tsx src/components/platform/LiveCompetition.test.tsx src/features/predict/live-market.test.ts
```

- [ ] Live Testnet smoke sequence passes in order:
```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --balance --wallet-id <wallet-id>
bun run --cwd agent-arena/apps/backend smoke:predict -- --setup --wallet-id <wallet-id> --manager-id <manager-id> --deposit-dusdc-raw 1000000
bun run --cwd agent-arena/apps/backend smoke:predict -- --mint-range --wallet-id <wallet-id> --manager-id <manager-id> --oracle-id <oracle-id> --lower-strike-raw <lower> --higher-strike-raw <higher> --quantity-raw 100000 --max-cost-raw 1000000
bun run --cwd agent-arena/apps/backend smoke:predict -- --close-range-last --wallet-id <wallet-id> --manager-id <manager-id> --oracle-id <oracle-id> --lower-strike-raw <lower> --higher-strike-raw <higher> --min-proceeds-raw 1
bun run --cwd agent-arena/apps/backend smoke:predict -- --withdraw-manager-dusdc --wallet-id <wallet-id> --manager-id <manager-id> --amount-raw 1
```

- [ ] Submit smoke is only run after dry-run passes and `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true` is set.

- [ ] Final docs state clearly:
  - Directional trading is complete.
  - Range trading is complete.
  - PredictManager deposit, internal operator withdrawal smoke, and owner-authorized withdrawal are complete.
  - Settled claim is complete for directional and range, subject to Predict oracle settlement readiness.
  - Oracle settlement itself is outside Agent Arena authority.

---

## Suggested Commit Sequence

1. `feat: add range predict execution`
2. `feat: add predict manager withdrawal`
3. `feat: add settled predict claims`
4. `feat: expose final agent predict actions`
5. `docs: update predict execution skills and smoke guide`

Keep any unrelated frontend worktree changes out of backend-only commits.
