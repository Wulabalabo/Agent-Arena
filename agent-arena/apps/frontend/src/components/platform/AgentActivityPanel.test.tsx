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
        positions={mockPlatformSnapshot.positions}
        riskDecisions={mockPlatformSnapshot.riskDecisions}
        tradingWallet={mockPlatformSnapshot.tradingWallet}
      />
    );

    expect(screen.getByRole("heading", { name: /^Intents$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Risk$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Executions$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Positions$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Wallet$/i })).toBeInTheDocument();
    expect(screen.getByText("RISK_LIMIT_EXCEEDED")).toBeInTheDocument();
    expect(screen.getByText("0xmock_exec_1")).toBeInTheDocument();
    expect(screen.getByText("btc-up-65000000000000-1781701200000")).toBeInTheDocument();
  });
});
