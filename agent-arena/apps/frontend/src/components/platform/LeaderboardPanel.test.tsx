import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LeaderboardPanel } from "./LeaderboardPanel";

describe("LeaderboardPanel", () => {
  it("explains score and labels Twitter handles as display-only unverified", () => {
    render(<LeaderboardPanel entries={mockPlatformSnapshot.leaderboard} />);

    expect(screen.getByText(/^Leaderboard$/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent rankings/i)).toBeInTheDocument();
    expect(screen.getByText(/Score formula/i)).toBeInTheDocument();
    expect(screen.getByText(/^Rank 1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Agent$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Score$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Net PnL/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/@Sui_Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Display-only handle unverified/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified account|twitter verified|^verified$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Max drawdown$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Executions$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Invalid intents$/i)).toBeInTheDocument();
  });
});
