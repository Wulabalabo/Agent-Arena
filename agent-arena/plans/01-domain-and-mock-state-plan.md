# Domain And Mock State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current bot/prediction MVP model with a Predict-native Agent backing domain model and deterministic mock state.

**Architecture:** Keep this phase pure TypeScript. Define stable domain types, mock fixtures, selectors, and state transitions before touching page layout. No wallet SDK, backend, or Sui transaction code is introduced in this plan.

**Tech Stack:** React, TypeScript, Vitest, Vite, existing frontend test setup.

---

## Source Specs

- `agent-arena/specs/01-product-spec.md`
- `agent-arena/specs/05-data-state-and-acceptance-spec.md`

## File Structure

- Modify: `agent-arena/apps/frontend/src/types/arena.ts`
- Owns shared domain types for rounds, Agents, Predict attribution descriptors, trade markers, backing positions, and app state.
- Modify: `agent-arena/apps/frontend/src/mock/arena.ts`
  - Owns deterministic MVP data for rounds, Agents, candles, trade markers, and user backing positions.
- Modify: `agent-arena/apps/frontend/src/mock/arena.test.ts`
  - Verifies mock data shape and product rules.
- Modify: `agent-arena/apps/frontend/src/state/arena.ts`
  - Owns pure selectors and reducers for round selection, Agent selection, backing drafts, lock state, and settlement state.
- Modify: `agent-arena/apps/frontend/src/state/arena.test.ts`
  - Verifies lock, backing, cancel/modify, close/redeem, and settlement behavior.

## Task 1: Replace Domain Types

**Files:**
- Modify: `agent-arena/apps/frontend/src/types/arena.ts`
- Test: `agent-arena/apps/frontend/src/mock/arena.test.ts`

- [ ] **Step 1: Write the failing mock shape test**

Replace the first test block in `agent-arena/apps/frontend/src/mock/arena.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { mockAgents, mockArenaRounds, mockUserBackings } from "./arena";

describe("arena mock data", () => {
  it("provides enough deterministic data for the MVP Arena", () => {
    expect(mockArenaRounds).toHaveLength(3);
    expect(mockAgents.length).toBeGreaterThanOrEqual(6);
    for (const round of mockArenaRounds) {
      expect(round.id).toBeTruthy();
      expect(round.marketSymbol).toBeTruthy();
      expect(round.durationLabel).toBeTruthy();
      expect(round.status).toMatch(/^(upcoming|locking|live|settling|settled)$/);
      expect(round.startsAt).toBeTruthy();
      expect(round.locksAt).toBeTruthy();
      expect(round.endsAt).toBeTruthy();
      expect(round.predictOracleId).toBeTruthy();
      expect(round.predictExpiry).toBeTruthy();
    }
    expect(mockArenaRounds[0].candles.length).toBeGreaterThanOrEqual(20);
    expect(mockArenaRounds[0].tradeMarkers.length).toBeGreaterThanOrEqual(10);
    expect(mockUserBackings.some((backing) => backing.status === "live")).toBe(true);
    expect(mockUserBackings.some((backing) => backing.status === "redeemed")).toBe(true);
  });

  it("keeps the user decision object Agent-first", () => {
    for (const agent of mockAgents) {
      expect(agent.name).toBeTruthy();
      expect(agent.strategyType).toBeTruthy();
      expect(agent.supportedPositionTypes.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/mock/arena.test.ts
```

Expected: FAIL because `mockAgents`, `mockArenaRounds`, and `mockUserBackings` do not exist yet.

- [ ] **Step 3: Replace `arena.ts` with the new domain model**

Replace `agent-arena/apps/frontend/src/types/arena.ts` with:

```ts
export type RoundStatus = "upcoming" | "locking" | "live" | "settling" | "settled";

export type AgentSortMode = "leaderboard" | "winRate" | "backingVolume" | "riskAdjusted" | "recentForm";

export type ReasoningDepth = "low" | "medium" | "high";

export type RiskLabel = "aggressive" | "balanced" | "defensive";

export type PredictPositionType = "directional" | "range";

export type AgentExposureStatus = "flat" | "long" | "short" | "range" | "closed";

export type TradeAction =
  | "enter_long"
  | "enter_short"
  | "mint_range"
  | "reduce"
  | "close"
  | "reverse"
  | "take_profit"
  | "stop_loss";

export type BackingStatus =
  | "draft"
  | "pending_signature"
  | "submitted"
  | "backed"
  | "locked"
  | "live"
  | "redeemable"
  | "redeemed"
  | "cancelled"
  | "failed";

export interface Candle {
  id: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  color: string;
  model: string;
  reasoningDepth: ReasoningDepth;
  strategyType: string;
  strategySummary: string;
  dataInputs: string[];
  winRate: number;
  historicalRoi: number;
  maxDrawdown: number;
  recentForm: Array<"W" | "L">;
  riskLabel: RiskLabel;
  supportedPositionTypes: PredictPositionType[];
  popularityRank: number;
  backingVolume: number;
}

export interface TradeMarker {
  id: string;
  roundId: string;
  agentId: string;
  timestamp: string;
  candleIndex: number;
  action: TradeAction;
  price: number;
  confidence: number;
  reason: string;
  predictPosition: PredictPositionDescriptor;
}

export interface DirectionalPredictPositionDescriptor {
  type: "directional";
  label: string;
  marketKey: string;
  rangeKey: null;
}

export interface RangePredictPositionDescriptor {
  type: "range";
  label: string;
  marketKey: null;
  rangeKey: string;
}

export type PredictPositionDescriptor =
  | DirectionalPredictPositionDescriptor
  | RangePredictPositionDescriptor;

export interface AgentRoundState {
  roundId: string;
  agentId: string;
  status: AgentExposureStatus;
  currentExposure: string;
  floatingPnl: number;
  lastAction: TradeAction | "none";
  lastReason: string;
  finalRoi: number | null;
}

export interface ArenaRound {
  id: string;
  marketSymbol: string;
  durationLabel: string;
  status: RoundStatus;
  startsAt: string;
  locksAt: string;
  endsAt: string;
  predictOracleId: string;
  predictExpiry: string;
  totalBackingVolume: number;
  agentIds: string[];
  candles: Candle[];
  tradeMarkers: TradeMarker[];
  agentStates: AgentRoundState[];
}

export interface BackingPositionBase {
  id: string;
  userAddress: string;
  managerId: string | null;
  roundId: string;
  agentId: string;
  amount: number;
  status: BackingStatus;
  createdAt: string;
  updatedAt: string;
  predictTxDigest: string | null;
  estimatedValue: number;
  finalValue: number | null;
  fee: number | null;
  redeemTxDigest: string | null;
}

export interface DirectionalBackingPosition extends BackingPositionBase {
  predictPositionType: "directional";
  marketKey: string;
  rangeKey: null;
}

export interface RangeBackingPosition extends BackingPositionBase {
  predictPositionType: "range";
  marketKey: null;
  rangeKey: string;
}

export type BackingPosition = DirectionalBackingPosition | RangeBackingPosition;

export interface BackingDraft {
  roundId: string;
  agentId: string;
  amount: number;
}

export interface ArenaState {
  rounds: ArenaRound[];
  agents: Agent[];
  userBackings: BackingPosition[];
  selectedRoundId: string;
  selectedAgentId: string;
  activeSort: AgentSortMode;
  backingDraft: BackingDraft | null;
}
```

- [ ] **Step 4: Run the test to verify it still fails for missing mock exports**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/mock/arena.test.ts
```

Expected: FAIL because the mock exports are still missing.

## Task 2: Rebuild Deterministic Mock Data

**Files:**
- Modify: `agent-arena/apps/frontend/src/mock/arena.ts`
- Test: `agent-arena/apps/frontend/src/mock/arena.test.ts`

- [ ] **Step 1: Create the mock exports**

Replace `agent-arena/apps/frontend/src/mock/arena.ts` with deterministic data matching the new type names:

```ts
import type { Agent, AgentSortMode, ArenaRound, BackingPosition } from "../types/arena";

export const mockAgents: Agent[] = [
  {
    id: "volatility-sniper",
    name: "Volatility Sniper",
    avatar: "V7",
    color: "#4da2ff",
    model: "GPT-5 Trading",
    reasoningDepth: "high",
    strategyType: "Volatility Breakout",
    strategySummary: "Buys convexity when oracle momentum and strike skew expand together.",
    dataInputs: ["Candles", "Predict oracle", "Strike grid", "Market state"],
    winRate: 64,
    historicalRoi: 18.4,
    maxDrawdown: 4.2,
    recentForm: ["W", "W", "L", "W"],
    riskLabel: "balanced",
    supportedPositionTypes: ["directional", "range"],
    popularityRank: 1,
    backingVolume: 4200
  },
  {
    id: "mean-reversion-monk",
    name: "Mean Reversion Monk",
    avatar: "MR",
    color: "#ffb95f",
    model: "Claude Market",
    reasoningDepth: "medium",
    strategyType: "Mean Reversion",
    strategySummary: "Fades stretched candles when live price diverges from local fair value.",
    dataInputs: ["Candles", "Predict oracle", "Historical volatility"],
    winRate: 59,
    historicalRoi: 13.1,
    maxDrawdown: 2.8,
    recentForm: ["W", "L", "W", "W"],
    riskLabel: "defensive",
    supportedPositionTypes: ["directional"],
    popularityRank: 2,
    backingVolume: 3500
  },
  {
    id: "momentum-burst",
    name: "Momentum Burst",
    avatar: "MB",
    color: "#5ee6a7",
    model: "Gemini Flash",
    reasoningDepth: "medium",
    strategyType: "Trend Follower",
    strategySummary: "Adds exposure when candle bodies and oracle updates confirm acceleration.",
    dataInputs: ["Candles", "Live oracle", "Trade tape"],
    winRate: 56,
    historicalRoi: 15.7,
    maxDrawdown: 7.1,
    recentForm: ["L", "W", "W", "L"],
    riskLabel: "aggressive",
    supportedPositionTypes: ["directional"],
    popularityRank: 3,
    backingVolume: 2800
  },
  {
    id: "liquidity-sense",
    name: "Liquidity Sense",
    avatar: "LS",
    color: "#a2c9ff",
    model: "Local Quant",
    reasoningDepth: "low",
    strategyType: "Liquidity Sensitive",
    strategySummary: "Avoids thin markets and prefers range exposure when pricing gets stretched.",
    dataInputs: ["Predict market state", "Strike grid", "Orderbook demo"],
    winRate: 61,
    historicalRoi: 9.5,
    maxDrawdown: 1.9,
    recentForm: ["W", "W", "W", "L"],
    riskLabel: "defensive",
    supportedPositionTypes: ["range"],
    popularityRank: 4,
    backingVolume: 2100
  },
  {
    id: "oracle-hunter",
    name: "Oracle Hunter",
    avatar: "OH",
    color: "#c4c6cd",
    model: "GPT-5 Mini",
    reasoningDepth: "high",
    strategyType: "Oracle Reactive",
    strategySummary: "Trades dislocations between oracle updates and Predict strike prices.",
    dataInputs: ["Predict oracle", "SVI surface", "Candles"],
    winRate: 53,
    historicalRoi: 11.2,
    maxDrawdown: 8.4,
    recentForm: ["L", "L", "W", "W"],
    riskLabel: "aggressive",
    supportedPositionTypes: ["directional", "range"],
    popularityRank: 5,
    backingVolume: 1800
  },
  {
    id: "risk-shield",
    name: "Risk Shield",
    avatar: "RS",
    color: "#ffb4ab",
    model: "Claude Defensive",
    reasoningDepth: "medium",
    strategyType: "Defensive Low Drawdown",
    strategySummary: "Stays flat until the expected value clears drawdown and spread costs.",
    dataInputs: ["Predict market state", "Risk config", "Candles"],
    winRate: 58,
    historicalRoi: 6.4,
    maxDrawdown: 1.2,
    recentForm: ["W", "L", "L", "W"],
    riskLabel: "defensive",
    supportedPositionTypes: ["range"],
    popularityRank: 6,
    backingVolume: 1200
  }
];

export const mockArenaRounds: ArenaRound[] = [
  {
    id: "btc-15m-live",
    marketSymbol: "BTC",
    durationLabel: "15m",
    status: "live",
    startsAt: "2026-06-09T14:50:00+08:00",
    locksAt: "2026-06-09T14:49:30+08:00",
    endsAt: "2026-06-09T15:05:00+08:00",
    predictOracleId: "0xbtc15moracle",
    predictExpiry: "2026-06-09T15:05:00+08:00",
    totalBackingVolume: 15600,
    agentIds: mockAgents.map((agent) => agent.id),
    candles: Array.from({ length: 20 }, (_, index) => {
      const open = 67200 + index * 42;
      const close = open + (index % 3 === 0 ? -75 : 95);
      return {
        id: `btc-candle-${index + 1}`,
        timestamp: `14:${String(35 + index).padStart(2, "0")}`,
        open,
        high: Math.max(open, close) + 120,
        low: Math.min(open, close) - 110,
        close
      };
    }),
    tradeMarkers: [
      {
        id: "tm-1",
        roundId: "btc-15m-live",
        agentId: "momentum-burst",
        timestamp: "14:39",
        candleIndex: 4,
        action: "enter_long",
        price: 67460,
        confidence: 69,
        reason: "Three-candle acceleration confirmed a breakout attempt.",
        predictPosition: {
          type: "directional",
          label: "UP 67600",
          marketKey: "BTC:1505:67600:UP",
          rangeKey: null
        }
      },
      {
        id: "tm-2",
        roundId: "btc-15m-live",
        agentId: "volatility-sniper",
        timestamp: "14:40",
        candleIndex: 5,
        action: "mint_range",
        price: 67520,
        confidence: 72,
        reason: "Volatility expanded while the strike grid stayed underpriced.",
        predictPosition: {
          type: "range",
          label: "Range 67400-68000",
          marketKey: null,
          rangeKey: "BTC:1505:67400:68000"
        }
      },
      {
        id: "tm-3",
        roundId: "btc-15m-live",
        agentId: "mean-reversion-monk",
        timestamp: "14:42",
        candleIndex: 7,
        action: "enter_short",
        price: 67690,
        confidence: 64,
        reason: "Price stretched above local fair value and momentum slowed.",
        predictPosition: {
          type: "directional",
          label: "DOWN 67600",
          marketKey: "BTC:1505:67600:DOWN",
          rangeKey: null
        }
      },
      {
        id: "tm-4",
        roundId: "btc-15m-live",
        agentId: "risk-shield",
        timestamp: "14:43",
        candleIndex: 8,
        action: "reduce",
        price: 67610,
        confidence: 81,
        reason: "Drawdown penalty risk exceeded expected upside.",
        predictPosition: {
          type: "range",
          label: "Range reduction",
          marketKey: null,
          rangeKey: "BTC:1505:range-reduce"
        }
      },
      {
        id: "tm-5",
        roundId: "btc-15m-live",
        agentId: "oracle-hunter",
        timestamp: "14:44",
        candleIndex: 9,
        action: "enter_long",
        price: 67720,
        confidence: 61,
        reason: "Oracle-implied fair value remained above market probability.",
        predictPosition: {
          type: "directional",
          label: "UP 67800",
          marketKey: "BTC:1505:67800:UP",
          rangeKey: null
        }
      },
      {
        id: "tm-6",
        roundId: "btc-15m-live",
        agentId: "liquidity-sense",
        timestamp: "14:45",
        candleIndex: 10,
        action: "close",
        price: 67680,
        confidence: 77,
        reason: "Spread widened enough to reduce edge.",
        predictPosition: {
          type: "range",
          label: "Close range",
          marketKey: null,
          rangeKey: "BTC:1505:close-range"
        }
      },
      {
        id: "tm-7",
        roundId: "btc-15m-live",
        agentId: "volatility-sniper",
        timestamp: "14:46",
        candleIndex: 11,
        action: "take_profit",
        price: 67820,
        confidence: 74,
        reason: "Partial risk reduction protects the round lead.",
        predictPosition: {
          type: "range",
          label: "Range take profit",
          marketKey: null,
          rangeKey: "BTC:1505:take-profit"
        }
      },
      {
        id: "tm-8",
        roundId: "btc-15m-live",
        agentId: "momentum-burst",
        timestamp: "14:47",
        candleIndex: 12,
        action: "reverse",
        price: 67740,
        confidence: 58,
        reason: "Momentum stalled after a failed high.",
        predictPosition: {
          type: "directional",
          label: "UP to DOWN",
          marketKey: "BTC:1505:reverse",
          rangeKey: null
        }
      },
      {
        id: "tm-9",
        roundId: "btc-15m-live",
        agentId: "mean-reversion-monk",
        timestamp: "14:48",
        candleIndex: 13,
        action: "take_profit",
        price: 67620,
        confidence: 66,
        reason: "Mean reversion target reached.",
        predictPosition: {
          type: "directional",
          label: "DOWN take profit",
          marketKey: "BTC:1505:take-profit-down",
          rangeKey: null
        }
      },
      {
        id: "tm-10",
        roundId: "btc-15m-live",
        agentId: "oracle-hunter",
        timestamp: "14:49",
        candleIndex: 14,
        action: "stop_loss",
        price: 67590,
        confidence: 55,
        reason: "Oracle edge collapsed before lock boundary.",
        predictPosition: {
          type: "directional",
          label: "UP stop",
          marketKey: "BTC:1505:stop-up",
          rangeKey: null
        }
      }
    ],
    agentStates: []
  },
  {
    id: "eth-30m-upcoming",
    marketSymbol: "ETH",
    durationLabel: "30m",
    status: "upcoming",
    startsAt: "2026-06-09T15:30:00+08:00",
    locksAt: "2026-06-09T15:29:30+08:00",
    endsAt: "2026-06-09T16:00:00+08:00",
    predictOracleId: "0xeth30moracle",
    predictExpiry: "2026-06-09T16:00:00+08:00",
    totalBackingVolume: 6200,
    agentIds: mockAgents.slice(0, 4).map((agent) => agent.id),
    candles: [],
    tradeMarkers: [],
    agentStates: []
  },
  {
    id: "sui-1h-settled",
    marketSymbol: "SUI",
    durationLabel: "1h",
    status: "settled",
    startsAt: "2026-06-09T12:00:00+08:00",
    locksAt: "2026-06-09T11:59:30+08:00",
    endsAt: "2026-06-09T13:00:00+08:00",
    predictOracleId: "0xsui1horacle",
    predictExpiry: "2026-06-09T13:00:00+08:00",
    totalBackingVolume: 9800,
    agentIds: mockAgents.map((agent) => agent.id),
    candles: [],
    tradeMarkers: [],
    agentStates: []
  }
];

export const mockUserBackings: BackingPosition[] = [
  {
    id: "backing-live-1",
    userAddress: "0xuser",
    managerId: "0xmanager",
    roundId: "btc-15m-live",
    agentId: "volatility-sniper",
    amount: 120,
    status: "live",
    createdAt: "2026-06-09T14:46:00+08:00",
    updatedAt: "2026-06-09T14:50:00+08:00",
    predictTxDigest: "0xpredictlive",
    predictPositionType: "range",
    marketKey: null,
    rangeKey: "BTC:1505:67400:68000",
    estimatedValue: 137.4,
    finalValue: null,
    fee: null,
    redeemTxDigest: null
  },
  {
    id: "backing-upcoming-1",
    userAddress: "0xuser",
    managerId: null,
    roundId: "eth-30m-upcoming",
    agentId: "mean-reversion-monk",
    amount: 80,
    status: "draft",
    createdAt: "2026-06-09T15:01:00+08:00",
    updatedAt: "2026-06-09T15:01:00+08:00",
    predictTxDigest: null,
    predictPositionType: "directional",
    marketKey: "ETH:1600:3600:DOWN",
    rangeKey: null,
    estimatedValue: 80,
    finalValue: null,
    fee: null,
    redeemTxDigest: null
  },
  {
    id: "backing-history-positive",
    userAddress: "0xuser",
    managerId: "0xmanager",
    roundId: "sui-1h-settled",
    agentId: "liquidity-sense",
    amount: 100,
    status: "redeemed",
    createdAt: "2026-06-09T11:55:00+08:00",
    updatedAt: "2026-06-09T13:04:00+08:00",
    predictTxDigest: "0xpredictwin",
    predictPositionType: "range",
    marketKey: null,
    rangeKey: "SUI:1300:3.10:3.25",
    estimatedValue: 100,
    finalValue: 128.5,
    fee: 2.5,
    redeemTxDigest: "0xredeemwin"
  },
  {
    id: "backing-history-negative",
    userAddress: "0xuser",
    managerId: "0xmanager",
    roundId: "sui-1h-settled",
    agentId: "oracle-hunter",
    amount: 100,
    status: "redeemed",
    createdAt: "2026-06-09T11:57:00+08:00",
    updatedAt: "2026-06-09T13:05:00+08:00",
    predictTxDigest: "0xpredictloss",
    predictPositionType: "directional",
    marketKey: "SUI:1300:3.20:UP",
    rangeKey: null,
    estimatedValue: 100,
    finalValue: 74.2,
    fee: 1.5,
    redeemTxDigest: "0xredeemloss"
  }
];

export function getAgentById(agents: Agent[], agentId: string): Agent {
  const agent = agents.find((candidate) => candidate.id === agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  return agent;
}

export function getRoundById(rounds: ArenaRound[], roundId: string): ArenaRound {
  const round = rounds.find((candidate) => candidate.id === roundId);
  if (!round) {
    throw new Error(`Round not found: ${roundId}`);
  }
  return round;
}

export function getSortedAgents(agentsToSort: Agent[], mode: AgentSortMode): Agent[] {
  return [...agentsToSort].sort((left, right) => {
    if (mode === "winRate") return right.winRate - left.winRate;
    if (mode === "backingVolume") return right.backingVolume - left.backingVolume;
    if (mode === "riskAdjusted") return left.maxDrawdown - right.maxDrawdown;
    if (mode === "recentForm") {
      const score = (agent: Agent) => agent.recentForm.filter((item) => item === "W").length;
      return score(right) - score(left);
    }
    return left.popularityRank - right.popularityRank;
  });
}
```

- [ ] **Step 2: Run mock tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/mock/arena.test.ts
```

Expected: PASS for the new mock tests.

## Task 3: Rebuild Pure Arena State

**Files:**
- Modify: `agent-arena/apps/frontend/src/state/arena.ts`
- Modify: `agent-arena/apps/frontend/src/state/arena.test.ts`

- [ ] **Step 1: Write state transition tests**

Replace `agent-arena/apps/frontend/src/state/arena.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { mockAgents, mockArenaRounds, mockUserBackings } from "../mock/arena";
import {
  cancelBacking,
  closeMintedBacking,
  createInitialArenaState,
  createOrUpdateDraft,
  getSelectedAgent,
  getSelectedRound,
  isRoundLocked,
  selectAgent,
  selectRound
} from "./arena";

describe("arena state", () => {
  it("selects rounds and keeps the first round Agent selected", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = selectRound(state, "eth-30m-upcoming");
    expect(getSelectedRound(next).id).toBe("eth-30m-upcoming");
    expect(getSelectedAgent(next).id).toBe("volatility-sniper");
  });

  it("selects an Agent only when it exists", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = selectAgent(state, "mean-reversion-monk");
    expect(getSelectedAgent(next).id).toBe("mean-reversion-monk");
  });

  it("creates and updates a backing draft before lock", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = createOrUpdateDraft(state, {
      roundId: "eth-30m-upcoming",
      agentId: "mean-reversion-monk",
      amount: 150
    });
    expect(next.backingDraft?.amount).toBe(150);
  });

  it("allows cancelling only draft-style backing", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = cancelBacking(state, "backing-upcoming-1");
    const backing = next.userBackings.find((item) => item.id === "backing-upcoming-1");
    expect(backing?.status).toBe("cancelled");
  });

  it("marks live Predict exposure as close/redeem rather than free cancel", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = closeMintedBacking(state, "backing-live-1");
    const backing = next.userBackings.find((item) => item.id === "backing-live-1");
    expect(backing?.status).toBe("redeemable");
  });

  it("recognizes locked rounds from status", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    expect(isRoundLocked(getSelectedRound(state))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the state tests to verify failure**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/state/arena.test.ts
```

Expected: FAIL because new state functions do not exist.

- [ ] **Step 3: Replace state helpers**

Replace `agent-arena/apps/frontend/src/state/arena.ts` with:

```ts
import { getAgentById, getRoundById } from "../mock/arena";
import type { ArenaRound, ArenaState, BackingDraft, BackingPosition, Agent } from "../types/arena";

export function createInitialArenaState(
  rounds: ArenaRound[],
  agents: Agent[],
  userBackings: BackingPosition[]
): ArenaState {
  const firstRound = rounds[0];
  const firstAgentId = firstRound?.agentIds[0] ?? agents[0]?.id;

  return {
    rounds,
    agents,
    userBackings,
    selectedRoundId: firstRound.id,
    selectedAgentId: firstAgentId,
    activeSort: "leaderboard",
    backingDraft: null
  };
}

export function getSelectedRound(state: ArenaState): ArenaRound {
  return getRoundById(state.rounds, state.selectedRoundId);
}

export function getSelectedAgent(state: ArenaState): Agent {
  return getAgentById(state.agents, state.selectedAgentId);
}

export function selectRound(state: ArenaState, roundId: string): ArenaState {
  const round = getRoundById(state.rounds, roundId);
  return {
    ...state,
    selectedRoundId: round.id,
    selectedAgentId: round.agentIds[0] ?? state.selectedAgentId,
    backingDraft: null
  };
}

export function selectAgent(state: ArenaState, agentId: string): ArenaState {
  getAgentById(state.agents, agentId);
  return {
    ...state,
    selectedAgentId: agentId
  };
}

export function isRoundLocked(round: ArenaRound): boolean {
  return round.status === "locking" || round.status === "live" || round.status === "settling" || round.status === "settled";
}

export function createOrUpdateDraft(state: ArenaState, draft: BackingDraft): ArenaState {
  const round = getRoundById(state.rounds, draft.roundId);
  getAgentById(state.agents, draft.agentId);

  if (isRoundLocked(round)) {
    return state;
  }

  return {
    ...state,
    backingDraft: draft
  };
}

export function cancelBacking(state: ArenaState, backingId: string): ArenaState {
  return {
    ...state,
    userBackings: state.userBackings.map((backing) => {
      if (backing.id !== backingId) return backing;
      const round = getRoundById(state.rounds, backing.roundId);
      if (isRoundLocked(round)) return backing;
      if (backing.predictTxDigest) return backing;
      return {
        ...backing,
        status: "cancelled",
        updatedAt: "2026-06-09T15:10:00+08:00"
      };
    })
  };
}

export function closeMintedBacking(state: ArenaState, backingId: string): ArenaState {
  return {
    ...state,
    userBackings: state.userBackings.map((backing) => {
      if (backing.id !== backingId) return backing;
      if (!backing.predictTxDigest) return backing;
      return {
        ...backing,
        status: "redeemable",
        updatedAt: "2026-06-09T15:10:00+08:00"
      };
    })
  };
}
```

- [ ] **Step 4: Run state tests**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/state/arena.test.ts
```

Expected: PASS for all state tests.

## Task 4: Run Foundation Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run domain and state tests together**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/mock/arena.test.ts src/state/arena.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
cd agent-arena/apps/frontend
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit this phase if committing is part of the execution session**

Run:

```bash
git add agent-arena/apps/frontend/src/types/arena.ts agent-arena/apps/frontend/src/mock/arena.ts agent-arena/apps/frontend/src/mock/arena.test.ts agent-arena/apps/frontend/src/state/arena.ts agent-arena/apps/frontend/src/state/arena.test.ts
git commit -m "refactor: align arena domain with Agent backing"
```

Expected: commit contains only domain, mock, and state files.
