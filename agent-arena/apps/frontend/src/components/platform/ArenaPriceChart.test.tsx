import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import { ArenaPriceChart } from "./ArenaPriceChart";

describe("ArenaPriceChart", () => {
  it("updates the reference trace when BTC price changes", async () => {
    const { rerender } = render(
      <ArenaPriceChart error={null} snapshot={createSnapshot(65_611.52, "2026-06-16T15:00:54.893Z")} status="ready" />
    );

    const initialPath = await readTracePath();

    rerender(
      <ArenaPriceChart error={null} snapshot={createSnapshot(65_705.88, "2026-06-16T15:00:55.393Z")} status="ready" />
    );

    await waitFor(async () => {
      expect(await readTracePath()).not.toBe(initialPath);
    });
    expect(screen.getByText("$65,705.88")).toBeInTheDocument();
  });
});

async function readTracePath(): Promise<string> {
  await waitFor(() => {
    expect(screen.getByTestId("btc-reference-trace")).toHaveAttribute("d");
  });
  return screen.getByTestId("btc-reference-trace").getAttribute("d") ?? "";
}

function createSnapshot(spot: number, updatedAt: string): LiveBtcMarketSnapshot {
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
      forward: spot - 0.33,
      updatedAt,
      checkpoint: 349166156
    },
    currentOracleTradeCount: 1,
    events: [],
    fetchedAt: updatedAt
  };
}
