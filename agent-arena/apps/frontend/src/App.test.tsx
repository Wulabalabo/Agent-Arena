import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LiveBtcMarketSnapshot } from "./features/predict/live-market";
import App from "./App";

describe("App", () => {
  it("defaults to the Agent competition console", () => {
    render(<App />);

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pair Agent/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back Agent$/i })).not.toBeInTheDocument();
  });

  it("navigates to pairing, wallet, leaderboard, replay, and skills", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Pair Agent/i }));
    expect(screen.getByText(/Registration code/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Wallet/i }));
    expect(screen.getByText(/Testnet trading wallet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Leaderboard/i }));
    expect(screen.getByText(/Score formula/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Replay/i }));
    expect(screen.getByText(/Intent submitted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Skills/i }));
    expect(screen.getByText(/agent-arena\/skills\/agent-arena.md/i)).toBeInTheDocument();
    expect(screen.getByText("Init: POST http://127.0.0.1:8787/api/arena/agent/init")).toBeInTheDocument();
  });

  it("loads live Predict market data into the competition console", async () => {
    render(<App liveMarketLoader={async () => appLiveMarketSnapshot} />);

    expect(await screen.findByText("$65,611.52")).toBeInTheDocument();
    expect(screen.getByText(/Position minted/i)).toBeInTheDocument();
  });
});

const appLiveMarketSnapshot: LiveBtcMarketSnapshot = {
  health: "ready",
  serverStatus: "OK",
  serverTime: "2026-06-16T15:00:00.000Z",
  serverTimeMs: 1781622000000,
  predictId: "0xpredict",
  quoteAssetLabel: "DUSDC",
  oracleCounts: {
    activeFutureBtc: 1,
    activeTotal: 1,
    total: 1
  },
  oracle: {
    oracleId: "0xfuture-nearest",
    underlyingAsset: "BTC",
    expiryMs: 1781622900000,
    expiresAt: "2026-06-16T15:15:00.000Z",
    secondsToExpiry: 900,
    status: "active"
  },
  price: {
    spot: 65611.517258518,
    forward: 65611.186326705,
    updatedAt: "2026-06-16T15:00:54.893Z",
    checkpoint: 349166156
  },
  currentOracleTradeCount: 1,
  events: [
    {
      id: "position_minted:mint_digest",
      kind: "position_minted",
      digest: "mint_digest",
      oracleId: "0xfuture-later",
      timestampMs: 1781622054000,
      timestamp: "2026-06-16T15:00:54.000Z",
      expiry: "2026-06-16T15:30:00.000Z",
      direction: "DOWN",
      strikeRaw: "65650000000000",
      strike: 65650,
      lowerStrikeRaw: null,
      lowerStrike: null,
      higherStrikeRaw: null,
      higherStrike: null,
      quantityRaw: "100000",
      quoteAmount: 0.008006,
      probabilityPrice: 0.080060678,
      settled: null
    }
  ],
  fetchedAt: "2026-06-16T15:00:55.000Z"
};
