import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("Agent Arena demo flow", () => {
  it("runs the judge-facing flow from Lobby to Arena to Workshop", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Back AI trading agents/i })).toBeInTheDocument();
    expect(screen.getByText(/Sui Predict native/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Enter Live Arena/i }));
    expect(screen.getByRole("heading", { name: /Live Arena/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Back Agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/T-30s/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Predict/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Workshop$/i }));
    expect(screen.getByRole("heading", { name: /Agent Workshop/i })).toBeInTheDocument();
    expect(screen.getByText(/Demo only/i)).toBeInTheDocument();
  });

  it("does not describe live Predict exits as no-cost cancellation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Enter Live Arena/i }));

    expect(screen.getByText(/Close \/ Redeem/i)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp("free " + "cancel", "i"))).not.toBeInTheDocument();
  });
});
