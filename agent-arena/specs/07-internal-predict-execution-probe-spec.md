# Internal Predict Execution Probe Spec

## Status

Version: 0.2
Date: 2026-06-17
Audience: backend, platform operators, security reviewers

## Purpose

Agent Arena needs a narrow internal execution probe before exposing live trading execution to external AI Agents.

The probe must prove that the platform can:

- Generate a Testnet Sui trading wallet for an Agent.
- Keep private key material server-side.
- Receive Testnet SUI and DUSDC funding into that wallet.
- Create or discover a DeepBook Predict `PredictManager`.
- Deposit DUSDC into the manager.
- Sign and submit Testnet DeepBook Predict transactions for:
  - directional mint,
  - range mint,
  - partial redeem,
  - full close,
  - settled claim or redeem when available.
- Apply pre-submit guardrails, then record post-submit execution facts.
- Record the transaction digest and execution state.

This spec is intentionally internal-only. It is not the public Agent API contract.

## Product Boundary

This probe exists to validate platform-managed signing against the real DeepBook Predict Testnet protocol.

It must not:

- Expose private keys to the frontend, external Agents, logs, browser storage, analytics, skill docs, or registry events.
- Allow arbitrary Sui transaction payloads.
- Support Mainnet.
- Become a generic hosted wallet product.
- Replace DeepBook Predict with custom market logic.
- Treat `agent_arena::registry` as custody, settlement, or signing authority.
- Expose `/api/arena/internal/*` routes, internal tokens, or raw probe execution controls to browsers, public frontend code, public Agent skill docs, or external Agent runtime credentials.
- Promote an internal probe wallet into a formal Agent trading wallet without the `registrationCode -> owner wallet claim -> runtime credential` flow from `06-agent-participation-platform-spec.md`.
- Promise atomic cost or payout protection that the current DeepBook Predict entry points do not enforce onchain.

The platform remains an application layer over DeepBook Predict. DeepBook Predict remains the source of truth for market, position, range, pricing, settlement, and manager state.

## References

Current DeepBook Predict Testnet references:

- Public server: `https://predict-server.testnet.mystenlabs.com`
- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict registry: `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- Quote asset: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- DUSDC decimals: `6`
- Price and strike scale observed from Predict data: `1e9`
- Source branch: `predict-testnet-4-16`

DeepBook Predict functions used by this probe:

- `predict::create_manager`
- `predict::get_trade_amounts`
- `predict::get_range_trade_amounts`
- `predict_manager::deposit`
- `predict::mint`
- `predict::redeem`
- `predict::redeem_permissionless`
- `predict::mint_range`
- `predict::redeem_range`
- `market_key::up`
- `market_key::down`
- `market_key::new`
- `range_key::new`

Sui transaction execution uses Programmable Transaction Blocks and `signAndExecuteTransaction` from the Sui TypeScript SDK.

## Existing Repo State

Current backend state:

- The backend is a Bun TypeScript service.
- Platform execution is mock-backed through `submitIntentWithMockExecution`.
- Backend package does not yet depend on `@mysten/sui`.
- The current platform contract flow already supports:
  - `POST /api/arena/agent/init`,
  - `POST /api/arena/owner/agents/claim`,
  - runtime header `x-agent-arena-agent-token`,
  - mock trading wallet records,
  - mock intent execution.

Current frontend state:

- The live competition screen can read the Predict public server directly.
- It displays BTC spot, forward, oracle expiry, active BTC oracles, oracle trades, and recent Predict position/range flow.
- It does not sign transactions.

## Scope

### In Scope

- Internal-only Testnet wallet generation.
- Local backend key storage for test wallets.
- Balance checks for Testnet SUI and DUSDC.
- PredictManager create or discovery workflow.
- DUSDC manager deposit workflow.
- Minimal internal execution endpoints.
- Sanitized operator summaries for future UI display.
- Dry-run before submit.
- Real signed submit for small test quantities.
- Execution audit records.
- A CLI or smoke script that can run the probe end to end.

### Out Of Scope

- Mainnet support.
- Production custody controls.
- HSM/KMS integration.
- Multi-tenant production wallet management.
- User-facing withdrawal UI.
- Registry write implementation.
- External Agent live execution access.
- Frontend or Agent-skill access to internal signing endpoints.
- Composite strategy actions such as `switch_direction` and `adjust_range`.
- Real Twitter verification.

## Architecture

The execution probe adds a backend-only live execution layer:

```text
Internal API / Smoke Script
  -> Internal auth guard
  -> Test wallet store
  -> Sui client
  -> Predict transaction builder
  -> Risk and operation guard
  -> Signer
  -> Sui Testnet RPC
  -> Predict public server refresh
  -> Execution audit log
```

The first implementation can be backend-only. If the frontend later displays probe results, it must use a separate sanitized summary endpoint that cannot sign, cannot expose private keys, cannot reveal internal tokens, and cannot proxy `/api/arena/internal/*`.

## Runtime Configuration

Required environment variables:

- `AGENT_ARENA_NETWORK=testnet`
- `AGENT_ARENA_SUI_RPC_URL=https://fullnode.testnet.sui.io:443`
- `AGENT_ARENA_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com`
- `AGENT_ARENA_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- `AGENT_ARENA_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- `AGENT_ARENA_SUI_CLOCK_OBJECT_ID=0x6`
- `AGENT_ARENA_QUOTE_ASSET_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- `AGENT_ARENA_QUOTE_DECIMALS=6`
- `AGENT_ARENA_PRICE_DECIMALS=9`
- `AGENT_ARENA_INTERNAL_TOKEN=<local secret>`
- `AGENT_ARENA_WALLET_SECRET=<local encryption secret>`

Optional environment variables:

- `AGENT_ARENA_WALLET_STORE_PATH=apps/backend/data/internal-wallets.json`
- `AGENT_ARENA_EXECUTION_STORE_PATH=apps/backend/data/internal-executions.json`
- `AGENT_ARENA_ALLOW_PRIVATE_KEY_EXPORT=false`

Private key export must remain disabled by default and is outside normal MVP operation. If a local recovery tool is ever added, it must be a CLI-only break-glass command, must require `AGENT_ARENA_ALLOW_PRIVATE_KEY_EXPORT=true`, must not be linked into HTTP route handlers, must emit an audit record, and must redact key material from default output.

## Internal Auth

Every endpoint in this spec must require:

```text
x-agent-arena-internal-token: <AGENT_ARENA_INTERNAL_TOKEN>
```

If the token is missing or invalid, return:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Internal execution probe is not authorized."
  }
}
```

These endpoints must not be listed in public Agent skill docs. Frontend code and external Agent runtimes must never receive `AGENT_ARENA_INTERNAL_TOKEN`. If an operator UI is added later, it must call a separate sanitized summary API, not these internal signing routes.

## Data Model

### InternalTradingWallet

Fields:

- `id`
- `agentId`
- `address`
- `publicKey`
- `keyScheme`: `ed25519`
- `encryptedPrivateKey`
- `bindingMode`: `internal_probe | claimed_agent`
- `createdAt`
- `status`: `funding_required | funded | manager_ready | active | detached`
- `testnetOnly`: `true`

The first implementation should use `bindingMode=internal_probe` only. If `bindingMode=claimed_agent` is added later, the backend must verify that the Agent already completed the owner claim flow from `06-agent-participation-platform-spec.md`.

The private key is generated by the backend and stored encrypted or sealed by the local test wallet store. It is never returned in API responses.

### InternalPredictManagerBinding

Fields:

- `id`
- `walletId`
- `agentId`
- `address`
- `managerId`
- `createdAt`
- `status`: `missing | creating | ready | failed`
- `lastCheckedAt`

### InternalExecution

Fields:

- `id`
- `walletId`
- `agentId`
- `managerId`
- `source`: `internal_probe`
- `operation`
- `oracleId`
- `expiryMs`
- `marketKey`
- `rangeKey`
- `quantityRaw`
- `previewCostRaw`
- `previewPayoutRaw`
- `maxCostRaw`
- `minProceedsRaw`
- `actualCostRaw`
- `actualProceedsRaw`
- `policyDrift`: `none | cost_above_pre_submit_guard | proceeds_below_pre_submit_guard | unknown`
- `dryRunDigest`
- `txDigest`
- `status`: `planned | dry_run_ok | submitted | confirmed | confirmed_policy_drift | failed`
- `errorCode`
- `errorMessage`
- `createdAt`
- `submittedAt`
- `confirmedAt`

### InternalSigningAudit

Fields:

- `id`
- `walletId`
- `agentId`
- `executionId`
- `operation`
- `transactionKind`
- `txDigest`
- `status`
- `createdAt`
- `errorCode`

## API

### Create Internal Wallet

```text
POST /api/arena/internal/wallets
```

Request:

```json
{
  "agentId": "agent_internal_001",
  "bindingMode": "internal_probe",
  "label": "first-live-predict-probe"
}
```

Behavior:

- `bindingMode=internal_probe` is the only required MVP mode.
- Internal probe wallets must use isolated test Agent IDs such as `agent_internal_*`.
- Internal probe wallets must not be promoted into formal Agent trading wallets.
- If a future implementation accepts `bindingMode=claimed_agent`, it must verify that the Agent exists, is owner-claimed, and is eligible for a platform-managed trading wallet under `06-agent-participation-platform-spec.md`.

Response:

```json
{
  "wallet": {
    "id": "wallet_internal_001",
    "agentId": "agent_internal_001",
    "bindingMode": "internal_probe",
    "address": "0x...",
    "publicKey": "...",
    "keyScheme": "ed25519",
    "status": "funding_required",
    "testnetOnly": true,
    "createdAt": "2026-06-17T00:00:00.000Z"
  },
  "funding": {
    "network": "testnet",
    "requiredAssets": [
      {
        "symbol": "SUI",
        "purpose": "gas",
        "suggestedAmount": "1"
      },
      {
        "symbol": "DUSDC",
        "type": "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
        "decimals": 6,
        "purpose": "Predict quote asset",
        "suggestedAmount": "10"
      }
    ]
  }
}
```

The response must not include private key material.

### Get Wallet Balances

```text
GET /api/arena/internal/wallets/:walletId/balances
```

Response:

```json
{
  "walletId": "wallet_internal_001",
  "address": "0x...",
  "balances": {
    "suiMist": "1000000000",
    "sui": "1.000000000",
    "dusdcRaw": "10000000",
    "dusdc": "10.000000"
  },
  "fundingStatus": "funded"
}
```

Balance reads must use Sui RPC for wallet-owned coins. PredictManager balances can be included only after the manager exists.

### Setup Predict Manager

```text
POST /api/arena/internal/predict/setup
```

Request:

```json
{
  "walletId": "wallet_internal_001",
  "depositDusdcRaw": "5000000",
  "dryRunOnly": false
}
```

Behavior:

1. Load wallet by `walletId`.
2. Confirm Testnet network.
3. Confirm wallet has SUI gas.
4. Discover an existing manager:
   - first from local `InternalPredictManagerBinding`,
   - then from the Predict public server `/managers` endpoint or a local event index of `PredictManagerCreated { manager_id, owner }`.
5. Never rely on Sui owned-object lookup for manager discovery. `PredictManager` is a shared object, not a wallet-owned object.
6. When a candidate manager is found, verify onchain that `predict_manager::owner()` equals the trading wallet address.
7. If the manager is missing and `dryRunOnly=true`, dry-run only `predict::create_manager` and return `depositStatus=blocked_until_manager_exists`.
8. If the manager is missing and `dryRunOnly=false`, submit `predict::create_manager`, confirm the new shared manager object id, then persist the binding.
9. Select DUSDC coin objects owned by the wallet.
10. Dry-run the DUSDC deposit against an existing confirmed manager object.
11. If deposit dry-run succeeds and `dryRunOnly=false`, submit `predict_manager::deposit`.
12. Record manager binding and transaction digests.

Response:

```json
{
  "walletId": "wallet_internal_001",
  "address": "0x...",
  "manager": {
    "id": "0x...",
    "status": "ready"
  },
  "setupPhases": {
    "managerDiscovery": "created",
    "ownerVerified": true,
    "depositStatus": "submitted"
  },
  "transactions": [
    {
      "operation": "create_manager",
      "digest": "0x..."
    },
    {
      "operation": "deposit_dusdc",
      "digest": "0x..."
    }
  ]
}
```

If `dryRunOnly` is true, the response must include dry-run result summaries and must not submit transactions. If no manager exists yet, the setup response must make clear that only `create_manager` was dry-run and that deposit dry-run is blocked until a real manager object exists.

### Preview Trade

```text
POST /api/arena/internal/predict/preview
```

Request for directional:

```json
{
  "walletId": "wallet_internal_001",
  "operation": "mint_directional",
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "strikeRaw": "65600000000000",
  "isUp": true,
  "quantityRaw": "100000"
}
```

Request for range:

```json
{
  "walletId": "wallet_internal_001",
  "operation": "mint_range",
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "lowerStrikeRaw": "65500000000000",
  "higherStrikeRaw": "65700000000000",
  "quantityRaw": "100000"
}
```

Behavior:

- Build the relevant `MarketKey` or `RangeKey`.
- Read and validate the referenced `OracleSVI` object before quoting.
- Call `predict::get_trade_amounts` for directional positions or `predict::get_range_trade_amounts` for ranges through dev-inspect or an equivalent read path.
- Return mint cost and redeem payout in raw units and decimal display units.

Response:

```json
{
  "operation": "mint_directional",
  "oracleId": "0x...",
  "quoteAsset": "DUSDC",
  "costRaw": "8006",
  "cost": "0.008006",
  "payoutRaw": "0",
  "payout": "0.000000"
}
```

Preview is advisory. `maxCostRaw` and `minProceedsRaw` are platform pre-submit guardrails, not onchain slippage parameters. The current DeepBook Predict entry points do not accept atomic max-cost or min-payout arguments, so execution must re-check immediately before submit, keep test quantities small, and record post-submit actual cost or proceeds.

### Execute Predict Operation

```text
POST /api/arena/internal/predict/execute
```

Request for directional mint:

```json
{
  "walletId": "wallet_internal_001",
  "operation": "mint_directional",
  "managerId": "0x...",
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "strikeRaw": "65600000000000",
  "isUp": true,
  "quantityRaw": "100000",
  "maxCostRaw": "1000000",
  "dryRunOnly": true
}
```

`dryRunOnly=true` builds the real directional mint PTB and runs Sui dry-run only. `dryRunOnly=false` requests a real Testnet submit and must be rejected unless `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true` is also set. Omitting `dryRunOnly` must fail closed rather than defaulting to submit.

`maxCostRaw` is a platform guardrail and audit bound. It is checked against caller-provided estimates when present and compared against dry-run or post-submit actual cost when available, but it is not enforced atomically by the DeepBook Predict contract.

Request for range mint:

```json
{
  "walletId": "wallet_internal_001",
  "operation": "mint_range",
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "lowerStrikeRaw": "65500000000000",
  "higherStrikeRaw": "65700000000000",
  "quantityRaw": "100000",
  "maxCostRaw": "1000000"
}
```

Request for partial redeem:

```json
{
  "walletId": "wallet_internal_001",
  "operation": "redeem_directional",
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "strikeRaw": "65600000000000",
  "isUp": true,
  "quantityRaw": "50000",
  "minProceedsRaw": "1"
}
```

`minProceedsRaw` is a platform pre-submit guardrail. It is checked against the latest preview or dry-run estimate immediately before submit, but it is not enforced atomically by the DeepBook Predict contract.

Request for close:

```json
{
  "walletId": "wallet_internal_001",
  "operation": "close_directional",
  "oracleId": "0x...",
  "expiryMs": "1781622900000",
  "strikeRaw": "65600000000000",
  "isUp": true,
  "minProceedsRaw": "1"
}
```

Close means "redeem the backend-confirmed full open quantity". The request must not trust a caller-provided close quantity.

Response:

```json
{
  "execution": {
    "id": "exec_internal_001",
    "walletId": "wallet_internal_001",
    "operation": "mint_directional",
    "status": "dry_run_ok",
    "dryRunDigest": "0x...",
    "oracleId": "0x...",
    "quantityRaw": "100000",
    "previewCostRaw": "8006",
    "actualCostRaw": "8006",
    "policyDrift": "none",
    "createdAt": "2026-06-17T00:00:00.000Z"
  },
  "transaction": {
    "operation": "mint_directional",
    "mode": "dry_run",
    "status": "dry_run_ok",
    "actualCostRaw": "8006"
  }
}
```

### List Internal Executions

```text
GET /api/arena/internal/predict/executions?walletId=wallet_internal_001
```

Response:

```json
{
  "executions": [
    {
      "id": "exec_internal_001",
      "operation": "mint_directional",
      "status": "submitted",
      "txDigest": "0x..."
    }
  ]
}
```

## Operation Mapping

The exact PTB object mutability and type argument list must be verified with dry-run against the configured Testnet package before any submit path is enabled. DeepBook Predict Testnet contracts are still provisional, so the builder should fail closed if the package ABI does not match this mapping.

Current implementation status:

- `predict::create_manager`: dry-run and submit wired.
- `predict_manager::deposit<DUSDC>`: dry-run and submit wired after a manager id exists.
- `market_key::up/down` plus `predict::mint<DUSDC>`: dry-run wired, submit guarded by `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true` and explicit `dryRunOnly=false`.
- `market_key::new` plus `predict::redeem<DUSDC>`: dry-run and submit wired for partial directional redeem and full directional close. Partial redeem validates the backend-confirmed position quantity before signing. Close resolves the full position quantity in the backend and rejects caller-provided close quantity.
- `predict::mint_range` and `predict::redeem_range`: planned mapping only; execution must remain disabled until range position resolution, PTB builders, dry-run evidence, and tests are added.

### Create Manager

PTB call:

```text
target: <PREDICT_PACKAGE>::predict::create_manager
arguments:
  - ctx is implicit
```

Expected result:

- New shared `PredictManager`.
- Store returned or created manager object id.
- Deposit cannot be composed against this manager until the shared object exists and the manager id is confirmed.

### Deposit DUSDC

PTB call:

```text
target: <PREDICT_PACKAGE>::predict_manager::deposit
typeArguments:
  - <DUSDC>
arguments:
  - &mut PredictManager
  - Coin<DUSDC>
  - ctx is implicit
```

The implementation must select and split/merge wallet-owned DUSDC coin objects as needed.

### Preview Directional

Read call:

```text
target: <PREDICT_PACKAGE>::predict::get_trade_amounts
arguments:
  - &Predict
  - &OracleSVI
  - MarketKey
  - quantity
  - &Clock
```

Expected result:

- `mintCostRaw`
- `redeemPayoutRaw`

This call is a quote or preview path only. It must not be treated as an atomic price bound for a later submit transaction.

### Preview Range

Read call:

```text
target: <PREDICT_PACKAGE>::predict::get_range_trade_amounts
arguments:
  - &Predict
  - &OracleSVI
  - RangeKey
  - quantity
  - &Clock
```

Expected result:

- `mintCostRaw`
- `redeemPayoutRaw`

This call is a quote or preview path only. It must not be treated as an atomic price bound for a later submit transaction.

### Mint Directional

PTB calls:

```text
key = market_key::up(oracle_id, expiry, strike)
```

or

```text
key = market_key::down(oracle_id, expiry, strike)
```

then:

```text
target: <PREDICT_PACKAGE>::predict::mint
typeArguments:
  - <DUSDC>
arguments:
  - &mut Predict
  - &mut PredictManager
  - &OracleSVI
  - MarketKey
  - quantity
  - &Clock
  - ctx is implicit
```

The current backend records `PositionMinted.cost` as `actualCostRaw` when the event is present. This value is used for policy drift auditing against `maxCostRaw`.

### Redeem Directional

PTB calls:

```text
key = market_key::new(oracle_id, expiry, strike, is_up)
```

then:

```text
target: <PREDICT_PACKAGE>::predict::redeem
typeArguments:
  - <DUSDC>
arguments:
  - &mut Predict
  - &mut PredictManager
  - &OracleSVI
  - MarketKey
  - quantity
  - &Clock
  - ctx is implicit
```

For settled binary positions, `predict::redeem_permissionless` may be used when the operation specifically needs permissionless settled redemption semantics.

The current backend records `PositionRedeemed.payout` as `actualProceedsRaw` when the event is present. Partial redeem must validate that `predict_manager::position(manager, MarketKey)` is greater than or equal to the requested `quantityRaw`. Close must first resolve `predict_manager::position(manager, MarketKey)` and use that full backend-confirmed quantity as `resolvedQuantityRaw`.

### Mint Range

PTB calls:

```text
key = range_key::new(oracle_id, expiry, lower_strike, higher_strike)
```

then:

```text
target: <PREDICT_PACKAGE>::predict::mint_range
typeArguments:
  - <DUSDC>
arguments:
  - &mut Predict
  - &mut PredictManager
  - &OracleSVI
  - RangeKey
  - quantity
  - &Clock
  - ctx is implicit
```

### Redeem Range

PTB calls:

```text
key = range_key::new(oracle_id, expiry, lower_strike, higher_strike)
```

then:

```text
target: <PREDICT_PACKAGE>::predict::redeem_range
typeArguments:
  - <DUSDC>
arguments:
  - &mut Predict
  - &mut PredictManager
  - &OracleSVI
  - RangeKey
  - quantity
  - &Clock
  - ctx is implicit
```

## Quantity And Decimal Rules

Internal execution endpoints must use raw integer strings for execution-critical values:

- `quantityRaw`
- `costRaw`
- `maxCostRaw`
- `minProceedsRaw`
- `strikeRaw`
- `lowerStrikeRaw`
- `higherStrikeRaw`

Display helpers may also return decimal strings:

- DUSDC: divide raw quote amount by `1e6`.
- BTC price and strike: divide raw price by `1e9`.

Do not accept floating point numbers for execution-critical values.

## Market Selection

The internal probe should default to the nearest future active BTC oracle. The Predict public server is the candidate source, not the final signing authority.

Selection rules:

1. Fetch `/status` from the Predict public server.
2. Fetch `/predicts/:predict_id/oracles`.
3. Filter:
   - `underlying_asset === "BTC"`,
   - `status === "active"`,
   - `expiry > current_time_ms`.
4. Sort by expiry ascending.
5. Select the first oracle unless the request specifies an `oracleId`.

Do not select stale active oracles with expiry in the past.

Before preview or submit, the backend must read the selected `OracleSVI` object from Sui RPC and verify:

- the object id matches the selected `oracleId`,
- the oracle belongs to the configured Predict object,
- the expiry matches the request,
- the lifecycle state allows the requested operation,
- the strike or range inputs are valid for the oracle strike grid,
- the object version is fresh enough for the configured retry policy.

If the Predict server response and direct onchain read disagree, use the more restrictive result and do not submit.

## Risk Guardrails

The internal probe is allowed to sign real Testnet transactions, but it still needs hard limits.

Default limits:

- `maxMintCostRaw`: `1000000` DUSDC raw units (`1.000000 DUSDC`) unless explicitly overridden by operator configuration.
- `maxQuantityRaw`: `1000000`.
- `maxExecutionsPerWalletPerHour`: `20`.
- `allowTransfers`: `false`.
- `allowMainnet`: `false`.
- `allowArbitraryMoveCall`: `false`.

Every execute request must:

- Validate `operation` against an enum.
- Validate raw integer strings.
- Validate range requests with `lowerStrikeRaw < higherStrikeRaw` before building `RangeKey`.
- Validate the selected oracle is future active unless redeeming settled exposure.
- Validate wallet has manager binding.
- Validate manager balance or open position before signing.
- Dry-run first.
- Deny submit if dry-run fails.
- Deny submit if the latest pre-submit preview or dry-run estimate exceeds `maxCostRaw`.
- Deny redeem if the latest pre-submit preview or dry-run estimate is below `minProceedsRaw` when provided.
- Record post-submit actual cost or proceeds from events, manager balance delta, or Predict server refresh.
- Mark the execution as `confirmed_policy_drift` if post-submit actual cost exceeds the pre-submit max-cost guardrail or actual proceeds fall below the pre-submit min-proceeds guardrail.

The guardrails above are not atomic slippage protection. The current DeepBook Predict entry points do not accept max-cost or min-payout parameters, so a successful submit can still settle with a different cost or payout than the latest pre-submit estimate. The MVP mitigations are small default quantities, strict operation whitelisting, immediate pre-submit checks, and post-submit audit.

## Funding Workflow

The first live test flow is:

1. Operator calls `POST /api/arena/internal/wallets`.
2. Backend returns the funding address.
3. Operator transfers Testnet SUI and DUSDC to that address.
4. Operator calls `GET /api/arena/internal/wallets/:walletId/balances`.
5. Backend confirms funding status.
6. Operator calls `POST /api/arena/internal/predict/setup` with `dryRunOnly=true` first.
7. Backend dry-runs `predict::create_manager` when no manager exists and blocks deposit until a real manager id exists.
8. Operator explicitly enables Testnet submit and calls setup with `dryRunOnly=false`.
9. Backend creates the manager first, confirms the manager id from events or object changes, and only then deposits DUSDC.
10. Operator runs one small directional mint with `dryRunOnly=true`.
11. Operator explicitly enables Testnet submit and runs the same small directional mint with `dryRunOnly=false`.
12. Operator runs one partial redeem with `dryRunOnly=true`, then with explicit submit when desired.
13. Operator runs one full close with `dryRunOnly=true`, then with explicit submit when desired.
14. Operator runs one range mint and one range redeem after range PTBs are implemented.

The API should return a clear address and funding instruction. It should never ask the operator to paste private key material into chat or frontend.

## Smoke Script

Add a local script:

```text
bun run apps/backend/src/internal-predict-execution-smoke.ts
```

Suggested modes:

```text
--create-wallet
--check-balances --wallet-id <id>
--setup --wallet-id <id> --deposit-dusdc-raw 5000000
--setup --wallet-id <id> --deposit-dusdc-raw 0 --submit
--setup --wallet-id <id> --manager-id <manager-id> --deposit-dusdc-raw 5000000 --submit
--mint-up --wallet-id <id> --manager-id <manager-id> --oracle-id <oracle-id> --quantity-raw 100000 --max-cost-raw 1000000
--mint-up --wallet-id <id> --manager-id <manager-id> --oracle-id <oracle-id> --quantity-raw 100000 --max-cost-raw 1000000 --submit
--redeem-last --wallet-id <id> --manager-id <manager-id> --oracle-id <oracle-id> --quantity-raw 50000 --min-proceeds-raw 1
--redeem-last --wallet-id <id> --manager-id <manager-id> --oracle-id <oracle-id> --quantity-raw 50000 --min-proceeds-raw 1 --submit
--close-last --wallet-id <id> --manager-id <manager-id> --oracle-id <oracle-id> --min-proceeds-raw 1
--close-last --wallet-id <id> --manager-id <manager-id> --oracle-id <oracle-id> --min-proceeds-raw 1 --submit
--mint-range --wallet-id <id> --quantity-raw 100000 --max-cost-raw 1000000
--redeem-range-last --wallet-id <id> --quantity-raw 50000 --min-proceeds-raw 1
```

The script may call the internal HTTP API or import backend modules directly. It must redact private keys in output.

Real submit must remain opt-in. `--submit` is not enough by itself; the local environment must also set `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`. Without both gates, setup, directional mint, partial directional redeem, and close return `PREDICT_SUBMIT_DISABLED`.

## Error Codes

Required error codes:

- `UNAUTHORIZED`
- `TESTNET_ONLY`
- `WALLET_NOT_FOUND`
- `PRIVATE_KEY_UNAVAILABLE`
- `FUNDING_REQUIRED`
- `INSUFFICIENT_SUI_GAS`
- `INSUFFICIENT_DUSDC`
- `MANAGER_NOT_FOUND`
- `MANAGER_SETUP_FAILED`
- `ORACLE_NOT_FOUND`
- `ORACLE_NOT_TRADEABLE`
- `POSITION_NOT_FOUND`
- `RANGE_POSITION_NOT_FOUND`
- `INVALID_RAW_AMOUNT`
- `DRY_RUN_FAILED`
- `MAX_COST_EXCEEDED`
- `MIN_PROCEEDS_NOT_MET`
- `POLICY_DRIFT_DETECTED`
- `PREDICT_TX_FAILED`
- `RPC_UNAVAILABLE`

## Security Requirements

- Private keys are generated backend-side only.
- Private keys are encrypted or sealed before persistence.
- Private keys are never returned from HTTP endpoints.
- Logs must redact:
  - private keys,
  - encrypted private keys,
  - runtime tokens,
  - internal tokens.
- The signer module must accept only typed operation plans, not arbitrary Move call requests.
- The probe signer module must require an `InternalExecution` record with `source=internal_probe` before signing.
- Formal external Agent execution must still require a stored `intentId`, `riskDecisionId`, and `executionId` before signing, as specified by `06-agent-participation-platform-spec.md`.
- The signer module must write an `InternalSigningAudit` record for every attempt.
- The internal API must reject non-Testnet configuration.
- The internal API must be disabled if `AGENT_ARENA_INTERNAL_TOKEN` is missing.
- Internal routes must not be registered into any public frontend proxy, public skill docs route map, or browser-accessible API client.
- Private key export, if ever implemented, must be a CLI-only break-glass path with audit logging and no HTTP handler.

## Acceptance Criteria

The spec is implemented when:

- A backend test proves wallet creation returns an address but never private key material.
- A backend test proves internal endpoints require `x-agent-arena-internal-token`.
- A backend test proves raw amount validation rejects floats and unsafe strings.
- A backend test proves stale active oracles are not selected.
- A backend test proves operation builders generate only whitelisted Predict operations.
- A backend test proves frontend-accessible clients cannot call `/api/arena/internal/*` or access `x-agent-arena-internal-token`.
- A backend test proves internal probe wallets cannot bypass the formal claimed-Agent wallet path.
- A backend test proves missing-manager setup dry-runs only `create_manager` and does not pretend to dry-run `deposit`.
- A backend test proves manager discovery does not rely on Sui owned-object lookup and verifies manager owner onchain.
- A backend test proves preview uses `get_trade_amounts` or `get_range_trade_amounts`.
- A backend test proves submit reads `OracleSVI` onchain and rejects mismatched server/onchain state.
- A backend test proves `maxCostRaw` and `minProceedsRaw` are treated as pre-submit guardrails and post-submit drift is audited.
- A smoke script can generate a Testnet address for funding.
- After SUI and DUSDC are funded, the smoke script can report balances.
- After funding, setup can create or reuse a `PredictManager`.
- After setup, setup can deposit DUSDC into the manager.
- A small directional mint can be dry-run and then submitted.
- A partial directional redeem can be dry-run and then submitted after backend position validation.
- A full close can redeem the backend-confirmed remaining quantity without accepting caller quantity.
- A small range mint can be dry-run and then submitted after range PTBs are implemented.
- A range redeem can be dry-run and then submitted after range position resolution is implemented.
- Every submitted transaction has a digest, execution record, and signing audit.
- No frontend code path can access private keys.
- No external Agent runtime credential can call the internal probe endpoints.

## Implementation Order

1. Add backend Sui SDK dependency and config loader.
2. Add internal auth guard.
3. Add wallet generation and local encrypted test wallet store.
4. Add wallet balance reads for SUI and DUSDC.
5. Add Predict server candidate reads and direct onchain `OracleSVI` confirmation.
6. Add PredictManager discovery through local binding, Predict server, or event index, with onchain owner verification.
7. Add two-phase setup: create manager first, then deposit after the manager object exists.
8. Add preview builders for `get_trade_amounts` and `get_range_trade_amounts`.
9. Add operation builders for market keys, directional mint, and directional redeem.
10. Add dry-run wrapper and ABI fail-closed gate for directional mint/redeem.
11. Add signed submit wrapper with pre-submit guardrails and post-submit policy drift audit for directional mint/redeem.
12. Add execution and signing audit persistence.
13. Add smoke script.
14. Run create-wallet and funding handoff.
15. After funding, run setup, directional mint, partial redeem, and close.
16. Add range key, range mint, and range redeem PTBs.

## Open Questions

- Whether the first implementation should persist test wallets in SQLite or a local encrypted JSON file. SQLite is preferable if it can reuse existing backend persistence patterns.
- Whether manager discovery should rely on the Predict public server `/managers` endpoint or a local event index of `PredictManagerCreated`. Direct owner-object lookup is not valid because `PredictManager` is shared.
- Whether settled binary claims should use `redeem` or `redeem_permissionless` in the MVP smoke. Use `redeem` for wallet-owned close flows; reserve `redeem_permissionless` for explicit settled-claim testing.
- Whether range settled claim needs a separate product term. The protocol path is still `redeem_range`.
