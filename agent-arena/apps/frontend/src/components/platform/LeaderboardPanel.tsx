import type { ReactNode } from "react";
import type { Competition, LeaderboardEntry } from "../../features/platform/types";

interface LeaderboardPanelProps {
  competition?: Competition;
  entries: LeaderboardEntry[];
}

export function LeaderboardPanel({ competition, entries }: LeaderboardPanelProps) {
  const sortedEntries = [...entries].sort(compareLeaderboardEntries);
  const topEntries = sortedEntries.slice(0, 3);

  return (
    <section aria-label="Leaderboard" className="grid gap-4">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="paper-label text-on-surface-variant">Leaderboard</p>
            <h1 className="mt-1 font-display text-3xl font-black uppercase text-on-surface">Leaderboard</h1>
            <p className="mt-2 break-words text-sm font-bold text-on-surface-variant">
              {competition?.name ?? "BTC 15m Arena"} / {formatStatus(competition?.status ?? "pending")} / {entries.length} ranked Agents
            </p>
            <p className="mt-3 max-w-3xl break-words text-xs font-semibold leading-5 text-on-surface-variant">
              Score formula combines net PnL, capital efficiency, hit rate, downside control, executions, and invalid intents.
            </p>
          </div>
          <span className="paper-chip paper-chip-green px-2 py-1">Testnet season</span>
        </div>
      </div>

      <section aria-label="Top Agents" className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <h2 className="font-display text-lg font-black uppercase text-on-surface">Top Agents</h2>
        </div>
        {topEntries.length > 0 ? (
          topEntries.map((entry, index) => (
            <article className="paper-card-sm p-4" key={entry.agentId}>
              <p className="paper-label text-on-surface-variant">Rank {index + 1}</p>
              <h3 className="mt-2 truncate font-display text-lg font-black uppercase text-on-surface">{entry.displayName}</h3>
              <p className="mt-2 font-mono text-sm font-black text-on-surface">{entry.score.toFixed(2)} score</p>
              <p className="mt-2 font-mono text-[11px] font-bold text-on-surface-variant">{formatPercent(entry.hitRatePct)} hit rate</p>
            </article>
          ))
        ) : (
          <EmptyState>No ranked Agents yet.</EmptyState>
        )}
      </section>

      <section aria-label="Ranked Agents" className="paper-card-sm overflow-hidden p-4">
        <h2 className="font-display text-lg font-black uppercase text-on-surface">Ranked Agents</h2>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <caption className="sr-only">Ranked Agents</caption>
            <thead>
              <tr className="border-b-2 border-black">
                <ColumnHeader>Rank</ColumnHeader>
                <ColumnHeader>Agent</ColumnHeader>
                <ColumnHeader>Score</ColumnHeader>
                <ColumnHeader>Net PnL</ColumnHeader>
                <ColumnHeader>Hit Rate</ColumnHeader>
                <ColumnHeader>Executions</ColumnHeader>
                <ColumnHeader>Invalid</ColumnHeader>
                <ColumnHeader>Exposure</ColumnHeader>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.length > 0 ? (
                sortedEntries.map((entry, index) => (
                  <tr className="border-b border-outline/50 last:border-b-0" key={entry.agentId}>
                    <Cell>#{index + 1}</Cell>
                    <Cell>
                      <span className="font-display font-black uppercase">{entry.displayName}</span>
                      <span className="mt-1 block font-mono text-[11px] text-on-surface-variant">{formatHandle(entry)}</span>
                      {entry.twitterHandle ? (
                        <span className="mt-1 block font-mono text-[11px] text-on-surface-variant">Display-only handle unverified</span>
                      ) : null}
                    </Cell>
                    <Cell>{entry.score.toFixed(2)}</Cell>
                    <Cell>{formatPercent(entry.netPnlPct)}</Cell>
                    <Cell>{formatPercent(entry.hitRatePct)}</Cell>
                    <Cell>{entry.executionCount}</Cell>
                    <Cell>{entry.invalidIntentCount}</Cell>
                    <Cell>{entry.currentExposureStatus ?? "flat"}</Cell>
                  </tr>
                ))
              ) : (
                <tr>
                  <Cell colSpan={8}>No ranked Agents yet.</Cell>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function compareLeaderboardEntries(left: LeaderboardEntry, right: LeaderboardEntry) {
  const scoreDelta = right.score - left.score;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const rankDelta = left.rank - right.rank;

  if (rankDelta !== 0) {
    return rankDelta;
  }

  const displayNameDelta = left.displayName.localeCompare(right.displayName);

  if (displayNameDelta !== 0) {
    return displayNameDelta;
  }

  return left.agentId.localeCompare(right.agentId);
}

interface CellProps {
  children: ReactNode;
  colSpan?: number;
}

function ColumnHeader({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-2 font-display text-xs font-black uppercase tracking-wide text-on-surface" scope="col">
      {children}
    </th>
  );
}

function Cell({ children, colSpan }: CellProps) {
  return (
    <td className="px-3 py-3 align-top font-mono text-xs font-bold text-on-surface" colSpan={colSpan}>
      {children}
    </td>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="paper-inset p-3 text-sm font-semibold text-on-surface-variant lg:col-span-3">{children}</p>;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatHandle(entry: LeaderboardEntry) {
  return entry.twitterHandle ? `@${entry.twitterHandle} unverified` : "No public handle";
}

function formatStatus(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
