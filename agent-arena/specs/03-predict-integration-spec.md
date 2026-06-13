# Sui Predict Integration Spec

## Status

Version: 0.1
Date: 2026-06-09
Audience: frontend, backend, contracts

## Purpose

Agent Arena must use Sui Predict as the underlying market and settlement protocol.

Agent Arena must not build a custom prediction-market protocol for the MVP.

Official reference:

- Predict package README: `https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict`
- Predict source: `https://raw.githubusercontent.com/MystenLabs/deepbookv3/predict-testnet-4-16/packages/predict/sources/predict.move`

## Current Public Integration Targets

From the Predict README at the time this spec was written:

- Public server: `https://predict-server.testnet.mystenlabs.com`
- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- Current quote asset: `e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`

These values are testnet-specific and must be configurable.

## Predict Concepts Used By Agent Arena

### Predict

Shared protocol object. Treat it as the market root.

### PredictManager

Per-user trading account. It holds the user's deposited quote balances and position/range quantities.

Important:

- Users need a PredictManager before trading.
- Positions and ranges are stored inside the manager.
- Positions and ranges are not standalone NFTs.

### OracleSVI

Market state for one underlying and one expiry.

Agent Arena rounds should map to active OracleSVI markets.

### Position

Directional binary position keyed by:

`(oracle_id, expiry, strike, is_up)`

### Range

Vertical range position keyed by:

`(oracle_id, expiry, lower_strike, higher_strike)`

## Read Paths

The app should use three read paths.

### Public Predict Server

Use for most page rendering:

- Protocol status.
- Predict state.
- Oracle list.
- Oracle state.
- Manager summary.
- Position summary.
- PnL.
- Mint/redeem history.
- Range mint/redeem history.
- Trades.

Relevant endpoints from README:

- `GET /status`
- `GET /predicts/:predict_id/state`
- `GET /predicts/:predict_id/oracles`
- `GET /oracles/:oracle_id/state`
- `GET /managers`
- `GET /managers/:manager_id/summary`
- `GET /managers/:manager_id/positions/summary`
- `GET /managers/:manager_id/pnl?range=ALL`
- `GET /positions/minted`
- `GET /positions/redeemed`
- `GET /ranges/minted`
- `GET /ranges/redeemed`
- `GET /trades/:oracle_id`

### Sui Live Stream

Use only when the UI needs live oracle tape.

Events to watch:

- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

### Direct On-Chain Reads

Use for confirmation-critical state:

- User PredictManager before transaction.
- Target OracleSVI before transaction.
- Quote coin before deposit.
- Transaction effects after submit.

Do not use direct chain reads as the primary list or history backend.

## Wallet Transaction Flows

### Create Manager

When user has no manager:

- Entry point: `predict::create_manager`
- Result: new shared PredictManager.

UI state:

- Show "Create PredictManager" before Back Agent.
- After confirmation, refresh manager state.

### Fund Manager

When manager has insufficient quote balance:

- Use `predict_manager::deposit`.
- Quote asset is currently DUSDC on testnet.

UI state:

- Show required balance.
- Show deposit CTA.
- Refresh manager summary after confirmation.

### Back Agent With Directional Position

Use when Agent strategy chooses a binary direction.

- Entry point: `predict::mint<Quote>`
- Inputs: Predict, PredictManager, OracleSVI, MarketKey, quantity, Clock.

Agent Arena attribution must record:

- User address.
- Manager id.
- Round id.
- Agent id.
- Oracle id.
- MarketKey.
- Quantity.
- Transaction digest.

### Back Agent With Range Position

Use when Agent strategy chooses a range.

- Entry point: `predict::mint_range<Quote>`
- Inputs: Predict, PredictManager, OracleSVI, RangeKey, quantity, Clock.

Agent Arena attribution must record:

- User address.
- Manager id.
- Round id.
- Agent id.
- Oracle id.
- RangeKey.
- Quantity.
- Transaction digest.

### Redeem

Directional positions:

- `predict::redeem<Quote>`
- `predict::redeem_permissionless<Quote>` for settled positions.

Ranges:

- `predict::redeem_range<Quote>`

UI state:

- Before settlement: show live or estimated value.
- After settlement: show redeem available.
- After redeem: show result and digest.

### Cancel And Modify Boundary

Mock or unsubmitted backing can be cancelled or modified before the app-level lock time.

Once the user signs a Predict mint transaction, there is no free "cancel" operation. Reducing or exiting exposure must be represented as a redeem/close flow, and the returned value may differ from the original backing amount because protocol pricing, spread, oracle state, and settlement state can change.

## Product Boundary

MVP should not claim that Agents can autonomously move user funds without user approval.

MVP should say:

- User backs an Agent.
- The app builds a Predict transaction from that Agent's strategy.
- User signs the transaction.
- Agent Arena records attribution and shows the Agent's live strategy tape.

Future mode:

- Agent Pool or Vault Adapter can custody pooled funds.
- Agent can execute Predict trades on behalf of the pool.
- Users own pool shares.
- Settlement distributes pool result.

This future mode is not MVP.

## Required Config

Frontend config must support:

- Predict server URL.
- Predict package id.
- Predict object id.
- Quote asset type.
- Network name.
- Feature flag for mock Predict data.
- Feature flag for live wallet transaction flow.

## Design Implications

The UI must say "Back Agent" first.

The UI may disclose:

- Underlying Predict oracle.
- Expiry.
- Strike or range.
- Position type.
- Manager id.
- Transaction digest.

The UI must avoid making the main action look like a direct UP/DOWN prediction market button.

The UI must avoid promising free cancellation for live Predict positions.
