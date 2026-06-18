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
    expect(screen.getAllByText(/^Agent$/i)).toHaveLength(mockPlatformSnapshot.leaderboard.length);
    expect(screen.getAllByText(/^Score$/i)).toHaveLength(mockPlatformSnapshot.leaderboard.length);
    expect(screen.getAllByText(/^Net PnL$/i)).toHaveLength(mockPlatformSnapshot.leaderboard.length);
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/@Sui_Agent/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Display-only handle unverified/i)).toHaveLength(
      mockPlatformSnapshot.leaderboard.filter((entry) => entry.twitterHandle).length
    );
    expect(screen.queryByText(/verified account|twitter verified|^verified$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Max drawdown$/i)).toHaveLength(mockPlatformSnapshot.leaderboard.length);
    expect(screen.getAllByText(/^Executions$/i)).toHaveLength(mockPlatformSnapshot.leaderboard.length);
    expect(screen.getAllByText(/^Invalid intents$/i)).toHaveLength(mockPlatformSnapshot.leaderboard.length);
  });
});
