# Agent Arena Legacy Development Plans

These plans describe the early MVP buildout. They are useful history, but they are not the only current execution record.

## Original Sequence

0. `00-spec-review.md`
1. `01-domain-and-mock-state-plan.md`
2. `02-frontend-pages-and-interactions-plan.md`
3. `03-predict-integration-readiness-plan.md`
4. `04-demo-acceptance-and-hardening-plan.md`
5. `05-internal-predict-execution-probe-plan.md`

## Source Specs

- `../specs/01-product-spec.md`
- `../specs/02-frontend-page-spec.md`
- `../specs/03-predict-integration-spec.md`
- `../specs/04-agent-workshop-spec.md`
- `../specs/05-data-state-and-acceptance-spec.md`
- `../specs/06-agent-participation-platform-spec.md`
- `../specs/07-internal-predict-execution-probe-spec.md`
- `../specs/08-agent-runtime-loop-and-execution-orchestration-spec.md`

## Current Planning Artifacts

Later design and execution records live in `../../docs/superpowers/`:

- Registry and owner-paid claim transaction work.
- Runtime credential rotation.
- Docker/server deployment.
- Owner-funded post-claim wallet funding.
- Auto range smoke workflow.
- Frontend restructuring.

See `../../docs/superpowers/README.md` for the dated index.

## Execution Rules That Still Apply

- Verify one plan before starting the next.
- Keep the MVP Testnet-only unless a new approved plan widens that boundary.
- Do not add a custom prediction-market contract.
- Keep internal Predict execution routes out of public Agent skill docs and frontend runtime clients.
- Re-check the current backend, frontend, skill docs, and operations runbook before treating older plan details as current API behavior.
