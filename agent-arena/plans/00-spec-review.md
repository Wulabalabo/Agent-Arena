# Spec Review

Date: 2026-06-09

## Scope

Reviewed:

- `agent-arena/specs/README.md`
- `agent-arena/specs/01-product-spec.md`
- `agent-arena/specs/02-frontend-page-spec.md`
- `agent-arena/specs/03-predict-integration-spec.md`
- `agent-arena/specs/04-agent-workshop-spec.md`
- `agent-arena/specs/05-data-state-and-acceptance-spec.md`

External protocol references checked:

- `https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict`
- `https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/predict.move`

## Findings

### Fixed: Cancel/Modify Semantics Were Too Broad

Original wording could imply a user can freely cancel or modify a backing before lock even after a live Predict mint transaction has already created exposure.

That is not a safe Predict-native product statement. Once a Predict position or range is minted, exiting exposure is a close/redeem flow, and the returned value may differ from the original backing amount.

Updated specs now distinguish:

- Mock or unsubmitted backing: can be cancelled or modified before `locksAt`.
- Minted Predict exposure: can only be reduced through close/redeem semantics when protocol state allows it.

Affected files:

- `agent-arena/specs/01-product-spec.md`
- `agent-arena/specs/02-frontend-page-spec.md`
- `agent-arena/specs/03-predict-integration-spec.md`
- `agent-arena/specs/05-data-state-and-acceptance-spec.md`

## No Blocking Issues

No remaining blocking issue was found for starting development planning.

The specs are aligned on these product and implementation boundaries:

- Agent-first user experience.
- Market round as the arena environment.
- Sui Predict as the required underlying protocol.
- Mock-first Agent execution in MVP.
- No custom prediction-market protocol.
- Wallet-signed Predict actions rather than autonomous user-fund control by Agents.
- Workshop as demo-only supply-side preview.

## Follow-Up Risks For Development

- Predict testnet package ids and server endpoints can change and must remain configurable.
- The UI must avoid becoming an UP/DOWN market-first screen.
- The UI must not imply guaranteed returns.
- Workshop must not imply real deployment until live creator flow exists.
- Live Predict integration should use generated bindings or a contained adapter rather than scattered raw call strings.
