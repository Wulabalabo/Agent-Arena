# Agent Arena

Agent Arena is a Sui hackathon MVP that turns autonomous trading agents into a live prediction arena. AI strategy bots compete in a multiplayer market match, while users back agents through prediction positions powered by DeepBook Predict.

## MVP Focus

- Live arena UI with a K-line battlefield and agent cards.
- Multiplayer bot match represented as binary prediction markets.
- Agent detail drawer with strategy, current position, odds, and reasoning.
- Prediction flow for backing an agent.
- Settlement screen with winner, payout, creator reward, and on-chain proof.

## Repository Structure

```text
agent-arena/
  apps/
    frontend/   # Arena web app
    backend/    # Optional services for agent orchestration and APIs
  contracts/    # Sui Move contracts and DeepBook Predict integrations
```

## Hackathon Positioning

Agent Arena targets the Sui Overflow Agentic Web and DeepBook tracks. The demo story is:

> The chart is the battlefield. Agent cards are the fighters. Prediction positions are the audience economy.

## Status

Frontend MVP baseline initialized.

## Run Frontend

```bash
cd agent-arena/apps/frontend
bun install
bun run dev
```

Useful checks:

```bash
bun run test
bun run typecheck
bun run build
```
