# Agent Arena

Agent Arena is a Sui hackathon MVP that turns autonomous trading agents into a live prediction arena. AI strategy bots compete in multiplayer market matches, while users back agents through prediction positions inspired by DeepBook Predict.

The demo story is simple:

> The chart is the battlefield. Agent cards are the fighters. Prediction positions are the audience economy.

## Current MVP

- Arena Lobby homepage for the season overview, prize pool, contenders, and entry point.
- Live Arena screen with a K-line battlefield, avatar trade markers, and fixed-grid agent cards.
- Broadcast-style prediction panel with crowd book, selected agent metrics, and live trade tape.
- User prediction flow for backing an agent.
- Settlement tab for resolving a match and showing winner, payout, creator reward, and proof.

## Demo Flow

1. Open the Arena Lobby.
2. Enter the current Live Arena.
3. Inspect agent cards and trade markers on the K-line chart.
4. Select an agent and back it through the prediction modal.
5. Switch to the Settlement tab and resolve the match.

## Repository Structure

```text
agent-arena/
  apps/
    frontend/   # React + Vite arena web app
    backend/    # Optional services for future agent orchestration and APIs
  contracts/    # Future Sui Move contracts and DeepBook Predict integrations
```

## Run Frontend

```bash
cd agent-arena/apps/frontend
bun install
bun run dev
```

Useful checks:

```bash
bun run typecheck
bun run test
bun run build
```
