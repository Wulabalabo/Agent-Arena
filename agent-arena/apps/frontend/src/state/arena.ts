import { getAgentById, getRoundById } from "../mock/arena";
import type {
  Agent,
  AgentSortMode,
  ArenaRound,
  ArenaState,
  AttributionSyncStatus,
  BackingDraft,
  BackingPosition
} from "../types/arena";

const STATE_UPDATE_TIMESTAMP = "2026-06-09T15:10:00+08:00";

interface RecordBackedPositionBaseInput {
  userAddress: string;
  managerId: string | null;
  roundId: string;
  agentId: string;
  amount: number;
  predictTxDigest: string;
  attributionId: string | null;
  attributionStatus: AttributionSyncStatus;
  attributionError: string | null;
}

type RecordBackedPositionInput =
  | (RecordBackedPositionBaseInput & {
      predictPositionType: "directional";
      marketKey: string;
      rangeKey: null;
    })
  | (RecordBackedPositionBaseInput & {
      predictPositionType: "range";
      marketKey: null;
      rangeKey: string;
    });

function getFirstSelectableAgentId(round: ArenaRound, agents: Agent[]): string {
  const roundAgentId = round.agentIds[0];
  if (roundAgentId) {
    return getAgentById(agents, roundAgentId).id;
  }

  const fallbackAgent = agents[0];
  if (!fallbackAgent) {
    throw new Error("Arena state requires at least one agent");
  }

  return fallbackAgent.id;
}

function getBackingIndex(backings: BackingPosition[], backingId: string): number {
  return backings.findIndex((backing) => backing.id === backingId);
}

function setBackingAtIndex(
  backings: BackingPosition[],
  index: number,
  nextBacking: BackingPosition
): BackingPosition[] {
  return backings.map((backing, currentIndex) => (currentIndex === index ? nextBacking : backing));
}

export function createInitialArenaState(
  rounds: ArenaRound[],
  agents: Agent[],
  userBackings: BackingPosition[]
): ArenaState {
  const firstRound = rounds[0];
  if (!firstRound) {
    throw new Error("Arena state requires at least one round");
  }

  return {
    rounds: [...rounds],
    agents: [...agents],
    userBackings: [...userBackings],
    selectedRoundId: firstRound.id,
    selectedAgentId: getFirstSelectableAgentId(firstRound, agents),
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
  if (roundId === state.selectedRoundId) {
    return state;
  }

  const round = getRoundById(state.rounds, roundId);

  return {
    ...state,
    selectedRoundId: round.id,
    selectedAgentId: getFirstSelectableAgentId(round, state.agents),
    backingDraft: null
  };
}

export function selectAgent(state: ArenaState, agentId: string): ArenaState {
  if (agentId === state.selectedAgentId) {
    return state;
  }

  getAgentById(state.agents, agentId);

  return {
    ...state,
    selectedAgentId: agentId
  };
}

export function setAgentSort(state: ArenaState, activeSort: AgentSortMode): ArenaState {
  if (activeSort === state.activeSort) {
    return state;
  }

  return {
    ...state,
    activeSort
  };
}

export function isRoundLocked(round: ArenaRound): boolean {
  return round.status === "locking" || round.status === "live" || round.status === "settling" || round.status === "settled";
}

export function createOrUpdateDraft(state: ArenaState, draft: BackingDraft): ArenaState {
  const round = getRoundById(state.rounds, draft.roundId);

  if (isRoundLocked(round)) {
    return state;
  }

  getAgentById(state.agents, draft.agentId);

  return {
    ...state,
    backingDraft: draft
  };
}

export function recordBackedPosition(state: ArenaState, input: RecordBackedPositionInput): ArenaState {
  const round = getRoundById(state.rounds, input.roundId);

  if (isRoundLocked(round)) {
    return state;
  }

  getAgentById(state.agents, input.agentId);

  const backingBase = {
    id: `backing-${input.roundId}-${input.agentId}-${input.predictTxDigest}`,
    userAddress: input.userAddress,
    managerId: input.managerId,
    roundId: input.roundId,
    agentId: input.agentId,
    amount: input.amount,
    status: "backed" as const,
    createdAt: STATE_UPDATE_TIMESTAMP,
    updatedAt: STATE_UPDATE_TIMESTAMP,
    predictTxDigest: input.predictTxDigest,
    attributionId: input.attributionId,
    attributionStatus: input.attributionStatus,
    attributionError: input.attributionError,
    estimatedValue: input.amount,
    finalValue: null,
    fee: null,
    redeemTxDigest: null
  };
  const nextBacking: BackingPosition =
    input.predictPositionType === "range"
      ? {
          ...backingBase,
          predictPositionType: "range",
          marketKey: null,
          rangeKey: input.rangeKey
        }
      : {
          ...backingBase,
          predictPositionType: "directional",
          marketKey: input.marketKey,
          rangeKey: null
        };
  const existingIndex = state.userBackings.findIndex(
    (backing) => backing.roundId === input.roundId && backing.agentId === input.agentId
  );

  return {
    ...state,
    backingDraft: null,
    userBackings:
      existingIndex === -1
        ? [...state.userBackings, nextBacking]
        : setBackingAtIndex(state.userBackings, existingIndex, nextBacking)
  };
}

export function cancelBacking(state: ArenaState, backingId: string): ArenaState {
  const backingIndex = getBackingIndex(state.userBackings, backingId);

  if (backingIndex === -1) {
    return state;
  }

  const backing = state.userBackings[backingIndex];
  const round = getRoundById(state.rounds, backing.roundId);

  if (isRoundLocked(round) || backing.predictTxDigest) {
    return state;
  }

  if (backing.status !== "draft" && backing.status !== "pending_signature") {
    return state;
  }

  const nextBacking: BackingPosition = {
    ...backing,
    status: "cancelled",
    updatedAt: STATE_UPDATE_TIMESTAMP
  };

  return {
    ...state,
    userBackings: setBackingAtIndex(state.userBackings, backingIndex, nextBacking)
  };
}

export function closeMintedBacking(state: ArenaState, backingId: string): ArenaState {
  const backingIndex = getBackingIndex(state.userBackings, backingId);

  if (backingIndex === -1) {
    return state;
  }

  const backing = state.userBackings[backingIndex];

  if (!backing.predictTxDigest) {
    return state;
  }

  const nextBacking: BackingPosition = {
    ...backing,
    status: "redeemable",
    updatedAt: STATE_UPDATE_TIMESTAMP
  };

  return {
    ...state,
    userBackings: setBackingAtIndex(state.userBackings, backingIndex, nextBacking)
  };
}
