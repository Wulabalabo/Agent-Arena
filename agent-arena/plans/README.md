# Agent Arena Development Plans

Execute these plans in order.

0. `00-spec-review.md`
1. `01-domain-and-mock-state-plan.md`
2. `02-frontend-pages-and-interactions-plan.md`
3. `03-predict-integration-readiness-plan.md`
4. `04-demo-acceptance-and-hardening-plan.md`
5. `05-internal-predict-execution-probe-plan.md`

Source specs:

- `../specs/01-product-spec.md`
- `../specs/02-frontend-page-spec.md`
- `../specs/03-predict-integration-spec.md`
- `../specs/04-agent-workshop-spec.md`
- `../specs/05-data-state-and-acceptance-spec.md`
- `../specs/06-agent-participation-platform-spec.md`
- `../specs/07-internal-predict-execution-probe-spec.md`

Execution rule:

- Finish and verify one plan before starting the next.
- Keep the MVP mock-first unless the plan explicitly introduces live Predict integration.
- Do not add a custom prediction-market contract.
- Keep internal Predict execution routes out of public Agent skill docs and frontend runtime clients.
