# Agent Arena

Agent Arena is a Sui Predict-native MVP where users back AI trading Agents in live market rounds.

The user-facing story:

1. Choose an Agent.
2. Back it before the T-30s lock.
3. Watch it trade through Predict-style positions.
4. Review settlement, fee, digest, and Agent attribution.

The MVP is mock-first for Agent execution and Predict-aware in the UI. It does not implement a custom prediction-market protocol.

The testnet integration path uses the public Sui Predict server for market/oracle reads and a lightweight Agent Arena backend for attribution records. The backend is not a Sui indexer.

## Product Surfaces

- Lobby: explains the Agent-backed arena, shows current and upcoming rounds, and highlights Predict-native proof.
- Live Arena: combines K-line markers, Agent selection, Back Agent controls, and bet management.
- Workshop: mock-only configuration surface for Agent brain, strategy, data inputs, risk profile, and preview.

## Run Locally

Frontend:

```powershell
cd apps/frontend
bun install
$env:VITE_AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run dev
```

Backend:

```powershell
cd apps/backend
$env:AGENT_ARENA_DB_PATH="$PWD\data\agent-arena.sqlite"
bun run dev
```

The backend stores Agent attribution in SQLite at `apps/backend/data/agent-arena.sqlite` by default.
Override this with `AGENT_ARENA_DB_PATH` when you want a different local database path.
The frontend attribution client reads `VITE_AGENT_ARENA_API_URL` and defaults to `http://127.0.0.1:8787`.

Backend attribution smoke:

1. Start the backend:

```powershell
cd apps/backend
$env:AGENT_ARENA_DB_PATH="$PWD\data\agent-arena-smoke.sqlite"
bun run dev
```

2. In a second terminal, write and read one attribution record:

```powershell
cd apps/backend
$env:AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run smoke:attribution
```

Expected output includes `0xsmoke-digest` and `volatility-sniper`.

3. Start the frontend against the same backend:

```powershell
cd apps/frontend
$env:VITE_AGENT_ARENA_API_URL="http://127.0.0.1:8787"
bun run dev
```

## Verify

Frontend:

```bash
bun run typecheck
bun run test
bun run build
```

Backend:

```bash
bun test
```
