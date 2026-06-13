import type { ArenaRound } from "../../types/arena";

interface MatchHeaderProps {
  round: ArenaRound;
}

export function MatchHeader({ round }: MatchHeaderProps) {
  return (
    <header className="rounded border border-outline-variant bg-surface-container-low p-4">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-primary">Live Arena</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-on-surface">
        {round.marketSymbol} {round.durationLabel}
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">Status: {round.status}</p>
    </header>
  );
}
