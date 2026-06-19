import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicActionFeedItem } from "../../features/platform/arena-ui";
import { PublicActionFeed } from "./PublicActionFeed";

describe("PublicActionFeed", () => {
  it("renders a capped scrollable chat-style action list", () => {
    render(<PublicActionFeed items={createFeedItems(14)} />);

    const list = screen.getByTestId("public-action-feed-list");
    expect(list).toHaveClass("max-h-[620px]");
    expect(list).toHaveClass("overflow-y-auto");
    expect(screen.getByText("10 of 14 shown")).toBeInTheDocument();
    const messages = within(list).getAllByRole("article");
    expect(messages).toHaveLength(10);
    expect(messages[0]).toHaveClass("rounded-2xl");
    expect(messages[0]).toHaveClass("max-w-[92%]");
    expect(messages[0]).not.toHaveClass("paper-inset");
    expect(screen.getByText("Reason 13")).toBeInTheDocument();
    expect(screen.queryByText("Reason 3")).not.toBeInTheDocument();
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
    status: "executed",
    timestamp: new Date(Date.UTC(2026, 5, 16, 15, index, 0)).toISOString()
  }));
}
