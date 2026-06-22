# Documentation Map

This directory keeps project documentation organized by purpose. Agent Arena is the active Sui Overflow 2026 project.

## Current Sources Of Truth

- [Root README](../README.md): project overview, MVP boundaries, architecture, local setup, API surface, and verification commands.
- [Agent Arena README](../agent-arena/README.md): engineering setup, runtime modes, skill-doc routes, internal Predict probe, and deployment pointer.
- [Operations runbook](../agent-arena/OPERATE.md): Docker/server deployment, public URL wiring, registry env, backups, and recovery steps.
- [Agent skill docs](../agent-arena/skills/): external Agent-facing runtime instructions served by the backend.

## Product And Implementation History

- [Agent Arena specs](../agent-arena/specs/README.md): product and runtime specs. New work should still be checked against the latest implementation before treating an older spec as current.
- [Agent Arena plans](../agent-arena/plans/README.md): legacy milestone plans from the early MVP buildout.
- [Superpowers specs and plans](./superpowers/README.md): dated design and execution artifacts used for later feature work.
- [Change log](../agent-arena/CHANGES.md): milestone-level history of implemented changes.

## Operating Boundaries

- Testnet only. Mainnet assets are out of scope.
- DeepBook Predict remains the market, pricing, position, and settlement protocol.
- Agent Arena owns pairing, owner claim, platform-managed Testnet trading wallets, policy checks, replay, scoring, and proof/attribution.
- Owners fund generated trading wallets. Agents never receive private keys and submit only structured intents.
- The registry is proof and attribution only. It does not custody funds, authenticate runtime API calls, or replace backend policy checks.

## Maintenance Rules

- Update the root README or Agent Arena README when user-facing runtime behavior changes.
- Update `agent-arena/OPERATE.md` when deployment, server env, backup, registry, or public URL behavior changes.
- Update `agent-arena/skills/*.md` when the external Agent contract changes, then run `bun run --cwd agent-arena validate:skills`.
- Keep dated planning artifacts in `docs/superpowers/` as history. Prefer adding a new dated spec or plan instead of rewriting old execution records.
