import { Crosshair, LineChart, Radio, ShieldCheck, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Agent, ArenaMatch, TradeAction } from "../../types/arena";

interface BotDetailDrawerProps {
  agent: Agent;
  match: ArenaMatch;
  onBackAgent: () => void;
}

export function BotDetailDrawer({ agent, match, onBackAgent }: BotDetailDrawerProps) {
  const rankedAgents = [...match.agents].sort((left, right) => left.rank - right.rank);
  const latestEvents = [...match.events].slice(-4).reverse();
  const totalPredictionVolume = match.agents.reduce((sum, current) => sum + current.predictionVolume, 0);

  return (
    <aside className="flex min-h-0 flex-col border-l border-outline-variant bg-surface-container-low p-4 xl:h-full xl:overflow-hidden">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-primary">Predict Pool</p>
            <h2 className="truncate font-display text-xl font-semibold text-on-surface">Rank-1 Market</h2>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded border border-success/40 bg-success/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-success">
            <Radio size={12} />
            Live
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Detail icon={<Trophy size={14} />} label="Prize" value={`${match.prizePool.toLocaleString()} SUI`} />
          <Detail icon={<Users size={14} />} label="Volume" value={`${match.predictionVolume.toLocaleString()} SUI`} />
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-hidden">
        <section className="rounded-lg border border-outline-variant bg-surface-container p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Crowd Book</p>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">Odds</p>
          </div>
          <div className="space-y-1.5">
            {rankedAgents.slice(0, 5).map((candidate) => {
              const backingShare = totalPredictionVolume
                ? Math.round((candidate.predictionVolume / totalPredictionVolume) * 100)
                : 0;

              return (
                <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2" key={candidate.id}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded border border-outline-variant bg-surface-container-high font-mono text-[8px] font-bold"
                        style={{ color: candidate.color }}
                      >
                        {candidate.avatar}
                      </span>
                      <span className="truncate text-xs font-semibold text-on-surface" title={candidate.name}>
                        {candidate.name}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface-container-highest">
                      <div className="h-full rounded bg-primary-container" style={{ width: `${backingShare}%` }} />
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs font-bold text-on-surface">{candidate.odds.toFixed(1)}x</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Selected Agent</p>
          <div className="mt-2 flex items-start gap-2">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded border border-outline-variant bg-surface-container-high font-mono text-xs font-bold"
              style={{ color: agent.color }}
            >
              {agent.avatar}
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-semibold text-on-surface" title={agent.name}>
                {agent.name}
              </h3>
              <p className="clamp-2 mt-1 text-xs leading-5 text-on-surface-variant">{agent.strategySummary}</p>
              <div className="mt-2 font-mono text-[10px] font-medium text-outline">On-chain ID / {agent.creator}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Detail icon={<LineChart size={14} />} label="Score" value={agent.battleScore.toFixed(1)} />
            <Detail icon={<Crosshair size={14} />} label="Entry" value={agent.entryPrice ? agent.entryPrice.toFixed(2) : "Flat"} />
            <Detail icon={<ShieldCheck size={14} />} label="Max DD" value={`${agent.maxDrawdown.toFixed(1)}%`} />
            <Detail icon={<Users size={14} />} label="Backers" value={String(agent.audienceBacking)} />
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-container p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Live Tape</p>
          <div className="mt-2 space-y-2">
            {latestEvents.map((event) => {
              const eventAgent = match.agents.find((candidate) => candidate.id === event.agentId);

              return (
                <div className="grid grid-cols-[44px_minmax(0,1fr)_46px] items-center gap-2" key={event.id}>
                  <span className={`rounded border px-1.5 py-1 text-center font-mono text-[9px] font-bold uppercase ${actionClass(event.action)}`}>
                    {formatAction(event.action)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-on-surface">{eventAgent?.name ?? "Agent"}</p>
                    <p className="truncate font-mono text-[10px] text-on-surface-variant">{event.reason}</p>
                  </div>
                  <p className="text-right font-mono text-xs text-on-surface">{event.price.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <button
        className="mt-3 w-full shrink-0 rounded bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary"
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
    <div className="min-w-0 rounded border border-outline-variant bg-surface-container-low px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-on-surface-variant/70">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-mono text-xs font-medium text-on-surface">{value}</div>
    </div>
  );
}

function formatAction(action: TradeAction): string {
  if (action === "risk-reduce") {
    return "Risk";
  }

  return action;
}

function actionClass(action: TradeAction): string {
  if (action === "buy") {
    return "border-success/50 bg-success/10 text-success";
  }

  if (action === "sell") {
    return "border-error/50 bg-error/10 text-error";
  }

  return "border-secondary/50 bg-secondary/10 text-secondary";
}
