import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { createPublicActionFeedItems, createUserAgentArenaProfile } from "../../features/platform/arena-ui";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import { ArenaPage } from "./ArenaPage";

describe("ArenaPage", () => {
  it("renders chart, current Agent profile, and public action feed", () => {
    render(
      <ArenaPage
        competition={mockPlatformSnapshot.competitions[0]}
        liveMarketSnapshot={liveMarketSnapshot}
        liveMarketStatus="ready"
        liveMarketError={null}
        userAgentProfile={createUserAgentArenaProfile({
          agent: mockPlatformSnapshot.agents[0],
          tradingWallet: mockPlatformSnapshot.tradingWallet,
          positions: mockPlatformSnapshot.positions,
          intents: mockPlatformSnapshot.intents,
          executions: mockPlatformSnapshot.executions,
          leaderboard: mockPlatformSnapshot.leaderboard
        })}
        actionFeedItems={createPublicActionFeedItems({
          agents: mockPlatformSnapshot.agents,
          intents: mockPlatformSnapshot.intents,
          executions: mockPlatformSnapshot.executions,
          leaderboard: mockPlatformSnapshot.leaderboard
        })}
      />
    );

    expect(screen.getByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/BTC reference chart/i)).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /My Agent/i })).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/UP 65000000000000/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(screen.getByText(/open directional/i)).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/score update/i)).toBeInTheDocument();
  });
});

const liveMarketSnapshot: LiveBtcMarketSnapshot = {
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
    spot: 65611.517258518,
    forward: 65611.186326705,
    updatedAt: "2026-06-16T15:00:54.893Z",
    checkpoint: 349166156
  },
  currentOracleTradeCount: 1,
  events: [],
  fetchedAt: "2026-06-16T15:00:55.000Z"
};
