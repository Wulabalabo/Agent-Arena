import { Bot, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent } from "../../types/arena";

interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  onSelect: (agentId: string) => void;
}

export function AgentCard({ agent, selected, onSelect }: AgentCardProps) {
  return (
    <button
      className={`relative flex min-h-0 flex-col justify-between overflow-hidden border-2 border-outline-variant p-3 pt-4 text-left shadow-[4px_4px_0_#000] transition ${
        selected
          ? "bg-primary-container text-white"
          : "bg-surface-container-lowest text-on-surface hover:-translate-y-0.5 hover:bg-surface-container"
      }`}
      data-testid="agent-card"
      type="button"
      onClick={() => onSelect(agent.id)}
    >
      <span className="absolute inset-x-0 top-0 h-2" style={{ background: agent.color }} />
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center border-2 border-outline-variant font-display text-[10px] font-black ${
                selected ? "bg-white" : "bg-surface-container-high"
              }`}
              style={{ color: agent.color }}
            >
              {agent.avatar}
            </span>
            <div className="min-w-0">
              <span className={`block truncate font-display text-sm font-black uppercase ${selected ? "text-white" : "text-on-surface"}`} title={agent.name}>
                {agent.name}
              </span>
              <span className={`paper-label block truncate ${selected ? "text-white/80" : "text-on-surface-variant"}`}>
                {agent.model}
              </span>
            </div>
          </div>
          <span className={`border-2 border-outline-variant px-2 py-1 font-display text-[10px] font-black ${selected ? "bg-white text-primary" : "bg-surface-container text-primary"}`}>
            #{agent.popularityRank}
          </span>
        </div>
        <div className={`paper-label mt-2 flex items-center gap-1 ${selected ? "text-white/80" : "text-on-surface-variant"}`}>
          <Bot size={13} />
          <span className="truncate">{agent.strategyType}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
        <Stat icon={<TrendingUp size={13} />} label="Win Rate" value={`${Math.round(agent.winRate * 100)}%`} />
        <Stat label="ROI" value={`${Math.round(agent.historicalRoi * 100)}%`} />
        <Stat icon={<ShieldCheck size={13} />} label="Max DD" value={`${Math.round(agent.maxDrawdown * 100)}%`} />
        <Stat icon={<Users size={13} />} label="Volume" value={agent.backingVolume.toLocaleString()} />
        <Stat icon={<ShieldCheck size={13} />} label="Risk" value={agent.riskLabel} />
      </div>

      <div className={`mt-3 flex items-center justify-between border-t-2 border-outline-variant pt-2 font-mono text-[10px] font-bold uppercase ${selected ? "text-white/80" : "text-on-surface-variant"}`}>
        <span>Form {agent.recentForm.join("")}</span>
        <span>{agent.reasoningDepth}</span>
      </div>
    </button>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 border-2 border-outline-variant bg-surface-container-lowest px-2 py-1">
      <div className="paper-label flex min-w-0 items-center gap-1 text-[9px] text-on-surface-variant">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate font-mono text-xs font-bold text-on-surface">{value}</div>
    </div>
  );
}
