# Agent Arena Frontend Participation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the React frontend from a user Back Agent experience to an Agent participation console with registration, Testnet trading wallet, BTC 15m competition, live intents/executions, leaderboard, replay, and skill docs.

**Architecture:** Keep the existing Vite/React app and replace the primary narrative and state model incrementally. Add a frontend API client for `/api/arena/*`, mock fixtures for offline tests, and focused components for the new platform surfaces. Reuse chart and arena visuals only where they support Agent participation rather than user betting.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, lucide-react, existing CSS/Tailwind setup.

---

## File Structure

- Create `agent-arena/apps/frontend/src/features/platform/types.ts`: frontend API/domain types.
- Create `agent-arena/apps/frontend/src/features/platform/client.ts`: platform API client.
- Create `agent-arena/apps/frontend/src/features/platform/mock.ts`: frontend fixtures.
- Create `agent-arena/apps/frontend/src/features/platform/state.ts`: view state and selectors.
- Create `agent-arena/apps/frontend/src/components/platform/AgentRegistration.tsx`.
- Create `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`.
- Create `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`.
- Create `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`.
- Create `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`.
- Create `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx`.
- Create `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx`.
- Modify `agent-arena/apps/frontend/src/App.tsx`.
- Modify `agent-arena/apps/frontend/src/App.test.tsx`.
- Add focused component tests.

### Task 1: Frontend Platform Types And Client

**Files:**
- Create: `agent-arena/apps/frontend/src/features/platform/types.ts`
- Create: `agent-arena/apps/frontend/src/features/platform/client.ts`
- Test: `agent-arena/apps/frontend/src/features/platform/client.test.ts`

- [ ] **Step 1: Write failing client tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { createPlatformClient } from "./client";

describe("platform client", () => {
  it("registers an Agent through the platform API", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: { id: "agent_1", name: "Trend Ranger", twitterHandle: "Sui_Agent" },
      apiKey: "agent_arena_sk_example"
    }), { status: 201 }));

    const client = createPlatformClient({ baseUrl: "http://127.0.0.1:8787/api/arena", fetcher });
    const result = await client.registerAgent({ name: "Trend Ranger", twitterHandle: "@Sui_Agent" });

    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/auth/register", expect.objectContaining({ method: "POST" }));
    expect(result.apiKey).toBe("agent_arena_sk_example");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/features/platform/client.test.ts
```

Expected:

- Fails because platform client files do not exist.

- [ ] **Step 3: Implement types and client**

Client methods:

- `registerAgent(input)`
- `getAgentMe(apiKey)`
- `getAgentWallet(apiKey)`
- `createTradingWallet(agentId)`
- `listActiveCompetitions()`
- `submitIntent(apiKey, payload)`
- `getLeaderboard(competitionId)`

Rules:

- Use `x-agent-arena-api-key` for Agent authenticated methods.
- Throw `PlatformClientError` with `code`, `message`, and `retryable`.

- [ ] **Step 4: Run client tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/features/platform/client.test.ts
```

Expected:

- Client tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/features/platform/types.ts agent-arena/apps/frontend/src/features/platform/client.ts agent-arena/apps/frontend/src/features/platform/client.test.ts
git commit -m "feat: add frontend platform api client"
```

### Task 2: Agent Registration And Wallet Panels

**Files:**
- Create: `agent-arena/apps/frontend/src/components/platform/AgentRegistration.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/AgentRegistration.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Test expectations:

- Registration form accepts Agent name and optional Twitter handle.
- API key is shown after registration.
- Twitter handle is labeled unverified.
- Wallet panel shows Testnet deposit address.
- Wallet panel states that Agent cannot access private keys or withdrawals.

- [ ] **Step 2: Run component tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/AgentRegistration.test.tsx src/components/platform/TradingWalletPanel.test.tsx
```

Expected:

- Fails because components do not exist.

- [ ] **Step 3: Implement components**

Implementation rules:

- Use button labels that describe actions: `Register Agent`, `Generate Testnet Wallet`, `Copy Skill URL`.
- Display Twitter as `@handle` with visible `Unverified` label.
- Display wallet as Testnet-only.
- Do not include Mainnet funding copy.
- Do not show or request a private key.

- [ ] **Step 4: Run component tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/AgentRegistration.test.tsx src/components/platform/TradingWalletPanel.test.tsx
```

Expected:

- Component tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/components/platform/AgentRegistration.tsx agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentRegistration.test.tsx agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx
git commit -m "feat: add agent registration and wallet panels"
```

### Task 3: Competition Lobby And Live Competition

**Files:**
- Create: `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/LiveCompetition.test.tsx`

- [ ] **Step 1: Write failing tests**

Test expectations:

- Lobby shows BTC 15m Testnet competition.
- Lobby shows DeepBook Predict object and oracle id.
- Live competition lists allowed actions by lifecycle.
- Live competition displays intents and executions separately.
- Partial execution is visibly distinct.

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/CompetitionLobby.test.tsx src/components/platform/LiveCompetition.test.tsx
```

Expected:

- Fails because components do not exist.

- [ ] **Step 3: Implement components**

Implementation rules:

- Use existing chart component only as a support visual.
- The main action area is Agent intent lifecycle, not user Back Agent.
- Show statuses: `pre_open`, `live`, `expired`, `settled`.
- Show action chips: `hold`, `open`, `add`, `reduce`, `close`, `switch`, `adjust`.

- [ ] **Step 4: Run tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/CompetitionLobby.test.tsx src/components/platform/LiveCompetition.test.tsx
```

Expected:

- Competition tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx agent-arena/apps/frontend/src/components/platform/CompetitionLobby.test.tsx agent-arena/apps/frontend/src/components/platform/LiveCompetition.test.tsx
git commit -m "feat: add agent competition surfaces"
```

### Task 4: Leaderboard, Replay, And Skill Docs

**Files:**
- Create: `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Test expectations:

- Leaderboard shows rank, score, net PnL, drawdown, and Twitter handle as unverified.
- Replay shows intent -> risk decision -> execution -> Predict tx digest.
- Skill docs panel shows copyable `/skills/agent-arena.md` path and API base URL.

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/LeaderboardPanel.test.tsx src/components/platform/ReplayTimeline.test.tsx src/components/platform/SkillDocsPanel.test.tsx
```

Expected:

- Fails because components do not exist.

- [ ] **Step 3: Implement components**

Implementation rules:

- Keep cards for repeated leaderboard rows and replay entries only.
- Avoid user-betting language.
- Use compact dashboard copy for operational screens.
- Use monospace for tx digests, API URLs, and skill paths.

- [ ] **Step 4: Run tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/LeaderboardPanel.test.tsx src/components/platform/ReplayTimeline.test.tsx src/components/platform/SkillDocsPanel.test.tsx
```

Expected:

- Component tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx agent-arena/apps/frontend/src/components/platform/ReplayTimeline.test.tsx agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.test.tsx
git commit -m "feat: add leaderboard replay and skill docs panels"
```

### Task 5: App Shell Pivot

**Files:**
- Modify: `agent-arena/apps/frontend/src/App.tsx`
- Modify: `agent-arena/apps/frontend/src/App.test.tsx`
- Modify: `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`

- [ ] **Step 1: Update failing acceptance tests first**

Change tests to assert:

- Heading mentions AI Agents competing in DeepBook Predict.
- Registration screen is reachable.
- Trading wallet screen is reachable.
- Live BTC 15m competition is reachable.
- Leaderboard shows unverified Twitter label when a handle exists.
- No primary CTA says `Back Agent`.

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/App.test.tsx src/acceptance/agent-arena.acceptance.test.tsx
```

Expected:

- Fails because App still uses the old Back Agent flow.

- [ ] **Step 3: Implement App shell pivot**

Implementation rules:

- Replace old top-level navigation with: `Register`, `Wallet`, `Competition`, `Leaderboard`, `Replay`, `Skills`.
- Default screen should be the live Agent competition console, not a marketing landing page.
- Keep old components only where they support chart/replay visuals.
- Remove or demote Workshop from the primary MVP navigation.

- [ ] **Step 4: Run frontend verification**

```powershell
cd agent-arena
bun run typecheck
bun run test:frontend
bun run build
```

Expected:

- Typecheck passes.
- Frontend tests pass.
- Build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/App.tsx agent-arena/apps/frontend/src/App.test.tsx agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx
git commit -m "feat: pivot frontend to agent participation console"
```

## Final Verification

Run:

```powershell
cd agent-arena
bun run typecheck
bun run test:frontend
bun run build
```

Expected:

- Frontend typecheck, tests, and production build pass.
