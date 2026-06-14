import { getSortedAgents } from "../../mock/arena";
import type { Agent, AgentSortMode } from "../../types/arena";
import { AgentCard } from "./AgentCard";

interface AgentCardRailProps {
  agents: Agent[];
  selectedAgentId: string;
  activeSort: AgentSortMode;
  compact?: boolean;
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

export function AgentCardRail({ agents, selectedAgentId, activeSort, compact = false, onSortChange, onSelect }: AgentCardRailProps) {
  const sortedAgents = getSortedAgents(agents, activeSort);

  return (
    <section
      aria-label={compact ? "Compact agent selector" : "Available Agents"}
      className={`paper-card-sm flex min-h-0 flex-col px-3 md:px-4 ${compact ? "h-[190px] py-2" : "py-3"}`}
    >
      <div className={`flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between ${compact ? "mb-1.5" : "mb-2"}`}>
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

      {compact ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden md:grid-cols-3">
          {sortedAgents.map((agent) => (
            <CompactAgentCard agent={agent} key={agent.id} selected={agent.id === selectedAgentId} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-hidden md:grid-cols-3 xl:grid-cols-3">
          {sortedAgents.map((agent) => (
            <AgentCard agent={agent} key={agent.id} selected={agent.id === selectedAgentId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function CompactAgentCard({
  agent,
  selected,
  onSelect
}: {
  agent: Agent;
  selected: boolean;
  onSelect: (agentId: string) => void;
}) {
  return (
    <button
      className={`min-w-0 overflow-hidden border-2 border-outline-variant px-2 py-1.5 text-left shadow-[2px_2px_0_#000] transition ${
        selected ? "bg-primary-container text-white" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
      }`}
      data-testid="agent-card"
      type="button"
      onClick={() => onSelect(agent.id)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center border-2 border-outline-variant font-display text-[10px] font-black ${
            selected ? "bg-white" : "bg-surface-container-high"
          }`}
          style={{ color: agent.color }}
        >
          {agent.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-display text-xs font-black uppercase ${selected ? "text-white" : "text-on-surface"}`} title={agent.name}>
            {agent.name}
          </div>
          <div className={`paper-label truncate ${selected ? "text-white/80" : "text-on-surface-variant"}`}>
            WR {Math.round(agent.winRate * 100)}% / {agent.riskLabel}
          </div>
        </div>
        <span className={`shrink-0 font-mono text-[10px] font-bold ${selected ? "text-white" : "text-primary"}`}>#{agent.popularityRank}</span>
      </div>
      <div className={`mt-1 truncate font-mono text-[10px] font-bold ${selected ? "text-white/80" : "text-on-surface-variant"}`}>
        Max DD {Math.round(agent.maxDrawdown * 100)}% / {agent.backingVolume.toLocaleString()} backed
      </div>
    </button>
  );
}
