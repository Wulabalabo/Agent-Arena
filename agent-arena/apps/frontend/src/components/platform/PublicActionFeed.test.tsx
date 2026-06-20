import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicActionFeedItem } from "../../features/platform/arena-ui";
import { PublicActionFeed } from "./PublicActionFeed";

describe("PublicActionFeed", () => {
  it("renders a capped scrollable chat-style action list", () => {
    render(<PublicActionFeed items={createFeedItems(14)} />);

    const list = screen.getByTestId("public-action-feed-list");
    expect(list).toHaveClass("h-[420px]");
    expect(list).toHaveClass("xl:h-[560px]");
    expect(list).toHaveClass("overflow-y-auto");
    expect(list).not.toHaveClass("xl:max-h-none");
    expect(screen.getByText("8 of 14 shown")).toBeInTheDocument();
    const messages = within(list).getAllByRole("article");
    expect(messages).toHaveLength(8);
    expect(messages[0]).toHaveClass("rounded-2xl");
    expect(messages[0]).toHaveClass("max-w-[92%]");
    expect(messages[0]).not.toHaveClass("paper-inset");
    expect(screen.getByText("Reason 13")).toBeInTheDocument();
    expect(screen.queryByText("Reason 5")).not.toBeInTheDocument();
  });

  it("uses the lower panel space for the Agent Arena icon", () => {
    render(<PublicActionFeed items={[]} />);

    const brandPanel = screen.getByTestId("public-action-feed-brand-panel");
    expect(brandPanel).toHaveClass("min-h-[192px]");
    expect(brandPanel).toHaveClass("border-2");
    expect(within(brandPanel).getByRole("img", { name: /Agent Arena icon/i })).toHaveAttribute(
      "src",
      "/agent-arena-icon.png"
    );
  });

  it("summarizes Agent buying actions at a glance", () => {
    render(
      <PublicActionFeed
        items={[
          {
            action: "open_directional",
            agentDisplayName: "Trend Ranger",
            agentId: "agent_1",
            direction: "UP",
            id: "feed_directional",
            maxCost: "5.00",
            quantity: "10",
            status: "executed",
            timestamp: "2026-06-16T15:00:00.000Z"
          },
          {
            action: "open_range",
            agentDisplayName: "Range Cartographer",
            agentId: "agent_2",
            higherStrike: "66000000000000",
            id: "feed_range",
            lowerStrike: "64000000000000",
            budgetRaw: "42000000",
            status: "accepted",
            timestamp: "2026-06-16T15:01:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Range Cartographer bought range 64000000000000-66000000000000")).toBeInTheDocument();
    expect(screen.getByText(/Budget 42000000/i)).toBeInTheDocument();
    expect(screen.getByText("Trend Ranger bought UP")).toBeInTheDocument();
    expect(screen.getByText(/Qty 10 \/ Max cost 5.00/i)).toBeInTheDocument();

    const messages = within(screen.getByTestId("public-action-feed-list")).getAllByRole("article");
    expect(messages[0]).toHaveClass("bg-[#f2fbf6]");
  });
});

function createFeedItems(count: number): PublicActionFeedItem[] {
  return Array.from({ length: count }, (_, index) => ({
    action: "open_directional",
    agentDisplayName: `Agent ${index}`,
    agentId: `agent_${index}`,
    confidence: 0.72,
    direction: index % 2 === 0 ? "UP" : "DOWN",
    id: `feed_${index}`,
    reason: `Reason ${index}`,
    maxCost: "5.00",
    quantity: "10",
    status: "executed",
    timestamp: new Date(Date.UTC(2026, 5, 16, 15, index, 0)).toISOString()
  }));
}
