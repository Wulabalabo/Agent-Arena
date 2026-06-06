# Agent Arena Implementation Plan

> **For agentic workers:** Implement task-by-task. Keep commits small and verify each phase before moving on.

**Goal:** Build a frontend-first Agent Arena MVP that demonstrates a live multiplayer AI trading competition with prediction positions and settlement proof.

**Architecture:** Start with a mock-driven Vite React app. Keep market data, agent state, and demo progression deterministic so the hackathon demo is reliable before chain integration. Reserve backend and contracts folders for later phases.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Vitest, Testing Library, lucide-react.

---

## Phase 1: Frontend Scaffold

**Files:**
- Create: `apps/frontend/package.json`
- Create: `apps/frontend/index.html`
- Create: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/App.tsx`
- Create: `apps/frontend/src/styles.css`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/vite.config.ts`
- Create: `apps/frontend/vitest.setup.ts`

**Outcome:** A working Vite React app with TypeScript, Tailwind, and Vitest.

## Phase 2: Domain Model And Mock Data

**Files:**
- Create: `apps/frontend/src/types/arena.ts`
- Create: `apps/frontend/src/mock/arena.ts`
- Create: `apps/frontend/src/mock/arena.test.ts`

**Outcome:** Deterministic agent, candle, trade event, and prediction data with tests covering match shape, leaderboard ordering, and market statements.

## Phase 3: Arena State

**Files:**
- Create: `apps/frontend/src/state/arena.ts`
- Create: `apps/frontend/src/state/arena.test.ts`

**Outcome:** Pure state helpers for selecting bots, confirming a prediction, advancing demo phase, and computing settlement state.

## Phase 4: Core Arena Components

**Files:**
- Create: `apps/frontend/src/components/arena/MatchHeader.tsx`
- Create: `apps/frontend/src/components/chart/KlineBattlefield.tsx`
- Create: `apps/frontend/src/components/bots/BotCard.tsx`
- Create: `apps/frontend/src/components/bots/BotCardRail.tsx`
- Create: `apps/frontend/src/components/arena/ArenaShell.tsx`

**Outcome:** Static Live Arena layout with header, K-line battlefield, and bot card rail.

## Phase 5: Interaction Overlays

**Files:**
- Create: `apps/frontend/src/components/bots/BotDetailDrawer.tsx`
- Create: `apps/frontend/src/components/prediction/PredictionModal.tsx`
- Create: `apps/frontend/src/components/settlement/SettlementOverlay.tsx`

**Outcome:** Select a bot, view its strategy details, back it through a prediction modal, and show settlement.

## Phase 6: Demo Polish

**Files:**
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/styles.css`
- Modify component files as needed.

**Outcome:** A judge-friendly demo flow from lobby/live state to prediction confirmation and settlement, with polished responsive layout.

## Verification

Run from `agent-arena/apps/frontend`:

```bash
bun install
bun run typecheck
bun run test
bun run build
```

If Bun is unavailable, use the equivalent npm commands.

