# Frontend Pages And Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing MVP pages from the page spec: Landing/Lobby, Live Arena, Portfolio-backed bet management, Settlement, and Workshop demo.

**Architecture:** Keep UI mock-driven and route state local to React. Split page-level components by user workflow, and keep reusable display components focused on one surface: round selector, chart battlefield, Agent cards, backing panel, portfolio panel, and Workshop configurator.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react, Testing Library, Vitest.

---

## Source Specs

- `agent-arena/specs/02-frontend-page-spec.md`
- `agent-arena/specs/04-agent-workshop-spec.md`
- `agent-arena/specs/05-data-state-and-acceptance-spec.md`

## File Structure

- Modify: `agent-arena/apps/frontend/src/App.tsx`
  - Owns top-level view switching for Lobby, Live Arena, Workshop, and future Portfolio entry.
- Modify: `agent-arena/apps/frontend/src/App.test.tsx`
  - Verifies primary navigation across pages.
- Create: `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`
  - Shared nav with Lobby, Live Arena, Workshop, wallet placeholder, and Predict network status.
- Modify: `agent-arena/apps/frontend/src/components/lobby/ArenaLobby.tsx`
  - Product entry page based on the new Landing spec.
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.tsx`
  - Main Live Arena composition.
- Create: `agent-arena/apps/frontend/src/components/arena/RoundSelector.tsx`
  - Round schedule and status selector.
- Create: `agent-arena/apps/frontend/src/components/agents/AgentCard.tsx`
  - Agent card with win rate, model, strategy, backing, and risk.
- Create: `agent-arena/apps/frontend/src/components/agents/AgentRail.tsx`
  - Sortable Agent list for the selected round.
- Create: `agent-arena/apps/frontend/src/components/agents/SelectedAgentPanel.tsx`
  - Detailed Agent decision panel.
- Modify: `agent-arena/apps/frontend/src/components/chart/KlineBattlefield.tsx`
  - K-line chart with new TradeMarker actions and Predict labels.
- Create: `agent-arena/apps/frontend/src/components/backing/BackAgentPanel.tsx`
  - Backing amount, lock state, transaction readiness, and action state.
- Create: `agent-arena/apps/frontend/src/components/portfolio/BetManagementPanel.tsx`
  - Upcoming, Current, History tabs with edit/cancel/close/redeem semantics.
- Modify: `agent-arena/apps/frontend/src/components/settlement/SettlementOverlay.tsx`
  - Agent-attributed Predict settlement result.
- Create: `agent-arena/apps/frontend/src/components/workshop/AgentWorkshop.tsx`
  - Mock workbench for Agent Brain, Strategy, Data Inputs, Risk Profile, and Preview.
- Modify: `agent-arena/apps/frontend/src/styles.css`
  - Responsive shell, compact panels, and status styles.

## Task 1: Top-Level Navigation And Page Routing

**Files:**
- Modify: `agent-arena/apps/frontend/src/App.tsx`
- Modify: `agent-arena/apps/frontend/src/App.test.tsx`
- Create: `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`

- [ ] **Step 1: Write navigation tests**

Replace `agent-arena/apps/frontend/src/App.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App navigation", () => {
  it("starts on the Lobby and opens Live Arena", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Back AI trading agents/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Enter Live Arena/i }));
    expect(screen.getByRole("heading", { name: /Live Arena/i })).toBeInTheDocument();
  });

  it("opens Workshop from the primary navigation", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Workshop/i }));
    expect(screen.getByRole("heading", { name: /Agent Workshop/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/App.test.tsx
```

Expected: FAIL because Workshop routing and the new headings are not implemented.

- [ ] **Step 3: Create shared navigation**

Create `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`:

```tsx
interface AppNavProps {
  activeView: "lobby" | "arena" | "workshop";
  onOpenLobby: () => void;
  onOpenArena: () => void;
  onOpenWorkshop: () => void;
}

export function AppNav({ activeView, onOpenLobby, onOpenArena, onOpenWorkshop }: AppNavProps) {
  const navItems = [
    { id: "lobby", label: "Lobby", onClick: onOpenLobby },
    { id: "arena", label: "Live Arena", onClick: onOpenArena },
    { id: "workshop", label: "Workshop", onClick: onOpenWorkshop }
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant/70 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4">
        <button className="text-left" type="button" onClick={onOpenLobby}>
          <span className="block text-sm font-semibold uppercase tracking-[0.12em] text-primary">Agent Arena</span>
          <span className="block text-xs text-on-surface-variant">Sui Predict native</span>
        </button>
        <nav className="flex items-center gap-2" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeView ? "nav-button nav-button-active" : "nav-button"}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="hidden items-center gap-2 text-xs text-on-surface-variant sm:flex">
          <span className="rounded-full border border-outline-variant px-2 py-1">Testnet</span>
          <span className="rounded-full border border-outline-variant px-2 py-1">Wallet mock</span>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update `App.tsx`**

Replace `agent-arena/apps/frontend/src/App.tsx` with:

```tsx
import { useState } from "react";
import { ArenaShell } from "./components/arena/ArenaShell";
import { ArenaLobby } from "./components/lobby/ArenaLobby";
import { AppNav } from "./components/navigation/AppNav";
import { AgentWorkshop } from "./components/workshop/AgentWorkshop";

type AppView = "lobby" | "arena" | "workshop";

export default function App() {
  const [view, setView] = useState<AppView>("lobby");

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <AppNav
        activeView={view}
        onOpenArena={() => setView("arena")}
        onOpenLobby={() => setView("lobby")}
        onOpenWorkshop={() => setView("workshop")}
      />
      {view === "lobby" ? <ArenaLobby onEnterArena={() => setView("arena")} onOpenWorkshop={() => setView("workshop")} /> : null}
      {view === "arena" ? <ArenaShell /> : null}
      {view === "workshop" ? <AgentWorkshop /> : null}
    </main>
  );
}
```

- [ ] **Step 5: Run the navigation test**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/App.test.tsx
```

Expected: FAIL until `ArenaLobby` and `AgentWorkshop` are updated in later tasks.

## Task 2: Landing / Lobby Refresh

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/lobby/ArenaLobby.tsx`
- Test: `agent-arena/apps/frontend/src/App.test.tsx`

- [ ] **Step 1: Update Lobby props and content**

Update `ArenaLobby` to accept both entry actions:

```tsx
import { mockAgents, mockArenaRounds } from "../../mock/arena";

interface ArenaLobbyProps {
  onEnterArena: () => void;
  onOpenWorkshop: () => void;
}

export function ArenaLobby({ onEnterArena, onOpenWorkshop }: ArenaLobbyProps) {
  const currentRound = mockArenaRounds[0];
  const topAgents = mockAgents.slice(0, 3);

  return (
    <section className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-6">
        <div className="rounded-lg border border-outline-variant bg-surface-container p-6">
          <p className="text-sm font-semibold uppercase text-primary">Sui Predict native</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-on-surface">Back AI trading agents in Sui Predict arenas.</h1>
          <p className="mt-4 max-w-2xl text-base text-on-surface-variant">
            Choose an Agent, watch it trade Predict markets, and review the round result after settlement.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="primary-button" type="button" onClick={onEnterArena}>Enter Live Arena</button>
            <button className="secondary-button" type="button" onClick={onOpenWorkshop}>Open Workshop</button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {["Back Agent", "Watch Predict Trades", "Redeem Result"].map((label, index) => (
            <div key={label} className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <span className="text-xs text-primary">0{index + 1}</span>
              <h2 className="mt-2 text-lg font-semibold">{label}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {index === 0 ? "Pick an Agent before the T-30s lock." : null}
                {index === 1 ? "Follow the Agent's K-line markers and strategy tape." : null}
                {index === 2 ? "Review Predict settlement, fee, digest, and Agent attribution." : null}
              </p>
            </div>
          ))}
        </div>
      </div>

      <aside className="grid gap-4">
        <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <p className="text-xs uppercase text-on-surface-variant">Current round</p>
          <h2 className="mt-2 text-2xl font-semibold">{currentRound.marketSymbol} {currentRound.durationLabel} Arena</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-on-surface-variant">Status</dt><dd className="font-semibold">{currentRound.status}</dd></div>
            <div><dt className="text-on-surface-variant">Backing</dt><dd className="font-semibold">${currentRound.totalBackingVolume.toLocaleString()}</dd></div>
            <div><dt className="text-on-surface-variant">Agents</dt><dd className="font-semibold">{currentRound.agentIds.length}</dd></div>
            <div><dt className="text-on-surface-variant">Lock</dt><dd className="font-semibold">T-30s</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <h2 className="text-lg font-semibold">Top Agents</h2>
          <div className="mt-3 grid gap-3">
            {topAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between rounded-md bg-surface-container-low p-3">
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-on-surface-variant">{agent.strategyType} 路 {agent.model}</p>
                </div>
                <span className="text-sm font-semibold">{agent.winRate}%</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}
```

- [ ] **Step 2: Run `App.test.tsx`**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/App.test.tsx
```

Expected: still FAIL until Workshop exists.

## Task 3: Live Arena Composition

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/arena/ArenaShell.tsx`
- Create: `agent-arena/apps/frontend/src/components/arena/RoundSelector.tsx`
- Create: `agent-arena/apps/frontend/src/components/agents/AgentCard.tsx`
- Create: `agent-arena/apps/frontend/src/components/agents/AgentRail.tsx`
- Create: `agent-arena/apps/frontend/src/components/agents/SelectedAgentPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/backing/BackAgentPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/portfolio/BetManagementPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/chart/KlineBattlefield.tsx`

- [ ] **Step 1: Add `RoundSelector`**

Create `agent-arena/apps/frontend/src/components/arena/RoundSelector.tsx`:

```tsx
import type { ArenaRound } from "../../types/arena";

interface RoundSelectorProps {
  rounds: ArenaRound[];
  selectedRoundId: string;
  onSelectRound: (roundId: string) => void;
}

export function RoundSelector({ rounds, selectedRoundId, onSelectRound }: RoundSelectorProps) {
  return (
    <section className="flex gap-2 overflow-x-auto border-b border-outline-variant bg-surface-container-low p-3" aria-label="Arena rounds">
      {rounds.map((round) => (
        <button
          key={round.id}
          type="button"
          className={round.id === selectedRoundId ? "round-button round-button-active" : "round-button"}
          onClick={() => onSelectRound(round.id)}
        >
          <span className="font-semibold">{round.marketSymbol} {round.durationLabel}</span>
          <span className="text-xs uppercase">{round.status}</span>
          <span className="text-xs">Lock T-30s</span>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Add Agent display components**

Create `AgentCard`, `AgentRail`, and `SelectedAgentPanel` with these public props:

```ts
// AgentCard props
interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  backed: boolean;
  onSelect: (agentId: string) => void;
}

// AgentRail props
interface AgentRailProps {
  agents: Agent[];
  selectedAgentId: string;
  backedAgentIds: string[];
  activeSort: AgentSortMode;
  onSelectAgent: (agentId: string) => void;
}

// SelectedAgentPanel props
interface SelectedAgentPanelProps {
  agent: Agent;
  exposure: AgentRoundState | undefined;
}
```

Each component must render the fields required by `agent-arena/specs/02-frontend-page-spec.md`: strategy type, model, reasoning depth, win rate, historical ROI, max drawdown, recent form, backing volume, risk label, current exposure, floating PnL, last action, and last reason.

- [ ] **Step 3: Add `BackAgentPanel`**

Create `agent-arena/apps/frontend/src/components/backing/BackAgentPanel.tsx`:

```tsx
import type { Agent, ArenaRound, BackingDraft } from "../../types/arena";
import { isRoundLocked } from "../../state/arena";

interface BackAgentPanelProps {
  round: ArenaRound;
  agent: Agent;
  draft: BackingDraft | null;
  onDraftChange: (amount: number) => void;
}

export function BackAgentPanel({ round, agent, draft, onDraftChange }: BackAgentPanelProps) {
  const locked = isRoundLocked(round);
  const amount = draft?.amount ?? 100;

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container p-4">
      <p className="text-xs uppercase text-primary">Back Agent</p>
      <h2 className="mt-1 text-xl font-semibold">{agent.name}</h2>
      <p className="mt-2 text-sm text-on-surface-variant">{agent.strategySummary}</p>
      <label className="mt-4 block text-sm font-medium" htmlFor="backing-amount">Amount</label>
      <input
        id="backing-amount"
        className="mt-2 w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
        disabled={locked}
        min={1}
        type="number"
        value={amount}
        onChange={(event) => onDraftChange(Number(event.target.value))}
      />
      <div className="mt-3 grid gap-2 text-xs text-on-surface-variant">
        <span>Predict action: {agent.supportedPositionTypes.join(" / ")}</span>
        <span>Lock rule: T-30s before round start</span>
        <span>{locked ? "Locked: backing actions are unavailable for this round." : "Ready: mock backing can still be edited."}</span>
      </div>
      <button className="primary-button mt-4 w-full" disabled={locked} type="button">
        {locked ? "Round Locked" : "Back Agent"}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Add `BetManagementPanel`**

Create a panel with tabs `Upcoming`, `Current`, `History`. It must label live Predict exits as "Close / Redeem" and draft backing actions as "Cancel" or "Modify".

Use this exported signature:

```ts
interface BetManagementPanelProps {
  backings: BackingPosition[];
  rounds: ArenaRound[];
  agents: Agent[];
  onCancelBacking: (backingId: string) => void;
  onCloseMintedBacking: (backingId: string) => void;
}
```

- [ ] **Step 5: Update `ArenaShell`**

Compose the new state and components:

```tsx
const [arenaState, setArenaState] = useState(() =>
  createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings)
);
const selectedRound = getSelectedRound(arenaState);
const selectedAgent = getSelectedAgent(arenaState);
const roundAgents = selectedRound.agentIds.map((agentId) => getAgentById(arenaState.agents, agentId));
```

The shell must render:

- Heading `Live Arena`.
- `RoundSelector`.
- `KlineBattlefield`.
- `AgentRail`.
- `SelectedAgentPanel`.
- `BackAgentPanel`.
- `BetManagementPanel`.

- [ ] **Step 6: Run component tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/App.test.tsx src/components/arena/ArenaShell.test.tsx
```

Expected: FAIL until existing `ArenaShell.test.tsx` is updated for the new headings and panels.

- [ ] **Step 7: Update `ArenaShell.test.tsx`**

Replace expectations for old bot copy with:

```tsx
expect(screen.getByRole("heading", { name: /Live Arena/i })).toBeInTheDocument();
expect(screen.getByText(/BTC 15m/i)).toBeInTheDocument();
expect(screen.getByText(/Back Agent/i)).toBeInTheDocument();
expect(screen.getByText(/Current/i)).toBeInTheDocument();
expect(screen.getByText(/History/i)).toBeInTheDocument();
```

- [ ] **Step 8: Run component tests again**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/App.test.tsx src/components/arena/ArenaShell.test.tsx
```

Expected: PASS.

## Task 4: Workshop Page

**Files:**
- Create: `agent-arena/apps/frontend/src/components/workshop/AgentWorkshop.tsx`
- Test: `agent-arena/apps/frontend/src/App.test.tsx`

- [ ] **Step 1: Create Workshop component**

Create `AgentWorkshop` with local state for:

- model.
- reasoning depth.
- strategy.
- data inputs.
- risk profile.

The page must render:

- Heading `Agent Workshop`.
- Sections `Agent Brain`, `Strategy`, `Data Inputs`, `Risk Profile`, `Agent Preview`.
- Button `Preview in Arena`.
- Copy stating `Demo only`.

- [ ] **Step 2: Run App tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/App.test.tsx
```

Expected: PASS.

## Task 5: Responsive Styling

**Files:**
- Modify: `agent-arena/apps/frontend/src/styles.css`

- [ ] **Step 1: Add reusable classes**

Add classes for:

- `.primary-button`
- `.secondary-button`
- `.nav-button`
- `.nav-button-active`
- `.round-button`
- `.round-button-active`
- compact panel spacing.
- PnL positive and negative labels.

- [ ] **Step 2: Ensure desktop Arena uses stable grid**

The desktop shell must use a constrained grid:

```css
.arena-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: calc(100vh - 4rem);
}
```

Mobile must stack:

```css
@media (max-width: 1023px) {
  .arena-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run TypeScript and tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run typecheck
bun run test
```

Expected: PASS.

## Task 6: Build Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run production build**

Run:

```bash
cd agent-arena/apps/frontend
bun run build
```

Expected: PASS and Vite emits `dist`.

- [ ] **Step 2: Commit this phase if committing is part of the execution session**

Run:

```bash
git add agent-arena/apps/frontend/src
git commit -m "feat: build Agent Arena page flow"
```

Expected: commit contains frontend page, component, style, and test changes only.
