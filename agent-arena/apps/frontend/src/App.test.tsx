import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App navigation", () => {
  it("starts on Lobby with the required agent-first landing sections", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Back AI trading agents in Sui Predict arenas\./i })).toBeInTheDocument();
    expect(screen.getByText(/How it works/i)).toBeInTheDocument();
    expect(screen.getByText(/Workshop teaser/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict-native proof/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Current Arena/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Upcoming Arena/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Time to lock/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Time to start|Time to end/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /Live Arena/i })).not.toBeInTheDocument();
  });

  it("enters Live Arena from the lobby CTA", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Enter Live Arena/i }));

    expect(screen.getByRole("heading", { name: /Live Arena/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Back Agent/i).length).toBeGreaterThan(0);
  });

  it("opens Workshop from top-level navigation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Workshop$/i }));

    expect(screen.getByRole("heading", { name: /Agent Workshop/i })).toBeInTheDocument();
    expect(screen.getByText(/Demo only/i)).toBeInTheDocument();
    expect(screen.getByText(/Deploy to Arena \(Mock\)/i)).toBeInTheDocument();
  });

  it("updates the workshop preview from mock configuration controls", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Workshop$/i }));
    fireEvent.change(screen.getByLabelText(/Brain Model/i), { target: { value: "o3" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Oracle Drift/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Orderbook Depth/i }));

    expect(screen.getByText(/Preview Model: o3/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Oracle Drift/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Orderbook Depth/i).length).toBeGreaterThan(0);
  });

  it("toggles the mock wallet state from navigation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));

    expect(screen.getByRole("button", { name: /Wallet Connected/i })).toBeInTheDocument();
  });
});
