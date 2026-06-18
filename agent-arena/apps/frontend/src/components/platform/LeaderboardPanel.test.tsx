import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LeaderboardPanel } from "./LeaderboardPanel";

describe("LeaderboardPanel", () => {
  it("renders a full leaderboard page with summary, top three, and ranked table", () => {
    render(
      <LeaderboardPanel
        entries={mockPlatformSnapshot.leaderboard}
        competition={mockPlatformSnapshot.competitions[0]}
      />
    );

    expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByText(/BTC 15m Testnet Arena/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Top Agents/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ranked Agents/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Trend Ranger/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Range Cartographer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Oracle Pulse/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/@Sui_Agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/unverified/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: /rank/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /agent/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /score/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /net pnl/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /executions/i })).toBeInTheDocument();
  });
});
