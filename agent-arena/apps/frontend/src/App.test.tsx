import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        connectedWalletAddress="0x0000000000000000000000000000000000000000000000000000000000000bad"
        manualClaimEnabled={false}
        missingWalletMessage="Connect owner wallet in the top menu before claiming."
        walletProvider={{
          getAccounts: () => [{
            address: "0x0000000000000000000000000000000000000000000000000000000000000bad"
          }],
          signAndExecuteTransaction: async () => ({ digest: "0xclaimdigest" })
        }}
      />
    )
  };
});

import App from "./App";
import { mockPlatformSnapshot } from "./features/platform/mock";

const testOwnerAddress = "0x0000000000000000000000000000000000000000000000000000000000000bad";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("loads a connected owner Agent profile from the platform API", async () => {
    const liveMarketLoader = vi.fn(async () => appLiveMarketSnapshot);
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.includes("/owner/agent?")) {
        return jsonResponse({
          agent: {
            ...mockPlatformSnapshot.agents[0],
            id: "agent_real_owner",
            displayName: "Real Bound Agent",
            ownerAddress: "0xreal_owner",
            tradingWalletAddress: "0xreal_agent_wallet",
            exposureStatus: "flat"
          },
          tradingWallet: {
            ...mockPlatformSnapshot.tradingWallet,
            id: "wallet_real_owner",
            agentId: "agent_real_owner",
            address: "0xreal_agent_wallet"
          },
          positions: [],
          intents: [],
          executions: [],
          leaderboard: []
        });
      }

      if (url.includes("/public-feed")) {
        return jsonResponse({
          agents: [],
          intents: [],
          executions: [],
          leaderboard: []
        });
      }

      return jsonResponse({ marketState: appMarketState });
    });

    render(<App connectedOwnerAddress="0xreal_owner" liveMarketLoader={liveMarketLoader} platformFetcher={platformFetcher} />);

    const myAgentProfile = await screen.findByRole("region", { name: /My Agent profile/i });
    expect(within(myAgentProfile).getByText(/Real Bound Agent/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Copy Agent prompt/i)).not.toBeInTheDocument();
    expect(platformFetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/api/arena/owner/agent?ownerAddress=0xreal_owner"
    );
  });

  it("navigates between Arena and Leaderboard only", async () => {
    const liveMarketLoader = vi.fn(async () => appLiveMarketSnapshot);
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.includes("/owner/agent?")) {
        return createMockOwnerAgentProfileResponse();
      }

      if (url.includes("/public-feed")) {
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
    expect(screen.getByText("Strike $65,700.00")).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    const myAgentProfile = screen.getByRole("region", { name: /My Agent profile/i });
    expect(within(myAgentProfile).getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText(/UP \$65,000.00/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText(/18.42%/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText(/BTC 15m Testnet Arena/i)).toBeInTheDocument();
    expect(within(myAgentProfile).getByText(/^live$/i)).toBeInTheDocument();
    expect(within(myAgentProfile).queryByRole("region", { name: /My Agent wallet details/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(await screen.findByText("Live Ranger bought DOWN")).toBeInTheDocument();
    expect(screen.getByText(/Qty 7 \/ Max cost 3.50/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Leaderboard$/i }));
    expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ranked Agents/i })).toBeInTheDocument();
  });

  it("does not show mock public actions when the public feed endpoint is unavailable", async () => {
    const liveMarketLoader = vi.fn(async () => appLiveMarketSnapshot);
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.includes("/owner/agent?")) {
        return createMockOwnerAgentProfileResponse();
      }

      if (url.includes("/public-feed")) {
        return new Response(JSON.stringify({
          error: {
            code: "NOT_FOUND",
            message: "Route not found"
          }
        }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ marketState: appMarketState }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    render(<App connectedOwnerAddress="0xowner" liveMarketLoader={liveMarketLoader} platformFetcher={platformFetcher} />);

    await waitFor(() => {
      expect(countPlatformCalls(platformFetcher, "/public-feed")).toBe(1);
    });

    expect(screen.getByText("No public actions yet.")).toBeInTheDocument();
    expect(screen.queryByText("Trend Ranger bought UP")).not.toBeInTheDocument();
    expect(screen.queryByText("Range Scout bought range 64000000000000-66000000000000")).not.toBeInTheDocument();
  });

  it("refreshes public action feed less frequently than market state", async () => {
    vi.useFakeTimers();
    const liveMarketLoader = vi.fn(async () => appLiveMarketSnapshot);
    let publicFeedRequestCount = 0;
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.includes("/owner/agent?")) {
        return createMockOwnerAgentProfileResponse();
      }

      if (url.includes("/public-feed")) {
        publicFeedRequestCount += 1;
        const isFirstFeed = publicFeedRequestCount === 1;

        return new Response(JSON.stringify({
          agents: [
            {
              id: "agent_refresh",
              displayName: isFirstFeed ? "Pulse One" : "Pulse Two",
              twitterHandle: null,
              twitterVerified: false
            }
          ],
          intents: [
            {
              id: isFirstFeed ? "intent_refresh_1" : "intent_refresh_2",
              competitionId: "btc-15m-001",
              agentId: "agent_refresh",
              idempotencyKey: isFirstFeed ? "feed-refresh-1" : "feed-refresh-2",
              action: "open_directional",
              status: "accepted",
              confidence: 0.72,
              reason: "Polling cadence test item.",
              rejectionCode: null,
              createdAt: isFirstFeed ? "2026-06-16T15:02:00.000Z" : "2026-06-16T15:02:15.000Z",
              market: {
                kind: "directional",
                oracleId: "0xfuture-nearest",
                expiry: "1781622900000",
                strike: "65700000000000",
                isUp: isFirstFeed
              },
              quantity: isFirstFeed ? "3" : "4",
              maxCost: isFirstFeed ? "1.50" : "2.00"
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

    await flushAppEffects();
    expect(countPlatformCalls(platformFetcher, "/public-feed")).toBe(1);
    expect(screen.getByText("Pulse One bought UP")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(countPlatformCalls(platformFetcher, "/market-state")).toBeGreaterThanOrEqual(2);
    expect(countPlatformCalls(platformFetcher, "/public-feed")).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(countPlatformCalls(platformFetcher, "/public-feed")).toBe(2);
    expect(screen.getByText("Pulse Two bought DOWN")).toBeInTheDocument();
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
    const registryProof = {
      kind: "register_agent",
      packageId: "0x0000000000000000000000000000000000000000000000000000000000000abc",
      registryObjectId: "0x0000000000000000000000000000000000000000000000000000000000000def",
      agentId: "agent_2050",
      ownerAddress: testOwnerAddress,
      tradingWalletAddress: "0x0000000000000000000000000000000000000000000000000000000000000bee",
      metadataHash: "sha256:metadata",
      nonceBase64: "bm9uY2U=",
      signatureBase64: "c2lnbmF0dXJl"
    };
    const claimResult = {
      agent: {
        id: "agent_2050",
        displayName: "Claimed Agent",
        twitterHandle: "Sui_Agent",
        twitterVerified: false,
        ownerAddress: testOwnerAddress,
        tradingWalletAddress: registryProof.tradingWalletAddress,
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-18T02:00:00.000Z"
      },
      tradingWallet: {
        id: "wallet_2050",
        agentId: "agent_2050",
        address: registryProof.tradingWalletAddress,
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
    };
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/owner/agents/claim/prepare")) {
        return jsonResponse({
          pendingClaimId: "pending_claim_2050",
          agent: claimResult.agent,
          tradingWallet: claimResult.tradingWallet,
          registryProof
        }, 201);
      }

      if (url.endsWith("/owner/agents/claim/finalize")) {
        return jsonResponse({
          ...claimResult,
          registry: {
            status: "submitted",
            txDigest: "0xclaimdigest"
          }
        }, 201);
      }

      return jsonResponse({
        error: {
          code: "NOT_FOUND",
          message: "Unexpected request"
        }
      }, 404);
    });

    render(<App platformFetcher={platformFetcher} />);

    expect(screen.getByLabelText(/Registration code/i)).toHaveValue("PAIR-2050");
    expect(screen.queryByLabelText(/Owner wallet address/i)).not.toBeInTheDocument();
    expect(screen.getByText(testOwnerAddress)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Twitter handle/i), {
      target: { value: "@Sui_Agent" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^Claim$/i }));

    expect(await screen.findByText("agent_runtime_claimed")).toBeInTheDocument();
    expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/prepare", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        registrationCode: "PAIR-2050",
        ownerAddress: testOwnerAddress,
        twitterHandle: "@Sui_Agent"
      })
    }));
    expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/finalize", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        pendingClaimId: "pending_claim_2050",
        txDigest: "0xclaimdigest"
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

function countPlatformCalls(fetcher: ReturnType<typeof vi.fn>, suffix: string): number {
  return fetcher.mock.calls.filter(([url]) => typeof url === "string" && url.includes(suffix)).length;
}

async function flushAppEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createMockOwnerAgentProfileResponse(): Response {
  return jsonResponse({
    agent: mockPlatformSnapshot.agents[0],
    tradingWallet: mockPlatformSnapshot.tradingWallet,
    positions: mockPlatformSnapshot.positions,
    intents: mockPlatformSnapshot.intents,
    executions: mockPlatformSnapshot.executions,
    leaderboard: mockPlatformSnapshot.leaderboard
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
