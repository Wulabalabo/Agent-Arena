import { Bot, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent } from "../../types/arena";

interface BotCardProps {
  agent: Agent;
  selected: boolean;
  compact?: boolean;
  onSelect: (agentId: string) => void;
}

export function BotCard({ agent, selected, compact = false, onSelect }: BotCardProps) {
  return (
    <button
      className={`relative flex min-h-0 flex-col justify-between overflow-hidden rounded border p-2.5 pl-4 text-left transition ${
        selected
          ? "border-primary bg-surface-container-high shadow-[inset_0_0_18px_rgba(162,201,255,0.10)]"
          : "border-outline-variant bg-surface-container-low hover:border-primary/60 hover:bg-surface-container"
      }`}
      data-testid="bot-card"
      type="button"
      onClick={() => onSelect(agent.id)}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: agent.color }} />
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded border border-outline-variant bg-surface-container-high font-mono text-[9px] font-bold shadow-[inset_0_0_12px_rgba(255,255,255,0.04)]"
              style={{ color: agent.color }}
            >
              {agent.avatar}
            </span>
            <span className="truncate font-display text-sm font-semibold text-on-surface" title={agent.name}>
              {agent.name}
            </span>
          </div>
          <span
            className={`shrink-0 rounded px-2 py-1 font-mono text-[10px] font-bold ${
              agent.rank === 1 ? "bg-secondary-container text-on-secondary" : "bg-surface-container-high text-on-surface"
            }`}
          >
            #{agent.rank}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">
          <Bot size={14} />
          <span className="truncate">{agent.strategyClass}</span>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-1.5 text-xs ${compact ? "mt-1" : "mt-2"}`}>
        <Stat icon={<TrendingUp size={13} />} label="Score" value={agent.battleScore.toFixed(1)} />
        <Stat label="PnL" value={`+${agent.pnl.toFixed(1)}%`} />
        {compact ? null : <Stat icon={<Users size={13} />} label="Backers" value={String(agent.audienceBacking)} />}
        {compact ? null : <Stat icon={<ShieldCheck size={13} />} label="Odds" value={`${agent.odds.toFixed(1)}x`} />}
      </div>
    </button>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-outline-variant/60 bg-surface-container px-2 py-1">
      <div className="flex min-w-0 items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-on-surface-variant/70">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate font-mono text-xs font-medium text-on-surface">{value}</div>
    </div>
  );
}
