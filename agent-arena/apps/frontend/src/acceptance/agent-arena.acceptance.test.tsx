import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import type { LiveBtcMarketSnapshot } from "../features/predict/live-market";
import { mockPlatformSnapshot } from "../features/platform/mock";

function expectNoUserBettingLanguage() {
  expect(document.body.textContent).not.toMatch(/\b(bet|betting|wager|wagering|stake|staking)\b/i);
}

describe("Agent Arena acceptance", () => {
  it("shows the Agent participation MVP path without user betting language", async () => {
    const liveMarketLoader = vi.fn(async () => acceptanceLiveMarketSnapshot);
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/public-feed")) {
        return new Response(JSON.stringify({
          agents: mockPlatformSnapshot.agents,
          intents: mockPlatformSnapshot.intents,
          executions: mockPlatformSnapshot.executions,
          leaderboard: mockPlatformSnapshot.leaderboard
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ marketState: null }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    render(<App connectedOwnerAddress="0xowner" liveMarketLoader={liveMarketLoader} platformFetcher={platformFetcher} />);

    expect(screen.queryByRole("button", { name: /^Lobby$/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Testnet/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Agent Runtime Credential/i)).not.toBeInTheDocument();
    expectNoUserBettingLanguage();

    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(liveMarketLoader).toHaveBeenCalled();
    expect(await screen.findByTestId("btc-current-price-label")).toHaveTextContent("$65,611.52");
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /My Agent/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger bought UP/i)).toBeInTheDocument();
    expect(screen.getByText(/^rejected$/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger scored 28.49/i)).toBeInTheDocument();
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
