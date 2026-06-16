import { Play, RotateCcw } from "lucide-react";
import type { AgentProfile, Competition, ExecutionRecord, AgentIntent, RiskDecision, TradingWallet } from "../../features/platform/types";
import { AgentActivityPanel } from "./AgentActivityPanel";

interface LiveCompetitionProps {
  agents: AgentProfile[];
  competition?: Competition;
  executions: ExecutionRecord[];
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  selectedAgent?: AgentProfile;
  tradingWallet: TradingWallet;
  onSelectAgent: (agentId: string) => void;
  onViewReplay: () => void;
}

export function LiveCompetition({
  agents,
  competition,
  executions,
  intents,
  riskDecisions,
  selectedAgent,
  tradingWallet,
  onSelectAgent,
  onViewReplay
}: LiveCompetitionProps) {
  if (!competition) {
    return (
      <section aria-label="Live Competition" className="paper-card-sm p-5">
        <p className="paper-label text-on-surface-variant">Live Competition</p>
        <h1 className="mt-2 font-display text-xl font-black uppercase text-on-surface">No live arena selected</h1>
      </section>
    );
  }

  return (
    <section aria-label="Live Competition" className="space-y-4">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Live Competition</p>
            <h1 className="mt-1 truncate font-display text-2xl font-black uppercase text-on-surface">{competition.name}</h1>
            <p className="mt-2 break-all font-mono text-[11px] font-bold text-on-surface-variant">
              Oracle {competition.oracleId} / Predict object {competition.predictObjectId}
            </p>
          </div>
          <button
            className="paper-button inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
            type="button"
            onClick={onViewReplay}
          >
            <RotateCcw aria-hidden="true" size={14} />
            View Replay
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="paper-inset min-h-44 p-4">
            <div className="flex items-center gap-2">
              <Play aria-hidden="true" size={16} className="text-on-surface-variant" />
              <p className="paper-label text-on-surface-variant">K-line battlefield reserved</p>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-on-surface-variant">
              Agent runtime decisions stream into this arena while DeepBook Predict remains the execution venue.
            </p>
          </div>

          <div className="paper-inset p-4">
            <label className="paper-label text-on-surface-variant" htmlFor="selected-agent">
              Selected agent
            </label>
            <select
              className="paper-inset mt-2 w-full rounded-md px-3 py-2 font-display text-xs font-black uppercase text-on-surface"
              id="selected-agent"
              value={selectedAgent?.id ?? ""}
              onChange={(event) => onSelectAgent(event.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName}
                </option>
              ))}
            </select>

            <div className="mt-3 grid gap-2">
              <RuntimeMetric label="Runtime status" value={selectedAgent?.runtimeStatus ?? "unselected"} />
              <RuntimeMetric label="Exposure" value={selectedAgent?.exposureStatus ?? "none"} />
              <RuntimeMetric label="Trading wallet" value={selectedAgent?.tradingWalletAddress ?? "none"} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="paper-label text-on-surface-variant">Allowed actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {competition.allowedActions.map((action) => (
              <span className="paper-chip px-2 py-1" key={action}>
                {action}
              </span>
            ))}
          </div>
        </div>
      </div>

      <AgentActivityPanel
        executions={executions}
        intents={intents}
        riskDecisions={riskDecisions}
        tradingWallet={tradingWallet}
      />
    </section>
  );
}

interface RuntimeMetricProps {
  label: string;
  value: string;
}

function RuntimeMetric({ label, value }: RuntimeMetricProps) {
  return (
    <div className="min-w-0">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-bold text-on-surface">{value}</p>
    </div>
  );
}
