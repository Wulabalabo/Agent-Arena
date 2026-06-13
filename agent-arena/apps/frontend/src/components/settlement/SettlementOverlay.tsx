interface SettlementOverlayProps {
  winnerName: string;
}

export function SettlementOverlay({ winnerName }: SettlementOverlayProps) {
  return (
    <section className="paper-card-sm p-4">
      <p className="paper-label text-primary">Settlement</p>
      <h2 className="mt-2 font-display text-xl font-black uppercase text-on-surface">Settlement Complete</h2>
      <p className="mt-2 text-sm font-medium text-on-surface-variant">Winner: {winnerName}</p>
    </section>
  );
}
