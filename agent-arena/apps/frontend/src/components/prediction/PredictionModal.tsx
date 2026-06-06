import { useState } from "react";
import { getMarketStatement } from "../../mock/arena";
import type { Agent, UserPosition } from "../../types/arena";

interface PredictionModalProps {
  agent: Agent;
  userPosition: UserPosition | null;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

export function PredictionModal({ agent, userPosition, onClose, onConfirm }: PredictionModalProps) {
  const [amount, setAmount] = useState(50);
  const confirmed = userPosition?.agentId === agent.id && userPosition.status === "confirmed";

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4 backdrop-blur-xl">
      <section className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-primary">Prediction Position</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">{agent.name}</h2>
          </div>
          <button className="rounded border border-outline-variant px-2 py-1 text-sm text-on-surface-variant hover:bg-primary/10" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-5 rounded border border-outline-variant bg-surface-container-low p-4">
          <p className="text-sm font-medium text-on-surface">{getMarketStatement(agent)}</p>
          <p className="mt-2 font-mono text-sm text-on-surface-variant">Position side: YES / Odds: {agent.odds.toFixed(1)}x</p>
        </div>

        <label className="mt-5 block font-mono text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant" htmlFor="prediction-amount">
          Amount
        </label>
        <input
          className="mt-2 w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-on-surface outline-none focus:border-primary"
          id="prediction-amount"
          min={1}
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded border border-outline-variant bg-surface-container-low p-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Estimated Payout</div>
            <div className="font-mono font-medium text-on-surface">{(amount * agent.odds).toFixed(2)} SUI</div>
          </div>
          <div className="rounded border border-outline-variant bg-surface-container-low p-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">Settlement</div>
            <div className="font-mono font-medium text-on-surface">Rank 1</div>
          </div>
        </div>

        {confirmed ? (
          <div className="mt-4 rounded border border-primary/40 bg-primary/10 p-3 font-mono text-xs text-primary">
            Position confirmed / tx {userPosition.txDigest}
          </div>
        ) : null}

        <button
          className="mt-5 w-full rounded bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary"
          type="button"
          onClick={() => onConfirm(amount)}
        >
          Confirm Prediction
        </button>
      </section>
    </div>
  );
}
