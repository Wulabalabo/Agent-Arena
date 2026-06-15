# Agent Arena Platform Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinate the Agent Arena pivot into a Testnet-only DeepBook Predict Agent competition platform.

**Architecture:** Execute the work as five independently verifiable plans. Backend platform contracts come first so external Agent skill docs and frontend screens can bind to a stable API. DeepBook execution and the Move registry are isolated behind adapters so mock competition flow can ship before live signing is fully wired.

**Tech Stack:** Bun, TypeScript, SQLite, Vite, React, Vitest, Sui Move, DeepBook Predict Testnet, Markdown skill files.

---

## Execution Order

1. `docs/superpowers/plans/2026-06-15-agent-arena-backend-platform-core.md`
2. `docs/superpowers/plans/2026-06-15-agent-arena-skills.md`
3. `docs/superpowers/plans/2026-06-15-agent-arena-registry-contract.md`
4. `docs/superpowers/plans/2026-06-15-agent-arena-deepbook-execution.md`
5. `docs/superpowers/plans/2026-06-15-agent-arena-frontend-participation.md`

## Cross-Plan Rules

- Keep `agent-arena/specs/06-agent-participation-platform-spec.md` as the source of truth.
- Preserve the boundary that Agent Arena is an application layer over DeepBook Predict.
- Keep MVP Testnet-only.
- Do not expose platform-managed trading wallet private keys outside backend signer code.
- Do not let external Agents submit arbitrary transaction payloads.
- Keep `agent_arena::registry` as proof and attribution, not custody or market settlement.

## Milestone Checkpoints

### Checkpoint 1: Mock Platform Works

Required plans:

- Backend platform core.
- Agent skill docs.

Required verification:

```powershell
cd agent-arena
bun run test:backend
```

Expected:

- Backend tests pass.
- Agent can register, read active BTC 15m competition, submit mock intents, receive accepted/rejected/executed statuses, and appear on a mock leaderboard.

### Checkpoint 2: Registry Builds

Required plans:

- Registry contract.

Required verification:

```powershell
cd agent-arena/contracts/agent_arena
sui move test
```

Expected:

- Move tests pass for Agent registration, competition registration, execution recording, score commitment, and non-custody boundaries.

### Checkpoint 3: DeepBook Execution Adapter Works

Required plans:

- DeepBook Predict execution.

Required verification:

```powershell
cd agent-arena
bun run test:backend
```

Expected:

- Adapter tests pass with mocked Sui client and mocked Predict server.
- Live execution is feature-flagged and disabled by default unless Testnet config and signer storage are present.

### Checkpoint 4: Frontend Demo Works

Required plans:

- Frontend Agent participation.

Required verification:

```powershell
cd agent-arena
bun run typecheck
bun run test:frontend
bun run build
```

Expected:

- Frontend typecheck, tests, and build pass.
- UI flow is Agent registration -> trading wallet -> BTC 15m competition -> live intents/executions -> leaderboard/replay.

## Commit Strategy

- Commit each child plan separately after its verification passes.
- Keep docs-only commits separate from implementation commits when useful for review.
- Before every commit, run:

```powershell
git status --short --untracked-files=all
git diff --cached --stat
```

Expected:

- Only files for the current plan are staged.
