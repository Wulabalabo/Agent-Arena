import { render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveBtcMarketSnapshot } from "./live-market";
import { useLiveBtcMarketSnapshot } from "./use-live-btc-market";

function makeSnapshot(serverTime: string, spot: number): LiveBtcMarketSnapshot {
  return {
    health: "ready",
    serverStatus: "OK",
    serverTime,
    serverTimeMs: Date.parse(serverTime),
    predictId: "0xpredict",
    quoteAssetLabel: "DUSDC",
    oracleCounts: {
      activeFutureBtc: 1,
      activeTotal: 1,
      total: 1
    },
    oracle: {
      oracleId: "0xoracle",
      underlyingAsset: "BTC",
      expiryMs: Date.parse("2026-06-16T15:15:00.000Z"),
      expiresAt: "2026-06-16T15:15:00.000Z",
      secondsToExpiry: 900,
      status: "active"
    },
    price: {
      spot,
      forward: spot - 1,
      updatedAt: serverTime,
      checkpoint: 349166000
    },
    currentOracleTradeCount: 0,
    events: [],
    fetchedAt: serverTime
  };
}

function Probe({
  loader,
  refreshLoader
}: {
  loader: () => Promise<LiveBtcMarketSnapshot>;
  refreshLoader?: (snapshot: LiveBtcMarketSnapshot) => Promise<LiveBtcMarketSnapshot>;
}) {
  const { snapshot, status } = useLiveBtcMarketSnapshot({
    fullRefreshEveryMs: 5_000,
    loader,
    pollIntervalMs: 500,
    refreshLoader
  });

  return (
    <div>
      <p>{status}</p>
      <p>{snapshot?.price?.spot ?? "none"}</p>
    </div>
  );
}

describe("useLiveBtcMarketSnapshot", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads immediately and refreshes on the configured interval", async () => {
    vi.useFakeTimers();
    const loader = vi
      .fn<() => Promise<LiveBtcMarketSnapshot>>()
      .mockResolvedValueOnce(makeSnapshot("2026-06-16T15:00:00.000Z", 65600))
      .mockResolvedValueOnce(makeSnapshot("2026-06-16T15:00:00.500Z", 65601));

    render(<Probe loader={loader} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("65600")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("65601")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("uses the lightweight refresh loader on interval before the next full refresh window", async () => {
    vi.useFakeTimers();
    const loader = vi.fn<() => Promise<LiveBtcMarketSnapshot>>().mockResolvedValue(
      makeSnapshot("2026-06-16T15:00:00.000Z", 65600)
    );
    const refreshLoader = vi
      .fn<(snapshot: LiveBtcMarketSnapshot) => Promise<LiveBtcMarketSnapshot>>()
      .mockResolvedValue(makeSnapshot("2026-06-16T15:00:00.500Z", 65601));

    render(<Probe loader={loader} refreshLoader={refreshLoader} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("65601")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(refreshLoader).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous snapshot when a refresh fails", async () => {
    vi.useFakeTimers();
    const loader = vi
      .fn<() => Promise<LiveBtcMarketSnapshot>>()
      .mockResolvedValueOnce(makeSnapshot("2026-06-16T15:00:00.000Z", 65600))
      .mockRejectedValueOnce(new Error("predict offline"));

    render(<Probe loader={loader} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("65600")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("65600")).toBeInTheDocument();
  });
});
