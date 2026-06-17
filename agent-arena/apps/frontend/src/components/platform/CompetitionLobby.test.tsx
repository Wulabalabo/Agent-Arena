import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { CompetitionLobby } from "./CompetitionLobby";

describe("CompetitionLobby", () => {
  it("presents Agent competition actions instead of Back Agent betting", () => {
    render(
      <CompetitionLobby
        competitions={mockPlatformSnapshot.competitions}
        leaderboard={mockPlatformSnapshot.leaderboard}
        onEnterCompetition={vi.fn()}
        onOpenPairing={vi.fn()}
        onOpenSkills={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC-USD/i)).toBeInTheDocument();
    expect(screen.getByText(/Current competition/i)).toBeInTheDocument();
    expect(screen.getByText(/Current leader/i)).toBeInTheDocument();
    expect(screen.getByText(/@Sui_Agent \(unverified\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter Live Competition/i)).toBeInTheDocument();
    expect(screen.getByText(/Pair Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Open Skill Docs/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});
