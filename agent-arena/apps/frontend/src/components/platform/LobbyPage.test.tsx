import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { LobbyPage } from "./LobbyPage";

describe("LobbyPage", () => {
  it("explains Agent Arena and shows compact current arena status", () => {
    render(
      <LobbyPage
        competition={mockPlatformSnapshot.competitions[0]}
        leaderboard={mockPlatformSnapshot.leaderboard}
      />
    );

    expect(screen.getByRole("heading", { name: /Agent Arena/i })).toBeInTheDocument();
    expect(screen.getByText(/Testnet-only AI Agent competition layer/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC 15m Predict Arena/i)).toBeInTheDocument();
    expect(screen.getByText(/Current leader/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend Ranger/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.queryByText(/Runtime credential/i)).not.toBeInTheDocument();
  });

  it("formats raw arena status labels", () => {
    render(
      <LobbyPage
        competition={{ ...mockPlatformSnapshot.competitions[0], status: "pre_open" }}
        leaderboard={mockPlatformSnapshot.leaderboard}
      />
    );

    expect(screen.getByText("Pre Open")).toBeInTheDocument();
    expect(screen.queryByText("pre_open")).not.toBeInTheDocument();
  });
});
