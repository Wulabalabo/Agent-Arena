import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { ReplayTimeline } from "./ReplayTimeline";

describe("ReplayTimeline", () => {
  it("shows intent to risk to execution to Predict transaction evidence", () => {
    render(<ReplayTimeline events={mockPlatformSnapshot.replay} />);

    expect(screen.getByText(/^Replay$/i)).toBeInTheDocument();
    expect(screen.getByText(/Intent to Predict proof chain/i)).toBeInTheDocument();
    expect(screen.getByText(/Intent submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk accepted/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Predict transaction confirmed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/intent_1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Copy value/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Predict tx digest/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not submitted/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/0xmock_exec_1/i)).toBeInTheDocument();
    expect(screen.getByText(mockPlatformSnapshot.replay[0].summary)).toBeInTheDocument();
    expect(screen.getByText(mockPlatformSnapshot.replay[1].summary)).toBeInTheDocument();
    expect(screen.getByText(mockPlatformSnapshot.replay[2].summary)).toBeInTheDocument();
  });
});
