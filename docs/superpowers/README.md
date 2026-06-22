# Superpowers Planning Archive

This folder stores dated design and implementation-plan artifacts created during Agent Arena development. These files explain why a change was made and how it was executed, but the current runtime source of truth remains the code plus the top-level documentation linked from [docs/README.md](../README.md).

## How To Read This Folder

- `specs/`: approved design notes and scope decisions.
- `plans/`: task-by-task execution plans and verification checklists.
- Checked boxes in plan files indicate work that was executed in that plan session.
- Older plans may describe superseded endpoint names, UI states, or registry mechanics. Re-check the current backend, frontend, skill docs, and runbook before reusing exact API details.

## Recent Design Notes

| Date | Document | Purpose |
| --- | --- | --- |
| 2026-06-21 | [Owner-funded claim flow](./specs/2026-06-21-owner-funded-claim-flow-design.md) | Random pairing codes and non-blocking owner funding after claim. |
| 2026-06-20 | [Registry and credential rotation](./specs/2026-06-20-agent-arena-registry-and-credential-rotation-design.md) | Proof-only registry scope and owner-authorized runtime credential rotation. |
| 2026-06-19 | [Frontend restructure](./specs/2026-06-19-agent-arena-frontend-restructure-design.md) | Frontend structure and Agent Arena UI reorganization. |
| 2026-06-17 | [Auto range smoke](./specs/2026-06-17-auto-range-smoke-design.md) | Operator auto-range Predict smoke workflow. |

## Recent Execution Plans

| Date | Document | Status |
| --- | --- | --- |
| 2026-06-21 | [Owner-funded claim flow](./plans/2026-06-21-owner-funded-claim-flow.md) | Executed. |
| 2026-06-20 | [Registry credential rotation](./plans/2026-06-20-agent-arena-registry-credential-rotation.md) | Part of the registry and rotation buildout. |
| 2026-06-20 | [Owner single registry transaction](./plans/2026-06-20-agent-arena-owner-single-registry-tx.md) | Later registry transaction model for owner-paid claim and rotation. |
| 2026-06-20 | [Docker deployment](./plans/2026-06-20-agent-arena-docker-deployment.md) | Deployment packaging and operations runbook work. |
| 2026-06-19 | [Frontend restructure](./plans/2026-06-19-agent-arena-frontend-restructure.md) | Frontend organization work. |
| 2026-06-17 | [Auto range smoke](./plans/2026-06-17-auto-range-smoke.md) | Predict range smoke automation. |

## Older Planning Artifacts

The remaining files in `plans/` capture the original MVP sequence:

- Agent runtime orchestration.
- Remaining Predict execution.
- Frontend participation.
- Backend contract alignment.
- Agent skills.
- Registry contract.
- Platform roadmap.
- DeepBook execution.
- Backend platform core.
- Attribution UI integration.

Use them as background, not as current acceptance criteria.
