import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("defaults to the Agent competition console", () => {
    render(<App />);

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pair Agent/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back Agent$/i })).not.toBeInTheDocument();
  });

  it("navigates to pairing, wallet, leaderboard, replay, and skills", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Pair Agent/i }));
    expect(screen.getByText(/Registration code/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Wallet/i }));
    expect(screen.getByText(/Testnet trading wallet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Leaderboard/i }));
    expect(screen.getByText(/Score formula/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Replay/i }));
    expect(screen.getByText(/Intent submitted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Skills/i }));
    expect(screen.getByText(/agent-arena\/skills\/agent-arena.md/i)).toBeInTheDocument();
    expect(screen.getByText("Init: POST http://127.0.0.1:8787/api/arena/agent/init")).toBeInTheDocument();
  });
});
