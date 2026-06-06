import { useState } from "react";
import { getSortedAgents } from "../../mock/arena";
import type { AgentSortMode, ArenaMatch, MatchPhase, UserPosition } from "../../types/arena";
import { SettlementOverlay } from "../settlement/SettlementOverlay";
import { BotCard } from "./BotCard";

interface BotCardRailProps {
  match: ArenaMatch;
  selectedAgentId: string | null;
  activeSort: AgentSortMode;
  phase: MatchPhase;
  winnerId: string | null;
  userPosition: UserPosition | null;
  onSortChange: (mode: AgentSortMode) => void;
  onSelect: (agentId: string) => void;
  onSettle: () => void;
}

const sortOptions: Array<{ id: AgentSortMode; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "crowd", label: "Crowd Pick" },
  { id: "odds", label: "Best Odds" }
];

type AgentPanelTab = "agents" | "settlement";

export function BotCardRail({
  match,
  selectedAgentId,
  activeSort,
  phase,
  winnerId,
  userPosition,
  onSortChange,
  onSelect,
  onSettle
}: BotCardRailProps) {
  const agents = getSortedAgents(match.agents, activeSort);
  const [activeTab, setActiveTab] = useState<AgentPanelTab>("agents");
  const compactCards = agents.length > 8;
  const desktopGridClass = agents.length <= 4 ? "xl:grid-cols-4" : agents.length <= 6 ? "xl:grid-cols-3" : "xl:grid-cols-4";

  return (
    <section className="flex min-h-0 flex-col border-t border-outline-variant bg-surface-container-lowest px-3 py-3 md:px-4">
      <div className="mb-2 flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-outline">Agent Cards</p>
          <h2 className="truncate font-display text-base font-semibold text-on-surface">Live Leaderboard</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["agents", "settlement"] as const).map((tab) => (
            <button
              className={`rounded border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.05em] ${
                activeTab === tab
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/60"
              }`}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab === "agents" ? "Live Agents" : "Settlement"}
            </button>
          ))}
          {sortOptions.map((option) => (
            <button
              className={`rounded border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.05em] ${
                activeSort === option.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/60"
              } ${activeTab === "agents" ? "" : "hidden"}`}
              key={option.id}
              type="button"
              onClick={() => onSortChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "agents" ? (
        <div
          className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-hidden md:grid-cols-3 ${desktopGridClass}`}
          data-testid="agent-card-grid"
        >
          {agents.map((agent) => (
            <BotCard
              agent={agent}
              compact={compactCards}
              key={agent.id}
              selected={agent.id === selectedAgentId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden" data-testid="settlement-panel">
          {phase === "settled" && winnerId ? (
            <SettlementOverlay match={match} userPosition={userPosition} winnerId={winnerId} />
          ) : (
            <div className="h-full rounded-lg border border-outline-variant bg-surface-container p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-primary">Settlement Preview</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-on-surface">Resolve the current arena round</h3>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-on-surface-variant">
                Settlement belongs to the agent panel because it is another way to read the same roster: final rank, winner,
                creator reward, and audience prediction result.
              </p>
              <button
                className="mt-4 rounded bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary"
                type="button"
                onClick={onSettle}
              >
                Settle Match
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
