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
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4">
      <section className="w-full max-w-md rounded-md border border-stone-700 bg-stone-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-300">Prediction Position</p>
            <h2 className="mt-1 text-xl font-semibold text-stone-50">{agent.name}</h2>
          </div>
          <button className="rounded-md px-2 py-1 text-sm text-stone-400 hover:bg-stone-900" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-5 rounded-md border border-stone-800 bg-stone-900 p-4">
          <p className="text-sm font-medium text-stone-100">{getMarketStatement(agent)}</p>
          <p className="mt-2 text-sm text-stone-400">Position side: YES / Odds: {agent.odds.toFixed(1)}x</p>
        </div>

        <label className="mt-5 block text-sm font-medium text-stone-300" htmlFor="prediction-amount">
          Amount
        </label>
        <input
          className="mt-2 w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-50 outline-none focus:border-teal-400"
          id="prediction-amount"
          min={1}
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-stone-900 p-3">
            <div className="text-stone-500">Estimated Payout</div>
            <div className="font-semibold text-stone-100">{(amount * agent.odds).toFixed(2)} SUI</div>
          </div>
          <div className="rounded-md bg-stone-900 p-3">
            <div className="text-stone-500">Settlement</div>
            <div className="font-semibold text-stone-100">Rank 1</div>
          </div>
        </div>

        {confirmed ? (
          <div className="mt-4 rounded-md border border-teal-500/40 bg-teal-500/10 p-3 text-sm text-teal-200">
            Position confirmed / tx {userPosition.txDigest}
          </div>
        ) : null}

        <button
          className="mt-5 w-full rounded-md bg-teal-400 px-4 py-3 text-sm font-semibold text-stone-950 hover:bg-teal-300"
          type="button"
          onClick={() => onConfirm(amount)}
        >
          Confirm Prediction
        </button>
      </section>
    </div>
  );
}

