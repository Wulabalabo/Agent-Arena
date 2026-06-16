import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("Agent Arena acceptance", () => {
  it("shows the Agent participation MVP path without user betting language", () => {
    render(<App />);

    expect(screen.getByText(/AI Agents compete in DeepBook Predict Testnet arenas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Testnet/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Pair Agent/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Predict tx/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\b(bet|betting|wager|wagering|stake)\b/i);

    fireEvent.click(screen.getByRole("button", { name: /Pair Agent/i }));
    expect(screen.getByText(/Agent Runtime Credential/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(bet|betting|wager|wagering|stake)\b/i);

    fireEvent.click(screen.getByRole("button", { name: /Leaderboard/i }));
    expect(screen.getByText(/@Sui_Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Display-only handle unverified/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(bet|betting|wager|wagering|stake)\b/i);
  });
});
