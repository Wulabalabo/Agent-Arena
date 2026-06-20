import { useEffect, useRef, useState } from "react";
import type { LiveBtcMarketSnapshot } from "./live-market";

export type LiveBtcMarketStatus = "idle" | "loading" | "ready" | "error";

interface UseLiveBtcMarketSnapshotOptions {
  loader: () => Promise<LiveBtcMarketSnapshot>;
  refreshLoader?: (snapshot: LiveBtcMarketSnapshot) => Promise<LiveBtcMarketSnapshot>;
  pollIntervalMs?: number;
  fullRefreshEveryMs?: number;
  enabled?: boolean;
}

interface UseLiveBtcMarketSnapshotResult {
  snapshot: LiveBtcMarketSnapshot | null;
  status: LiveBtcMarketStatus;
  error: string | null;
}

export function useLiveBtcMarketSnapshot({
  loader,
  refreshLoader,
  pollIntervalMs = 500,
  fullRefreshEveryMs = 5_000,
  enabled = true
}: UseLiveBtcMarketSnapshotOptions): UseLiveBtcMarketSnapshotResult {
  const [snapshot, setSnapshot] = useState<LiveBtcMarketSnapshot | null>(null);
  const [status, setStatus] = useState<LiveBtcMarketStatus>(enabled ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef<LiveBtcMarketSnapshot | null>(null);
  const lastFullRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let inFlight = false;

    async function refresh() {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const currentSnapshot = snapshotRef.current;
        const shouldRunFullRefresh =
          !currentSnapshot ||
          !refreshLoader ||
          Date.now() - lastFullRefreshAtRef.current >= fullRefreshEveryMs;
        const nextSnapshot = shouldRunFullRefresh
          ? await loader()
          : await refreshLoader(currentSnapshot);

        if (!cancelled) {
          if (shouldRunFullRefresh) {
            lastFullRefreshAtRef.current = Date.now();
          }

          snapshotRef.current = nextSnapshot;
          setSnapshot(nextSnapshot);
          setStatus("ready");
          setError(null);
        }
      } catch (unknownError) {
        if (!cancelled) {
          setStatus("error");
          setError(unknownError instanceof Error ? unknownError.message : "Predict market refresh failed");
        }
      } finally {
        inFlight = false;
      }
    }

    void refresh();
    const intervalId = window.setInterval(refresh, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, fullRefreshEveryMs, loader, pollIntervalMs, refreshLoader]);

  return { snapshot, status, error };
}
