import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestnetStatusPanel } from "./TestnetStatusPanel";
import type { PredictTestnetSnapshot } from "../../features/predict/snapshot";

const readySnapshot: PredictTestnetSnapshot = {
  health: "ready",
  serverStatus: "OK",
  predictId: "0xpredict",
  quoteAssetLabel: "DUSDC",
  oracleCounts: {
    active: 2,
    settled: 12,
    total: 14
  },
  activeOracle: {
    oracleId: "0xactive",
    underlyingAsset: "BTC",
    expiryMs: 1783065600000,
    status: "active"
  },
  activeOracleState: {
    oracle_id: "0xactive"
  },
  updatedAt: "2026-06-09T09:56:46.403Z"
};

describe("TestnetStatusPanel", () => {
  it("loads a read-only Predict testnet snapshot on demand", async () => {
    const loadSnapshot = vi.fn(async () => readySnapshot);

    render(<TestnetStatusPanel loadSnapshot={loadSnapshot} />);

    expect(screen.getByText(/Read-only testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner wallet signs registry binding and credential rotation/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Refresh Predict testnet/i }));

    expect(await screen.findByText(/Server OK/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC active oracle/i)).toBeInTheDocument();
    expect(screen.getByText(/Active 2 \/ Settled 12 \/ Total 14/i)).toBeInTheDocument();
    expect(loadSnapshot).toHaveBeenCalledOnce();
  });

  it("shows a degraded state when there is no active oracle", async () => {
    const loadSnapshot = vi.fn(async (): Promise<PredictTestnetSnapshot> => ({
      ...readySnapshot,
      health: "degraded",
      activeOracle: null,
      activeOracleState: null,
      oracleCounts: {
        active: 0,
        settled: 14,
        total: 14
      }
    }));

    render(<TestnetStatusPanel loadSnapshot={loadSnapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh Predict testnet/i }));

    expect(await screen.findByText(/No active oracle/i)).toBeInTheDocument();
    expect(screen.getByText(/Server OK/i)).toBeInTheDocument();
  });
});
