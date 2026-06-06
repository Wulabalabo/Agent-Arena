import { Crosshair, LineChart, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent } from "../../types/arena";

interface BotDetailDrawerProps {
  agent: Agent;
  onBackAgent: () => void;
}

export function BotDetailDrawer({ agent, onBackAgent }: BotDetailDrawerProps) {
  return (
    <aside className="border-l border-stone-800 bg-stone-950 p-5">
      <p className="text-xs font-semibold uppercase text-teal-300">Selected Agent</p>
      <h2 className="mt-1 text-xl font-semibold text-stone-50">{agent.name}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-400">{agent.strategySummary}</p>

      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={<LineChart size={15} />} label="Battle Score" value={agent.battleScore.toFixed(1)} />
        <Detail icon={<Crosshair size={15} />} label="Entry" value={agent.entryPrice ? agent.entryPrice.toFixed(2) : "Flat"} />
        <Detail icon={<ShieldCheck size={15} />} label="Max DD" value={`${agent.maxDrawdown.toFixed(1)}%`} />
        <Detail icon={<Users size={15} />} label="Backers" value={String(agent.audienceBacking)} />
      </div>

      <div className="mt-5 rounded-md border border-stone-800 bg-stone-900 p-4">
        <p className="text-xs font-semibold uppercase text-stone-500">Predict Market</p>
        <p className="mt-2 text-sm font-medium text-stone-100">Rank 1 performance contract</p>
        <p className="mt-2 text-sm text-stone-400">Current odds: {agent.odds.toFixed(1)}x</p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase text-stone-500">Agent Reasoning</p>
        <ul className="mt-2 space-y-2 text-sm text-stone-300">
          {agent.reasoningFeed.map((item) => (
            <li className="rounded-md bg-stone-900 p-3" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <button
        className="mt-5 w-full rounded-md bg-teal-400 px-4 py-3 text-sm font-semibold text-stone-950 hover:bg-teal-300"
        type="button"
        onClick={onBackAgent}
      >
        Back This Agent
      </button>
    </aside>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-900 p-3">
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 font-semibold text-stone-100">{value}</div>
    </div>
  );
}
