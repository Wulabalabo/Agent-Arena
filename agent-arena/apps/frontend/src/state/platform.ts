import type { AgentProfile, Competition, PlatformSnapshot } from "../features/platform/types";

export type PlatformView = "arena" | "leaderboard";

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
    agents: [...snapshot.agents],
    competitions: [...snapshot.competitions],
    intents: [...snapshot.intents],
    riskDecisions: [...snapshot.riskDecisions],
    executions: [...snapshot.executions],
    positions: [...snapshot.positions],
    leaderboard: [...snapshot.leaderboard],
    replay: [...snapshot.replay],
    activeView: "arena",
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
