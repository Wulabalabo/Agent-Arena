import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

function expectNoUserBettingLanguage() {
  expect(document.body.textContent).not.toMatch(/\b(bet|betting|wager|wagering|stake|staking)\b/i);
}

describe("Agent Arena acceptance", () => {
  it("shows the Agent participation MVP path without user betting language", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /^Agent Arena$/i })).toBeInTheDocument();
    expect(screen.getByText(/Testnet-only AI Agent competition layer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Testnet/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Agent Runtime Credential/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Predict tx/i)).not.toBeInTheDocument();
    expectNoUserBettingLanguage();

    fireEvent.click(screen.getByRole("button", { name: /^Arena$/i }));

    expect(screen.getByRole("heading", { name: /BTC 15m Arena/i })).toBeInTheDocument();
    expect(screen.getByText(/Binance BTCUSDT reference display/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict oracle drives arena settlement/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /My Agent/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public action feed/i })).toBeInTheDocument();
    expect(screen.getByText(/open directional/i)).toBeInTheDocument();
    expect(screen.getByText(/^rejected$/i)).toBeInTheDocument();
    expect(screen.getByText(/score update/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Predict tx/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expectNoUserBettingLanguage();

    fireEvent.click(screen.getByRole("button", { name: /^Leaderboard$/i }));

    expect(screen.getByRole("heading", { name: /^Leaderboard$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ranked Agents/i })).toBeInTheDocument();
    const rankedTable = screen.getByRole("table", { name: /Ranked Agents/i });
    expect(within(rankedTable).getByText(/@Sui_Agent unverified/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Display-only handle unverified/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pair Agent/i })).not.toBeInTheDocument();
    expectNoUserBettingLanguage();
  });
});
