import { Activity, Clock3, Trophy, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import type { ArenaMatch, MatchPhase } from "../../types/arena";

interface MatchHeaderProps {
  match: ArenaMatch;
  phase: MatchPhase;
  onAdvance: () => void;
  onSettle: () => void;
}

export function MatchHeader({ match, phase, onAdvance, onSettle }: MatchHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-stone-800 bg-stone-950/95 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase text-teal-300">Sui Testnet / DeepBook Predict</p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-50">{match.name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
        <Metric icon={<Activity size={16} />} label="Phase" value={formatPhase(phase)} />
        <Metric icon={<Clock3 size={16} />} label="Ends In" value="03:42" />
        <Metric icon={<Trophy size={16} />} label="Prize Pool" value={`${match.prizePool.toLocaleString()} SUI`} />
        <Metric label="Predict Vol." value={`${match.predictionVolume.toLocaleString()} SUI`} />
        <Metric icon={<WalletCards size={16} />} label="Wallet" value="0xA11...B7" />
      </div>

      <div className="flex gap-2">
        <button
          className="rounded-md border border-stone-700 px-3 py-2 text-sm text-stone-200 hover:border-teal-400"
          type="button"
          onClick={onAdvance}
        >
          Advance Phase
        </button>
        <button
          className="rounded-md bg-teal-400 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-teal-300"
          type="button"
          onClick={onSettle}
        >
          Settle Match
        </button>
      </div>
    </header>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-stone-800 bg-stone-900 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-stone-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="truncate text-sm font-semibold text-stone-100">{value}</div>
    </div>
  );
}

function formatPhase(phase: MatchPhase): string {
  return phase
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
