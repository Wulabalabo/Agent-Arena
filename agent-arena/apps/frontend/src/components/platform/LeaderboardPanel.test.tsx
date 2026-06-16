import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LeaderboardPanel } from "./LeaderboardPanel";

describe("LeaderboardPanel", () => {
  it("explains score and labels Twitter handles as display-only unverified", () => {
    render(<LeaderboardPanel entries={mockPlatformSnapshot.leaderboard} />);

    expect(screen.getByText(/Score formula/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByText(/@Sui_Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Handle unverified/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Verified$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Max drawdown/i)).toBeInTheDocument();
  });
});
