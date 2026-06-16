import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { AgentActivityPanel } from "./AgentActivityPanel";

describe("AgentActivityPanel", () => {
  it("shows intents, risk decisions, executions, and wallet state as separate platform records", () => {
    render(
      <AgentActivityPanel
        executions={mockPlatformSnapshot.executions}
        intents={mockPlatformSnapshot.intents}
        riskDecisions={mockPlatformSnapshot.riskDecisions}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
      />
    );

    expect(screen.getByText(/Intents/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Executions/i)).toBeInTheDocument();
    expect(screen.getByText(/Wallet/i)).toBeInTheDocument();
    expect(screen.getByText("RISK_LIMIT_EXCEEDED")).toBeInTheDocument();
    expect(screen.getByText("0xmock_exec_1")).toBeInTheDocument();
  });
});
