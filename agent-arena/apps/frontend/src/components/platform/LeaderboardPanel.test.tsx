import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import type { LeaderboardEntry } from "../../features/platform/types";
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

    const topAgents = screen.getByRole("region", { name: /Top Agents/i });
    expect(within(topAgents).getAllByText(/^Rank \d$/i).map((label) => label.textContent)).toEqual([
      "Rank 1",
      "Rank 2",
      "Rank 3"
    ]);
    expect(within(topAgents).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Trend Ranger",
      "Range Cartographer",
      "Oracle Pulse"
    ]);

    const rankedTable = screen.getByRole("table", { name: /Ranked Agents/i });
    expect(within(rankedTable).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Rank",
      "Agent",
      "Score",
      "Net PnL",
      "Hit Rate",
      "Executions",
      "Invalid",
      "Exposure"
    ]);

    const rows = within(rankedTable).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["#1", "#2", "#3"]);
    expect(within(rows[0]).getAllByRole("cell")[1]).toHaveTextContent(/^Trend Ranger/);
    expect(within(rows[1]).getAllByRole("cell")[1]).toHaveTextContent(/^Range Cartographer/);
    expect(within(rows[2]).getAllByRole("cell")[1]).toHaveTextContent(/^Oracle Pulse/);
    expect(within(rankedTable).getByText("@Sui_Agent unverified")).toBeInTheDocument();
    expect(within(rankedTable).getByText("@oracle_pulse unverified")).toBeInTheDocument();
    expect(within(rankedTable).getByText("No public handle")).toBeInTheDocument();
  });

  it("orders top cards and rows by score before rank and stable agent identity", () => {
    const unsortedEntries: LeaderboardEntry[] = [
      { ...mockPlatformSnapshot.leaderboard[0], rank: 3, score: 99 },
      { ...mockPlatformSnapshot.leaderboard[1], agentId: "agent_alpha", displayName: "Alpha Range", rank: 2, score: 50 },
      { ...mockPlatformSnapshot.leaderboard[1], agentId: "agent_zulu", displayName: "Zulu Range", rank: 2, score: 50 },
      { ...mockPlatformSnapshot.leaderboard[2], rank: 2, score: 60 },
      { ...mockPlatformSnapshot.leaderboard[1], rank: 1, score: 5 }
    ];

    render(<LeaderboardPanel entries={unsortedEntries} competition={mockPlatformSnapshot.competitions[0]} />);

    const topAgents = screen.getByRole("region", { name: /Top Agents/i });
    expect(within(topAgents).getAllByText(/^Rank \d$/i).map((label) => label.textContent)).toEqual([
      "Rank 1",
      "Rank 2",
      "Rank 3"
    ]);
    expect(within(topAgents).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Trend Ranger",
      "Oracle Pulse",
      "Alpha Range"
    ]);

    const rankedTable = screen.getByRole("table", { name: /Ranked Agents/i });
    const rows = within(rankedTable).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["#1", "#2", "#3", "#4", "#5"]);
    expect(within(rows[0]).getAllByRole("cell")[1]).toHaveTextContent(/^Trend Ranger/);
    expect(within(rows[1]).getAllByRole("cell")[1]).toHaveTextContent(/^Oracle Pulse/);
    expect(within(rows[2]).getAllByRole("cell")[1]).toHaveTextContent(/^Alpha Range/);
    expect(within(rows[3]).getAllByRole("cell")[1]).toHaveTextContent(/^Zulu Range/);
    expect(within(rows[4]).getAllByRole("cell")[1]).toHaveTextContent(/^Range Cartographer/);
  });

  it("shows empty states in the top area and ranked table", () => {
    render(<LeaderboardPanel entries={[]} competition={mockPlatformSnapshot.competitions[0]} />);

    const topAgents = screen.getByRole("region", { name: /Top Agents/i });
    expect(within(topAgents).getByText("No ranked Agents yet.")).toBeInTheDocument();

    const rankedTable = screen.getByRole("table", { name: /Ranked Agents/i });
    expect(within(rankedTable).getByText("No ranked Agents yet.")).toBeInTheDocument();
  });
});
