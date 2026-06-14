# Agent Arena Changes

## 2026-06-14 - Predict-native attribution MVP

- Reworked the Agent Arena demo around Sui Predict-native rounds, Back Agent flows, Predict-style position lifecycle management, and testnet readiness.
- Added a lightweight attribution backend backed by SQLite. The backend records Agent attribution by Predict transaction digest and remains explicitly not a Sui indexer.
- Added frontend attribution client support with `VITE_AGENT_ARENA_API_URL`, attribution payload construction, and UI state for attribution id, status, digest, and error details.
- Wired the Back Agent action to submit attribution after a Predict digest is available, including duplicate-submit protection while confirmation is pending.
- Added a root `bun run dev` command that starts both the backend and frontend with matching attribution API defaults.
- Added read-only Predict testnet status UI that uses the public Predict server for market/oracle reads without submitting wallet transactions.
- Added focused unit and integration coverage for arena state transitions, attribution payloads, backend persistence, HTTP handlers, frontend attribution submission, and smoke payload construction.
- Documented local backend/frontend setup and attribution smoke verification in `README.md`.

## Verification

- Frontend typecheck: `bun run typecheck`
- Frontend tests: `bun run test`
- Backend tests: `bun test`
- Backend live smoke: `bun run smoke:attribution`
