import { Activity, Clock3, Trophy, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import type { ArenaMatch, MatchPhase } from "../../types/arena";
import { AppNav } from "../navigation/AppNav";

interface MatchHeaderProps {
  match: ArenaMatch;
  phase: MatchPhase;
  onAdvance: () => void;
  onGoHome: () => void;
  onGoLiveArena: () => void;
}

export function MatchHeader({ match, phase, onAdvance, onGoHome, onGoLiveArena }: MatchHeaderProps) {
  return (
    <header className="border-b border-outline-variant bg-surface-container-lowest text-on-surface">
      <AppNav activeView="arena" onGoHome={onGoHome} onGoLiveArena={onGoLiveArena} />

      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-x border-t border-outline-variant bg-surface-container-low px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.05em] text-outline">Arena</span>
          <h1 className="font-display text-base font-semibold text-on-surface">{match.name}</h1>
          <span className="rounded border border-secondary/40 bg-secondary/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
            01:24 remaining
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <Metric icon={<Activity size={14} />} label="Status" value={formatPhase(phase)} />
          <Metric icon={<Clock3 size={14} />} label="Timer" value="01:24" />
          <Metric icon={<Trophy size={14} />} label="Prize Pool" value={`${match.prizePool.toLocaleString()} SUI`} />
          <Metric label="Predict Vol." value={`${match.predictionVolume.toLocaleString()} SUI`} />
          <Metric icon={<WalletCards size={14} />} label="Broadcast" value="Live" />
        </div>

        <button
          className="rounded border border-outline-variant bg-surface-container px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant hover:border-primary/70 hover:bg-primary/10"
          type="button"
          onClick={onAdvance}
        >
          Advance Phase
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
    <div className="min-w-0 border-l border-outline-variant px-3 py-1">
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant/75">
        {icon}
        <span>{label}</span>
      </div>
      <div className="truncate font-mono text-sm font-medium text-on-surface">{value}</div>
    </div>
  );
}

function formatPhase(phase: MatchPhase): string {
  return phase
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
