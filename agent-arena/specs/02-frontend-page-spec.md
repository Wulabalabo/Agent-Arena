# Frontend Page Spec

## Status

Version: 0.1
Date: 2026-06-09
Audience: product, design, frontend

## Design Goal

Design the app as a usable Agent backing product, not a marketing-only page.

The first demo path must be:

Landing Page -> Live Arena -> Back Agent -> Watch Round -> Settlement -> Workshop Preview

The experience should feel dense, live, and operational. Avoid oversized marketing cards, decorative hero-only layouts, and pages that require long scrolling to understand the core loop.

## Information Architecture

Primary navigation:

- Lobby
- Live Arena
- Workshop
- Portfolio

MVP can keep Portfolio as a panel inside Arena, but the design should reserve room for a future standalone page.

## Page 1: Landing / Lobby

Purpose:

- Explain Agent Arena quickly.
- Show current and upcoming rounds.
- Route users into Live Arena.
- Show that the product is built on Sui Predict.

Required sections:

- First viewport product statement.
- Current live or upcoming Arena card.
- Top Agents preview.
- "How it works" three-step strip.
- Workshop teaser.
- Predict-native proof strip.

Primary copy:

- Headline: "Back AI trading agents in Sui Predict arenas."
- Subcopy: "Choose an Agent, watch it trade Predict markets, and review the round result after settlement."
- Primary action: "Enter Live Arena"
- Secondary action: "Open Workshop"

Current round card must show:

- Market, such as BTC 15m.
- Round status: upcoming, locking, live, settling, settled.
- Time to lock.
- Time to start or end.
- Number of Agents.
- Total backing volume.
- Top Agent by popularity.

Top Agents preview must show:

- Agent name and avatar.
- Strategy type.
- Win rate.
- Recent form.
- Risk label.
- Current popularity.

## Page 2: Live Arena

Purpose:

- Let users select a round.
- Let users compare Agents.
- Let users back an Agent before lock.
- Let users watch Agent behavior during the round.
- Let users understand settlement.

Recommended layout:

- Top bar: product nav, wallet state, Predict network status.
- Round selector row: market and duration tabs.
- Main center: K-line battlefield.
- Left or bottom rail: Agent selection.
- Right rail: selected Agent and Backing panel.
- Lower compact area or tab: Portfolio / activity tape.

### Round Selector

The round selector is a race schedule, not a direct market direction picker.

Each round button shows:

- Market pair or oracle symbol.
- Duration.
- Status.
- Lock countdown.
- Total backing volume.

Example labels:

- BTC 15m
- ETH 30m
- SUI 1h

Status states:

- Upcoming
- Locking
- Live
- Settling
- Settled

Locking begins at T-minus 30 seconds.

### K-Line Battlefield

The K-line chart is the emotional core of the Arena page.

It must show:

- Candles.
- Current price.
- Round start and end boundaries.
- Lock boundary.
- Agent order markers.
- Agent position changes.
- Hover details for each marker.

Marker types:

- Enter long.
- Enter short.
- Reduce.
- Close.
- Reverse.
- Stop loss.
- Take profit.

Marker tooltip must show:

- Agent name.
- Timestamp.
- Action.
- Price.
- Position size or confidence.
- Short reason.
- Related Predict position or range label when available.

Design note:

- Markers should use each Agent's color and avatar initials.
- The chart should make Agents feel active without overwhelming the candle view.

### Agent Selection Panel

Purpose:

- Help users choose which Agent to back.

Each Agent card must show:

- Avatar or emblem.
- Name.
- Strategy type.
- Model label.
- Reasoning depth.
- Win rate.
- Historical ROI.
- Max drawdown.
- Recent form.
- Current backing volume.
- Risk label.
- Popularity rank.

Agent card states:

- Default.
- Hover/focus.
- Selected.
- Backed by user.
- Locked.
- Settled winner/positive.
- Settled loser/negative.

Sorting modes:

- Leaderboard.
- Win rate.
- Backing volume.
- Risk adjusted.
- Recent form.

### Selected Agent Panel

Purpose:

- Show enough detail to justify a backing decision.

Required fields:

- Agent thesis.
- Model.
- Reasoning depth.
- Strategy.
- Data inputs.
- Historical win rate.
- Recent round outcomes.
- Max drawdown.
- Best market type.
- Risk profile.
- Current backing pool.
- Demo confidence label.

Live fields:

- Current simulated Predict exposure.
- Floating PnL.
- Last action.
- Last reasoning snippet.
- Position status: flat, long, short, range, closed.

### Back Agent Panel

Purpose:

- Convert selected Agent into a backing action.

Required controls:

- Amount input.
- Quick amount buttons.
- Selected Agent summary.
- Round lock countdown.
- Transaction readiness checklist.
- Primary action button.

Button states:

- Connect wallet.
- Create PredictManager.
- Deposit quote asset.
- Back Agent.
- Locked.
- Confirming.
- Backed.
- Failed.

Important UX rule:

- The user must feel they are backing an Agent.
- The panel can disclose the underlying Predict action, but it must not visually become a direct UP/DOWN betting panel.

### Bet Management Panel

Tabs:

- Upcoming.
- Current.
- History.

Upcoming items show:

- Round.
- Agent.
- Amount.
- Lock countdown.
- Status.
- Cancel action for mock or unsubmitted backing.
- Modify action for mock or unsubmitted backing.
- Close/redeem action for already minted Predict positions when available.

Current items show:

- Round.
- Agent.
- Backed amount.
- Current estimated value.
- Agent live PnL.
- Position status.
- View on chart action.

History items show:

- Round.
- Agent.
- Result.
- ROI.
- Fee.
- Redeem/claim state.
- Transaction digest.
- Replay action.

Rules:

- Cancel and modify are allowed only for mock or unsubmitted backing before T-minus 30 seconds.
- Already minted Predict positions cannot be freely cancelled. The UI must label the action as close or redeem and show that value can differ from the original backing amount.
- After lock, actions become disabled and must explain why.

## Page 3: Settlement View

Purpose:

- Show the result clearly.

Required content:

- Round summary.
- Agent final PnL.
- User backed amount.
- Gross result.
- Fee.
- Net result.
- Predict transaction digest.
- Redeem/claim state.
- Agent trade replay summary.

Tone:

- Use plain financial language.
- Avoid implying guaranteed returns.

## Page 4: Workshop

Purpose:

- Demo how future Agent supply will work.

This page is mock-only in MVP.

It must show:

- Agent Brain.
- Strategy.
- Data Inputs.
- Risk Profile.
- Preview.
- Deploy to Arena mock action.

Design should feel like a configuration workbench, not a wizard with large marketing panels.

## Responsive Requirements

Desktop:

- Arena should fit the main workflow in one viewport when possible.
- K-line chart must remain visually dominant.
- Right panel must not become taller than the viewport without internal scrolling.

Mobile:

- Use stacked tabs: Chart, Agents, Backing, Portfolio.
- Backing action should remain reachable from Agent detail.
- Avoid horizontal scrolling.

## Accessibility And State Requirements

- All buttons need clear disabled reasons.
- Countdown state must be readable without color alone.
- Profit and loss must use both color and sign.
- Agent card selection must be keyboard reachable.
- Tooltips must not be the only place critical information appears.
