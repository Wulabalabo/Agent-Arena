import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { TradingWalletPanel } from "./TradingWalletPanel";

describe("TradingWalletPanel", () => {
  it("shows Testnet deposit address without private key language", () => {
    render(
      <TradingWalletPanel
        agent={mockPlatformSnapshot.agents[0]}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
      />
    );

    expect(screen.getByText(/Testnet trading wallet/i)).toBeInTheDocument();
    expect(screen.getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    expect(screen.getByText(/Copy deposit address/i)).toBeInTheDocument();
    expect(screen.getByText(/Never exposes private keys/i)).toBeInTheDocument();
    expect(screen.getByText(/platform signs only approved DeepBook Predict operations/i)).toBeInTheDocument();
  });
});
