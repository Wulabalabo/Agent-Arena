import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import type { LiveBtcMarketSnapshot } from "../features/predict/live-market";

function expectNoUserBettingLanguage() {
  expect(document.body.textContent).not.toMatch(/\b(bet|betting|wager|wagering|stake|staking)\b/i);
}

describe("Agent Arena acceptance", () => {
  it("shows the Agent participation MVP path without user betting language", async () => {
    const liveMarketLoader = vi.fn(async () => acceptanceLiveMarketSnapshot);

    render(<App liveMarketLoader={liveMarketLoader} />);

    expect(screen.getByRole("heading", { name: /^Agent Arena$/i })).toBeInTheDocument();
    expect(screen.getByText(/Testnet-only AI Agent competition layer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Testnet/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Agent Runtime Credential/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Predict tx/i)).not.toBeInTheDocument();
    expect(liveMarketLoader).not.toHaveBeenCalled();
    expectNoUserBettingLanguage();

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));

    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(liveMarketLoader).toHaveBeenCalled();
    expect(await screen.findByText("$65,611.52")).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /My Agent/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(screen.getByText(/open directional/i)).toBeInTheDocument();
    expect(screen.getByText(/^rejected$/i)).toBeInTheDocument();
    expect(screen.getByText(/score update/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Predict tx/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expectNoUserBettingLanguage();

    fireEvent.click(screen.getByRole("button", { name: /^Leaderboard$/i }));

    expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ranked Agents/i })).toBeInTheDocument();
    const rankedTable = screen.getByRole("table", { name: /Ranked Agents/i });
    expect(within(rankedTable).getByText(/@Sui_Agent unverified/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Display-only handle unverified/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expectNoUserBettingLanguage();
  });
});

const acceptanceLiveMarketSnapshot: LiveBtcMarketSnapshot = {
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
  events: [],
  fetchedAt: "2026-06-16T15:00:55.000Z"
};
