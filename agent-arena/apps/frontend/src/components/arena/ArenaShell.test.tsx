import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArenaShell } from "./ArenaShell";

describe("ArenaShell", () => {
  it("renders the live match, battlefield, and six agent cards", () => {
    render(<ArenaShell />);

    expect(screen.getByRole("heading", { name: /DeepBook Blitz League/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/K-line battlefield/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("bot-card")).toHaveLength(6);
  });

  it("opens bot details and prediction confirmation for a selected agent", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Volatility Sniper/i }));
    expect(screen.getByRole("heading", { name: /Volatility Sniper/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back This Agent/i }));
    expect(screen.getByText(/Will Volatility Sniper finish rank 1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm Prediction/i }));
    expect(screen.getByText(/Position confirmed/i)).toBeInTheDocument();
  });

  it("shows settlement after advancing to the end of the demo", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Settle Match/i }));

    expect(screen.getByRole("heading", { name: /Settlement Complete/i })).toBeInTheDocument();
    expect(screen.getByText(/Winner/i)).toBeInTheDocument();
  });
});

