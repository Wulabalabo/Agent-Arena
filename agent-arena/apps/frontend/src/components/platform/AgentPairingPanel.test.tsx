import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { AgentPairingPanel } from "./AgentPairingPanel";

describe("AgentPairingPanel", () => {
  it("shows pairing code claim and runtime credential boundaries", () => {
    render(
      <AgentPairingPanel
        agent={mockPlatformSnapshot.agents[0]}
        claimUrl="http://localhost:5173/claim/PAIR-2048"
        expiresAt="2026-06-16T10:15:00.000Z"
        registrationCode="PAIR-2048"
        runtimeCredential="agent_runtime_test_token"
      />
    );

    expect(screen.getByText(/PAIR-2048/)).toBeInTheDocument();
    expect(screen.getByText(/Connect owner wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Runtime Credential/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot withdraw funds/i)).toBeInTheDocument();
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
  });
});
