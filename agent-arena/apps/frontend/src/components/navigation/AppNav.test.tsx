import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("renders only Arena and Leaderboard as primary navigation items", () => {
    const onNavigate = vi.fn();
    render(<AppNav activeView="arena" onNavigate={onNavigate} />);

    expect(screen.queryByRole("button", { name: /^Lobby$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Arena$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: /^Arena$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Wallet$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Replay$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Skills$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Agent Arena$/i }));
    expect(onNavigate).toHaveBeenCalledWith("arena");

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));
    expect(onNavigate).toHaveBeenCalledWith("arena");
  });

  it("gives the menu bar enough vertical breathing room", () => {
    const { container } = render(<AppNav activeView="arena" onNavigate={vi.fn()} />);
    const frame = container.querySelector("header > div");

    expect(frame).toHaveClass("min-h-14");
    expect(frame).toHaveClass("py-2");
    expect(screen.getByRole("button", { name: /^Arena$/i })).toHaveClass("py-2");
  });
});
