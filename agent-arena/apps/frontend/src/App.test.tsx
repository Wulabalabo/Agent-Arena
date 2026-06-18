import { fireEvent, render, screen } from "@testing-library/react";
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

  it("defaults to the Lobby page", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Agent Arena/i })).toBeInTheDocument();
    expect(screen.getByText(/Testnet-only AI Agent competition layer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
  });

  it("navigates between Lobby, Arena, and Leaderboard only", async () => {
    const liveMarketLoader = vi.fn(async () => appLiveMarketSnapshot);

    render(<App liveMarketLoader={liveMarketLoader} />);

    expect(screen.getByRole("button", { name: /^Lobby$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Arena$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Wallet$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Replay$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skills$/i })).not.toBeInTheDocument();
    expect(liveMarketLoader).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));
    expect(await screen.findByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(liveMarketLoader).toHaveBeenCalled();
    expect(await screen.findByText("$65,611.52")).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Leaderboard$/i }));
    expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ranked Agents/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Lobby$/i }));
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
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
