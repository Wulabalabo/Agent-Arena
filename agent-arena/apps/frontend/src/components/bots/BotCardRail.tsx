import { getSortedAgents } from "../../mock/arena";
import type { AgentSortMode, ArenaMatch } from "../../types/arena";
import { BotCard } from "./BotCard";

interface BotCardRailProps {
  match: ArenaMatch;
  selectedAgentId: string | null;
  activeSort: AgentSortMode;
  onSortChange: (mode: AgentSortMode) => void;
  onSelect: (agentId: string) => void;
}

const sortOptions: Array<{ id: AgentSortMode; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "crowd", label: "Crowd Pick" },
  { id: "odds", label: "Best Odds" }
];

export function BotCardRail({ match, selectedAgentId, activeSort, onSortChange, onSelect }: BotCardRailProps) {
  const agents = getSortedAgents(match.agents, activeSort);

  return (
    <section className="border-t border-stone-800 bg-stone-950 px-5 py-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-stone-500">Agent Cards</p>
          <h2 className="text-base font-semibold text-stone-100">Live Leaderboard</h2>
        </div>
        <div className="flex gap-2">
          {sortOptions.map((option) => (
            <button
              className={`rounded-md px-3 py-2 text-sm ${
                activeSort === option.id ? "bg-teal-400 text-stone-950" : "bg-stone-900 text-stone-300"
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

      <div className="flex gap-3 overflow-x-auto pb-1">
        {agents.map((agent) => (
          <BotCard agent={agent} key={agent.id} selected={agent.id === selectedAgentId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

