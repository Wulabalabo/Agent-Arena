import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("renders only Lobby, Arena, and Leaderboard as primary navigation items", () => {
    const onNavigate = vi.fn();
    render(<AppNav activeView="lobby" onNavigate={onNavigate} />);

    expect(screen.getByRole("button", { name: /^Lobby$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Arena$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Wallet$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Replay$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skills$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Agent Arena$/i }));
    expect(onNavigate).toHaveBeenCalledWith("lobby");

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));
    expect(onNavigate).toHaveBeenCalledWith("arena");
  });
});
