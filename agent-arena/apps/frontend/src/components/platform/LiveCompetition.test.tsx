import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
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
        onSelectAgent={vi.fn()}
        onViewReplay={vi.fn()}
      />
    );

    expect(screen.getByText(/Live Competition/i)).toBeInTheDocument();
    expect(screen.getByText(/0xbtc15m/i)).toBeInTheDocument();
    expect(screen.getByText(/open_directional/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime status/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict tx/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});
