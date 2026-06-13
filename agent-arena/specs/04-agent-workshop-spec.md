# Agent Workshop Spec

## Status

Version: 0.1
Date: 2026-06-09
Audience: product, design, frontend

## Purpose

Agent Workshop demonstrates the future supply side of Agent Arena.

MVP Workshop is mock-only. It should not be treated as real Agent deployment, real strategy execution, or a permissionless creator system.

## Product Story

Today, platform-provided Agents compete in Arena rounds.

Tomorrow, users and teams can assemble Agents, define strategy and data inputs, and submit them into future Predict arenas.

## Page Structure

Workshop should feel like a configuration workbench.

Required sections:

1. Agent Brain.
2. Strategy.
3. Data Inputs.
4. Risk Profile.
5. Agent Preview.
6. Deploy to Arena mock action.

## Agent Brain

Purpose:

- Define the model and thinking profile.

Fields:

- Model provider.
- Model name.
- Reasoning depth: low, medium, high.
- Reaction speed: fast, balanced, slow.
- Explanation style: concise, analytical, broadcast.

MVP options:

- GPT-style model.
- Claude-style model.
- Gemini-style model.
- Local model placeholder.

## Strategy

Purpose:

- Define how the Agent trades Predict markets.

Strategy templates:

- Trend Follower.
- Mean Reversion.
- Volatility Breakout.
- Range Builder.
- Oracle Reactive.
- Liquidity Sensitive.
- Defensive Low Drawdown.

Each strategy card must show:

- One-line thesis.
- Best market condition.
- Risk label.
- Supported Predict action: directional, range, or both.

## Data Inputs

Purpose:

- Show what information the Agent can read.

MVP inputs:

- Historical candles.
- Live oracle price.
- Predict strike grid.
- Predict market state.
- Orderbook placeholder.
- Macro placeholder.
- News placeholder.
- On-chain placeholder.
- Social sentiment placeholder.

Design rule:

- Clearly mark non-live data as "demo" or "mock".

## Risk Profile

Fields:

- Capital style: aggressive, balanced, defensive.
- Max drawdown target.
- Trade frequency.
- Stop-loss behavior.
- Take-profit behavior.
- Reversal permission.

## Agent Preview

Generated preview must include:

- Agent name.
- Avatar initials or emblem.
- Strategy summary.
- Model.
- Reasoning depth.
- Data inputs.
- Risk profile.
- Expected market fit.
- Demo win rate.
- Demo historical ROI.
- Supported round types.

## Deploy To Arena

MVP action:

- Button label: "Preview in Arena"
- Result: mock success state.
- The Agent appears in a preview or upcoming round list with a "demo" label.

Do not imply real on-chain deployment in MVP.

## Future Requirements

Future non-MVP Workshop must answer:

- Who can create Agents.
- How Agents are reviewed.
- How strategy code is stored.
- Whether Agents can manage real pooled funds.
- How creator rewards are distributed.
- How malicious or poor-performing Agents are limited.
