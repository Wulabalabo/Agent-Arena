import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import { LiveCompetition } from "./LiveCompetition";

describe("LiveCompetition", () => {
  it("shows Agent runtime, allowed actions, and Predict execution context", () => {
    render(
      <LiveCompetition
        agents={mockPlatformSnapshot.agents}
        competition={mockPlatformSnapshot.competitions[0]}
        executions={mockPlatformSnapshot.executions}
        intents={mockPlatformSnapshot.intents}
        riskDecisions={mockPlatformSnapshot.riskDecisions}
        selectedAgent={mockPlatformSnapshot.agents[0]}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
        liveMarketSnapshot={liveMarketSnapshot}
        liveMarketStatus="ready"
        liveMarketError={null}
        onSelectAgent={vi.fn()}
        onViewReplay={vi.fn()}
      />
    );

    expect(screen.getByText(/Live Competition/i)).toBeInTheDocument();
    expect(screen.getByText(/0xbtc15m/i)).toBeInTheDocument();
    expect(screen.getByText(/open_directional/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict object/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Selected agent/i)).toBeInTheDocument();
    expect(screen.getByText(/K-line battlefield reserved/i)).toBeInTheDocument();
    expect(screen.getByText("$65,611.52")).toBeInTheDocument();
    expect(screen.getByText(/0.5s refresh/i)).toBeInTheDocument();
    expect(screen.getByText(/Last poll 2026-06-16 15:00:55.000 UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-16 15:15:00 UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/Oracle trades/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/Position minted/i)).toBeInTheDocument();
    expect(screen.getByText(/0.008006 DUSDC/i)).toBeInTheDocument();
    expect(screen.getByText(/DOWN 65,650/i)).toBeInTheDocument();
    expect(screen.getByText(/Strike raw 65650000000000 \/ Qty raw 100000/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime status/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict tx/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Intents$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Risk$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Executions$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Wallet$/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});

const liveMarketSnapshot: LiveBtcMarketSnapshot = {
  health: "ready",
  serverStatus: "OK",
  serverTime: "2026-06-16T15:00:00.000Z",
  serverTimeMs: 1781622000000,
  predictId: "0xpredict",
  quoteAssetLabel: "DUSDC",
  oracleCounts: {
    activeFutureBtc: 2,
    activeTotal: 3,
    total: 10
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
