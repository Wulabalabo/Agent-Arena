import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockAgents } from "../../mock/arena";
import { PredictionModal } from "../prediction/PredictionModal";
import { ArenaLobby } from "./ArenaLobby";

describe("ArenaLobby legacy copy", () => {
  it("keeps the dormant lobby protocol loop centered on Agent participation", () => {
    render(<ArenaLobby onEnterArena={vi.fn()} onOpenWorkshop={vi.fn()} />);

    expect(screen.getByText(/Select Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Commit Agent participation before the market lock boundary/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Stake before/i)).not.toBeInTheDocument();
  });

  it("keeps the dormant prediction modal label Agent-oriented", () => {
    render(<PredictionModal agent={mockAgents[0]!} onClose={vi.fn()} />);

    expect(screen.getByText(/Agent participation/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Back Agent$/i)).not.toBeInTheDocument();
  });
});
