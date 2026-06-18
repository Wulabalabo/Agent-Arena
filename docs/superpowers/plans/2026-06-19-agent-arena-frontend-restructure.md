# Agent Arena Frontend Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Agent Arena frontend around three primary pages: Lobby, Arena, and Leaderboard, while preserving the hidden owner claim route.

**Architecture:** Keep the existing React, Vite, Vitest, Tailwind, and paper/terminal visual system. Add mock-first UI contracts for Arena profile and public action feed, split page responsibilities into focused components, and wire `App.tsx` to a smaller `PlatformView` state model. Hidden claim routing remains path-based and bypasses primary navigation.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Tailwind CSS, lucide-react, existing DeepBook Predict live snapshot utilities.

---

## Scope Check

This is a single frontend information-architecture restructure. It touches routing state, navigation, page composition, mock data contracts, and focused frontend tests. It does not require backend API changes, live websocket feeds, a dedicated Profile page, Mainnet support, Twitter OAuth, or a real Binance fetcher.

## File Structure

Modify:

- `agent-arena/apps/frontend/src/state/platform.ts`: shrink visible platform views to `lobby`, `arena`, and `leaderboard`; start on `lobby`.
- `agent-arena/apps/frontend/src/state/platform.test.ts`: assert the new default view and legal visible views.
- `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`: render only Lobby, Arena, and Leaderboard.
- `agent-arena/apps/frontend/src/components/navigation/AppNav.test.tsx`: focused navigation coverage for the three visible items.
- `agent-arena/apps/frontend/src/App.tsx`: render the three page components and preserve `/agent-arena/claim/:registrationCode`.
- `agent-arena/apps/frontend/src/App.test.tsx`: replace old multi-view assertions with new page, nav, claim, and live market assertions.
- `agent-arena/apps/frontend/src/features/platform/mock.ts`: add enough mock leaderboard entries and competition data to support top-three highlights.
- `agent-arena/apps/frontend/src/features/platform/types.ts`: add `currentExposureStatus` to `LeaderboardEntry` if needed by the table.
- `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`: evolve into a full leaderboard page, or keep as a wrapper around new leaderboard subcomponents.
- `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx`: update expectations for summary, top three, and ranked table.

Create:

- `agent-arena/apps/frontend/src/features/platform/arena-ui.ts`: mock-first UI contracts and derivation helpers for copy prompt, public action feed, and user Agent profile.
- `agent-arena/apps/frontend/src/features/platform/arena-ui.test.ts`: focused unit tests for UI contract derivation and prompt text.
- `agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.tsx`: copyable complete Agent prompt.
- `agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.test.tsx`: clipboard and prompt tests.
- `agent-arena/apps/frontend/src/components/platform/LobbyPage.tsx`: first-page project explanation, compact status, and copy prompt panel.
- `agent-arena/apps/frontend/src/components/platform/LobbyPage.test.tsx`: Lobby content tests.
- `agent-arena/apps/frontend/src/components/platform/ArenaPriceChart.tsx`: mock-first BTC reference chart and Predict oracle annotations.
- `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`: current user's Agent profile and competition state.
- `agent-arena/apps/frontend/src/components/platform/PublicActionFeed.tsx`: right-rail public Agent action feed.
- `agent-arena/apps/frontend/src/components/platform/ArenaPage.tsx`: desktop and mobile layout composition for chart, profile, and feed.
- `agent-arena/apps/frontend/src/components/platform/ArenaPage.test.tsx`: Arena composition and settlement-label tests.

No files outside `agent-arena/apps/frontend` and this plan should be required.

All commands run from the workspace root:

```text
C:\Users\user\Documents\Sui-Overflow-2026
```

## Task 1: Prepare Platform View State And Navigation

**Files:**

- Modify: `agent-arena/apps/frontend/src/state/platform.ts`
- Modify: `agent-arena/apps/frontend/src/state/platform.test.ts`
- Modify: `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`
- Create: `agent-arena/apps/frontend/src/components/navigation/AppNav.test.tsx`

- [ ] **Step 1: Write failing state tests for the new route model**

Replace the first and third tests in `agent-arena/apps/frontend/src/state/platform.test.ts` with:

```ts
it("starts on the Lobby view with the first competition and Agent selected", () => {
  const firstAgent = mockPlatformSnapshot.agents[0];
  const firstCompetition = mockPlatformSnapshot.competitions[0];
  const state = createInitialPlatformState(mockPlatformSnapshot);

  expect(state.activeView).toBe("lobby");
  expect(getSelectedCompetition(state).id).toBe(firstCompetition.id);
  expect(getSelectedAgent(state).id).toBe(firstAgent.id);
});

it("switches between the three primary platform views without clearing selected Agent", () => {
  const secondAgent = mockPlatformSnapshot.agents[1];
  const state = createInitialPlatformState(mockPlatformSnapshot);

  const arena = selectPlatformView(selectAgent(state, secondAgent.id), "arena");
  const leaderboard = selectPlatformView(arena, "leaderboard");
  const lobby = selectPlatformView(leaderboard, "lobby");

  expect(arena.activeView).toBe("arena");
  expect(leaderboard.activeView).toBe("leaderboard");
  expect(lobby.activeView).toBe("lobby");
  expect(lobby.selectedAgentId).toBe(secondAgent.id);
});
```

- [ ] **Step 2: Write a failing focused navigation test**

Create `agent-arena/apps/frontend/src/components/navigation/AppNav.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("renders only Lobby, Arena, and Leaderboard as primary navigation items", () => {
    const onNavigate = vi.fn();
    render(<AppNav activeView="lobby" onNavigate={onNavigate} />);

    expect(screen.getByRole("button", { name: /^Lobby$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Arena$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Wallet$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Replay$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skills$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));
    expect(onNavigate).toHaveBeenCalledWith("arena");
  });
});
```

- [ ] **Step 3: Run tests and confirm they fail for the expected reason**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/state/platform.test.ts src/components/navigation/AppNav.test.tsx
```

Expected: FAIL because `PlatformView` does not yet include `arena`, default state starts on `competition`, and nav still renders old items.

- [ ] **Step 4: Update `PlatformView` for a typecheckable transition and default to Lobby**

In `agent-arena/apps/frontend/src/state/platform.ts`, replace the `PlatformView` type with this transitional union:

```ts
export type PlatformView =
  | "lobby"
  | "arena"
  | "setup"
  | "wallet"
  | "competition"
  | "leaderboard"
  | "replay"
  | "skills";
```

This keeps current `App.tsx` typecheckable while introducing the new `arena` view. Task 6 removes old view values after the new pages are wired.

In `createInitialPlatformState`, set:

```ts
activeView: "lobby",
```

- [ ] **Step 5: Update primary nav items**

In `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`, replace `navItems` with:

```ts
const navItems: Array<{ id: PlatformView; label: string }> = [
  { id: "lobby", label: "Lobby" },
  { id: "arena", label: "Arena" },
  { id: "leaderboard", label: "Leaderboard" }
];
```

Leave the `Agent Arena` brand button pointing to `lobby`.

- [ ] **Step 6: Re-run focused tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/state/platform.test.ts src/components/navigation/AppNav.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run frontend typecheck for the checkpoint**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend typecheck
```

Expected: PASS. `App.tsx` still contains old visible branches at this checkpoint, but it remains typecheckable because Task 1 uses the transitional `PlatformView` union.

- [ ] **Step 8: Commit Task 1**

```powershell
git add -- agent-arena/apps/frontend/src/state/platform.ts agent-arena/apps/frontend/src/state/platform.test.ts agent-arena/apps/frontend/src/components/navigation/AppNav.tsx agent-arena/apps/frontend/src/components/navigation/AppNav.test.tsx
git commit -m "refactor: shrink arena navigation views"
```

## Task 2: Add Mock-First Arena UI Contracts

**Files:**

- Create: `agent-arena/apps/frontend/src/features/platform/arena-ui.ts`
- Create: `agent-arena/apps/frontend/src/features/platform/arena-ui.test.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/mock.ts`
- Modify: `agent-arena/apps/frontend/src/features/platform/types.ts`

- [ ] **Step 1: Write failing tests for prompt, profile derivation, action feed, and leaderboard exposure**

Create `agent-arena/apps/frontend/src/features/platform/arena-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "./mock";
import {
  agentArenaJoinPrompt,
  createPublicActionFeedItems,
  createUserAgentArenaProfile
} from "./arena-ui";

describe("arena UI contracts", () => {
  it("provides the full Agent join prompt", () => {
    expect(agentArenaJoinPrompt).toBe(
      "Read http://127.0.0.1:8787/skills/agent-arena.md and follow the instructions to join the BTC 15m Agent Arena."
    );
  });

  it("derives the current user's Agent arena profile from platform state", () => {
    const profile = createUserAgentArenaProfile({
      agent: mockPlatformSnapshot.agents[0],
      tradingWallet: mockPlatformSnapshot.tradingWallet,
      positions: mockPlatformSnapshot.positions,
      intents: mockPlatformSnapshot.intents,
      executions: mockPlatformSnapshot.executions,
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(profile.accountState).toBe("open_exposure");
    expect(profile.displayName).toBe("Trend Ranger");
    expect(profile.twitterHandle).toBe("Sui_Agent");
    expect(profile.twitterVerified).toBe(false);
    expect(profile.positionLabel).toBe("UP 65000000000000");
    expect(profile.realizedPnlPct).toBe(0.1842);
    expect(profile.latestIntentId).toBe("intent_1");
    expect(profile.latestExecutionId).toBe("exec_1");
    expect(profile.latestPredictTxDigest).toBe("0xmock_exec_1");
  });

  it("derives an explicit no-claimed-Agent profile state", () => {
    const profile = createUserAgentArenaProfile({
      agent: null,
      tradingWallet: null,
      positions: [],
      intents: [],
      executions: [],
      leaderboard: []
    });

    expect(profile.accountState).toBe("no_claimed_agent");
    expect(profile.displayName).toBe("No claimed Agent");
    expect(profile.positionLabel).toBe("No active Agent");
    expect(profile.tradingWalletAddress).toBeNull();
  });

  it("derives public action feed items from intents and executions", () => {
    const items = createPublicActionFeedItems({
      agents: mockPlatformSnapshot.agents,
      intents: mockPlatformSnapshot.intents,
      executions: mockPlatformSnapshot.executions,
      leaderboard: mockPlatformSnapshot.leaderboard
    });

    expect(items.map((item) => item.action)).toContain("open_directional");
    expect(items.map((item) => item.action)).toContain("rejected");
    expect(items[0]).toEqual(expect.objectContaining({
      agentDisplayName: expect.any(String),
      timestamp: expect.any(String),
      status: expect.any(String)
    }));
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/features/platform/arena-ui.test.ts
```

Expected: FAIL because `arena-ui.ts` does not exist.

- [ ] **Step 3: Add UI contracts and derivation helpers**

Create `agent-arena/apps/frontend/src/features/platform/arena-ui.ts`:

```ts
import type {
  AgentIntent,
  AgentPositionSnapshot,
  AgentProfile,
  ExecutionRecord,
  LeaderboardEntry,
  TradingWallet
} from "./types";

export const agentArenaJoinPrompt =
  "Read http://127.0.0.1:8787/skills/agent-arena.md and follow the instructions to join the BTC 15m Agent Arena.";

export type UserAgentArenaAccountState =
  | "no_owner_wallet"
  | "no_claimed_agent"
  | "claimed_no_runtime"
  | "flat"
  | "open_exposure"
  | "attention";

export interface PublicActionFeedItem {
  id: string;
  timestamp: string;
  agentId: string;
  agentDisplayName: string;
  action:
    | "hold"
    | "open_directional"
    | "open_range"
    | "reduce"
    | "close"
    | "rejected"
    | "executed"
    | "pnl_update"
    | "score_update";
  status: "accepted" | "queued" | "executed" | "rejected" | "failed" | "info";
  direction?: "UP" | "DOWN";
  lowerStrike?: string;
  higherStrike?: string;
  confidence?: number;
  reason?: string;
  rejectionCode?: string;
  pnlDeltaPct?: number;
  scoreDelta?: number;
  predictTxDigest?: string;
}

export interface UserAgentArenaProfile {
  accountState: UserAgentArenaAccountState;
  agentId: string | null;
  displayName: string;
  ownerAddress: string | null;
  twitterHandle: string | null;
  twitterVerified: false;
  tradingWalletAddress: string | null;
  runtimeStatus: string;
  exposureStatus: string;
  positionLabel: string;
  openQuantityRaw: string | null;
  submittedBudgetRaw: string | null;
  realizedPnlPct: number | null;
  unrealizedPnlPct: number | null;
  latestIntentId: string | null;
  latestExecutionId: string | null;
  latestPredictTxDigest: string | null;
}

interface CreateUserAgentArenaProfileInput {
  agent: AgentProfile | null;
  tradingWallet: TradingWallet | null;
  positions: AgentPositionSnapshot[];
  intents: AgentIntent[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
}

interface CreatePublicActionFeedItemsInput {
  agents: AgentProfile[];
  intents: AgentIntent[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
}

export function createUserAgentArenaProfile({
  agent,
  tradingWallet,
  positions,
  intents,
  executions,
  leaderboard
}: CreateUserAgentArenaProfileInput): UserAgentArenaProfile {
  if (!agent) {
    return createEmptyUserAgentProfile("no_claimed_agent", "No claimed Agent", "No active Agent");
  }

  const latestIntent = findLatestByAgent(intents, agent.id);
  const latestExecution = findLatestByAgent(executions, agent.id);
  const currentPosition = positions.find((position) => position.agentId === agent.id && position.status === "open");
  const leaderboardEntry = leaderboard.find((entry) => entry.agentId === agent.id);
  const accountState = getAccountState(agent, tradingWallet, currentPosition, latestIntent, latestExecution);

  return {
    accountState,
    agentId: agent.id,
    displayName: agent.displayName,
    ownerAddress: agent.ownerAddress,
    twitterHandle: agent.twitterHandle,
    twitterVerified: false,
    tradingWalletAddress: tradingWallet?.address ?? agent.tradingWalletAddress ?? null,
    runtimeStatus: agent.runtimeStatus,
    exposureStatus: agent.exposureStatus,
    positionLabel: formatPositionLabel(currentPosition),
    openQuantityRaw: currentPosition?.quantityRaw ?? null,
    submittedBudgetRaw: latestIntent?.budgetRaw ?? null,
    realizedPnlPct: leaderboardEntry?.netPnlPct ?? null,
    unrealizedPnlPct: leaderboardEntry?.netPnlPct ?? null,
    latestIntentId: latestIntent?.id ?? null,
    latestExecutionId: latestExecution?.id ?? null,
    latestPredictTxDigest: latestExecution?.predictTxDigest ?? null
  };
}

export function createPublicActionFeedItems({
  agents,
  intents,
  executions,
  leaderboard
}: CreatePublicActionFeedItemsInput): PublicActionFeedItem[] {
  const executionItems = executions.map((execution): PublicActionFeedItem => {
    const agent = agents.find((item) => item.id === execution.agentId);
    return {
      id: `execution:${execution.id}`,
      timestamp: execution.createdAt,
      agentId: execution.agentId,
      agentDisplayName: agent?.displayName ?? execution.agentId,
      action: "executed",
      status: execution.status === "failed" ? "failed" : "executed",
      predictTxDigest: execution.predictTxDigest ?? undefined
    };
  });

  const intentItems = intents.map((intent): PublicActionFeedItem => {
    const agent = agents.find((item) => item.id === intent.agentId);
    const score = leaderboard.find((entry) => entry.agentId === intent.agentId);
    return {
      id: `intent:${intent.id}`,
      timestamp: intent.createdAt,
      agentId: intent.agentId,
      agentDisplayName: agent?.displayName ?? intent.agentId,
      action: intent.status === "rejected" ? "rejected" : normalizeFeedAction(intent.action),
      status: intent.status === "rejected" ? "rejected" : intent.status === "executed" ? "executed" : "accepted",
      direction: intent.market?.kind === "directional" ? (intent.market.isUp ? "UP" : "DOWN") : undefined,
      lowerStrike: intent.market?.kind === "range" ? intent.market.lowerStrike : undefined,
      higherStrike: intent.market?.kind === "range" ? intent.market.higherStrike : undefined,
      confidence: intent.confidence,
      reason: intent.reason,
      rejectionCode: intent.rejectionCode ?? undefined,
      pnlDeltaPct: score?.netPnlPct
    };
  });

  return [...executionItems, ...intentItems].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function createEmptyUserAgentProfile(
  accountState: UserAgentArenaAccountState,
  displayName: string,
  positionLabel: string
): UserAgentArenaProfile {
  return {
    accountState,
    agentId: null,
    displayName,
    ownerAddress: null,
    twitterHandle: null,
    twitterVerified: false,
    tradingWalletAddress: null,
    runtimeStatus: "unavailable",
    exposureStatus: "none",
    positionLabel,
    openQuantityRaw: null,
    submittedBudgetRaw: null,
    realizedPnlPct: null,
    unrealizedPnlPct: null,
    latestIntentId: null,
    latestExecutionId: null,
    latestPredictTxDigest: null
  };
}

function getAccountState(
  agent: AgentProfile,
  tradingWallet: TradingWallet | null,
  currentPosition: AgentPositionSnapshot | undefined,
  latestIntent: AgentIntent | undefined,
  latestExecution: ExecutionRecord | undefined
): UserAgentArenaAccountState {
  if (!agent.ownerAddress) {
    return "no_owner_wallet";
  }

  if (agent.runtimeStatus === "waiting") {
    return "claimed_no_runtime";
  }

  if (latestIntent?.status === "rejected" || latestExecution?.status === "failed") {
    return "attention";
  }

  if (currentPosition || agent.exposureStatus === "directional" || agent.exposureStatus === "range") {
    return "open_exposure";
  }

  if (!tradingWallet) {
    return "claimed_no_runtime";
  }

  return "flat";
}

function normalizeFeedAction(action: AgentIntent["action"]): PublicActionFeedItem["action"] {
  if (action === "add" || action === "switch_direction" || action === "adjust_range") {
    return "hold";
  }

  return action;
}

function findLatestByAgent<T extends { agentId: string; createdAt: string }>(items: T[], agentId: string): T | undefined {
  return [...items]
    .filter((item) => item.agentId === agentId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function formatPositionLabel(position: AgentPositionSnapshot | undefined): string {
  if (!position) {
    return "Flat";
  }

  if (position.direction && position.strikeRaw) {
    return `${position.direction.toUpperCase()} ${position.strikeRaw}`;
  }

  if (position.lowerStrikeRaw && position.higherStrikeRaw) {
    return `Range ${position.lowerStrikeRaw}-${position.higherStrikeRaw}`;
  }

  return position.status;
}
```

- [ ] **Step 4: Expand mock leaderboard entries**

In `agent-arena/apps/frontend/src/features/platform/mock.ts`, add at least two more `leaderboard` entries after the existing `Trend Ranger` entry:

```ts
{
  rank: 2,
  agentId: "agent_2",
  displayName: "Range Cartographer",
  twitterHandle: null,
  twitterVerified: false,
  score: 17.12,
  netPnlPct: 0.0921,
  maxDrawdownPct: 0.018,
  capitalEfficiencyPct: 0.72,
  hitRatePct: 0.5,
  executionCount: 4,
  invalidIntentCount: 1,
  finalExecutionAt: "2026-06-16T10:13:00.000Z",
  currentExposureStatus: "flat"
},
{
  rank: 3,
  agentId: "agent_3",
  displayName: "Oracle Pulse",
  twitterHandle: "oracle_pulse",
  twitterVerified: false,
  score: 11.84,
  netPnlPct: 0.051,
  maxDrawdownPct: 0.022,
  capitalEfficiencyPct: 0.66,
  hitRatePct: 0.4,
  executionCount: 5,
  invalidIntentCount: 0,
  finalExecutionAt: "2026-06-16T10:12:00.000Z",
  currentExposureStatus: "range"
}
```

Also add a third mock agent for `agent_3` if the feed or leaderboard needs a matching display record.

- [ ] **Step 5: Add optional current exposure to leaderboard type**

In `agent-arena/apps/frontend/src/features/platform/types.ts`, add to `LeaderboardEntry`:

```ts
currentExposureStatus?: ExposureStatus;
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/features/platform/arena-ui.test.ts src/features/platform/mock.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- agent-arena/apps/frontend/src/features/platform/arena-ui.ts agent-arena/apps/frontend/src/features/platform/arena-ui.test.ts agent-arena/apps/frontend/src/features/platform/mock.ts agent-arena/apps/frontend/src/features/platform/types.ts
git commit -m "feat: add arena ui mock contracts"
```

## Task 3: Build Lobby Page And Copy Prompt Panel

**Files:**

- Create: `agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.test.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/LobbyPage.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/LobbyPage.test.tsx`

- [ ] **Step 1: Write failing copy prompt tests**

Create `agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { agentArenaJoinPrompt } from "../../features/platform/arena-ui";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";

describe("CopyAgentPromptPanel", () => {
  it("shows and copies the complete Agent prompt", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyAgentPromptPanel />);

    expect(screen.getByText(agentArenaJoinPrompt)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy prompt/i }));

    expect(writeText).toHaveBeenCalledWith(agentArenaJoinPrompt);
    expect(await screen.findByText(/Prompt copied/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write failing Lobby page tests**

Create `agent-arena/apps/frontend/src/components/platform/LobbyPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LobbyPage } from "./LobbyPage";

describe("LobbyPage", () => {
  it("explains Agent Arena and shows compact current arena status", () => {
    render(
      <LobbyPage
        competition={mockPlatformSnapshot.competitions[0]}
        leaderboard={mockPlatformSnapshot.leaderboard}
      />
    );

    expect(screen.getByRole("heading", { name: /Agent Arena/i })).toBeInTheDocument();
    expect(screen.getByText(/Testnet-only AI Agent competition layer/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC 15m Predict Arena/i)).toBeInTheDocument();
    expect(screen.getByText(/Current leader/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.queryByText(/Runtime credential/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/CopyAgentPromptPanel.test.tsx src/components/platform/LobbyPage.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 4: Implement `CopyAgentPromptPanel`**

Create `agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.tsx`:

```tsx
import { Clipboard, Check } from "lucide-react";
import { useState } from "react";
import { agentArenaJoinPrompt } from "../../features/platform/arena-ui";

export function CopyAgentPromptPanel() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(agentArenaJoinPrompt);
    setCopied(true);
  }

  return (
    <section aria-label="Copy Agent prompt" className="paper-inset p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Join prompt</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Send this to your Agent</h2>
        </div>
        <span className="paper-chip px-2 py-1">Skill ready</span>
      </div>

      <div className="mt-4 grid gap-3 border-2 border-black bg-[#191b23] p-3 text-white md:grid-cols-[1fr_auto]">
        <p className="break-words font-mono text-xs font-black leading-6">{agentArenaJoinPrompt}</p>
        <button
          className="paper-button inline-flex items-center justify-center gap-2 bg-white px-3 py-2 font-display text-xs font-black uppercase text-on-surface"
          type="button"
          onClick={copyPrompt}
        >
          {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
          {copied ? "Prompt copied" : "Copy prompt"}
        </button>
      </div>

      <p className="mt-3 break-all font-mono text-[11px] font-bold text-on-surface-variant">
        Skill URL: http://127.0.0.1:8787/skills/agent-arena.md
      </p>
    </section>
  );
}
```

- [ ] **Step 5: Implement `LobbyPage`**

Create `agent-arena/apps/frontend/src/components/platform/LobbyPage.tsx`:

```tsx
import type { ReactNode } from "react";
import { Radio, Trophy, Users } from "lucide-react";
import type { Competition, LeaderboardEntry } from "../../features/platform/types";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";

interface LobbyPageProps {
  competition?: Competition;
  leaderboard: LeaderboardEntry[];
}

export function LobbyPage({ competition, leaderboard }: LobbyPageProps) {
  const leader = leaderboard[0];

  return (
    <section aria-label="Lobby" className="grid gap-4">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Lobby</p>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-black uppercase text-on-surface">
              Agent Arena
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-on-surface-variant">
              Testnet-only AI Agent competition layer for BTC 15 minute DeepBook Predict arenas. Send an Agent the skill prompt, let it register, and watch it submit guarded intents through the platform.
            </p>
          </div>
          <span className="paper-chip paper-chip-green px-2 py-1">Testnet</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <LobbyMetric icon={<Radio aria-hidden="true" size={15} />} label="Arena" value="BTC 15m Predict Arena" />
          <LobbyMetric label="Status" value={competition?.status ?? "pending"} />
          <LobbyMetric icon={<Users aria-hidden="true" size={15} />} label="Agents" value={`${competition?.activeAgentCount ?? 0} active / ${competition?.registeredAgentCount ?? 0} registered`} />
          <LobbyMetric icon={<Trophy aria-hidden="true" size={15} />} label="Current leader" value={leader?.displayName ?? "No leader yet"} />
        </div>
      </div>

      <CopyAgentPromptPanel />
    </section>
  );
}

function LobbyMetric({ icon, label, value }: { icon?: ReactNode; label: string; value: string | number }) {
  return (
    <div className="paper-inset min-w-0 p-3">
      <p className="paper-label flex items-center gap-2 text-on-surface-variant">
        {icon}
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-xs font-black text-on-surface">{value}</p>
    </div>
  );
}
```

- [ ] **Step 6: Run focused Lobby tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/CopyAgentPromptPanel.test.tsx src/components/platform/LobbyPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.tsx agent-arena/apps/frontend/src/components/platform/CopyAgentPromptPanel.test.tsx agent-arena/apps/frontend/src/components/platform/LobbyPage.tsx agent-arena/apps/frontend/src/components/platform/LobbyPage.test.tsx
git commit -m "feat: add agent arena lobby page"
```

## Task 4: Build Arena Page, Chart, User Profile, And Public Feed

**Files:**

- Create: `agent-arena/apps/frontend/src/components/platform/ArenaPriceChart.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/PublicActionFeed.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/ArenaPage.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/ArenaPage.test.tsx`

- [ ] **Step 1: Write failing Arena page test**

Create `agent-arena/apps/frontend/src/components/platform/ArenaPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import { createPublicActionFeedItems, createUserAgentArenaProfile } from "../../features/platform/arena-ui";
import { ArenaPage } from "./ArenaPage";

describe("ArenaPage", () => {
  it("renders chart, current Agent profile, and public action feed", () => {
    render(
      <ArenaPage
        competition={mockPlatformSnapshot.competitions[0]}
        liveMarketSnapshot={liveMarketSnapshot}
        liveMarketStatus="ready"
        liveMarketError={null}
        userAgentProfile={createUserAgentArenaProfile({
          agent: mockPlatformSnapshot.agents[0],
          tradingWallet: mockPlatformSnapshot.tradingWallet,
          positions: mockPlatformSnapshot.positions,
          intents: mockPlatformSnapshot.intents,
          executions: mockPlatformSnapshot.executions,
          leaderboard: mockPlatformSnapshot.leaderboard
        })}
        actionFeedItems={createPublicActionFeedItems({
          agents: mockPlatformSnapshot.agents,
          intents: mockPlatformSnapshot.intents,
          executions: mockPlatformSnapshot.executions,
          leaderboard: mockPlatformSnapshot.leaderboard
        })}
      />
    );

    expect(screen.getByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/BTC reference chart/i)).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /My Agent/i })).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/UP 65000000000000/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(screen.getByText(/open directional/i)).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });
});

const liveMarketSnapshot: LiveBtcMarketSnapshot = {
  health: "ready",
  serverStatus: "OK",
  serverTime: "2026-06-16T15:00:00.000Z",
  serverTimeMs: 1781622000000,
  predictId: "0xpredict",
  quoteAssetLabel: "DUSDC",
  oracleCounts: { activeFutureBtc: 1, activeTotal: 1, total: 1 },
  oracle: {
    oracleId: "0xfuture-nearest",
    underlyingAsset: "BTC",
    expiryMs: 1781622900000,
    expiresAt: "2026-06-16T15:15:00.000Z",
    secondsToExpiry: 900,
    status: "active"
  },
  price: {
    spot: 65611.517258518,
    forward: 65611.186326705,
    updatedAt: "2026-06-16T15:00:54.893Z",
    checkpoint: 349166156
  },
  currentOracleTradeCount: 1,
  events: [],
  fetchedAt: "2026-06-16T15:00:55.000Z"
};
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/ArenaPage.test.tsx
```

Expected: FAIL because the Arena components do not exist.

- [ ] **Step 3: Implement `ArenaPriceChart`**

Create `agent-arena/apps/frontend/src/components/platform/ArenaPriceChart.tsx`:

```tsx
import { Activity, Radio } from "lucide-react";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";

interface ArenaPriceChartProps {
  snapshot: LiveBtcMarketSnapshot | null;
  status: LiveBtcMarketStatus;
  error: string | null;
}

const mockKlinePath = "M 0 72 L 40 66 L 80 82 L 120 48 L 160 54 L 200 34 L 240 44 L 280 26 L 320 38 L 360 20";

export function ArenaPriceChart({ snapshot, status, error }: ArenaPriceChartProps) {
  const price = snapshot?.price;

  return (
    <section aria-label="BTC reference chart" className="paper-inset min-h-[360px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">BTCUSDT</p>
          <h2 className="mt-1 font-display text-xl font-black uppercase text-on-surface">BTC reference chart</h2>
        </div>
        <span className="paper-chip paper-chip-blue px-2 py-1">
          <Activity aria-hidden="true" size={12} />
          Binance BTCUSDT reference display
        </span>
      </div>

      <div className="mt-4 border-2 border-black bg-[#191b23] p-4 text-white">
        <svg className="h-44 w-full" role="img" aria-label="BTC heartbeat price trace" viewBox="0 0 360 110" preserveAspectRatio="none">
          <line x1="0" y1="55" x2="360" y2="55" stroke="rgba(255,255,255,0.22)" strokeDasharray="6 6" />
          <path d={mockKlinePath} fill="none" stroke="#22c55e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          <circle cx="360" cy="20" r="5" fill="#fd761a" />
        </svg>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Reference BTC" value={price ? formatUsd(price.spot) : "Waiting"} />
        <Metric label="Predict oracle" value={price?.forward ? formatUsd(price.forward) : "Waiting"} />
        <Metric label="Oracle expiry" value={snapshot?.oracle ? `${snapshot.oracle.secondsToExpiry}s` : "No oracle"} />
        <Metric label="Predict status" value={snapshot?.serverStatus ?? status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="paper-chip px-2 py-1">
          <Radio aria-hidden="true" size={12} />
          Predict oracle drives arena settlement
        </span>
        {error ? <span className="paper-chip paper-chip-red px-2 py-1">{error}</span> : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-2 border-black bg-white p-3">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-2 truncate font-mono text-sm font-black text-on-surface">{value}</p>
    </div>
  );
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}
```

- [ ] **Step 4: Implement `UserAgentProfilePanel`**

Create `agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx`:

```tsx
import type { UserAgentArenaProfile } from "../../features/platform/arena-ui";

export function UserAgentProfilePanel({ profile }: { profile: UserAgentArenaProfile }) {
  return (
    <section aria-label="My Agent profile" className="paper-inset p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">My Agent</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">My Agent</h2>
        </div>
        <span className="paper-chip paper-chip-green px-2 py-1">{profile.accountState}</span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <Metric label="Name" value={profile.displayName} />
        <Metric label="Account" value={profile.accountState.replace(/_/g, " ")} />
        <Metric label="Position" value={profile.positionLabel} />
        <Metric label="Exposure" value={profile.exposureStatus} />
        <Metric label="PnL" value={profile.realizedPnlPct === null ? "No score" : `${(profile.realizedPnlPct * 100).toFixed(2)}%`} />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MonoLine label="Agent id" value={profile.agentId} />
        <MonoLine label="Owner" value={profile.ownerAddress ?? "No owner connected"} />
        <MonoLine label="Trading wallet" value={profile.tradingWalletAddress ?? "No wallet"} />
        <MonoLine label="Latest Predict tx" value={profile.latestPredictTxDigest ?? "No execution"} />
      </div>

      {profile.twitterHandle ? (
        <p className="mt-3">
          <span className="paper-chip px-2 py-1">@{profile.twitterHandle} unverified</span>
        </p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-2 border-black bg-white p-3">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-2 truncate font-mono text-xs font-black text-on-surface">{value}</p>
    </div>
  );
}

function MonoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
    </p>
  );
}
```

- [ ] **Step 5: Implement `PublicActionFeed`**

Create `agent-arena/apps/frontend/src/components/platform/PublicActionFeed.tsx`:

```tsx
import type { PublicActionFeedItem } from "../../features/platform/arena-ui";

export function PublicActionFeed({ items }: { items: PublicActionFeedItem[] }) {
  return (
    <aside aria-label="Public action feed" className="paper-inset p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Broadcast</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Public action feed</h2>
        </div>
        <span className="paper-chip px-2 py-1">Live</span>
      </div>

      <div className="mt-3 grid max-h-[720px] gap-2 overflow-auto pr-1">
        {items.map((item) => (
          <article className="border-2 border-black bg-white p-3" key={item.id}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="truncate font-display text-xs font-black uppercase text-on-surface">{item.agentDisplayName}</p>
              <span className="paper-chip px-2 py-1">{item.status}</span>
            </div>
            <p className="mt-2 font-mono text-xs font-black text-on-surface">{formatAction(item.action)}</p>
            <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">{formatMarket(item)}</p>
            {item.reason ? <p className="mt-2 clamp-2 text-xs font-semibold leading-5 text-on-surface-variant">{item.reason}</p> : null}
            {item.rejectionCode ? <MonoLine label="Code" value={item.rejectionCode} /> : null}
            {item.predictTxDigest ? <MonoLine label="Tx" value={item.predictTxDigest} /> : null}
          </article>
        ))}
      </div>
    </aside>
  );
}

function formatAction(value: string): string {
  return value.replace(/_/g, " ");
}

function formatMarket(item: PublicActionFeedItem): string {
  if (item.direction) {
    return `${item.direction} direction`;
  }

  if (item.lowerStrike && item.higherStrike) {
    return `Range ${item.lowerStrike}-${item.higherStrike}`;
  }

  return new Date(item.timestamp).toISOString().slice(11, 19);
}

function MonoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
    </p>
  );
}
```

- [ ] **Step 6: Implement `ArenaPage`**

Create `agent-arena/apps/frontend/src/components/platform/ArenaPage.tsx`:

```tsx
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";
import type { PublicActionFeedItem, UserAgentArenaProfile } from "../../features/platform/arena-ui";
import type { Competition } from "../../features/platform/types";
import { ArenaPriceChart } from "./ArenaPriceChart";
import { PublicActionFeed } from "./PublicActionFeed";
import { UserAgentProfilePanel } from "./UserAgentProfilePanel";

interface ArenaPageProps {
  competition?: Competition;
  liveMarketSnapshot: LiveBtcMarketSnapshot | null;
  liveMarketStatus: LiveBtcMarketStatus;
  liveMarketError: string | null;
  userAgentProfile: UserAgentArenaProfile;
  actionFeedItems: PublicActionFeedItem[];
}

export function ArenaPage({
  competition,
  liveMarketSnapshot,
  liveMarketStatus,
  liveMarketError,
  userAgentProfile,
  actionFeedItems
}: ArenaPageProps) {
  return (
    <section aria-label="Arena" className="grid gap-4">
      <div className="paper-card-sm p-5">
        <p className="paper-label text-on-surface-variant">Arena</p>
        <h1 className="mt-1 font-display text-2xl font-black uppercase text-on-surface">BTC 15m Arena</h1>
        <p className="mt-2 break-all font-mono text-[11px] font-bold text-on-surface-variant">
          {competition ? `Oracle ${competition.oracleId} / Predict object ${competition.predictObjectId}` : "Waiting for arena"}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <ArenaPriceChart snapshot={liveMarketSnapshot} status={liveMarketStatus} error={liveMarketError} />
          <UserAgentProfilePanel profile={userAgentProfile} />
        </div>
        <PublicActionFeed items={actionFeedItems} />
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Run Arena tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/ArenaPage.test.tsx src/features/platform/arena-ui.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add -- agent-arena/apps/frontend/src/components/platform/ArenaPriceChart.tsx agent-arena/apps/frontend/src/components/platform/UserAgentProfilePanel.tsx agent-arena/apps/frontend/src/components/platform/PublicActionFeed.tsx agent-arena/apps/frontend/src/components/platform/ArenaPage.tsx agent-arena/apps/frontend/src/components/platform/ArenaPage.test.tsx
git commit -m "feat: add live arena page layout"
```

## Task 5: Expand Leaderboard Into A Full Page

**Files:**

- Modify: `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx`

- [ ] **Step 1: Replace leaderboard test expectations**

In `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx`, replace the test body with:

```tsx
it("renders a full leaderboard page with summary, top three, and ranked table", () => {
  render(<LeaderboardPanel entries={mockPlatformSnapshot.leaderboard} competition={mockPlatformSnapshot.competitions[0]} />);

  expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
  expect(screen.getByText(/BTC 15m Testnet Arena/i)).toBeInTheDocument();
  expect(screen.getByText(/Top Agents/i)).toBeInTheDocument();
  expect(screen.getByText(/Ranked Agents/i)).toBeInTheDocument();
  expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
  expect(screen.getByText(/Range Cartographer/i)).toBeInTheDocument();
  expect(screen.getByText(/Oracle Pulse/i)).toBeInTheDocument();
  expect(screen.getByText(/@Sui_Agent/i)).toBeInTheDocument();
  expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /rank/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /agent/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /score/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /net pnl/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /executions/i })).toBeInTheDocument();
});
```

Update the render import expectations if TypeScript requires the `competition` prop to be added.

- [ ] **Step 2: Run failing leaderboard test**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/LeaderboardPanel.test.tsx
```

Expected: FAIL because `LeaderboardPanel` does not accept `competition` and does not render top-three cards or a table.

- [ ] **Step 3: Replace `LeaderboardPanel` with a full page**

Update `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx` to accept `competition` and render:

```tsx
import type { ReactNode } from "react";
import type { Competition, LeaderboardEntry } from "../../features/platform/types";

interface LeaderboardPanelProps {
  competition?: Competition;
  entries: LeaderboardEntry[];
}

export function LeaderboardPanel({ competition, entries }: LeaderboardPanelProps) {
  const sortedEntries = [...entries].sort((left, right) => right.score - left.score);
  const topEntries = sortedEntries.slice(0, 3);

  return (
    <section aria-label="Leaderboard" className="grid gap-4">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="paper-label text-on-surface-variant">Leaderboard</p>
            <h1 className="mt-1 font-display text-3xl font-black uppercase text-on-surface">Leaderboard</h1>
            <p className="mt-2 text-sm font-bold text-on-surface-variant">
              {competition?.name ?? "BTC 15m Arena"} / {competition?.status ?? "pending"} / {entries.length} ranked Agents
            </p>
          </div>
          <span className="paper-chip paper-chip-green px-2 py-1">Testnet season</span>
        </div>
      </div>

      <section aria-label="Top Agents" className="grid gap-3 lg:grid-cols-3">
        {topEntries.map((entry) => (
          <article className="paper-card-sm p-4" key={entry.agentId}>
            <p className="paper-label text-on-surface-variant">Rank {entry.rank}</p>
            <h2 className="mt-2 truncate font-display text-lg font-black uppercase text-on-surface">{entry.displayName}</h2>
            <p className="mt-2 font-mono text-sm font-black text-on-surface">{entry.score.toFixed(2)} score</p>
            <p className="mt-2 font-mono text-[11px] font-bold text-on-surface-variant">{formatHandle(entry)}</p>
          </article>
        ))}
      </section>

      <section aria-label="Ranked Agents" className="paper-card-sm overflow-hidden p-4">
        <h2 className="font-display text-lg font-black uppercase text-on-surface">Ranked Agents</h2>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-black">
                <ColumnHeader>Rank</ColumnHeader>
                <ColumnHeader>Agent</ColumnHeader>
                <ColumnHeader>Score</ColumnHeader>
                <ColumnHeader>Net PnL</ColumnHeader>
                <ColumnHeader>Hit Rate</ColumnHeader>
                <ColumnHeader>Executions</ColumnHeader>
                <ColumnHeader>Invalid</ColumnHeader>
                <ColumnHeader>Exposure</ColumnHeader>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => (
                <tr className="border-b border-outline/50" key={entry.agentId}>
                  <Cell>#{entry.rank}</Cell>
                  <Cell>
                    <span className="font-display font-black uppercase">{entry.displayName}</span>
                    <span className="mt-1 block font-mono text-[11px] text-on-surface-variant">{formatHandle(entry)}</span>
                  </Cell>
                  <Cell>{entry.score.toFixed(2)}</Cell>
                  <Cell>{formatPercent(entry.netPnlPct)}</Cell>
                  <Cell>{formatPercent(entry.hitRatePct)}</Cell>
                  <Cell>{entry.executionCount}</Cell>
                  <Cell>{entry.invalidIntentCount}</Cell>
                  <Cell>{entry.currentExposureStatus ?? "flat"}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ColumnHeader({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 font-display text-[11px] font-black uppercase text-on-surface-variant">{children}</th>;
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 font-mono text-xs font-bold text-on-surface">{children}</td>;
}

function formatHandle(entry: LeaderboardEntry): string {
  return entry.twitterHandle ? `@${entry.twitterHandle} unverified` : "No public handle";
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
```

- [ ] **Step 4: Run leaderboard tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/components/platform/LeaderboardPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx
git commit -m "feat: expand arena leaderboard page"
```

## Task 6: Wire App To The Three Pages And Preserve Hidden Claim Route

**Files:**

- Modify: `agent-arena/apps/frontend/src/App.tsx`
- Modify: `agent-arena/apps/frontend/src/App.test.tsx`
- Modify: `agent-arena/apps/frontend/src/state/platform.ts`

- [ ] **Step 1: Replace App tests for new primary flow**

In `agent-arena/apps/frontend/src/App.test.tsx`, keep the existing claim-route mock setup and claim test. Replace old default and navigation tests with:

```tsx
it("defaults to the Lobby page", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /Agent Arena/i })).toBeInTheDocument();
  expect(screen.getByText(/Testnet-only AI Agent competition layer/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
});

it("navigates between Lobby, Arena, and Leaderboard only", async () => {
  render(<App liveMarketLoader={async () => appLiveMarketSnapshot} />);

  expect(screen.getByRole("button", { name: /^Lobby$/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Arena$/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Leaderboard$/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Wallet$/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Replay$/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Skills$/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));
  expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
  expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
  expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^Leaderboard$/i }));
  expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
  expect(screen.getByText(/Ranked Agents/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^Lobby$/i }));
  expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
});
```

Keep this claim-route test unchanged in purpose:

```tsx
it("claims an Agent from the owner-facing claim URL", async () => {
  window.history.pushState({}, "", "/agent-arena/claim/PAIR-2050");
  // existing platformFetcher setup remains
  // expectations still assert registration code, wallet address, and runtime credential reveal
});
```

- [ ] **Step 2: Run failing App tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/App.test.tsx
```

Expected: FAIL until `App.tsx` renders the new pages.

- [ ] **Step 3: Update App imports**

In `agent-arena/apps/frontend/src/App.tsx`, remove unused imports for old visible pages:

```ts
import { AgentPairingPanel } from "./components/platform/AgentPairingPanel";
import { CompetitionLobby } from "./components/platform/CompetitionLobby";
import { LiveCompetition } from "./components/platform/LiveCompetition";
import { ReplayTimeline } from "./components/platform/ReplayTimeline";
import { SkillDocsPanel } from "./components/platform/SkillDocsPanel";
import { TradingWalletPanel } from "./components/platform/TradingWalletPanel";
```

Add:

```ts
import { ArenaPage } from "./components/platform/ArenaPage";
import { LobbyPage } from "./components/platform/LobbyPage";
import {
  createPublicActionFeedItems,
  createUserAgentArenaProfile
} from "./features/platform/arena-ui";
```

- [ ] **Step 4: Update live market polling condition**

In `App.tsx`, set:

```ts
enabled: state.activeView === "arena",
```

- [ ] **Step 5: Add derived Arena props**

Inside `App`, after `selectedCompetition`, add:

```ts
const userAgentProfile = useMemo(
  () =>
    createUserAgentArenaProfile({
      agent: selectedAgent,
      tradingWallet: state.tradingWallet,
      positions: state.positions,
      intents: state.intents,
      executions: state.executions,
      leaderboard: state.leaderboard
    }),
  [selectedAgent, state.tradingWallet, state.positions, state.intents, state.executions, state.leaderboard]
);

const publicActionFeedItems = useMemo(
  () =>
    createPublicActionFeedItems({
      agents: state.agents,
      intents: state.intents,
      executions: state.executions,
      leaderboard: state.leaderboard
    }),
  [state.agents, state.intents, state.executions, state.leaderboard]
);
```

- [ ] **Step 6: Replace visible page render block**

In `App.tsx`, keep the claim route branch first. Replace the visible branch with:

```tsx
{claimRegistrationCode ? (
  <SuiDappKitAgentClaimPanel
    apiBaseUrl={apiBaseUrl}
    fetcher={platformFetcher}
    registrationCode={claimRegistrationCode}
  />
) : state.activeView === "lobby" ? (
  <LobbyPage competition={selectedCompetition} leaderboard={state.leaderboard} />
) : state.activeView === "arena" ? (
  <ArenaPage
    actionFeedItems={publicActionFeedItems}
    competition={selectedCompetition}
    liveMarketError={liveMarket.error}
    liveMarketSnapshot={liveMarket.snapshot}
    liveMarketStatus={liveMarket.status}
    userAgentProfile={userAgentProfile}
  />
) : (
  <LeaderboardPanel competition={selectedCompetition} entries={state.leaderboard} />
)}
```

Remove the old header section that only rendered for `"competition"` because Arena owns its header.

- [ ] **Step 7: Shrink `PlatformView` to the final visible route model**

After `App.tsx` no longer references old view strings, replace the transitional union in `agent-arena/apps/frontend/src/state/platform.ts` with:

```ts
export type PlatformView = "lobby" | "arena" | "leaderboard";
```

- [ ] **Step 8: Run focused App tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend vitest run src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Keep old unreferenced components unless deletion is proven safe**

Keep `AgentPairingPanel`, `CompetitionLobby`, `LiveCompetition`, `ReplayTimeline`, `SkillDocsPanel`, and `TradingWalletPanel` in place for this implementation pass unless TypeScript reports an unused import in a file being edited. Remove only imports from `App.tsx`; do not delete component files in this task.

- [ ] **Step 10: Commit Task 6**

```powershell
git add -- agent-arena/apps/frontend/src/App.tsx agent-arena/apps/frontend/src/App.test.tsx agent-arena/apps/frontend/src/state/platform.ts
git commit -m "feat: wire three page arena frontend"
```

## Task 7: Final Validation And Cleanup

**Files:**

- Modify only files already touched by Tasks 1-6 if validation exposes issues.

- [ ] **Step 1: Run frontend typecheck**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend typecheck
```

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend test
```

Expected: PASS.

- [ ] **Step 3: Run a production build**

Run:

```powershell
bun run --cwd agent-arena/apps/frontend build
```

Expected: PASS.

- [ ] **Step 4: Inspect final changed files**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected:

- Only intended frontend files are modified.
- `git diff --check` prints no whitespace errors.
- Existing unrelated dirty files, if still present, remain unstaged unless the user explicitly asks to include them.

- [ ] **Step 5: Commit final cleanup if needed**

If Task 7 made fixes:

```powershell
git add -- agent-arena/apps/frontend/src
git commit -m "fix: validate arena frontend restructure"
```

If Task 7 did not make fixes, do not create an empty commit.

## Plan Self-Review

Spec coverage:

- Primary nav reduced to Lobby, Arena, Leaderboard: Task 1 and Task 6.
- Hidden claim route preserved: Task 6.
- Lobby first page and complete prompt copy: Task 3 and Task 6.
- Arena center chart, lower user profile, right public feed: Task 4 and Task 6.
- Binance reference and Predict settlement label: Task 4 and Task 6.
- Full Leaderboard page with top three and table: Task 5.
- Mock-first data with API-shaped contracts: Task 2.
- Existing visual system preserved: Tasks 3-5 use `paper-*` utilities and existing palette.
- Tests for required behaviors: Tasks 1-7.

Placeholder scan:

- The plan contains no unresolved placeholder markers or intentionally vague implementation steps.

Type consistency:

- `PlatformView` uses a transitional union in Task 1 so current `App.tsx` stays typecheckable, then narrows to `lobby | arena | leaderboard` in Task 6 after the new pages are wired.
- `PublicActionFeedItem` and `UserAgentArenaProfile` are defined before components consume them.
- `LeaderboardEntry.currentExposureStatus` is optional and uses the existing `ExposureStatus` union.
- `ArenaPage` props match the outputs from `arena-ui.ts` and the existing live market hook.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-19-agent-arena-frontend-restructure.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

The user requested subagent review before implementation, so run that review first and apply any plan fixes before choosing an execution mode.
