import { getSortedAgents } from "../../mock/arena";
import type { Agent, AgentSortMode } from "../../types/arena";
import { AgentCard } from "./AgentCard";

interface AgentCardRailProps {
  agents: Agent[];
  selectedAgentId: string;
  activeSort: AgentSortMode;
  onSortChange: (mode: AgentSortMode) => void;
  onSelect: (agentId: string) => void;
}

const sortOptions: Array<{ id: AgentSortMode; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "winRate", label: "Win Rate" },
  { id: "backingVolume", label: "Backing Vol." },
  { id: "riskAdjusted", label: "Risk Adj." },
  { id: "recentForm", label: "Recent Form" }
];

export function AgentCardRail({ agents, selectedAgentId, activeSort, onSortChange, onSelect }: AgentCardRailProps) {
  const sortedAgents = getSortedAgents(agents, activeSort);

  return (
    <section className="paper-card-sm flex min-h-0 flex-col px-3 py-3 md:px-4">
      <div className="mb-2 flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="paper-label text-outline">Available Agents</p>
          <h2 className="truncate font-display text-base font-black uppercase text-on-surface">Live Leaderboard</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortOptions.map((option) => (
            <button
              className={`border-2 border-outline-variant px-2.5 py-1.5 font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000] ${
                activeSort === option.id
                  ? "bg-primary-container text-white"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
              }`}
              key={option.id}
              type="button"
              onClick={() => onSortChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-hidden md:grid-cols-3 xl:grid-cols-3">
        {sortedAgents.map((agent) => (
          <AgentCard agent={agent} key={agent.id} selected={agent.id === selectedAgentId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
