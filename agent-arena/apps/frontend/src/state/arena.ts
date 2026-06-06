import { getAgentById, getSortedAgents } from "../mock/arena";
import type { ArenaMatch, ArenaState, MatchPhase, UserPosition } from "../types/arena";

const phaseOrder: MatchPhase[] = ["lobby", "live", "final-minute", "settling", "settled"];

export function createInitialArenaState(match: ArenaMatch): ArenaState {
  return {
    match,
    phase: match.phase,
    selectedAgentId: match.agents[0]?.id ?? null,
    activeSort: "leaderboard",
    userPosition: null,
    winnerId: null
  };
}

export function selectAgent(state: ArenaState, agentId: string): ArenaState {
  getAgentById(state.match, agentId);

  return {
    ...state,
    selectedAgentId: agentId
  };
}

export function setAgentSort(state: ArenaState, activeSort: ArenaState["activeSort"]): ArenaState {
  return {
    ...state,
    activeSort
  };
}

export function confirmPrediction(state: ArenaState, agentId: string, amount: number): ArenaState {
  const agent = getAgentById(state.match, agentId);
  const estimatedPayout = Number((amount * agent.odds).toFixed(2));
  const userPosition: UserPosition = {
    agentId,
    amount,
    odds: agent.odds,
    estimatedPayout,
    status: "confirmed",
    txDigest: `0x${agentId.replaceAll("-", "").slice(0, 10)}${Math.round(amount * 100)}`
  };

  return {
    ...state,
    userPosition,
    match: {
      ...state.match,
      predictionVolume: state.match.predictionVolume + amount,
      agents: state.match.agents.map((candidate) =>
        candidate.id === agentId
          ? {
              ...candidate,
              audienceBacking: candidate.audienceBacking + 1,
              predictionVolume: candidate.predictionVolume + amount
            }
          : candidate
      )
    }
  };
}

export function advancePhase(state: ArenaState): ArenaState {
  const currentIndex = phaseOrder.indexOf(state.phase);
  const nextPhase = phaseOrder[Math.min(currentIndex + 1, phaseOrder.length - 1)];

  return {
    ...state,
    phase: nextPhase
  };
}

export function settleMatch(state: ArenaState): ArenaState {
  const [winner] = getSortedAgents(state.match.agents, "leaderboard");

  return {
    ...state,
    phase: "settled",
    winnerId: winner.id
  };
}

