import { useState } from "react";
import { predictConfig } from "../../features/predict/config";
import { createPredictClient } from "../../features/predict/client";
import { loadPredictTestnetSnapshot, type PredictTestnetSnapshot } from "../../features/predict/snapshot";

interface TestnetStatusPanelProps {
  loadSnapshot?: () => Promise<PredictTestnetSnapshot>;
}

const defaultLoadSnapshot = () =>
  loadPredictTestnetSnapshot({
    client: createPredictClient({ serverUrl: predictConfig.serverUrl }),
    config: predictConfig
  });

export function TestnetStatusPanel({ loadSnapshot = defaultLoadSnapshot }: TestnetStatusPanelProps) {
  const [snapshot, setSnapshot] = useState<PredictTestnetSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setSnapshot(await loadSnapshot());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Predict testnet refresh failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="paper-card-sm p-4" aria-label="Predict testnet status">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="paper-label text-primary">Read-only testnet</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Predict server</h2>
        </div>
        <span className={`paper-chip px-2 py-1 ${snapshot?.health === "ready" ? "paper-chip-green" : "paper-chip-red"}`}>
          {snapshot?.health === "ready" ? "Ready" : "Manual"}
        </span>
      </div>

      <div className="paper-inset mt-3 p-3 text-sm font-medium text-on-surface-variant">
        {snapshot ? (
          <div className="grid gap-2">
            <div className="font-display text-xs font-black uppercase text-on-surface">Server {snapshot.serverStatus}</div>
            <div>
              {snapshot.activeOracle
                ? `${snapshot.activeOracle.underlyingAsset} active oracle`
                : "No active oracle"}
            </div>
            <div>
              Active {snapshot.oracleCounts.active} / Settled {snapshot.oracleCounts.settled} / Total{" "}
              {snapshot.oracleCounts.total}
            </div>
            <div className="font-mono text-[10px]">Quote {snapshot.quoteAssetLabel} / {snapshot.updatedAt}</div>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="font-display text-xs font-black uppercase text-on-surface">Server not loaded</div>
            <div>Uses the public Predict server and does not submit wallet transactions.</div>
          </div>
        )}
        {error ? <div className="mt-2 text-error">{error}</div> : null}
      </div>

      <button
        className="paper-button mt-3 w-full px-4 py-3 font-display text-xs font-black uppercase"
        disabled={isLoading}
        type="button"
        onClick={handleRefresh}
      >
        {isLoading ? "Refreshing..." : "Refresh Predict testnet"}
      </button>
    </section>
  );
}
