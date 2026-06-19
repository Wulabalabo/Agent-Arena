import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import { ArenaPriceChart } from "./ArenaPriceChart";

describe("ArenaPriceChart", () => {
  it("renders a clean line chart with price and time axes", async () => {
    render(
      <ArenaPriceChart error={null} snapshot={createSnapshot(65_611.52, "2026-06-16T15:00:54.893Z")} status="ready" />
    );

    expect(screen.getByRole("img", { name: /BTC price line chart/i })).toBeInTheDocument();
    expect(screen.getByTestId("btc-reference-line")).toHaveAttribute("stroke", "#f59e0b");
    expect(screen.getByTestId("btc-target-line")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getAllByTestId("btc-price-tick")).toHaveLength(4);
    expect(screen.getAllByTestId("btc-price-tick").every((tick) => tick.textContent?.startsWith("$"))).toBe(true);
    expect(screen.getAllByTestId("btc-time-tick")).toHaveLength(2);
    expect(screen.getAllByTestId("btc-time-tick").map((tick) => tick.textContent)).not.toContain("15:00:54 UTC");
    expect(screen.getByTestId("btc-current-price-label")).toHaveTextContent("$65,611.52");
    expect(screen.getByTestId("btc-current-time-label")).toHaveTextContent("15:00:54 UTC");
  });

  it("does not render a synthetic target when the forward price is unavailable", () => {
    render(
      <ArenaPriceChart
        error={null}
        snapshot={createSnapshot(65_611.52, "2026-06-16T15:00:54.893Z", null)}
        status="ready"
      />
    );

    expect(screen.queryByTestId("btc-target-line")).not.toBeInTheDocument();
    expect(screen.queryByText("Target")).not.toBeInTheDocument();
    expect(screen.getByTestId("btc-current-price-label")).toHaveTextContent("$65,611.52");
  });

  it("updates the reference trace when BTC price changes", async () => {
    const { rerender } = render(
      <ArenaPriceChart error={null} snapshot={createSnapshot(65_611.52, "2026-06-16T15:00:54.893Z")} status="ready" />
    );

    const initialPath = await readTracePath();
    const initialMarkerY = screen.getByTestId("btc-current-marker").getAttribute("cy");

    rerender(
      <ArenaPriceChart error={null} snapshot={createSnapshot(65_705.88, "2026-06-16T15:00:55.393Z")} status="ready" />
    );

    await waitFor(async () => {
      expect(await readTracePath()).not.toBe(initialPath);
    });
    await waitFor(() => {
      expect(screen.getByTestId("btc-current-marker").getAttribute("cy")).not.toBe(initialMarkerY);
    });
    expect(screen.getByTestId("btc-current-price-label")).toHaveTextContent("$65,705.88");
    expect(screen.getByTestId("btc-current-time-label")).toHaveTextContent("15:00:55 UTC");
  });
});

async function readTracePath(): Promise<string> {
  await waitFor(() => {
    expect(screen.getByTestId("btc-reference-line")).toHaveAttribute("d");
  });
  return screen.getByTestId("btc-reference-line").getAttribute("d") ?? "";
}

function createSnapshot(spot: number, updatedAt: string, forward: number | null = spot - 0.33): LiveBtcMarketSnapshot {
  return {
    health: "ready",
    serverStatus: "OK",
    serverTime: "2026-06-16T15:00:00.000Z",
    serverTimeMs: 1781622000000,
    predictId: "0xpredict",
    quoteAssetLabel: "DUSDC",
    oracleCounts: { activeFutureBtc: 1, activeTotal: 1, total: 1 },
    oracle: {
      oracleId: "0xfuture-nearest",
      underlyingAsset: "BTC",
      expiryMs: 1781622900000,
      expiresAt: "2026-06-16T15:15:00.000Z",
      secondsToExpiry: 900,
      status: "active"
    },
    price: {
      spot,
      forward,
      updatedAt,
      checkpoint: 349166156
    },
    currentOracleTradeCount: 1,
    events: [],
    fetchedAt: updatedAt
  };
}
