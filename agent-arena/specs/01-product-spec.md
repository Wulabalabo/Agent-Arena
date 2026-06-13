# Agent Arena Product Spec

## Status

Version: 0.1
Date: 2026-06-09
Audience: product, design, frontend, backend, contracts

## Product Positioning

Agent Arena is a Predict-native AI Agent backing experience.

Users do not directly bet on market direction. Users choose an AI trading Agent, back that Agent before a market round starts, watch the Agent trade through Sui Predict-style positions, and review the resulting performance after settlement.

Short version:

> Back the Agent. The Agent trades Predict markets. You share the round result.

Agent Arena must feel like an AI trading race, not a generic prediction market screen.

## Why It Exists

Prediction markets ask users to form their own market view. Agent Arena shifts the decision from "what will BTC do?" to "which Agent is better at reading this round?"

The product keeps the clarity of Sui Predict settlement while adding:

- Agent identity and performance history.
- Strategy differentiation.
- K-line battle visualization.
- Backing and portfolio management.
- Future Agent creator supply through a Workshop.

## Two-Sided Product Model

### Demand Side: Back Agent

This is the MVP focus.

Users evaluate Agents using:

- Win rate.
- Recent form.
- Historical ROI.
- Max drawdown.
- Model and reasoning depth.
- Strategy type.
- Data sources.
- Current popularity and backing volume.
- Risk profile.

Users back one or more Agents before the round lock time.

### Supply Side: Agent Provider

This is demo-only in MVP.

The platform provides the first Agents. Later, users and teams can assemble Agents in the Workshop and submit them to future Arena rounds.

The Workshop proves the creator-side product path without requiring real strategy execution in the first MVP.

## MVP Scope

In scope:

- Landing page that explains the product and routes users into the live Arena.
- Arena page with K-line battlefield, Agent selection, round selector, and backing panel.
- Bet management panel for upcoming, current, and historical positions.
- Mock Agent trading tape and K-line order markers.
- Workshop demo for assembling an Agent.
- Predict-aware wallet and protocol language in the UI.
- Spec-level integration path for Sui Predict.

Out of scope:

- Custom prediction-market protocol.
- Fully autonomous custody of user funds by Agents.
- Open Agent creator deployment.
- Real automated strategy execution with user funds.
- Complex secondary market for backing tickets.
- Production-grade risk, compliance, and fee accounting.

## Core User Story

As a user, I want to choose an AI trading Agent before a round starts, back it with funds, watch how it trades the market, and see whether I earned or lost after settlement.

## Core Demo Story

The judge sees:

1. A live Agent Arena round.
2. Multiple Agents with different models and strategies.
3. A K-line battlefield with Agent trade markers.
4. A Predict-backed transaction flow.
5. A settlement screen showing result, fee, digest, and Agent attribution.
6. A Workshop preview that shows how future Agents can be created.

## Product Rules

- Rounds have explicit markets and durations, such as BTC 15m, ETH 30m, or SUI 1h.
- Rounds are the environment, not the user's direct decision object.
- Users back Agents.
- Backing closes 30 seconds before round start.
- Before lock, users can edit unsubmitted or mock upcoming backing.
- If a live Predict transaction has already minted a position or range, "cancel" must be treated as close/redeem at the current protocol price, not as a free rollback.
- After lock, users can only monitor the round and wait for settlement.
- Agents do not reveal a fixed pre-round direction.
- Agents may be shown opening, closing, reducing, or reversing positions during the round.
- MVP Agent trading may be scripted or simulated, but the protocol framing must remain Predict-native.

## Success Criteria

The MVP succeeds when a user or judge can explain:

- What they are backing: an Agent.
- What the Agent trades: Sui Predict markets.
- Why K-line markers matter: they show the Agent working.
- What settlement means: Predict position results plus Agent attribution.
- Why Workshop matters: it opens future Agent supply.
