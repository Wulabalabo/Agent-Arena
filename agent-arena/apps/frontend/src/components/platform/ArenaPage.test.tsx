import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import {
  createPublicActionFeedItems,
  createUserAgentArenaProfile,
  type PublicActionFeedItem,
  type UserAgentArenaProfile
} from "../../features/platform/arena-ui";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";
import { ArenaPage } from "./ArenaPage";

describe("ArenaPage", () => {
  it("renders chart, current Agent profile, and public action feed", () => {
    renderArenaPage();

    expect(screen.getByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/BTC reference chart/i)).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    expect(screen.getByText(/Active BTC price line/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /My Agent/i })).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/UP 65000000000000/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(screen.getByText(/open directional/i)).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/score update/i)).toBeInTheDocument();
  });

  it("renders a muted chart state when BTC reference data is unavailable", () => {
    renderArenaPage({
      liveMarketError: "Predict refresh failed",
      liveMarketSnapshot: null,
      liveMarketStatus: "error"
    });

    expect(screen.getAllByText(/Waiting for BTC reference data/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Active BTC price line/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Predict refresh failed/i)).toBeInTheDocument();
  });

  it("formats chart timestamps as UTC instead of slicing offset strings", () => {
    renderArenaPage({
      liveMarketSnapshot: {
        ...liveMarketSnapshot,
        oracle: liveMarketSnapshot.oracle
          ? {
            ...liveMarketSnapshot.oracle,
            expiresAt: "2026-06-16T23:15:00+08:00"
          }
          : null,
        price: liveMarketSnapshot.price
          ? {
            ...liveMarketSnapshot.price,
            updatedAt: "2026-06-16T23:00:00+08:00"
          }
          : null,
        fetchedAt: "2026-06-16T23:00:55+08:00"
      }
    });

    expect(screen.getByText("Updated 15:00:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("2026-06-16 15:15:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("Fetched 2026-06-16 15:00:55.000 UTC")).toBeInTheDocument();
    expect(screen.queryByText("Updated 23:00:00 UTC")).not.toBeInTheDocument();
  });

  it("renders the empty public feed state", () => {
    renderArenaPage({ actionFeedItems: [] });

    expect(screen.getByText("0 items")).toBeInTheDocument();
    expect(screen.getByText(/No public actions yet/i)).toBeInTheDocument();
  });

  it("renders no-claimed-Agent profile fallbacks", () => {
    renderArenaPage({
      userAgentProfile: createUserAgentArenaProfile({
        agent: null,
        tradingWallet: null,
        positions: [],
        intents: [],
        executions: [],
        leaderboard: []
      })
    });

    expect(screen.getAllByText(/No claimed Agent/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No active Agent/i)).toBeInTheDocument();

    const walletDetails = screen.getByRole("region", { name: /My Agent wallet details/i });
    expect(within(walletDetails).getByText(/Trading wallet:/i)).toBeInTheDocument();
    expect(within(walletDetails).getByText(/not created/i)).toBeInTheDocument();
  });

  it("renders partial feed statuses and score update details", () => {
    renderArenaPage({
      actionFeedItems: [
        {
          id: "feed_partial",
          timestamp: "2026-06-16T15:01:00.000Z",
          agentId: "agent_1",
          agentDisplayName: "Trend Ranger",
          action: "reduce",
          status: "partial",
          reason: "Partial fill confirmed before the oracle window closed."
        },
        {
          id: "feed_score",
          timestamp: "2026-06-16T15:02:00.000Z",
          agentId: "agent_1",
          agentDisplayName: "Trend Ranger",
          action: "score_update",
          status: "info",
          pnlDeltaPct: 0.0456,
          scoreDelta: 12.34
        }
      ]
    });

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByText("partial")).toBeInTheDocument();
    expect(screen.getByText(/score update/i)).toBeInTheDocument();
    expect(screen.getByText(/Score 12.34 \/ PnL 4.56%/i)).toBeInTheDocument();
  });
});

function renderArenaPage({
  actionFeedItems = createPublicActionFeedItems({
    agents: mockPlatformSnapshot.agents,
    intents: mockPlatformSnapshot.intents,
    executions: mockPlatformSnapshot.executions,
    leaderboard: mockPlatformSnapshot.leaderboard
  }),
  liveMarketError = null,
  liveMarketSnapshot: snapshot = liveMarketSnapshot,
  liveMarketStatus = "ready",
  userAgentProfile = createUserAgentArenaProfile({
    agent: mockPlatformSnapshot.agents[0],
    tradingWallet: mockPlatformSnapshot.tradingWallet,
    positions: mockPlatformSnapshot.positions,
    intents: mockPlatformSnapshot.intents,
    executions: mockPlatformSnapshot.executions,
    leaderboard: mockPlatformSnapshot.leaderboard
  })
}: {
  actionFeedItems?: PublicActionFeedItem[];
  liveMarketError?: string | null;
  liveMarketSnapshot?: LiveBtcMarketSnapshot | null;
  liveMarketStatus?: LiveBtcMarketStatus;
  userAgentProfile?: UserAgentArenaProfile;
} = {}) {
  render(
    <ArenaPage
      competition={mockPlatformSnapshot.competitions[0]}
      liveMarketSnapshot={snapshot}
      liveMarketStatus={liveMarketStatus}
      liveMarketError={liveMarketError}
      userAgentProfile={userAgentProfile}
      actionFeedItems={actionFeedItems}
    />
  );
}

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
