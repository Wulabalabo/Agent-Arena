import { Crosshair, Database, Gauge, ShieldCheck, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent, AgentRoundState } from "../../types/arena";
import { getPredictQuoteAssetLabel } from "../../features/predict/config";

interface BotDetailDrawerProps {
  agent: Agent;
  roundState?: AgentRoundState;
}

const QUOTE_ASSET_LABEL = getPredictQuoteAssetLabel();

export function BotDetailDrawer({ agent, roundState }: BotDetailDrawerProps) {
  return (
    <aside className="rounded border border-outline-variant bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-primary">Selected Agent</p>
          <h2 className="truncate font-display text-xl font-semibold text-on-surface">{agent.name}</h2>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded border border-outline-variant bg-surface-container px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">
          {agent.model}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={<Trophy size={14} />} label="Win Rate" value={`${Math.round(agent.winRate * 100)}%`} />
        <Detail icon={<Users size={14} />} label="Backing Vol." value={`${agent.backingVolume.toLocaleString()} ${QUOTE_ASSET_LABEL}`} />
      </div>

      <div className="mt-4 flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded border border-outline-variant bg-surface-container-high font-mono text-xs font-bold"
          style={{ color: agent.color }}
        >
          {agent.avatar}
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-6 text-on-surface-variant">{agent.strategySummary}</p>
          <div className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-outline">
            {agent.reasoningDepth} reasoning
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={<Gauge size={14} />} label="ROI" value={`${Math.round(agent.historicalRoi * 100)}%`} />
        <Detail icon={<ShieldCheck size={14} />} label="Max DD" value={`${Math.round(agent.maxDrawdown * 100)}%`} />
        <Detail icon={<Crosshair size={14} />} label="Exposure" value={roundState?.currentExposure ?? "waiting"} />
        <Detail icon={<Users size={14} />} label="Status" value={roundState?.status ?? "flat"} />
      </div>

      <section className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Data Inputs</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {agent.dataInputs.map((input) => (
            <span
              className="rounded border border-outline-variant bg-surface-container-low px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant"
              key={input}
            >
              <Database className="mr-1 inline" size={10} />
              {input}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-outline-variant bg-surface-container-low px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-on-surface-variant/70">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-mono text-xs font-medium text-on-surface">{value}</div>
    </div>
  );
}
