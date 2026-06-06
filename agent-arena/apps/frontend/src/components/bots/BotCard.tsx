import { Bot, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent } from "../../types/arena";

interface BotCardProps {
  agent: Agent;
  selected: boolean;
  onSelect: (agentId: string) => void;
}

export function BotCard({ agent, selected, onSelect }: BotCardProps) {
  return (
    <button
      className={`flex min-h-[168px] min-w-[230px] flex-col justify-between rounded-md border p-4 text-left transition ${
        selected ? "border-teal-300 bg-stone-900" : "border-stone-800 bg-stone-950 hover:border-stone-600"
      }`}
      data-testid="bot-card"
      type="button"
      onClick={() => onSelect(agent.id)}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: agent.color }} />
            <span className="font-semibold text-stone-50">{agent.name}</span>
          </div>
          <span className="rounded bg-stone-800 px-2 py-1 text-xs font-semibold text-stone-200">#{agent.rank}</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-stone-400">
          <Bot size={14} />
          <span>{agent.strategyClass}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat icon={<TrendingUp size={13} />} label="Score" value={agent.battleScore.toFixed(1)} />
        <Stat label="Odds" value={`${agent.odds.toFixed(1)}x`} />
        <Stat icon={<Users size={13} />} label="Backers" value={String(agent.audienceBacking)} />
        <Stat icon={<ShieldCheck size={13} />} label="Drawdown" value={`${agent.maxDrawdown.toFixed(1)}%`} />
      </div>
    </button>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-900/80 px-2 py-1.5">
      <div className="flex items-center gap-1 text-stone-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-stone-100">{value}</div>
    </div>
  );
}
