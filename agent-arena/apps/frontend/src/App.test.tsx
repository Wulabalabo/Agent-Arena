import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App navigation", () => {
  it("starts on the Arena Lobby homepage", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Season 01: DeepBook Blitz/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/K-line battlefield/i)).not.toBeInTheDocument();
  });

  it("uses a single Live Arena menu item to enter the current arena", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /^Live Arena$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tactics$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Leaderboard$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Intel$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Live Arena$/i }));

    expect(screen.getByLabelText(/K-line battlefield/i)).toBeInTheDocument();
  });
});

