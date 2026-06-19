import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveBtcMarketSnapshot } from "./features/predict/live-market";

vi.mock("./components/platform/SuiDappKitAgentClaimPanel", async () => {
  const { AgentClaimPanel } = await vi.importActual<typeof import("./components/platform/AgentClaimPanel")>(
    "./components/platform/AgentClaimPanel"
  );
  return {
    SuiDappKitAgentClaimPanel: (props: {
      apiBaseUrl: string;
      fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
      registrationCode: string;
    }) => (
      <AgentClaimPanel
        {...props}
        claimButtonLabel="Claim"
        connectedWalletAddress="0xowner"
        manualClaimEnabled={false}
        missingWalletMessage="Connect owner wallet in the top menu before claiming."
        walletProvider={{
          getAccounts: () => [{ address: "0xowner" }],
          signPersonalMessage: async () => ({ signature: "0xmock-global-signature" })
        }}
      />
    )
  };
});

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("defaults to the Arena page", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Lobby$/i })).not.toBeInTheDocument();
  });

  it("shows the join prompt when no owner wallet is connected", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Copy Agent prompt/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /My Agent profile/i })).not.toBeInTheDocument();
  });

  it("shows the join prompt when the connected owner has no bound Agent", async () => {
    render(<App connectedOwnerAddress="0xunbound_owner" />);

    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Copy Agent prompt/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /My Agent profile/i })).not.toBeInTheDocument();
  });

  it("navigates between Arena and Leaderboard only", async () => {
    const liveMarketLoader = vi.fn(async () => appLiveMarketSnapshot);
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/public-feed")) {
        return new Response(JSON.stringify({
          agents: [
            {
              id: "agent_real",
              displayName: "Live Ranger",
              twitterHandle: null,
              twitterVerified: false
            }
          ],
          intents: [
            {
              id: "intent_real",
              competitionId: "btc-15m-001",
              agentId: "agent_real",
              idempotencyKey: "real-feed-1",
              action: "open_directional",
              status: "executed",
              confidence: 0.78,
              reason: "Real feed item from the platform API.",
              rejectionCode: null,
              createdAt: "2026-06-16T15:02:00.000Z",
              market: {
                kind: "directional",
                oracleId: "0xfuture-nearest",
                expiry: "1781622900000",
                strike: "65700000000000",
                isUp: false
              },
              quantity: "7",
              maxCost: "3.50"
            }
          ],
          executions: [],
          leaderboard: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ marketState: appMarketState }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    render(<App connectedOwnerAddress="0xowner" liveMarketLoader={liveMarketLoader} platformFetcher={platformFetcher} />);

    expect(screen.queryByRole("button", { name: /^Lobby$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Arena$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Wallet$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Replay$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skills$/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(liveMarketLoader).toHaveBeenCalled();
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith(
        "http://127.0.0.1:8787/api/arena/competition/btc-15m-001/market-state"
      );
    });
    expect(await screen.findByTestId("btc-current-price-label")).toHaveTextContent("$65,611.52");
    expect(screen.getByTestId("btc-strike-line")).toBeInTheDocument();
    expect(screen.getByText("Strike")).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    const myAgentProfile = screen.getByRole("region", { name: /My Agent profile/i });
    expect(within(myAgentProfile).getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText(/UP 65000000000000/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText(/18.42%/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText("intent_1")).toBeInTheDocument();
    expect(within(myAgentProfile).getByText("exec_1")).toBeInTheDocument();
    expect(within(myAgentProfile).getByText("0xmock_exec_1")).toBeInTheDocument();
    expect(within(myAgentProfile).getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(await screen.findByText("Live Ranger bought DOWN")).toBeInTheDocument();
    expect(screen.getByText(/Qty 7 \/ Max cost 3.50/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Leaderboard$/i }));
    expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ranked Agents/i })).toBeInTheDocument();
  });

  it("clears the hidden claim URL when primary nav is used", () => {
    window.history.pushState({}, "", "/agent-arena/claim/PAIR-2050");

    render(<App />);

    expect(screen.getByLabelText(/Registration code/i)).toHaveValue("PAIR-2050");

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));

    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Registration code/i)).not.toBeInTheDocument();
  });

  it("clears the hidden claim URL when same-view Arena nav is used", () => {
    window.history.pushState({}, "", "/agent-arena/claim/PAIR-2050");

    render(<App />);

    expect(screen.getByLabelText(/Registration code/i)).toHaveValue("PAIR-2050");

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));

    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Registration code/i)).not.toBeInTheDocument();
  });

  it("claims an Agent from the owner-facing claim URL", async () => {
    window.history.pushState({}, "", "/agent-arena/claim/PAIR-2050");
    const platformFetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: {
        id: "agent_2050",
        displayName: "Claimed Agent",
        twitterHandle: "Sui_Agent",
        twitterVerified: false,
        ownerAddress: "0xowner",
        tradingWalletAddress: "0xwallet",
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-18T02:00:00.000Z"
      },
      tradingWallet: {
        id: "wallet_2050",
        agentId: "agent_2050",
        address: "0xwallet",
        status: "active",
        testnetSuiBalance: "0",
        quoteBalance: "0",
        predictManagerStatus: "missing",
        predictManagerId: null
      },
      runtimeCredential: {
        token: "agent_runtime_claimed",
        shownOnce: true,
        scopes: ["competition:read"]
      }
    }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));

    render(<App platformFetcher={platformFetcher} />);

    expect(screen.getByLabelText(/Registration code/i)).toHaveValue("PAIR-2050");
    expect(screen.queryByLabelText(/Owner wallet address/i)).not.toBeInTheDocument();
    expect(screen.getByText("0xowner")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Twitter handle/i), {
      target: { value: "@Sui_Agent" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^Claim$/i }));

    expect(await screen.findByText("agent_runtime_claimed")).toBeInTheDocument();
    expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        registrationCode: "PAIR-2050",
        ownerAddress: "0xowner",
        signature: "0xmock-global-signature",
        twitterHandle: "@Sui_Agent"
      })
    }));
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

const appMarketState = {
  allowedActions: ["hold", "open_directional"],
  allowedOperations: {
    canClose: true,
    canHold: true,
    canOpen: true,
    canReduce: true
  },
  competitionId: "btc-15m-001",
  executableMarkets: {
    directional: {
      expiry: "1781622900000",
      oracleId: "0xfuture-nearest",
      strike: "65700000000000"
    }
  },
  expiryMs: "1781622900000",
  fetchedAt: "2026-06-16T15:00:55.000Z",
  forwardPriceRaw: "65611186326705",
  lateWindow: {
    isFinalMinute: false,
    openAllowedByPlatform: true,
    openMayFailOnPredictQuote: true
  },
  oracleId: "0xfuture-nearest",
  oracleStatus: "active",
  priceDecimals: 9,
  serverTimeMs: "1781622000000",
  spotPriceRaw: "65611517258518",
  status: "live",
  strikeGrid: {
    maxStrikeRaw: "80000000000000",
    minStrikeRaw: "50000000000000",
    strikeStepRaw: "1000000000"
  },
  timeToExpiryMs: "900000",
  underlyingAsset: "BTC"
};
