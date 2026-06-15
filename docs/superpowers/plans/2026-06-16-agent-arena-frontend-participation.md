# Agent Arena Frontend Participation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the React frontend from a Back Agent betting surface to a Testnet-only Agent participation console with pairing-code onboarding, owner wallet claim, trading wallet funding, live intents/executions, leaderboard, replay, and skill docs.

**Architecture:** Keep the existing Vite/React app and reuse the strongest current visual assets: lobby density, live arena frame, K-line battlefield, Agent rail, and operation tape. Add a new `features/platform` domain for the desired Agent participation API contract and mock fixtures, then replace top-level screens incrementally with focused platform components. The plan is mock-first because the backend still needs a follow-up pairing-code/runtime-token API update; frontend tests must not require a live backend.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, lucide-react, existing CSS/Tailwind setup.

---

## File Structure

- Create `agent-arena/apps/frontend/src/features/platform/types.ts`: frontend domain and API types for pairing, wallet, competition, intents, executions, leaderboard, replay, and skill docs.
- Create `agent-arena/apps/frontend/src/features/platform/mock.ts`: deterministic fixtures used by tests and the mock-first UI.
- Create `agent-arena/apps/frontend/src/features/platform/client.ts`: typed API client for the target platform contract, with a mock transport for local demo.
- Create `agent-arena/apps/frontend/src/features/platform/client.test.ts`: client behavior and error mapping tests.
- Create `agent-arena/apps/frontend/src/state/platform.ts`: top-level view state, selected Agent/competition selectors, and reducer-like update helpers.
- Create `agent-arena/apps/frontend/src/state/platform.test.ts`: state transition tests.
- Create `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`: public competition entry surface.
- Create `agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.tsx`: registration-code claim and owner wallet claim UI.
- Create `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`: Testnet trading wallet and funding UI.
- Create `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`: live competition workspace around Agent status, K-line, and activity.
- Create `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx`: intent/risk/execution/wallet tabs.
- Create `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`: score table and formula explainer.
- Create `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx`: intent-to-execution-to-Predict proof timeline.
- Create `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx`: Agent skill links and integration instructions.
- Create matching `*.test.tsx` files in `agent-arena/apps/frontend/src/components/platform/`.
- Modify `agent-arena/apps/frontend/src/App.tsx`: route the primary app shell to the new platform surfaces.
- Modify `agent-arena/apps/frontend/src/App.test.tsx`: assert new navigation and no primary Back Agent CTA.
- Modify `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`: update demo acceptance path.
- Modify `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`: align nav items with Agent participation.
- Modify `agent-arena/apps/frontend/src/styles.css` only if existing utility classes cannot support the new compact screens.

## Product Contract

The frontend should target this product flow:

```text
Competition Lobby
-> Pair Agent
-> Connect owner wallet
-> Claim registration code
-> Optional Twitter display
-> Generate trading wallet
-> Fund Testnet wallet
-> Watch Agent submit intents
-> Inspect executions and Predict tx digests
-> Leaderboard
-> Replay
-> Skill Docs
```

The frontend must not show a primary user betting or Back Agent action. Existing Back Agent components can be deleted, demoted, or left unused, but the user-facing path must be Agent participation.

## API Contract Notes

Target contract from the new spec:

- Agent init: `POST /api/arena/agent/init`
- Owner claim: `POST /api/arena/owner/agents/claim`
- Runtime auth header: `x-agent-arena-agent-token`
- Runtime credential is issued only after owner wallet claim.

Current backend checkpoint still exposes an older mock auth/register API. Do not block frontend implementation on backend parity. The frontend client should implement the desired contract and provide deterministic mock responses. A later backend plan will update the backend routes.

---

### Task 1: Platform Types, Fixtures, And Client

**Files:**
- Create: `agent-arena/apps/frontend/src/features/platform/types.ts`
- Create: `agent-arena/apps/frontend/src/features/platform/mock.ts`
- Create: `agent-arena/apps/frontend/src/features/platform/client.ts`
- Test: `agent-arena/apps/frontend/src/features/platform/client.test.ts`

- [ ] **Step 1: Write the failing client tests**

Create `agent-arena/apps/frontend/src/features/platform/client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createPlatformClient, PlatformClientError } from "./client";
import { mockPlatformSnapshot } from "./mock";

describe("platform client", () => {
  it("initializes Agent pairing without returning a runtime credential", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      agentDraftId: "draft_1",
      registrationCode: "PAIR-2048",
      claimUrl: "http://localhost:5173/claim/PAIR-2048",
      expiresAt: "2026-06-16T10:15:00.000Z"
    }), { status: 201 }));

    const client = createPlatformClient({ baseUrl: "http://127.0.0.1:8787/api/arena", fetcher });
    const result = await client.initAgentPairing({ displayName: "Trend Ranger" });

    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/agent/init", expect.objectContaining({
      method: "POST"
    }));
    expect(result.registrationCode).toBe("PAIR-2048");
    expect("runtimeCredential" in result).toBe(false);
  });

  it("claims a pairing code and receives a scoped runtime credential", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: mockPlatformSnapshot.agents[0],
      tradingWallet: mockPlatformSnapshot.tradingWallet,
      runtimeCredential: {
        token: "agent_runtime_test_token",
        shownOnce: true,
        scopes: ["competition:read", "intent:submit", "execution:read"]
      }
    }), { status: 201 }));

    const client = createPlatformClient({ baseUrl: "http://127.0.0.1:8787/api/arena", fetcher });
    const result = await client.claimAgent({
      registrationCode: "PAIR-2048",
      ownerAddress: "0xowner",
      signature: "0xsig",
      twitterHandle: "@Sui_Agent"
    });

    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim", expect.objectContaining({
      method: "POST"
    }));
    expect(result.agent.twitterHandle).toBe("Sui_Agent");
    expect(result.agent.twitterVerified).toBe(false);
    expect(result.runtimeCredential.token).toBe("agent_runtime_test_token");
  });

  it("uses the runtime credential header for Agent reads and intents", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(mockPlatformSnapshot), { status: 200 }));
    const client = createPlatformClient({ baseUrl: "http://127.0.0.1:8787/api/arena", fetcher });

    await client.getAgentMe("agent_runtime_test_token");
    await client.submitIntent("agent_runtime_test_token", mockPlatformSnapshot.latestIntent);

    expect(fetcher).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8787/api/arena/agent/me", expect.objectContaining({
      headers: expect.objectContaining({ "x-agent-arena-agent-token": "agent_runtime_test_token" })
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8787/api/arena/intents", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-agent-arena-agent-token": "agent_runtime_test_token" })
    }));
  });

  it("maps common API errors into PlatformClientError", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: "ROUND_NOT_LIVE",
        message: "The selected competition is not accepting new exposure."
      }
    }), { status: 400 }));

    const client = createPlatformClient({ baseUrl: "http://127.0.0.1:8787/api/arena", fetcher });

    await expect(client.getCompetition("btc-15m-001")).rejects.toMatchObject({
      code: "ROUND_NOT_LIVE",
      message: "The selected competition is not accepting new exposure."
    });
    await expect(client.getCompetition("btc-15m-001")).rejects.toBeInstanceOf(PlatformClientError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd agent-arena/apps/frontend
bun run test src/features/platform/client.test.ts
```

Expected:

- Fails because `features/platform/*` files do not exist.

- [ ] **Step 3: Implement `types.ts`**

Create `agent-arena/apps/frontend/src/features/platform/types.ts` with these exports:

```ts
export type AgentAction =
  | "hold"
  | "open_directional"
  | "open_range"
  | "add"
  | "reduce"
  | "close"
  | "switch_direction"
  | "adjust_range";

export type CompetitionStatus = "pre_open" | "live" | "expired" | "settled";
export type IntentStatus = "accepted" | "rejected" | "executed" | "partial";
export type ExecutionStatus = "queued" | "signed" | "submitted" | "confirmed" | "failed" | "partial";
export type AgentRuntimeStatus = "waiting" | "active" | "cooldown" | "rejected" | "offline";
export type ExposureStatus = "flat" | "directional" | "range" | "closing" | "settled";

export interface AgentProfile {
  id: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
  ownerAddress: string;
  tradingWalletAddress: string;
  runtimeStatus: AgentRuntimeStatus;
}

export interface PairingDraft {
  agentDraftId: string;
  registrationCode: string;
  claimUrl: string;
  expiresAt: string;
}

export interface RuntimeCredential {
  token: string;
  shownOnce: boolean;
  scopes: string[];
}

export interface TradingWallet {
  id: string;
  agentId: string;
  address: string;
  testnetSuiBalance: string;
  quoteBalance: string;
  predictManagerStatus: "missing" | "ready";
  status: "active" | "detached";
}

export interface Competition {
  id: string;
  name: string;
  marketSymbol: "BTC-USD";
  durationSeconds: 900;
  status: CompetitionStatus;
  oracleId: string;
  predictObjectId: string;
  startsAt: string;
  expiresAt: string;
  settlesAt: string | null;
  allowedActions: AgentAction[];
  registeredAgentCount: number;
  activeAgentCount: number;
  latestExecutionCount: number;
}

export interface AgentIntent {
  id: string;
  competitionId: string;
  agentId: string;
  idempotencyKey: string;
  action: AgentAction;
  status: IntentStatus;
  confidence: number;
  reason: string;
  createdAt: string;
  rejectionCode: string | null;
}

export interface RiskDecision {
  id: string;
  intentId: string;
  accepted: boolean;
  rejectionCode: string | null;
  policyMessage: string;
  createdAt: string;
}

export interface ExecutionRecord {
  id: string;
  intentId: string;
  agentId: string;
  competitionId: string;
  action: AgentAction;
  status: ExecutionStatus;
  predictTxDigest: string | null;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
  score: number;
  netPnlPct: number;
  maxDrawdownPct: number;
  capitalEfficiencyPct: number;
  hitRatePct: number;
  executionCount: number;
  invalidIntentCount: number;
  finalExecutionAt: string;
}

export interface ReplayEvent {
  id: string;
  timestamp: string;
  label: string;
  summary: string;
  recordId: string;
  copyValue: string;
  txDigest: string | null;
}

export interface PlatformSnapshot {
  agents: AgentProfile[];
  tradingWallet: TradingWallet;
  competitions: Competition[];
  latestIntent: AgentIntent;
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
  replay: ReplayEvent[];
}

export interface PlatformErrorBody {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}
```

- [ ] **Step 4: Implement `mock.ts`**

Create `agent-arena/apps/frontend/src/features/platform/mock.ts`:

```ts
import type { PlatformSnapshot } from "./types";

export const mockPlatformSnapshot: PlatformSnapshot = {
  agents: [
    {
      id: "agent_1",
      displayName: "Trend Ranger",
      twitterHandle: "Sui_Agent",
      twitterVerified: false,
      ownerAddress: "0xowner",
      tradingWalletAddress: "0xagentwallet_agent_1",
      runtimeStatus: "active"
    },
    {
      id: "agent_2",
      displayName: "Range Cartographer",
      twitterHandle: null,
      twitterVerified: false,
      ownerAddress: "0xowner2",
      tradingWalletAddress: "0xagentwallet_agent_2",
      runtimeStatus: "cooldown"
    }
  ],
  tradingWallet: {
    id: "wallet_1",
    agentId: "agent_1",
    address: "0xagentwallet_agent_1",
    testnetSuiBalance: "4.20",
    quoteBalance: "125.00",
    predictManagerStatus: "ready",
    status: "active"
  },
  competitions: [
    {
      id: "btc-15m-001",
      name: "BTC 15m Testnet Arena",
      marketSymbol: "BTC-USD",
      durationSeconds: 900,
      status: "live",
      oracleId: "0xbtc15m",
      predictObjectId: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
      startsAt: "2026-06-16T10:00:00.000Z",
      expiresAt: "2026-06-16T10:15:00.000Z",
      settlesAt: null,
      allowedActions: ["hold", "open_directional", "open_range", "reduce", "close"],
      registeredAgentCount: 12,
      activeAgentCount: 8,
      latestExecutionCount: 24
    }
  ],
  latestIntent: {
    id: "intent_1",
    competitionId: "btc-15m-001",
    agentId: "agent_1",
    idempotencyKey: "trend-ranger-btc-15m-001-1",
    action: "open_directional",
    status: "executed",
    confidence: 0.72,
    reason: "Momentum remains above VWAP with rising oracle forward.",
    createdAt: "2026-06-16T10:03:12.000Z",
    rejectionCode: null
  },
  intents: [
    {
      id: "intent_1",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      idempotencyKey: "trend-ranger-btc-15m-001-1",
      action: "open_directional",
      status: "executed",
      confidence: 0.72,
      reason: "Momentum remains above VWAP with rising oracle forward.",
      createdAt: "2026-06-16T10:03:12.000Z",
      rejectionCode: null
    },
    {
      id: "intent_2",
      competitionId: "btc-15m-001",
      agentId: "agent_2",
      idempotencyKey: "range-cartographer-btc-15m-001-1",
      action: "open_range",
      status: "rejected",
      confidence: 0.61,
      reason: "Range looked attractive but exceeded risk limit.",
      createdAt: "2026-06-16T10:04:12.000Z",
      rejectionCode: "RISK_LIMIT_EXCEEDED"
    }
  ],
  riskDecisions: [
    {
      id: "risk_1",
      intentId: "intent_1",
      accepted: true,
      rejectionCode: null,
      policyMessage: "Accepted within Testnet risk limits.",
      createdAt: "2026-06-16T10:03:13.000Z"
    },
    {
      id: "risk_2",
      intentId: "intent_2",
      accepted: false,
      rejectionCode: "RISK_LIMIT_EXCEEDED",
      policyMessage: "Intent exceeded per-trade quote limit.",
      createdAt: "2026-06-16T10:04:13.000Z"
    }
  ],
  executions: [
    {
      id: "exec_1",
      intentId: "intent_1",
      agentId: "agent_1",
      competitionId: "btc-15m-001",
      action: "open_directional",
      status: "confirmed",
      predictTxDigest: "0xmock_exec_1",
      createdAt: "2026-06-16T10:03:14.000Z"
    }
  ],
  leaderboard: [
    {
      rank: 1,
      agentId: "agent_1",
      displayName: "Trend Ranger",
      twitterHandle: "Sui_Agent",
      twitterVerified: false,
      score: 28.49,
      netPnlPct: 0.1842,
      maxDrawdownPct: 0.031,
      capitalEfficiencyPct: 0.8,
      hitRatePct: 0.6,
      executionCount: 6,
      invalidIntentCount: 0,
      finalExecutionAt: "2026-06-16T10:12:00.000Z"
    }
  ],
  replay: [
    {
      id: "replay_intent_1",
      timestamp: "2026-06-16T10:03:12.000Z",
      label: "Intent submitted",
      summary: "Trend Ranger submitted open_directional with 0.72 confidence.",
      recordId: "intent_1",
      copyValue: "intent_1",
      txDigest: null
    },
    {
      id: "replay_risk_1",
      timestamp: "2026-06-16T10:03:13.000Z",
      label: "Risk accepted",
      summary: "Risk decision accepted the intent within Testnet policy.",
      recordId: "risk_1",
      copyValue: "risk_1",
      txDigest: null
    },
    {
      id: "replay_exec_1",
      timestamp: "2026-06-16T10:03:14.000Z",
      label: "Predict transaction confirmed",
      summary: "Execution confirmed on DeepBook Predict mock path.",
      recordId: "exec_1",
      copyValue: "0xmock_exec_1",
      txDigest: "0xmock_exec_1"
    }
  ]
};
```

- [ ] **Step 5: Implement `client.ts`**

Create `agent-arena/apps/frontend/src/features/platform/client.ts`:

```ts
import type {
  AgentIntent,
  PairingDraft,
  PlatformErrorBody,
  PlatformSnapshot,
  RuntimeCredential,
  TradingWallet
} from "./types";

export class PlatformClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "PlatformClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface CreatePlatformClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export interface InitAgentPairingInput {
  displayName: string;
}

export interface ClaimAgentInput {
  registrationCode: string;
  ownerAddress: string;
  signature: string;
  twitterHandle?: string | null;
}

export interface ClaimAgentResponse {
  agent: PlatformSnapshot["agents"][number];
  tradingWallet: TradingWallet;
  runtimeCredential: RuntimeCredential;
}

export function createPlatformClient({ baseUrl, fetcher = fetch }: CreatePlatformClientOptions) {
  const root = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {})
      }
    });

    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const errorBody = body as PlatformErrorBody;
      throw new PlatformClientError(
        errorBody.error?.code ?? "REQUEST_FAILED",
        errorBody.error?.message ?? "Platform request failed",
        errorBody.error?.retryable ?? false
      );
    }

    return body as T;
  }

  function authHeaders(runtimeCredential: string) {
    return { "x-agent-arena-agent-token": runtimeCredential };
  }

  return {
    initAgentPairing(input: InitAgentPairingInput) {
      return request<PairingDraft>("/agent/init", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    claimAgent(input: ClaimAgentInput) {
      return request<ClaimAgentResponse>("/owner/agents/claim", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    getAgentMe(runtimeCredential: string) {
      return request<PlatformSnapshot>("/agent/me", {
        headers: authHeaders(runtimeCredential)
      });
    },
    getAgentWallet(runtimeCredential: string) {
      return request<{ tradingWallet: TradingWallet }>("/agent/wallet", {
        headers: authHeaders(runtimeCredential)
      });
    },
    listCompetitions() {
      return request<{ competitions: PlatformSnapshot["competitions"] }>("/competition/list-active");
    },
    getCompetition(competitionId: string) {
      return request<{ competition: PlatformSnapshot["competitions"][number] }>(`/competition/${competitionId}`);
    },
    submitIntent(runtimeCredential: string, intent: AgentIntent) {
      return request<{ status: string; intentId: string }>("/intents", {
        method: "POST",
        headers: authHeaders(runtimeCredential),
        body: JSON.stringify(intent)
      });
    },
    getLeaderboard(competitionId: string) {
      return request<{ entries: PlatformSnapshot["leaderboard"] }>(`/leaderboard?competitionId=${encodeURIComponent(competitionId)}`);
    }
  };
}
```

- [ ] **Step 6: Run client tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/features/platform/client.test.ts
```

Expected:

- Client tests pass.

- [ ] **Step 7: Commit**

```powershell
git add agent-arena/apps/frontend/src/features/platform/types.ts agent-arena/apps/frontend/src/features/platform/mock.ts agent-arena/apps/frontend/src/features/platform/client.ts agent-arena/apps/frontend/src/features/platform/client.test.ts
git commit -m "feat: add frontend agent platform client"
```

### Task 2: Platform State And Navigation Model

**Files:**
- Create: `agent-arena/apps/frontend/src/state/platform.ts`
- Test: `agent-arena/apps/frontend/src/state/platform.test.ts`
- Modify: `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`

- [ ] **Step 1: Write failing state tests**

Create `agent-arena/apps/frontend/src/state/platform.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../features/platform/mock";
import {
  createInitialPlatformState,
  getSelectedAgent,
  getSelectedCompetition,
  selectAgent,
  selectPlatformView
} from "./platform";

describe("platform state", () => {
  it("starts on the live competition view with the first competition and Agent selected", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);

    expect(state.activeView).toBe("competition");
    expect(getSelectedCompetition(state).id).toBe("btc-15m-001");
    expect(getSelectedAgent(state).id).toBe("agent_1");
  });

  it("switches platform views without clearing selected Agent", () => {
    const state = createInitialPlatformState(mockPlatformSnapshot);
    const next = selectPlatformView(selectAgent(state, "agent_2"), "leaderboard");

    expect(next.activeView).toBe("leaderboard");
    expect(next.selectedAgentId).toBe("agent_2");
  });
});
```

- [ ] **Step 2: Run state tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/state/platform.test.ts
```

Expected:

- Fails because `state/platform.ts` does not exist.

- [ ] **Step 3: Implement platform state**

Create `agent-arena/apps/frontend/src/state/platform.ts`:

```ts
import type { AgentProfile, Competition, PlatformSnapshot } from "../features/platform/types";

export type PlatformView = "lobby" | "setup" | "wallet" | "competition" | "leaderboard" | "replay" | "skills";

export interface PlatformState extends PlatformSnapshot {
  activeView: PlatformView;
  selectedAgentId: string;
  selectedCompetitionId: string;
}

export function createInitialPlatformState(snapshot: PlatformSnapshot): PlatformState {
  const firstAgent = snapshot.agents[0];
  const firstCompetition = snapshot.competitions[0];
  if (!firstAgent || !firstCompetition) {
    throw new Error("Platform state requires at least one Agent and competition");
  }

  return {
    ...snapshot,
    activeView: "competition",
    selectedAgentId: firstAgent.id,
    selectedCompetitionId: firstCompetition.id
  };
}

export function selectPlatformView(state: PlatformState, activeView: PlatformView): PlatformState {
  return state.activeView === activeView ? state : { ...state, activeView };
}

export function selectAgent(state: PlatformState, selectedAgentId: string): PlatformState {
  getAgentById(state, selectedAgentId);
  return state.selectedAgentId === selectedAgentId ? state : { ...state, selectedAgentId };
}

export function getSelectedAgent(state: PlatformState): AgentProfile {
  return getAgentById(state, state.selectedAgentId);
}

export function getSelectedCompetition(state: PlatformState): Competition {
  const competition = state.competitions.find((item) => item.id === state.selectedCompetitionId);
  if (!competition) {
    throw new Error(`Competition not found: ${state.selectedCompetitionId}`);
  }
  return competition;
}

function getAgentById(state: PlatformState, agentId: string): AgentProfile {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  return agent;
}
```

- [ ] **Step 4: Update navigation tests or add assertions in `App.test.tsx` later**

No implementation change is needed to `AppNav` in this task unless its props make the new view names impossible. If needed, change `AppNav` to accept:

```ts
type AppView = "lobby" | "setup" | "wallet" | "competition" | "leaderboard" | "replay" | "skills";
```

Navigation labels:

- `Lobby`
- `Pair Agent`
- `Wallet`
- `Competition`
- `Leaderboard`
- `Replay`
- `Skills`

- [ ] **Step 5: Run state tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/state/platform.test.ts
```

Expected:

- State tests pass.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/frontend/src/state/platform.ts agent-arena/apps/frontend/src/state/platform.test.ts agent-arena/apps/frontend/src/components/navigation/AppNav.tsx
git commit -m "feat: add frontend platform state"
```

### Task 3: Agent Pairing And Trading Wallet Panels

**Files:**
- Create: `agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { AgentPairingPanel } from "./AgentPairingPanel";

describe("AgentPairingPanel", () => {
  it("shows pairing code claim and runtime credential boundaries", () => {
    render(
      <AgentPairingPanel
        agent={mockPlatformSnapshot.agents[0]}
        claimUrl="http://localhost:5173/claim/PAIR-2048"
        expiresAt="2026-06-16T10:15:00.000Z"
        registrationCode="PAIR-2048"
        runtimeCredential="agent_runtime_test_token"
      />
    );

    expect(screen.getByText(/PAIR-2048/)).toBeInTheDocument();
    expect(screen.getByText(/Connect owner wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Runtime Credential/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot withdraw funds/i)).toBeInTheDocument();
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
  });
});
```

Create `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { TradingWalletPanel } from "./TradingWalletPanel";

describe("TradingWalletPanel", () => {
  it("shows Testnet deposit address without private key language", () => {
    render(
      <TradingWalletPanel
        agent={mockPlatformSnapshot.agents[0]}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
      />
    );

    expect(screen.getByText(/Testnet trading wallet/i)).toBeInTheDocument();
    expect(screen.getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    expect(screen.getByText(/Copy deposit address/i)).toBeInTheDocument();
    expect(screen.getByText(/Never exposes private keys/i)).toBeInTheDocument();
    expect(screen.getByText(/platform signs only approved DeepBook Predict operations/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/AgentPairingPanel.test.tsx src/components/platform/TradingWalletPanel.test.tsx
```

Expected:

- Fails because components do not exist.

- [ ] **Step 3: Implement `AgentPairingPanel.tsx`**

Create `agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.tsx`:

```tsx
import { Copy, ShieldCheck, Wallet } from "lucide-react";
import type { AgentProfile } from "../../features/platform/types";

interface AgentPairingPanelProps {
  agent: AgentProfile;
  registrationCode: string;
  claimUrl: string;
  expiresAt: string;
  runtimeCredential: string;
}

export function AgentPairingPanel({
  agent,
  registrationCode,
  claimUrl,
  expiresAt,
  runtimeCredential
}: AgentPairingPanelProps) {
  return (
    <section aria-label="Agent pairing" className="paper-card-sm grid gap-4 p-4">
      <div>
        <p className="paper-label text-outline">Agent setup</p>
        <h2 className="font-display text-2xl font-black uppercase text-on-surface">Pair Agent</h2>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">
          Claim the short-lived registration code with an owner wallet before the Agent receives a runtime credential.
        </p>
      </div>

      <div className="paper-inset grid gap-2 p-3">
        <span className="paper-label text-outline">Registration code</span>
        <strong className="font-mono text-xl text-on-surface">{registrationCode}</strong>
        <span className="text-xs font-bold text-on-surface-variant">Expires at {expiresAt}</span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <InfoBlock icon={<Wallet size={16} />} title="Connect owner wallet" body="The wallet claim proves who owns this Agent profile." />
        <InfoBlock icon={<ShieldCheck size={16} />} title="Runtime credential after claim" body="The credential can submit intents but cannot withdraw funds, unbind wallets, or edit owner profile data." />
      </div>

      <div className="paper-inset p-3">
        <div className="paper-label text-outline">Agent</div>
        <div className="mt-1 font-display text-lg font-black uppercase">{agent.displayName}</div>
        {agent.twitterHandle ? (
          <div className="mt-1 text-sm font-bold text-on-surface-variant">@{agent.twitterHandle} <span className="paper-chip px-2 py-1">Unverified</span></div>
        ) : (
          <div className="mt-1 text-sm font-bold text-on-surface-variant">No Twitter handle</div>
        )}
      </div>

      <div className="paper-inset p-3">
        <div className="paper-label text-outline">Claim URL</div>
        <div className="mt-1 break-all font-mono text-xs font-bold">{claimUrl}</div>
      </div>

      <div className="paper-inset p-3">
        <div className="paper-label text-outline">Agent Runtime Credential</div>
        <div className="mt-1 truncate font-mono text-xs font-bold">{runtimeCredential}</div>
        <button className="paper-button mt-3 inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase" type="button">
          <Copy size={14} />
          Copy fallback
        </button>
      </div>
    </section>
  );
}

function InfoBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="border-2 border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex items-center gap-2 font-display text-sm font-black uppercase text-on-surface">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">{body}</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `TradingWalletPanel.tsx`**

Create `agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx`:

```tsx
import { Copy, RefreshCw } from "lucide-react";
import type { AgentProfile, TradingWallet } from "../../features/platform/types";

interface TradingWalletPanelProps {
  agent: AgentProfile;
  tradingWallet: TradingWallet;
}

export function TradingWalletPanel({ agent, tradingWallet }: TradingWalletPanelProps) {
  return (
    <section aria-label="Testnet trading wallet" className="paper-card-sm grid gap-4 p-4">
      <div>
        <p className="paper-label text-outline">Testnet trading wallet</p>
        <h2 className="font-display text-2xl font-black uppercase text-on-surface">{agent.displayName}</h2>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">
          Fund this platform-managed Testnet address. The frontend never displays private keys.
        </p>
      </div>

      <div className="paper-inset p-3">
        <div className="paper-label text-outline">Deposit address</div>
        <div className="mt-1 break-all font-mono text-sm font-bold">{tradingWallet.address}</div>
        <button className="paper-button mt-3 inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase" type="button">
          <Copy size={14} />
          Copy deposit address
        </button>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        <Metric label="Testnet SUI" value={tradingWallet.testnetSuiBalance} />
        <Metric label="Testnet DUSDC" value={tradingWallet.quoteBalance} />
        <Metric label="PredictManager" value={tradingWallet.predictManagerStatus} />
      </dl>

      <div className="bg-[#111318] p-3 text-sm font-bold leading-6 text-white shadow-[4px_4px_0_#000]">
        Never exposes private keys. The platform signs only approved DeepBook Predict operations after intent and risk checks.
      </div>

      <button className="paper-button inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase" type="button">
        <RefreshCw size={14} />
        Refresh balances
      </button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-inset p-2">
      <dt className="paper-label text-outline">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-bold text-on-surface">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 5: Run component tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/AgentPairingPanel.test.tsx src/components/platform/TradingWalletPanel.test.tsx
```

Expected:

- Component tests pass.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.tsx agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.tsx agent-arena/apps/frontend/src/components/platform/AgentPairingPanel.test.tsx agent-arena/apps/frontend/src/components/platform/TradingWalletPanel.test.tsx
git commit -m "feat: add agent pairing and wallet panels"
```

### Task 4: Competition Lobby And Live Competition

**Files:**
- Create: `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/LiveCompetition.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { CompetitionLobby } from "./CompetitionLobby";

describe("CompetitionLobby", () => {
  it("presents Agent competition actions instead of Back Agent betting", () => {
    render(
      <CompetitionLobby
        competitions={mockPlatformSnapshot.competitions}
        leaderboard={mockPlatformSnapshot.leaderboard}
        onEnterCompetition={vi.fn()}
        onOpenPairing={vi.fn()}
        onOpenSkills={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC-USD/i)).toBeInTheDocument();
    expect(screen.getByText(/Pair Agent/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});
```

Create `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { AgentActivityPanel } from "./AgentActivityPanel";

describe("AgentActivityPanel", () => {
  it("shows intents, risk decisions, executions, and wallet state as separate platform records", () => {
    render(
      <AgentActivityPanel
        executions={mockPlatformSnapshot.executions}
        intents={mockPlatformSnapshot.intents}
        riskDecisions={mockPlatformSnapshot.riskDecisions}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
      />
    );

    expect(screen.getByText(/Intents/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Executions/i)).toBeInTheDocument();
    expect(screen.getByText(/Wallet/i)).toBeInTheDocument();
    expect(screen.getByText("RISK_LIMIT_EXCEEDED")).toBeInTheDocument();
    expect(screen.getByText("0xmock_exec_1")).toBeInTheDocument();
  });
});
```

Create `agent-arena/apps/frontend/src/components/platform/LiveCompetition.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LiveCompetition } from "./LiveCompetition";

describe("LiveCompetition", () => {
  it("shows Agent runtime, allowed actions, and Predict execution context", () => {
    render(
      <LiveCompetition
        agents={mockPlatformSnapshot.agents}
        competition={mockPlatformSnapshot.competitions[0]}
        executions={mockPlatformSnapshot.executions}
        intents={mockPlatformSnapshot.intents}
        riskDecisions={mockPlatformSnapshot.riskDecisions}
        selectedAgent={mockPlatformSnapshot.agents[0]}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
        onSelectAgent={vi.fn()}
        onViewReplay={vi.fn()}
      />
    );

    expect(screen.getByText(/Live Competition/i)).toBeInTheDocument();
    expect(screen.getByText(/0xbtc15m/i)).toBeInTheDocument();
    expect(screen.getByText(/open_directional/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime status/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict tx/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/CompetitionLobby.test.tsx src/components/platform/AgentActivityPanel.test.tsx src/components/platform/LiveCompetition.test.tsx
```

Expected:

- Fails because components do not exist.

- [ ] **Step 3: Implement components**

Create `agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx`:

```tsx
import type { Competition, LeaderboardEntry } from "../../features/platform/types";

interface CompetitionLobbyProps {
  competitions: Competition[];
  leaderboard: LeaderboardEntry[];
  onEnterCompetition: () => void;
  onOpenPairing: () => void;
  onOpenSkills: () => void;
}

export function CompetitionLobby({
  competitions,
  leaderboard,
  onEnterCompetition,
  onOpenPairing,
  onOpenSkills
}: CompetitionLobbyProps) {
  const competition = competitions[0];
  const leader = leaderboard[0];

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="paper-card-sm p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="paper-chip">Testnet</span>
          <span className="paper-chip">DeepBook Predict</span>
          <span className="paper-chip">{competition.marketSymbol}</span>
        </div>

        <p className="text-sm uppercase tracking-wide text-muted-foreground">Agent Arena</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight">
          AI Agents compete in DeepBook Predict Testnet arenas
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Pair an external Agent, fund its platform trading wallet on Sui Testnet, then inspect every intent,
          risk decision, execution, and Predict tx digest during the 15 minute BTC arena.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button className="paper-button-primary" type="button" onClick={onEnterCompetition}>
            Enter Live Competition
          </button>
          <button className="paper-button" type="button" onClick={onOpenPairing}>
            Pair Agent
          </button>
          <button className="paper-button" type="button" onClick={onOpenSkills}>
            Open Skill Docs
          </button>
        </div>
      </div>

      <aside className="grid gap-4">
        <div className="paper-card-sm p-4">
          <h2 className="text-lg font-semibold">{competition.name}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Registered Agents</dt>
              <dd className="font-semibold">{competition.registeredAgentCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active Agents</dt>
              <dd className="font-semibold">{competition.activeAgentCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Oracle</dt>
              <dd className="font-mono text-xs">{competition.oracleId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-semibold capitalize">{competition.status}</dd>
            </div>
          </dl>
        </div>

        <div className="paper-card-sm p-4">
          <h2 className="text-lg font-semibold">Current leader</h2>
          <p className="mt-2 text-2xl font-semibold">{leader.displayName}</p>
          <p className="text-sm text-muted-foreground">
            {leader.twitterHandle ? `@${leader.twitterHandle}` : "No Twitter"} · Score {leader.score}
          </p>
        </div>
      </aside>
    </section>
  );
}
```

Create `agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx`:

```tsx
import type { AgentIntent, ExecutionRecord, RiskDecision, TradingWallet } from "../../features/platform/types";

interface AgentActivityPanelProps {
  executions: ExecutionRecord[];
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  tradingWallet: TradingWallet;
}

export function AgentActivityPanel({
  executions,
  intents,
  riskDecisions,
  tradingWallet
}: AgentActivityPanelProps) {
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="paper-card-sm p-4">
        <h3 className="text-base font-semibold">Intents</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {intents.map((intent) => (
            <li className="paper-inset p-3" key={intent.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{intent.id}</span>
                <span className="paper-chip">{intent.action}</span>
              </div>
              <p className="mt-2 text-muted-foreground">{intent.reason}</p>
              {intent.rejectionCode ? <p className="mt-1 font-mono text-xs">{intent.rejectionCode}</p> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="paper-card-sm p-4">
        <h3 className="text-base font-semibold">Risk</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {riskDecisions.map((decision) => (
            <li className="paper-inset p-3" key={decision.id}>
              <span className="paper-chip">{decision.accepted ? "Accepted" : "Rejected"}</span>
              <p className="mt-2 text-muted-foreground">{decision.policyMessage}</p>
              {decision.rejectionCode ? <p className="mt-1 font-mono text-xs">{decision.rejectionCode}</p> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="paper-card-sm p-4">
        <h3 className="text-base font-semibold">Executions</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {executions.map((execution) => (
            <li className="paper-inset p-3" key={execution.id}>
              <div className="flex items-center justify-between gap-3">
                <span>{execution.status}</span>
                <span className="paper-chip">{execution.action}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Predict tx</p>
              <p className="break-all font-mono text-xs">{execution.predictTxDigest ?? "pending"}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="paper-card-sm p-4">
        <h3 className="text-base font-semibold">Wallet</h3>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="break-all font-mono text-xs">{tradingWallet.address}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Testnet SUI</dt>
            <dd>{tradingWallet.testnetSuiBalance}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Predict manager</dt>
            <dd>{tradingWallet.predictManagerStatus}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
```

Create `agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx`:

```tsx
import type {
  AgentProfile,
  Competition,
  AgentIntent,
  ExecutionRecord,
  RiskDecision,
  TradingWallet
} from "../../features/platform/types";
import { AgentActivityPanel } from "./AgentActivityPanel";

interface LiveCompetitionProps {
  agents: AgentProfile[];
  competition: Competition;
  executions: ExecutionRecord[];
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  selectedAgent: AgentProfile;
  tradingWallet: TradingWallet;
  onSelectAgent: (agentId: string) => void;
  onViewReplay: () => void;
}

export function LiveCompetition({
  agents,
  competition,
  executions,
  intents,
  riskDecisions,
  selectedAgent,
  tradingWallet,
  onSelectAgent,
  onViewReplay
}: LiveCompetitionProps) {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Live Competition</p>
            <h1 className="mt-1 text-3xl font-semibold">{competition.name}</h1>
          </div>
          <button className="paper-button" type="button" onClick={onViewReplay}>
            View Replay
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="paper-inset p-3">
            <p className="text-xs text-muted-foreground">Oracle</p>
            <p className="font-mono text-sm">{competition.oracleId}</p>
          </div>
          <div className="paper-inset p-3">
            <p className="text-xs text-muted-foreground">Predict object</p>
            <p className="break-all font-mono text-xs">{competition.predictObjectId}</p>
          </div>
          <div className="paper-inset p-3">
            <p className="text-xs text-muted-foreground">Runtime status</p>
            <p className="font-semibold capitalize">{selectedAgent.runtimeStatus}</p>
          </div>
          <label className="paper-inset p-3 text-sm">
            <span className="block text-xs text-muted-foreground">Selected Agent</span>
            <select
              className="mt-1 w-full bg-transparent"
              value={selectedAgent.id}
              onChange={(event) => onSelectAgent(event.currentTarget.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 paper-inset p-4">
          <h2 className="text-base font-semibold">K-line battlefield reserved</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Allowed actions: {competition.allowedActions.join(", ")}
          </p>
        </div>
      </div>

      <AgentActivityPanel
        executions={executions}
        intents={intents}
        riskDecisions={riskDecisions}
        tradingWallet={tradingWallet}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run component tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/CompetitionLobby.test.tsx src/components/platform/AgentActivityPanel.test.tsx src/components/platform/LiveCompetition.test.tsx
```

Expected:

- Component tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/components/platform/CompetitionLobby.tsx agent-arena/apps/frontend/src/components/platform/LiveCompetition.tsx agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.tsx agent-arena/apps/frontend/src/components/platform/CompetitionLobby.test.tsx agent-arena/apps/frontend/src/components/platform/LiveCompetition.test.tsx agent-arena/apps/frontend/src/components/platform/AgentActivityPanel.test.tsx
git commit -m "feat: add live agent competition surfaces"
```

### Task 5: Leaderboard, Replay, And Skill Docs Panels

**Files:**
- Create: `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx`
- Create: `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.test.tsx`
- Test: `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LeaderboardPanel } from "./LeaderboardPanel";

describe("LeaderboardPanel", () => {
  it("explains score and labels Twitter handles as unverified", () => {
    render(<LeaderboardPanel entries={mockPlatformSnapshot.leaderboard} />);

    expect(screen.getByText(/Score formula/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/@Sui_Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
    expect(screen.getByText(/Max drawdown/i)).toBeInTheDocument();
  });
});
```

Create `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { ReplayTimeline } from "./ReplayTimeline";

describe("ReplayTimeline", () => {
  it("shows intent to risk to execution to Predict transaction evidence", () => {
    render(<ReplayTimeline events={mockPlatformSnapshot.replay} />);

    expect(screen.getByText(/Intent submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict transaction confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/0xmock_exec_1/i)).toBeInTheDocument();
  });
});
```

Create `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillDocsPanel } from "./SkillDocsPanel";

describe("SkillDocsPanel", () => {
  it("shows Agent skill paths and safe runtime rules", () => {
    render(<SkillDocsPanel apiBaseUrl="http://127.0.0.1:8787/api/arena" />);

    expect(screen.getByText(/agent-arena\/skills\/agent-arena.md/i)).toBeInTheDocument();
    expect(screen.getByText(/deepbook-predict-btc-15m.md/i)).toBeInTheDocument();
    expect(screen.getByText(/registration code/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime credential/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not ask the Agent to sign Sui transactions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/LeaderboardPanel.test.tsx src/components/platform/ReplayTimeline.test.tsx src/components/platform/SkillDocsPanel.test.tsx
```

Expected:

- Fails because components do not exist.

- [ ] **Step 3: Implement panels**

Create `agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx`:

```tsx
import type { LeaderboardEntry } from "../../features/platform/types";

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function LeaderboardPanel({ entries }: LeaderboardPanelProps) {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6">
      <div className="paper-card-sm p-5">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Leaderboard</p>
        <h1 className="mt-1 text-3xl font-semibold">Agent rankings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Score formula combines net PnL, capital efficiency, hit rate, max drawdown, execution quality,
          and invalid intent penalties.
        </p>
      </div>

      <div className="paper-card-sm overflow-x-auto p-4">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Rank</th>
              <th>Agent</th>
              <th>Score</th>
              <th>Net PnL</th>
              <th>Max drawdown</th>
              <th>Executions</th>
              <th>Invalid intents</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr className="border-t border-border" key={entry.agentId}>
                <td className="py-3 font-semibold">#{entry.rank}</td>
                <td>
                  <div className="font-semibold">{entry.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.twitterHandle ? `@${entry.twitterHandle}` : "No Twitter"} ·{" "}
                    {entry.twitterVerified ? "Verified" : "Unverified"}
                  </div>
                </td>
                <td>{entry.score.toFixed(2)}</td>
                <td>{formatPct(entry.netPnlPct)}</td>
                <td>{formatPct(entry.maxDrawdownPct)}</td>
                <td>{entry.executionCount}</td>
                <td>{entry.invalidIntentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

Create `agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx`:

```tsx
import type { ReplayEvent } from "../../features/platform/types";

interface ReplayTimelineProps {
  events: ReplayEvent[];
}

export function ReplayTimeline({ events }: ReplayTimelineProps) {
  const sortedEvents = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6">
      <div className="paper-card-sm p-5">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Replay</p>
        <h1 className="mt-1 text-3xl font-semibold">Intent to Predict proof chain</h1>
      </div>

      <ol className="grid gap-3">
        {sortedEvents.map((event) => (
          <li className="paper-card-sm p-4" key={event.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{event.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p>
              </div>
              <time className="font-mono text-xs text-muted-foreground">{event.timestamp}</time>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Record</dt>
                <dd className="font-mono text-xs">{event.recordId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Copy value</dt>
                <dd className="break-all font-mono text-xs">{event.copyValue}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Predict tx</dt>
                <dd className="break-all font-mono text-xs">{event.txDigest ?? "not submitted"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

Create `agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx`:

```tsx
interface SkillDocsPanelProps {
  apiBaseUrl: string;
}

const skillPaths = [
  "agent-arena/skills/agent-arena.md",
  "agent-arena/skills/deepbook-predict-btc-15m.md",
  "agent-arena/skills/agent-wallet.md",
  "agent-arena/skills/risk-and-scoring.md"
];

export function SkillDocsPanel({ apiBaseUrl }: SkillDocsPanelProps) {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="paper-card-sm p-5">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Skill Docs</p>
        <h1 className="mt-1 text-3xl font-semibold">External Agent integration</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Start by calling the init API for a registration code. The owner then claims that code with a
          connected Sui Testnet wallet and receives a one-time Agent Runtime Credential.
        </p>
        <p className="mt-3 font-semibold">
          Do not ask the Agent to sign Sui transactions. Submit intents only.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="paper-card-sm p-4">
          <h2 className="text-lg font-semibold">Runtime endpoint</h2>
          <p className="mt-2 break-all font-mono text-sm">{apiBaseUrl}</p>
        </div>

        <div className="paper-card-sm p-4">
          <h2 className="text-lg font-semibold">Skill files</h2>
          <ul className="mt-3 grid gap-2">
            {skillPaths.map((path) => (
              <li className="paper-inset break-all p-3 font-mono text-sm" key={path}>
                {path}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run panel tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/components/platform/LeaderboardPanel.test.tsx src/components/platform/ReplayTimeline.test.tsx src/components/platform/SkillDocsPanel.test.tsx
```

Expected:

- Panel tests pass.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.tsx agent-arena/apps/frontend/src/components/platform/ReplayTimeline.tsx agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.tsx agent-arena/apps/frontend/src/components/platform/LeaderboardPanel.test.tsx agent-arena/apps/frontend/src/components/platform/ReplayTimeline.test.tsx agent-arena/apps/frontend/src/components/platform/SkillDocsPanel.test.tsx
git commit -m "feat: add leaderboard replay and skill docs panels"
```

### Task 6: App Shell Pivot And Acceptance Flow

**Files:**
- Modify: `agent-arena/apps/frontend/src/App.tsx`
- Modify: `agent-arena/apps/frontend/src/App.test.tsx`
- Modify: `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`
- Modify: `agent-arena/apps/frontend/src/components/navigation/AppNav.tsx`
- Optional delete or leave unused: old Back Agent primary components.

- [ ] **Step 1: Write failing app tests**

Update `agent-arena/apps/frontend/src/App.test.tsx` to assert:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("defaults to the Agent competition console", () => {
    render(<App />);

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pair Agent/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back Agent$/i })).not.toBeInTheDocument();
  });

  it("navigates to pairing, wallet, leaderboard, replay, and skills", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Pair Agent/i }));
    expect(screen.getByText(/Registration code/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Wallet/i }));
    expect(screen.getByText(/Testnet trading wallet/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Leaderboard/i }));
    expect(screen.getByText(/Score formula/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Replay/i }));
    expect(screen.getByText(/Intent submitted/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Skills/i }));
    expect(screen.getByText(/agent-arena\/skills\/agent-arena.md/i)).toBeInTheDocument();
  });
});
```

Update `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx` to assert:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("Agent Arena acceptance", () => {
  it("shows the Agent participation MVP path without user betting language", () => {
    render(<App />);

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getByText(/Testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/Pair Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Runtime Credential/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict tx/i)).toBeInTheDocument();
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run app tests to verify failure**

```powershell
cd agent-arena/apps/frontend
bun run test src/App.test.tsx src/acceptance/agent-arena.acceptance.test.tsx
```

Expected:

- Fails because App still uses the old `lobby | arena | workshop` flow and Back Agent copy.

- [ ] **Step 3: Implement App shell pivot**

Modify `agent-arena/apps/frontend/src/App.tsx`:

```tsx
import { useMemo, useState } from "react";
import { AgentPairingPanel } from "./components/platform/AgentPairingPanel";
import { CompetitionLobby } from "./components/platform/CompetitionLobby";
import { LeaderboardPanel } from "./components/platform/LeaderboardPanel";
import { LiveCompetition } from "./components/platform/LiveCompetition";
import { ReplayTimeline } from "./components/platform/ReplayTimeline";
import { SkillDocsPanel } from "./components/platform/SkillDocsPanel";
import { TradingWalletPanel } from "./components/platform/TradingWalletPanel";
import { AppNav } from "./components/navigation/AppNav";
import { mockPlatformSnapshot } from "./features/platform/mock";
import { createInitialPlatformState, getSelectedAgent, getSelectedCompetition, selectAgent, selectPlatformView, type PlatformView } from "./state/platform";

const runtimeCredential = "agent_runtime_test_token";

export default function App() {
  const [state, setState] = useState(() => createInitialPlatformState(mockPlatformSnapshot));
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const selectedCompetition = useMemo(() => getSelectedCompetition(state), [state]);

  const navigate = (view: PlatformView) => setState((current) => selectPlatformView(current, view));

  return (
    <main className="min-h-screen bg-transparent text-on-surface">
      <AppNav activeView={state.activeView} onNavigate={navigate} />

      {state.activeView === "lobby" ? (
        <CompetitionLobby
          competitions={state.competitions}
          leaderboard={state.leaderboard}
          onEnterCompetition={() => navigate("competition")}
          onOpenPairing={() => navigate("setup")}
          onOpenSkills={() => navigate("skills")}
        />
      ) : null}

      {state.activeView === "setup" ? (
        <AgentPairingPanel
          agent={selectedAgent}
          claimUrl="http://localhost:5173/claim/PAIR-2048"
          expiresAt="2026-06-16T10:15:00.000Z"
          registrationCode="PAIR-2048"
          runtimeCredential={runtimeCredential}
        />
      ) : null}

      {state.activeView === "wallet" ? (
        <TradingWalletPanel agent={selectedAgent} tradingWallet={state.tradingWallet} />
      ) : null}

      {state.activeView === "competition" ? (
        <LiveCompetition
          agents={state.agents}
          competition={selectedCompetition}
          executions={state.executions}
          intents={state.intents}
          riskDecisions={state.riskDecisions}
          selectedAgent={selectedAgent}
          tradingWallet={state.tradingWallet}
          onSelectAgent={(agentId) => setState((current) => selectAgent(current, agentId))}
          onViewReplay={() => navigate("replay")}
        />
      ) : null}

      {state.activeView === "leaderboard" ? <LeaderboardPanel entries={state.leaderboard} /> : null}
      {state.activeView === "replay" ? <ReplayTimeline events={state.replay} /> : null}
      {state.activeView === "skills" ? <SkillDocsPanel apiBaseUrl="http://127.0.0.1:8787/api/arena" /> : null}
    </main>
  );
}
```

Modify `AppNav` so its props use `PlatformView` and render the seven labels. If importing `PlatformView` from state creates a cycle, duplicate the string union locally in `AppNav.tsx`.

- [ ] **Step 4: Run focused app tests**

```powershell
cd agent-arena/apps/frontend
bun run test src/App.test.tsx src/acceptance/agent-arena.acceptance.test.tsx
```

Expected:

- App and acceptance tests pass.

- [ ] **Step 5: Run full frontend verification**

```powershell
cd agent-arena
bun run typecheck
bun run test:frontend
bun run build
```

Expected:

- Typecheck passes.
- Frontend tests pass.
- Production build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add agent-arena/apps/frontend/src/App.tsx agent-arena/apps/frontend/src/App.test.tsx agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx agent-arena/apps/frontend/src/components/navigation/AppNav.tsx
git commit -m "feat: pivot frontend to agent participation console"
```

### Task 7: Remove Primary Back Agent Surface And Polish Copy

**Files:**
- Modify or delete: `agent-arena/apps/frontend/src/components/arena/BackAgentPanel.tsx`
- Modify or delete: `agent-arena/apps/frontend/src/components/arena/BetManagementPanel.tsx`
- Modify or leave unused: `agent-arena/apps/frontend/src/components/workshop/AgentWorkshop.tsx`
- Modify: `agent-arena/apps/frontend/src/styles.css` only if text overflows or layout breaks.
- Test: existing frontend test suite.

- [ ] **Step 1: Search for forbidden primary-flow copy**

```powershell
rg "Back Agent|back an Agent|backed amount|Backing|betting|stake before|user betting" agent-arena/apps/frontend/src -n
```

Expected:

- Results may exist only in deprecated or unused files.
- No rendered primary App path should expose these phrases.

- [ ] **Step 2: Remove or demote old primary components**

Rules:

- If `BackAgentPanel` and `BetManagementPanel` are unused after Task 6, leave them only if tests still cover legacy behavior and no primary route imports them.
- If they create test confusion, delete them and update imports/tests.
- `AgentWorkshop` can remain only as a secondary preview if it does not appear in primary navigation.

- [ ] **Step 3: Add a rendered-copy guard test if old files remain**

Add to `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`:

```tsx
it("does not render Back Agent as a primary action", () => {
  render(<App />);

  expect(screen.queryByRole("button", { name: /^Back Agent$/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/stake before the market lock boundary/i)).not.toBeInTheDocument();
});
```

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
- Production build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add agent-arena/apps/frontend/src
git commit -m "chore: remove primary back agent frontend flow"
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

- Frontend typecheck passes.
- Frontend test suite passes.
- Production build succeeds.

Also run:

```powershell
rg "Back Agent|stake before|user betting" agent-arena/apps/frontend/src/App.tsx agent-arena/apps/frontend/src/components/platform agent-arena/apps/frontend/src/acceptance -n
```

Expected:

- No results in active platform app paths.

## Plan Self-Review

Spec coverage:

- Agent pairing and registration code: Task 1, Task 3, Task 6.
- Owner wallet claim and runtime credential boundary: Task 1, Task 3, Task 6.
- Trading wallet Testnet funding and private-key boundary: Task 3.
- Live competition, intents, risk decisions, executions, Predict tx digests: Task 4.
- Leaderboard with score explanation and unverified Twitter: Task 5.
- Replay evidence chain: Task 5.
- Skill docs: Task 5.
- Component migration away from Back Agent: Task 6, Task 7.

Known dependency:

- Backend route names currently lag the new pairing/runtime credential contract. This plan intentionally builds the frontend against the desired contract with mock fixtures. A backend follow-up should replace `/api/arena/auth/register` and `x-agent-arena-api-key` with `/api/arena/agent/init`, owner claim, and `x-agent-arena-agent-token`.
