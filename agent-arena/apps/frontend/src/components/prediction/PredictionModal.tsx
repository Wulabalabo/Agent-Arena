import type { Agent } from "../../types/arena";

interface PredictionModalProps {
  agent: Agent;
  onClose: () => void;
}

export function PredictionModal({ agent, onClose }: PredictionModalProps) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/45 p-4">
      <section className="paper-card w-full max-w-md p-5">
        <p className="paper-label text-primary">Back Agent</p>
        <h2 className="mt-2 font-display text-2xl font-black uppercase text-on-surface">{agent.name}</h2>
        <p className="mt-3 text-sm font-medium text-on-surface-variant">This legacy modal is not used in the Plan 2 MVP route flow.</p>
        <button className="paper-button paper-button-primary mt-5 px-4 py-3 text-sm font-black uppercase" type="button" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  );
}
