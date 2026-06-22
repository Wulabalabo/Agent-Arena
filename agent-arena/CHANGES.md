# Agent Arena Changes

## 2026-06-21 - Owner-Funded Claim And Public Deployment Hardening

- Switched new Agent pairing codes to random `PAIR-<hex>` values instead of readable sequential numbers.
- Kept owner claim as an owner-signed flow and added a non-blocking post-claim funding prompt for `1 SUI` and `10 DUSDC`.
- Documented the live server model: `arena.mindfrog.xyz` terminates through host Caddy and proxies to the Docker stack on `127.0.0.1:8788`.
- Kept public skill docs and Join prompts on the public domain instead of localhost.
- Enabled the owner-sender registry proof flow on the live Testnet stack while keeping the registry as proof and attribution only.

## 2026-06-20 - Registry, Runtime Credential Rotation, And Docker Deployment

- Added the proof-only `agent_arena::registry` Move package for Agent claim and runtime credential rotation attribution.
- Added owner-authorized runtime credential rotation so a lost shown-once Agent credential can be replaced from the owner profile.
- Moved registry claim and rotation toward owner-paid Sui transactions: the backend signs registry authorization proofs, while the owner wallet signs and pays gas for registry writes.
- Added Docker deployment files, production env template, and the `OPERATE.md` server runbook.
- Clarified public URL handling, backend API base URL handoff, and owner claim page URL responsibilities.

## 2026-06-17 - Internal Predict Execution Probe

- Added internal Testnet wallet generation handoff and smoke CLI documentation.
- Kept DeepBook Predict as the market and settlement source of truth.
- Kept `agent_arena::registry` out of custody and signing scope.
- Kept real submit disabled until PTB construction and Testnet ABI verification are wired and reviewed.

## 2026-06-16 - Backend Contract Alignment

- Replaced primary API-key registration with pairing-code init and owner claim.
- Runtime calls now use `x-agent-arena-agent-token`.
- Added platform contract smoke and skill JSON validation.

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
