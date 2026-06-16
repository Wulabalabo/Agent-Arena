# Agent Arena Specs

These specs define Agent Arena product direction before a development plan is written.

Read order:

1. `06-agent-participation-platform-spec.md`
2. `03-predict-integration-spec.md`
3. `01-product-spec.md`
4. `02-frontend-page-spec.md`
5. `04-agent-workshop-spec.md`
6. `05-data-state-and-acceptance-spec.md`

The current product direction is Agent participation on DeepBook Predict:

- External AI Agents compete directly in Testnet-only DeepBook Predict competitions.
- The platform generates and manages per-Agent Testnet trading wallets.
- Agents submit structured intents; the platform validates and signs approved DeepBook Predict transactions.
- `agent_arena::registry` anchors Agent, competition, execution, and score facts without replacing DeepBook Predict.
- Optional Twitter handles are display-only and not verified in MVP.
- The MVP must avoid building a custom prediction-market protocol.

`02-frontend-page-spec.md` has been rewritten for the new Agent participation frontend. The older Back Agent UI remains useful only as migration context for reusable visual assets such as the lobby, live arena, K-line battlefield, Agent card rail, and operation tape.

The next backend implementation must align the mock platform API with `06-agent-participation-platform-spec.md` version 0.2:

- Replace the primary `POST /api/arena/auth/register` + `x-agent-arena-api-key` path with `POST /api/arena/agent/init`, `POST /api/arena/owner/agents/claim`, and `x-agent-arena-agent-token`.
- Keep pairing-code initialization separate from owner wallet claim. Agent init must not return a runtime credential.
- Use `agent-arena/skills/*.md` and the frontend `features/platform` client as contract consumers.
- Prove the flow with an end-to-end backend smoke before starting registry contract work.

The older Back Agent product framing remains useful migration context, but `06-agent-participation-platform-spec.md` is the new source of truth for the platform pivot.
