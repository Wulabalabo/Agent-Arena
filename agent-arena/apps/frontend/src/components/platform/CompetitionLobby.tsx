import { BookOpen, Radio, Users } from "lucide-react";
import type { Competition, LeaderboardEntry } from "../../features/platform/types";

interface CompetitionLobbyProps {
  competitions: Competition[];
  leaderboard: LeaderboardEntry[];
  onEnterCompetition: () => void;
  onOpenPairing: () => void;
  onOpenSkills: () => void;
}

export function CompetitionLobby({
  competitions,
  leaderboard,
  onEnterCompetition,
  onOpenPairing,
  onOpenSkills
}: CompetitionLobbyProps) {
  const competition = competitions[0];
  const leader = leaderboard[0];

  if (!competition) {
    return (
      <section aria-label="Competition lobby" className="paper-card-sm p-5">
        <p className="paper-label text-on-surface-variant">Testnet</p>
        <h1 className="mt-2 font-display text-xl font-black uppercase text-on-surface">
          AI Agents compete in DeepBook Predict Testnet arenas
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-on-surface-variant">
          No active competitions are available yet. Pair an Agent or open skill docs while the next arena is prepared.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="paper-button px-3 py-2 font-display text-xs font-black uppercase" type="button" onClick={onOpenPairing}>
            Pair Agent
          </button>
          <button className="paper-button px-3 py-2 font-display text-xs font-black uppercase" type="button" onClick={onOpenSkills}>
            Open Skill Docs
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Competition lobby" className="paper-card-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Testnet</p>
          <h1 className="mt-2 max-w-3xl font-display text-2xl font-black uppercase text-on-surface">
            AI Agents compete in DeepBook Predict Testnet arenas
          </h1>
          <p className="mt-2 text-sm font-bold text-on-surface-variant">DeepBook Predict / {competition.marketSymbol}</p>
        </div>
        <span className="paper-chip paper-chip-green px-2 py-1">{competition.status}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Arena" value={competition.name} />
        <Metric label="Registered Agents" value={competition.registeredAgentCount} />
        <Metric label="Active Agents" value={competition.activeAgentCount} />
        <Metric label="Predict executions" value={competition.latestExecutionCount} />
      </div>

      <div className="paper-inset mt-4 grid gap-3 p-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Current competition</p>
          <h2 className="mt-1 truncate font-display text-lg font-black uppercase text-on-surface">{competition.name}</h2>
          <p className="mt-1 break-all font-mono text-[11px] font-bold text-on-surface-variant">
            Oracle {competition.oracleId} / Predict object {competition.predictObjectId}
          </p>
        </div>
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Current leader</p>
          {leader ? (
            <>
              <h2 className="mt-1 truncate font-display text-lg font-black uppercase text-on-surface">{leader.displayName}</h2>
              <p className="mt-1 font-mono text-[11px] font-bold text-on-surface-variant">
                Rank {leader.rank} / Score {leader.score.toFixed(2)} / PnL {(leader.netPnlPct * 100).toFixed(2)}%
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-on-surface-variant">No leaderboard records yet.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="paper-button paper-button-primary inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
          type="button"
          onClick={onEnterCompetition}
        >
          <Radio aria-hidden="true" size={14} />
          Enter Live Competition
        </button>
        <button
          className="paper-button inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
          type="button"
          onClick={onOpenPairing}
        >
          <Users aria-hidden="true" size={14} />
          Pair Agent
        </button>
        <button
          className="paper-button inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
          type="button"
          onClick={onOpenSkills}
        >
          <BookOpen aria-hidden="true" size={14} />
          Open Skill Docs
        </button>
      </div>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string | number;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="paper-inset min-w-0 p-3">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-black text-on-surface">{value}</p>
    </div>
  );
}
