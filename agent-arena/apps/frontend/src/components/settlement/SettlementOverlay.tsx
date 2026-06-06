import { Trophy } from "lucide-react";
import { getSortedAgents } from "../../mock/arena";
import type { ArenaMatch, UserPosition } from "../../types/arena";

interface SettlementOverlayProps {
  match: ArenaMatch;
  winnerId: string;
  userPosition: UserPosition | null;
}

export function SettlementOverlay({ match, winnerId, userPosition }: SettlementOverlayProps) {
  const winner = match.agents.find((agent) => agent.id === winnerId) ?? getSortedAgents(match.agents, "leaderboard")[0];
  const leaderboard = getSortedAgents(match.agents, "leaderboard");
  const userWon = userPosition?.agentId === winner.id;

  return (
    <section className="border-t border-primary/30 bg-surface-container-low px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-primary">Settlement</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold text-on-surface">
            <Trophy className="text-secondary" size={24} />
            Settlement Complete
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Winner: <span className="font-semibold text-on-surface">{winner.name}</span>. Creator reward and audience
            positions are ready for proof display.
          </p>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface-container p-4 text-sm">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Your Result</div>
          <div className={userWon ? "font-mono font-medium text-success" : "font-mono font-medium text-error"}>
            {userPosition ? (userWon ? `+${userPosition.estimatedPayout.toFixed(2)} SUI` : "Position expired") : "No position"}
          </div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Proof</div>
          <div className="font-mono text-xs text-on-surface-variant">{userPosition?.txDigest ?? "0xsettlementproof"}</div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-outline-variant">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-surface-container text-xs uppercase text-outline">
            <tr>
              <th className="px-3 py-2 font-mono tracking-[0.05em]">Rank</th>
              <th className="px-3 py-2 font-mono tracking-[0.05em]">Agent</th>
              <th className="px-3 py-2 font-mono tracking-[0.05em]">Class</th>
              <th className="px-3 py-2 font-mono tracking-[0.05em]">Score</th>
              <th className="px-3 py-2 font-mono tracking-[0.05em]">PnL</th>
              <th className="px-3 py-2 font-mono tracking-[0.05em]">Backers</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((agent, index) => (
              <tr className={`${index % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low"} border-t border-outline-variant text-on-surface`} key={agent.id}>
                <td className="px-3 py-2 font-mono text-secondary">#{agent.rank}</td>
                <td className="px-3 py-2 font-semibold">{agent.name}</td>
                <td className="px-3 py-2 text-on-surface-variant">{agent.strategyClass}</td>
                <td className="px-3 py-2 font-mono">{agent.battleScore.toFixed(1)}</td>
                <td className="px-3 py-2 font-mono text-success">+{agent.pnl.toFixed(1)}%</td>
                <td className="px-3 py-2 font-mono">{agent.audienceBacking}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
