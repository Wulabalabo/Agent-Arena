# Data, State, And Acceptance Spec

## Status

Version: 0.1
Date: 2026-06-09
Audience: frontend, backend, contracts, QA

## Domain Objects

### ArenaRound

Fields:

- `id`
- `marketSymbol`
- `durationLabel`
- `status`
- `startsAt`
- `locksAt`
- `endsAt`
- `predictOracleId`
- `predictExpiry`
- `totalBackingVolume`
- `agentIds`

Statuses:

- `upcoming`
- `locking`
- `live`
- `settling`
- `settled`

### Agent

Fields:

- `id`
- `name`
- `avatar`
- `model`
- `reasoningDepth`
- `strategyType`
- `strategySummary`
- `dataInputs`
- `winRate`
- `historicalRoi`
- `maxDrawdown`
- `recentForm`
- `riskLabel`
- `supportedPositionTypes`

### AgentRoundState

Fields:

- `roundId`
- `agentId`
- `status`
- `currentExposure`
- `floatingPnl`
- `lastAction`
- `lastReason`
- `tradeMarkers`
- `finalRoi`

### TradeMarker

Fields:

- `id`
- `roundId`
- `agentId`
- `timestamp`
- `candleIndex`
- `action`
- `price`
- `confidence`
- `reason`
- `predictPositionLabel`

Actions:

- `enter_long`
- `enter_short`
- `mint_range`
- `reduce`
- `close`
- `reverse`
- `take_profit`
- `stop_loss`

### BackingPosition

Fields:

- `id`
- `userAddress`
- `managerId`
- `roundId`
- `agentId`
- `amount`
- `status`
- `createdAt`
- `updatedAt`
- `predictTxDigest`
- `predictPositionType`
- `marketKey`
- `rangeKey`
- `estimatedValue`
- `finalValue`
- `fee`
- `redeemTxDigest`

Statuses:

- `draft`
- `pending_signature`
- `submitted`
- `backed`
- `locked`
- `live`
- `redeemable`
- `redeemed`
- `cancelled`
- `failed`

## State Rules

- A round enters locking at `locksAt`, which is 30 seconds before `startsAt`.
- Mock or unsubmitted backing can be created, modified, or cancelled only before `locksAt`.
- Already minted Predict exposure can only be reduced through close/redeem semantics when the protocol state allows it.
- After `locksAt`, backing becomes locked.
- A live round can update Agent trade markers and floating PnL.
- Settlement can only appear after Predict oracle settlement or MVP mock settlement.
- Redeem requires a Predict-ready state and wallet action unless using settled permissionless redeem.

## MVP Mock Data Requirements

The MVP must include deterministic mock data for:

- At least 3 rounds.
- At least 6 Agents.
- At least 20 candles for the primary round.
- At least 10 trade markers across Agents.
- At least 1 user upcoming backing.
- At least 1 user live backing.
- At least 2 historical positions.
- At least 1 settled positive result.
- At least 1 settled negative result.

## Frontend Acceptance Criteria

Landing:

- User can see current or upcoming round.
- User can enter Live Arena.
- User can open Workshop.
- Predict-native framing is visible.

Live Arena:

- User can switch between rounds.
- User can select an Agent.
- K-line chart shows Agent markers.
- Selected Agent panel updates correctly.
- Backing panel shows lock countdown.
- Button state changes based on wallet/manager/deposit/mock readiness.
- Locked rounds prevent cancel and modify actions.

Bet Management:

- Upcoming tab supports cancel and modify before lock for mock or unsubmitted backing.
- Upcoming tab labels live Predict exits as close/redeem, not free cancellation.
- Current tab shows live status and estimated value.
- History tab shows result, fee, digest, and replay entry.

Workshop:

- User can configure brain, strategy, data inputs, and risk.
- Preview updates from selected options.
- Deploy action shows mock success and does not claim real deployment.

Settlement:

- Settled result shows gross result, fee, net result, and digest.
- Positive and negative outcomes are visually distinct.
- Result can be traced back to Agent and round.

## Predict Integration Acceptance Criteria

Spec-level MVP:

- Config includes Predict server URL, package id, object id, quote asset, and mock/live flags.
- UI labels distinguish Agent Arena attribution from underlying Predict position.
- Manager-required state is represented in the transaction checklist.
- Deposit-required state is represented in the transaction checklist.
- Mint and mint_range are represented as possible Agent strategy outputs.
- Redeem and redeem_range are represented in settlement.

Live integration future:

- App reads round market data from Predict server.
- App reads user manager summary from Predict server or chain.
- App creates manager if missing.
- App deposits DUSDC if needed.
- App mints a position or range from selected Agent strategy.
- App refreshes server and chain state after transaction confirmation.

## Non-Functional Requirements

- Arena desktop layout should avoid page-level vertical overflow in normal desktop viewports.
- Mobile layout must use tabs or stacked sections and avoid horizontal scrolling.
- Disabled controls must explain the reason.
- PnL must use sign and color, not color alone.
- Wallet transaction failures must keep user-entered amount and selected Agent.
- Mock mode must be clearly separated from live mode in config and UI labels.

## Risks

- Users may think they are directly choosing UP/DOWN. The UI must keep Agent as the main decision object.
- Users may think Agents can control their funds automatically. MVP must disclose wallet-signed Predict actions.
- Predict package ids and server endpoints are testnet-specific and may change.
- Workshop could look like real deployment. MVP must label it as demo/preview.

## Definition Of Done For Spec-To-Plan

The development plan can start when:

- Design has enough detail to create Landing, Arena, Workshop, and Portfolio views.
- Predict integration states are clear enough for mock-first frontend work.
- Data objects are stable enough to define TypeScript types.
- Acceptance criteria are specific enough to create tests.
