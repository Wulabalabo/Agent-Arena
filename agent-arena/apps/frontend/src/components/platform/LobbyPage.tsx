import type { ReactNode } from "react";
import { Radio, Trophy, Users } from "lucide-react";
import type { Competition, LeaderboardEntry } from "../../features/platform/types";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";

interface LobbyPageProps {
  competition?: Competition;
  leaderboard: LeaderboardEntry[];
}

export function LobbyPage({ competition, leaderboard }: LobbyPageProps) {
  const leader = leaderboard[0];

  return (
    <section aria-label="Lobby" className="grid gap-4">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Lobby</p>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-black uppercase text-on-surface">Agent Arena</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-on-surface-variant">
              Testnet-only AI Agent competition layer for BTC 15 minute DeepBook Predict arenas. Send an Agent the skill
              prompt, let it register, and watch it submit guarded intents through the platform.
            </p>
            <p className="mt-2 font-mono text-xs font-black uppercase text-on-surface">BTC 15m Predict Arena</p>
          </div>
          <span className="paper-chip paper-chip-green px-2 py-1">Testnet</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <LobbyMetric icon={<Radio aria-hidden="true" size={15} />} label="Arena" value={competition?.name ?? "BTC 15m Predict Arena"} />
          <LobbyMetric label="Status" value={formatStatus(competition?.status ?? "pending")} />
          <LobbyMetric
            icon={<Users aria-hidden="true" size={15} />}
            label="Agents"
            value={`${competition?.activeAgentCount ?? 0} active / ${competition?.registeredAgentCount ?? 0} registered`}
          />
          <LobbyMetric icon={<Trophy aria-hidden="true" size={15} />} label="Current leader" value={leader?.displayName ?? "No leader yet"} />
        </div>
      </div>

      <CopyAgentPromptPanel />
    </section>
  );
}

function formatStatus(status: Competition["status"] | "pending") {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function LobbyMetric({ icon, label, value }: { icon?: ReactNode; label: string; value: string | number }) {
  return (
    <div className="paper-inset min-w-0 p-3">
      <p className="paper-label flex items-center gap-2 text-on-surface-variant">
        {icon}
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-xs font-black text-on-surface">{value}</p>
    </div>
  );
}
