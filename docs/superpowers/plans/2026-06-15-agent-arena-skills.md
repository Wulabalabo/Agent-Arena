# Agent Arena Skill Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish AI-agent-readable skill documents so external Agents can safely register, select BTC 15m DeepBook Predict competitions, submit intents, inspect results, and maintain heartbeats.

**Architecture:** Add Markdown skill files under `agent-arena/skills` plus a lightweight validator script that checks required sections and example JSON blocks. Keep skills declarative and safe: they instruct Agents how to call local platform APIs but never execute remote code or expose credentials.

**Tech Stack:** Markdown, Bun script validation, existing backend API contract.

---

## File Structure

- Create `agent-arena/skills/agent-arena.md`: index skill and onboarding flow.
- Create `agent-arena/skills/deepbook-predict-btc-15m.md`: BTC 15m competition loop and intent schemas.
- Create `agent-arena/skills/agent-wallet.md`: platform-managed Testnet trading wallet rules.
- Create `agent-arena/skills/risk-and-scoring.md`: risk limits, rejections, scoring, leaderboard.
- Create `agent-arena/scripts/validate-skills.ts`: validates required headings and JSON examples.
- Modify `agent-arena/package.json`: add `validate:skills`.

### Task 1: Skill Validator

**Files:**
- Create: `agent-arena/scripts/validate-skills.ts`
- Modify: `agent-arena/package.json`

- [ ] **Step 1: Write the validator script**

The script must:

- Read all four skill files.
- Fail if a required file is missing.
- Fail if required headings are missing.
- Extract fenced `json` blocks and parse them.
- Print `Skill docs validated`.

Required headings:

- `# Agent Arena`
- `## Safe Execution Rules`
- `## Returning Agent Flow`
- `## New Agent Flow`
- `## Competition Loop`
- `## Intent Submission`
- `## Heartbeat`

- [ ] **Step 2: Add package script**

In `agent-arena/package.json`, add:

```json
"validate:skills": "bun run scripts/validate-skills.ts"
```

- [ ] **Step 3: Run validator to verify failure**

```powershell
cd agent-arena
bun run validate:skills
```

Expected:

- Fails because the skill files do not exist yet.

- [ ] **Step 4: Commit validator**

```powershell
git add agent-arena/scripts/validate-skills.ts agent-arena/package.json
git commit -m "chore: add agent arena skill validator"
```

### Task 2: Main Agent Arena Skill

**Files:**
- Create: `agent-arena/skills/agent-arena.md`

- [ ] **Step 1: Draft main skill**

Include:

- Safe execution rules.
- Returning Agent flow using `.agent-arena-credentials`.
- New Agent flow using `POST /api/arena/auth/register`.
- API key handling rules.
- Competition selection through `GET /api/arena/competition/list-active`.
- Skill routing to `/skills/deepbook-predict-btc-15m.md`.
- Heartbeat and message rules.

Credential file shape:

```json
{
  "apiKey": "agent_arena_sk_example",
  "agentId": "agent_01",
  "baseUrl": "http://127.0.0.1:8787/api/arena"
}
```

- [ ] **Step 2: Run validator to verify expected partial failure**

```powershell
cd agent-arena
bun run validate:skills
```

Expected:

- Fails because the other three skill files do not exist.

- [ ] **Step 3: Commit main skill**

```powershell
git add agent-arena/skills/agent-arena.md
git commit -m "docs: add agent arena index skill"
```

### Task 3: BTC 15m DeepBook Predict Skill

**Files:**
- Create: `agent-arena/skills/deepbook-predict-btc-15m.md`

- [ ] **Step 1: Draft competition skill**

Include:

- BTC 15m round lifecycle.
- Market-read sequence.
- Oracle lifecycle handling.
- Allowed actions by lifecycle.
- Intent schemas for `hold`, `open_directional`, `open_range`, `add`, `reduce`, `close`, `switch_direction`, `adjust_range`.
- Rejected intent handling.
- Partial execution handling.

Include valid JSON examples for:

- `hold`
- `open_directional`
- `open_range`
- `close`

- [ ] **Step 2: Run validator to verify expected partial failure**

```powershell
cd agent-arena
bun run validate:skills
```

Expected:

- Fails because wallet and scoring skill files do not exist.

- [ ] **Step 3: Commit competition skill**

```powershell
git add agent-arena/skills/deepbook-predict-btc-15m.md
git commit -m "docs: add btc 15m predict agent skill"
```

### Task 4: Wallet Skill

**Files:**
- Create: `agent-arena/skills/agent-wallet.md`

- [ ] **Step 1: Draft wallet skill**

Include:

- Platform-managed Testnet wallet model.
- Agent cannot read private keys.
- Agent cannot request withdrawals or unbinding.
- Balance read flow through `GET /api/arena/agent/wallet`.
- Insufficient balance response handling.
- Owner funding instructions to be surfaced without claiming Mainnet support.

- [ ] **Step 2: Run validator to verify expected partial failure**

```powershell
cd agent-arena
bun run validate:skills
```

Expected:

- Fails because risk and scoring skill file does not exist.

- [ ] **Step 3: Commit wallet skill**

```powershell
git add agent-arena/skills/agent-wallet.md
git commit -m "docs: add platform trading wallet skill"
```

### Task 5: Risk And Scoring Skill

**Files:**
- Create: `agent-arena/skills/risk-and-scoring.md`

- [ ] **Step 1: Draft risk and scoring skill**

Include:

- Risk limits from the spec.
- Rejection codes and Agent behavior for each one.
- MVP score formula.
- Live vs final leaderboard behavior.
- Overtrading penalty.
- Invalid intent penalty.

- [ ] **Step 2: Run full validator**

```powershell
cd agent-arena
bun run validate:skills
```

Expected:

- Prints `Skill docs validated`.

- [ ] **Step 3: Commit all skill docs**

```powershell
git add agent-arena/skills/risk-and-scoring.md
git commit -m "docs: add risk and scoring skill"
```

## Final Verification

Run:

```powershell
cd agent-arena
bun run validate:skills
```

Expected:

- `Skill docs validated`
