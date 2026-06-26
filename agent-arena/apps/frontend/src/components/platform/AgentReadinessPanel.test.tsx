import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentReadinessPanel } from "./AgentReadinessPanel";
import type { AgentReadiness } from "../../features/platform/types";

describe("AgentReadinessPanel", () => {
  it("renders action statuses and reason codes without internal health or token labels", () => {
    render(<AgentReadinessPanel readiness={readiness} />);

    const panel = screen.getByLabelText("Agent action readiness");
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByText("hold")).toBeInTheDocument();
    expect(within(panel).getByText("open_directional")).toBeInTheDocument();
    expect(within(panel).getByText("open_range")).toBeInTheDocument();
    expect(within(panel).getAllByText("executable")).toHaveLength(2);
    expect(within(panel).getAllByText("risky")).toHaveLength(2);
    expect(within(panel).getByText("blocked")).toBeInTheDocument();
    expect(within(panel).getByText("NO_EXECUTABLE_RANGE_MARKET")).toHaveClass("break-all");
    expect(within(panel).getByText("directional:btc-up")).toBeInTheDocument();
    expect(within(panel).queryByText(/runtime token/i)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/internal health/i)).not.toBeInTheDocument();
  });
});

const readiness: AgentReadiness = {
  competitionId: "btc-15m-001",
  agentId: "agent_1",
  asOfMs: "1781622000000",
  actions: {
    hold: {
      status: "executable",
      reasons: []
    },
    open_directional: {
      status: "executable",
      markets: ["directional:btc-up"],
      reasons: []
    },
    open_range: {
      status: "blocked",
      reasons: [{
        code: "NO_EXECUTABLE_RANGE_MARKET",
        message: "No executable range market is published.",
        recommendedAgentAction: "hold"
      }]
    },
    reduce: {
      status: "risky",
      reasons: [{
        code: "NO_OPEN_POSITION",
        message: "No open position is available to reduce.",
        recommendedAgentAction: "hold"
      }]
    },
    close: {
      status: "risky",
      reasons: [{
        code: "NO_OPEN_POSITION",
        message: "No open position is available to close.",
        recommendedAgentAction: "hold"
      }]
    }
  }
};
