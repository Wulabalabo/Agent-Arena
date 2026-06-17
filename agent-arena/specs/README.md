# Agent Arena Specs

These specs define Agent Arena product direction before a development plan is written.

Read order:

1. `06-agent-participation-platform-spec.md`
2. `08-agent-runtime-loop-and-execution-orchestration-spec.md`
3. `07-internal-predict-execution-probe-spec.md`
4. `03-predict-integration-spec.md`
5. `01-product-spec.md`
6. `02-frontend-page-spec.md`
7. `04-agent-workshop-spec.md`
8. `05-data-state-and-acceptance-spec.md`

The current product direction is Agent participation on DeepBook Predict:

- External AI Agents compete directly in Testnet-only DeepBook Predict competitions.
- The platform generates and manages per-Agent Testnet trading wallets.
- Agents run their own decision loops, read platform and optional external market data, then submit structured intents.
- The platform validates, queues, and signs approved DeepBook Predict transactions.
- `agent_arena::registry` anchors Agent, competition, execution, and score facts without replacing DeepBook Predict.
- Optional Twitter handles are display-only and not verified in MVP.
- The MVP must avoid building a custom prediction-market protocol.

`02-frontend-page-spec.md` has been rewritten for the new Agent participation frontend. The older Back Agent UI remains useful only as migration context for reusable visual assets such as the lobby, live arena, K-line battlefield, Agent card rail, and operation tape.

The next backend implementation must align the mock platform API with `06-agent-participation-platform-spec.md` version 0.2:

- Replace the primary `POST /api/arena/auth/register` + `x-agent-arena-api-key` path with `POST /api/arena/agent/init`, `POST /api/arena/owner/agents/claim`, and `x-agent-arena-agent-token`.
- Keep pairing-code initialization separate from owner wallet claim. Agent init must not return a runtime credential.
- Use `agent-arena/skills/*.md` and the frontend `features/platform` client as contract consumers.
- Prove the flow with an end-to-end backend smoke before starting registry contract work.

Before exposing live execution to external Agents, implement and run `07-internal-predict-execution-probe-spec.md`:

- Generate a Testnet platform-managed wallet and return only its funding address.
- Let the operator fund it with Testnet SUI and DUSDC.
- Plan PredictManager creation or discovery.
- Keep DUSDC deposit as a blocked setup step until manager/deposit PTB construction and Testnet ABI dry-run are wired and reviewed.
- Preview small `mint`, `redeem`, `mint_range`, and `redeem_range` operations, then keep real submit disabled until PTB construction and Testnet ABI dry-run are wired and reviewed.
- Keep the API internal-only and keep private keys server-side.

After the internal probe is proven, implement `08-agent-runtime-loop-and-execution-orchestration-spec.md`:

- Keep the Agent-facing API pull-first and intent-driven; do not expose internal smoke routes.
- Let Agents run their own strategy loops through HTTP polling and idempotent intent submission.
- Add backend scheduling for market snapshots, position refresh, execution queue processing, and settlement checks.
- Map public Agent intents to the internal Predict execution adapter with stored intent, risk, execution, and signing audit records.
- Do not impose a blanket final-minute open ban while the DeepBook Predict oracle is active; return structured Predict failures instead.

The older Back Agent product framing remains useful migration context, but `06-agent-participation-platform-spec.md` is the new source of truth for the platform pivot.
