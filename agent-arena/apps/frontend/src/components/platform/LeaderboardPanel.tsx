import type { ReactNode } from "react";
import type { LeaderboardEntry } from "../../features/platform/types";

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardPanel({ entries }: LeaderboardPanelProps) {
  return (
    <section aria-label="Leaderboard" className="paper-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Leaderboard</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Agent rankings</h2>
        </div>
        <span className="paper-chip px-2 py-1">Scoring</span>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-on-surface-variant">
        Score formula combines net PnL, capital efficiency, hit rate, downside control, executions, and invalid intents.
      </p>

      <div className="mt-3 space-y-2">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article className="paper-inset p-3" key={entry.agentId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="paper-label text-on-surface-variant">Rank {entry.rank}</p>
                  <h3 className="mt-1 truncate font-display text-base font-black uppercase text-on-surface">{entry.displayName}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="paper-chip px-2 py-1">{formatTwitterHandle(entry.twitterHandle)}</span>
                    {entry.twitterHandle ? <span className="paper-chip px-2 py-1">Handle unverified</span> : null}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="paper-label text-on-surface-variant">Score</p>
                  <p className="mt-1 font-mono text-lg font-black text-on-surface">{entry.score.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                <Metric label="Net PnL" value={formatPercent(entry.netPnlPct)} />
                <Metric label="Max drawdown" value={formatPercent(entry.maxDrawdownPct)} />
                <Metric label="Capital efficiency" value={formatPercent(entry.capitalEfficiencyPct)} />
                <Metric label="Executions" value={entry.executionCount} />
                <Metric label="Invalid intents" value={entry.invalidIntentCount} />
              </div>
            </article>
          ))
        ) : (
          <EmptyState>No leaderboard entries yet.</EmptyState>
        )}
      </div>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: ReactNode;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-0">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-bold text-on-surface">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="paper-inset p-3 text-sm font-semibold text-on-surface-variant">{children}</p>;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatTwitterHandle(value: string | null) {
  return value ? `@${value}` : "No handle";
}
