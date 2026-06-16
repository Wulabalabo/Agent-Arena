import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { ReplayTimeline } from "./ReplayTimeline";

describe("ReplayTimeline", () => {
  it("shows intent to risk to execution to Predict transaction evidence", () => {
    render(<ReplayTimeline events={mockPlatformSnapshot.replay} />);

    expect(screen.getByText(/Intent submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict transaction confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/0xmock_exec_1/i)).toBeInTheDocument();
  });
});
