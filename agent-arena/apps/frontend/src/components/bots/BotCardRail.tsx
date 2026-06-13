import { getSortedAgents } from "../../mock/arena";
import type { Agent, AgentSortMode } from "../../types/arena";
import { BotCard } from "./BotCard";

interface BotCardRailProps {
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

export function BotCardRail({ agents, selectedAgentId, activeSort, onSortChange, onSelect }: BotCardRailProps) {
  const sortedAgents = getSortedAgents(agents, activeSort);
  const compactCards = sortedAgents.length > 8;
  const desktopGridClass =
    sortedAgents.length <= 4 ? "xl:grid-cols-4" : sortedAgents.length <= 6 ? "xl:grid-cols-3" : "xl:grid-cols-4";

  return (
    <section className="flex min-h-0 flex-col border-t border-outline-variant bg-surface-container-lowest px-3 py-3 md:px-4">
      <div className="mb-2 flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-outline">Agent Cards</p>
          <h2 className="truncate font-display text-base font-semibold text-on-surface">Live Leaderboard</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortOptions.map((option) => (
            <button
              className={`rounded border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.05em] ${
                activeSort === option.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/60"
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

      <div
        className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-hidden md:grid-cols-3 ${desktopGridClass}`}
        data-testid="agent-card-grid"
      >
        {sortedAgents.map((agent) => (
          <BotCard agent={agent} compact={compactCards} key={agent.id} selected={agent.id === selectedAgentId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
