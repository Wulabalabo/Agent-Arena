# Auto Range Smoke Design

## Goal

Build a narrow Testnet smoke workflow that proves Agent Arena can use the current DeepBook Predict BTC 15 minute market to:

1. Discover the nearest active future BTC oracle.
2. Select a safe test range from current oracle price data.
3. Dry-run and optionally submit `mint_range`.
4. Dry-run and optionally submit `close_range_last`.
5. Dry-run and optionally submit a tiny `withdraw_manager_dusdc`.

This design is for internal operator validation only. It does not expose new Agent runtime actions and does not complete the production Agent intent to Predict signing bridge.

## Context

The backend already has PTB builders, guardrails, internal API routes, and smoke flags for:

- `mint_range`
- `redeem_range_last`
- `close_range_last`
- `withdraw_manager_dusdc`

The missing part is a repeatable live Testnet path that can choose the market parameters without hand-filled `AGENT_ARENA_SMOKE_*` values. Since this project is Testnet-only, the runner may select a practical range around the current BTC price. The runner must still output every raw parameter it selected so we can audit and reproduce the transaction.

## Non-Goals

- No mainnet support.
- No frontend UI changes.
- No Agent runtime-token access to internal smoke routes.
- No settled claim live smoke in this phase. Settled claim remains implemented but requires a settled oracle and existing claimable exposure.
- No composite Agent actions such as `adjust_range`.
- No contract changes.

## Recommended Approach

Add an internal smoke mode that can be invoked from the backend CLI:

```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id>
```

By default it runs dry-run only. A dry-run mint does not create a real range position, so the runner must not automatically try to close that just-dry-run position. If `--submit` is passed and `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`, it submits in this order:

1. `mint_range`
2. `close_range_last`
3. optional `withdraw_manager_dusdc --amount-raw 1`

The existing low-level flags stay available for manual debugging.

## Execution Modes

Dry-run mode:

- Select current BTC oracle and range.
- Dry-run `mint_range`.
- Do not run `close_range_last` unless the operator explicitly asks to close an already existing matching range position.
- Do not run withdrawal.

Submit mode:

- Select current BTC oracle and range.
- Submit `mint_range`.
- Close the same range using `close_range_last` after the mint confirms.
- Optionally run tiny manager withdrawal after close succeeds.

## Data Flow

1. Load Testnet Predict config from `apps/backend/.env`.
2. Fetch Predict server status and the configured Predict object's oracle list.
3. Select the nearest active future BTC oracle.
4. Fetch that oracle state.
5. Derive a test range from the latest BTC price:
   - Prefer `forward` if present.
   - Fall back to `spot`.
   - Use a symmetric default band around the chosen price, for example +/- 0.5%.
   - Convert to raw Predict price units using configured price decimals.
   - Snap to a conservative whole-price raw boundary if strike-grid data is unavailable from the public API.
   - Ensure `lowerStrikeRaw < higherStrikeRaw`.
6. Build a `mint_range` smoke payload with:
   - `walletId`
   - `managerId`
   - selected `oracleId`
   - selected `expiryMs`
   - selected `lowerStrikeRaw`
   - selected `higherStrikeRaw`
   - small `quantityRaw`, default `100000`
   - `maxCostRaw`, default `1000000`
7. Run through the existing internal execute route.
8. In submit mode, call `close_range_last` without caller quantity after `mint_range` confirms. The backend must resolve the full range position.
9. For withdrawal, call `withdraw_manager_dusdc` with `amountRaw=1` only after range close submit has succeeded.

## Range Selection Policy

The selected range is intentionally a test range, not a trading strategy.

Default policy:

- Price source: `forward` first, otherwise `spot`.
- Band: +/- 0.5% around the price.
- Raw scale: `price * 10^AGENT_ARENA_PREDICT_PRICE_DECIMALS`.
- Rounding:
  - lower: round down to the nearest whole USD raw unit.
  - higher: round up to the nearest whole USD raw unit.
- Minimum width: if rounding collapses the range, widen to at least one whole USD on each side.

The command should print a summary before execution:

```json
{
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "priceSource": "forward",
  "referencePrice": "65611.18",
  "lowerStrikeRaw": "65283000000000",
  "higherStrikeRaw": "65940000000000",
  "quantityRaw": "100000",
  "maxCostRaw": "1000000",
  "submitRequested": false
}
```

## Safety Rules

- Dry-run is the default.
- Submit requires both `--submit` and `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`.
- The runner must refuse non-Testnet config.
- The runner must refuse missing wallet or manager id.
- Private key material and wallet secret must never be printed.
- The runner must not call browser or public Agent APIs.
- If mint submit fails, it must not continue to close or withdraw.
- If close dry-run or submit fails, it must not run withdrawal.
- If manager balance is insufficient for withdrawal, the existing withdrawal guardrail should return a stable error.

## Output Contract

The smoke output should be machine-readable JSON with these top-level sections:

- `ok`
- `mode`: `dry_run` or `submit`
- `selectedMarket`
- `steps`
- `errors`

Each step should include:

- `name`
- `ok`
- `operation`
- `status`
- `executionId` when available
- `digest` when submitted and confirmed
- redacted request summary

## Error Handling

Stable operator-facing errors:

- `NO_ACTIVE_BTC_ORACLE`
- `ORACLE_PRICE_UNAVAILABLE`
- `RANGE_SELECTION_INVALID`
- `AUTO_RANGE_MINT_FAILED`
- `AUTO_RANGE_CLOSE_FAILED`
- `AUTO_RANGE_WITHDRAW_FAILED`
- existing internal API validation or guardrail codes

All errors should preserve enough selected-market context to debug without exposing secrets.

## Tests

Backend tests should cover:

- Selects nearest active future BTC oracle.
- Uses forward price before spot.
- Falls back to spot when forward is absent.
- Produces raw strikes with `lower < higher`.
- Refuses when no active future BTC oracle exists.
- Builds mint payload with selected raw range.
- Builds close payload without caller quantity.
- Does not run close if mint fails.
- Does not run withdrawal if close fails.
- Keeps dry-run as default.
- Requires explicit submit gate for submit mode.
- Redacts tokens, secrets, and private key material from output.

## Acceptance

Local acceptance:

```powershell
bun test agent-arena/apps/backend/src/internal-predict-execution-smoke.test.ts
bun run --cwd agent-arena/apps/backend test
```

Live Testnet acceptance:

```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id>
```

Expected dry-run result:

- `ok=true`
- selected BTC oracle is active and future-dated
- selected raw range is printed
- `mint_range` dry-run succeeds
- `close_range_last` is skipped because the dry-run mint created no position

Submit acceptance, only after dry-run:

```powershell
bun run --cwd agent-arena/apps/backend smoke:predict -- --auto-range-smoke --wallet-id <wallet-id> --manager-id <manager-id> --submit
```

Expected submit result:

- `mint_range` returns a confirmed digest.
- `close_range_last` returns a confirmed digest for the backend-resolved range quantity.
- tiny manager withdrawal dry-run or submit is reported according to the selected flags.

## Follow-Up Boundary

After this smoke is proven live on Testnet, the next separate design should wire Agent runtime intents to the real Predict adapter. That work must bind claimed Agent, platform wallet, PredictManager id, raw market fields, risk decision, and execution record before signing.
