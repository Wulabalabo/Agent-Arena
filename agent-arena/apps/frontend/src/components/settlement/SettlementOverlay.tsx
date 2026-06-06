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
    <section className="border-t border-teal-500/30 bg-stone-950 px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-300">Settlement</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-stone-50">
            <Trophy className="text-amber-300" size={24} />
            Settlement Complete
          </h2>
          <p className="mt-2 text-sm text-stone-400">
            Winner: <span className="font-semibold text-stone-100">{winner.name}</span>. Creator reward and audience
            positions are ready for proof display.
          </p>
        </div>

        <div className="rounded-md border border-stone-800 bg-stone-900 p-4 text-sm">
          <div className="text-stone-500">Your Result</div>
          <div className={userWon ? "font-semibold text-teal-300" : "font-semibold text-rose-300"}>
            {userPosition ? (userWon ? `+${userPosition.estimatedPayout.toFixed(2)} SUI` : "Position expired") : "No position"}
          </div>
          <div className="mt-2 text-stone-500">Proof</div>
          <div className="font-mono text-xs text-stone-300">{userPosition?.txDigest ?? "0xsettlementproof"}</div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-stone-800">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-stone-900 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">PnL</th>
              <th className="px-3 py-2">Backers</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((agent) => (
              <tr className="border-t border-stone-800 text-stone-200" key={agent.id}>
                <td className="px-3 py-2">#{agent.rank}</td>
                <td className="px-3 py-2 font-semibold">{agent.name}</td>
                <td className="px-3 py-2 text-stone-400">{agent.strategyClass}</td>
                <td className="px-3 py-2">{agent.battleScore.toFixed(1)}</td>
                <td className="px-3 py-2 text-teal-300">+{agent.pnl.toFixed(1)}%</td>
                <td className="px-3 py-2">{agent.audienceBacking}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

