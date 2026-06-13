import { BadgeInfo, Crosshair, Database, Gauge, ShieldCheck, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent, AgentRoundState } from "../../types/arena";
import { getPredictQuoteAssetLabel } from "../../features/predict/config";

interface AgentDetailPanelProps {
  agent: Agent;
  roundState?: AgentRoundState;
}

const QUOTE_ASSET_LABEL = getPredictQuoteAssetLabel();

export function AgentDetailPanel({ agent, roundState }: AgentDetailPanelProps) {
  const bestMarketType = agent.supportedPositionTypes.includes("range")
    ? agent.supportedPositionTypes.includes("directional")
      ? "Directional / Range"
      : "Range"
    : "Directional";
  const confidenceLabel = agent.reasoningDepth === "high" ? "High conviction" : agent.reasoningDepth === "medium" ? "Balanced conviction" : "Fast reaction";

  return (
    <aside className="paper-card-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-primary">Selected Agent</p>
          <h2 className="truncate font-display text-xl font-black uppercase text-on-surface">{agent.name}</h2>
        </div>
        <span className="paper-chip px-2 py-1">
          {agent.model}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={<Trophy size={14} />} label="Win Rate" value={`${Math.round(agent.winRate * 100)}%`} />
        <Detail icon={<Users size={14} />} label="Current Backing Pool" value={`${agent.backingVolume.toLocaleString()} ${QUOTE_ASSET_LABEL}`} />
      </div>

      <div className="paper-inset mt-4 p-3">
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center border-2 border-outline-variant bg-surface-container-high font-display text-xs font-black"
            style={{ color: agent.color }}
          >
            {agent.avatar}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-6 text-on-surface-variant">{agent.strategySummary}</p>
            <div className="paper-label mt-2 text-outline">
              {agent.reasoningDepth} reasoning / {agent.strategyType}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={<Gauge size={14} />} label="Historical ROI" value={`${Math.round(agent.historicalRoi * 100)}%`} />
        <Detail icon={<ShieldCheck size={14} />} label="Max Drawdown" value={`${Math.round(agent.maxDrawdown * 100)}%`} />
        <Detail icon={<ShieldCheck size={14} />} label="Risk Profile" value={agent.riskLabel} />
        <Detail icon={<Crosshair size={14} />} label="Best Market Type" value={bestMarketType} />
        <Detail icon={<BadgeInfo size={14} />} label="Demo Confidence" value={confidenceLabel} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={<Gauge size={14} />} label="Floating PnL" value={formatSignedPercent(roundState?.floatingPnl ?? 0)} />
        <Detail icon={<Crosshair size={14} />} label="Position Status" value={roundState?.status ?? "flat"} />
        <Detail icon={<BadgeInfo size={14} />} label="Last Action" value={formatAction(roundState?.lastAction ?? "none")} />
        <Detail icon={<ShieldCheck size={14} />} label="Current Exposure" value={roundState?.currentExposure ?? "waiting"} />
      </div>

      <section className="paper-inset mt-4 p-3">
        <p className="paper-label text-outline">Last Reasoning Snippet</p>
        <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">{roundState?.lastReason ?? "No live reasoning yet."}</p>
      </section>

      <section className="paper-inset mt-4 p-3">
        <p className="paper-label text-outline">Recent Outcomes</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {agent.recentForm.map((result, index) => (
            <span
              className={`paper-chip px-2 py-1 ${
                result === "W" ? "paper-chip-green" : "paper-chip-red"
              }`}
              key={`${agent.id}-${index}`}
            >
              {result}
            </span>
          ))}
        </div>
      </section>

      <section className="paper-inset mt-4 p-3">
        <p className="paper-label text-outline">Data Inputs</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {agent.dataInputs.map((input) => (
            <span
              className="paper-chip px-2 py-1"
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
    <div className="paper-inset min-w-0 px-2.5 py-2">
      <div className="paper-label flex min-w-0 items-center gap-1.5 text-[9px] text-on-surface-variant">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-mono text-xs font-bold text-on-surface">{value}</div>
    </div>
  );
}

function formatSignedPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatAction(action: AgentRoundState["lastAction"] | "none"): string {
  return action === "none" ? "Waiting" : action.replaceAll("_", " ");
}
