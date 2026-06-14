import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockAgents, mockArenaRounds, mockUserBackings } from "../../mock/arena";
import { ArenaShell } from "./ArenaShell";
import { BetManagementPanel } from "./BetManagementPanel";

describe("ArenaShell", () => {
  it("renders the live arena shell with a price curve, arena panel, agent tape, and bottom agent selector", () => {
    render(<ArenaShell />);

    expect(screen.getByRole("heading", { name: /Live Arena/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Round selector/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lock countdown/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Backing volume/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Prediction price chart/i)).toBeInTheDocument();
    expect(screen.getByText(/Target price/i)).toBeInTheDocument();
    expect(screen.getByText(/Current price/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Round Start/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lock Boundary/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Round End/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Arena action panel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Back Agent$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Positions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agent Tape/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close \/ Redeem/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Back Agent$/i }));
    expect(screen.getAllByText(/Max DD/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Transaction readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict action - predict::mint/i)).toBeInTheDocument();
    expect(screen.getByText(/Quote asset - DUSDC/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agent Tape/i }));
    expect(screen.getByLabelText(/Agent operation tape/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("agent-card")).toHaveLength(6);
    expect(screen.getAllByTestId("trade-avatar-marker").length).toBeGreaterThan(0);
  });

  it("uses a compact one-screen live arena workspace", () => {
    render(<ArenaShell />);

    expect(screen.getByLabelText(/Live Arena workspace/i)).toHaveClass("xl:overflow-hidden");
    expect(screen.getByLabelText(/Compact agent selector/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Arena action panel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collapse Arena panel/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Predict testnet status/i)).not.toBeInTheDocument();
  });

  it("switches selected agents and allows draft backing for unlocked rounds", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));
    fireEvent.click(screen.getByRole("button", { name: /Volatility Sniper/i }));
    expect(screen.getAllByRole("heading", { name: /Volatility Sniper/i }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Backing amount/i), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Draft/i }));

    fireEvent.click(screen.getByRole("button", { name: /Upcoming/i }));
    expect(screen.getByText(/Draft saved/i)).toBeInTheDocument();
    const betManagement = screen.getByLabelText(/Bet Management/i);
    expect(within(betManagement).getByText(/180 DUSDC/i)).toBeInTheDocument();
    expect(within(betManagement).getAllByText(/Volatility Sniper/i).length).toBeGreaterThan(0);
    expect(within(betManagement).getAllByRole("button", { name: /Modify/i }).length).toBeGreaterThan(0);
  });

  it("shows close or redeem language for live predict positions", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Positions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Current/i }));
    expect(screen.getByRole("button", { name: /Close \/ Redeem/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View on Chart/i })).toBeInTheDocument();
    expect(screen.getByText(/Agent live PnL/i)).toBeInTheDocument();
  });

  it("moves cancellable unsigned backings into history from upcoming", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));
    fireEvent.click(screen.getByRole("button", { name: /Positions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Upcoming/i }));

    expect(screen.getByText(/directional \/ draft/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel Draft/i }));

    expect(screen.getByText(/No upcoming backings yet\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /History/i }));
    expect(screen.getByText(/directional \/ cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/Transaction digest/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replay coming soon/i })).toBeDisabled();
  });

  it("updates minted live positions to redeemable when closed", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Positions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Current/i }));
    expect(screen.getByText(/range \/ live/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Close \/ Redeem/i }));

    expect(screen.getByText(/range \/ redeemable/i)).toBeInTheDocument();
    expect(screen.queryByText(/range \/ live/i)).not.toBeInTheDocument();
  });

  it("shows agent operation markers on the prediction price chart", () => {
    render(<ArenaShell />);

    const markers = screen.getAllByTestId("trade-avatar-marker");
    markers.forEach((marker) => {
      const markerCircle = marker.querySelector("circle");
      const markerY = Number(markerCircle?.getAttribute("cy"));
      expect(markerY).toBeGreaterThanOrEqual(36);
      expect(markerY).toBeLessThanOrEqual(324);
      expect(marker).toHaveAttribute("role", "button");
      expect(marker).toHaveAttribute("tabindex", "0");
    });

    fireEvent.keyDown(markers[0]!, { key: "Enter" });

    expect(screen.getByLabelText(/Agent operation tape/i)).toBeInTheDocument();
    expect(screen.queryByText(/Marker Detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Range \/ Market:/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Confidence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Predict/i).length).toBeGreaterThan(0);
  });

  it("keeps mock transaction stage controls inside diagnostics", () => {
    render(<ArenaShell />);

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));

    expect(screen.getByRole("button", { name: /Primary action: Back Agent/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Confirming$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Failed$/i })).not.toBeInTheDocument();

    const diagnosticsToggle = screen.getByRole("button", { name: /Show diagnostics/i });
    expect(diagnosticsToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(diagnosticsToggle);

    expect(screen.getByRole("region", { name: /Demo transaction controls/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirming/i }));
    expect(screen.getByRole("button", { name: /^Confirming$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Failed/i }));
    expect(screen.getByText(/Retry after wallet failure/i)).toBeInTheDocument();
  });

  it("lets the Back Agent primary action create an attributed mock backing", async () => {
    render(
      <ArenaShell
        attributionClient={{
          createAttribution: vi.fn(async (input) => ({
            ...input,
            id: "attr_0xprimary-digest_volatility-sniper",
            status: "submitted" as const
          })),
          listAttributions: vi.fn()
        }}
        createPredictDigest={() => "0xprimary-digest"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));
    expect(screen.getByText(/Mock mode stores Agent attribution/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Backing amount/i), { target: { value: "190" } });
    fireEvent.click(screen.getByRole("button", { name: /Primary action: Back Agent/i }));

    expect(await screen.findByText(/Agent attribution submitted/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText(/Bet Management/i)).getByText(/190 DUSDC/i)).toBeInTheDocument();
  });

  it("submits Agent attribution when the Back Agent primary action completes", async () => {
    const createAttribution = vi.fn(async (input) => ({
      ...input,
      id: "attr_0xtest-digest_volatility-sniper",
      status: "submitted" as const
    }));

    render(
      <ArenaShell
        attributionClient={{
          createAttribution,
          listAttributions: vi.fn()
        }}
        createPredictDigest={() => "0xtest-digest"}
        managerId="0xmanager"
        userAddress="0xuser"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));
    fireEvent.change(screen.getByLabelText(/Backing amount/i), { target: { value: "190" } });
    fireEvent.click(screen.getByRole("button", { name: /Primary action: Back Agent/i }));

    await waitFor(() => expect(createAttribution).toHaveBeenCalledTimes(1));
    expect(createAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        userAddress: "0xuser",
        managerId: "0xmanager",
        roundId: "round-eth-30m",
        agentId: "volatility-sniper",
        digest: "0xtest-digest",
        amount: 190
      })
    );
    expect(await screen.findByText(/Agent attribution submitted/i)).toBeInTheDocument();
    const betManagement = within(screen.getByLabelText(/Bet Management/i));
    expect(betManagement.getByText(/190 DUSDC/i)).toBeInTheDocument();
    expect(betManagement.getByText(/Agent attribution: submitted/i)).toBeInTheDocument();
    expect(betManagement.getByText(/Attribution id: attr_0xtest-digest_volatility-sniper/i)).toBeInTheDocument();
    expect(betManagement.getByText(/Transaction digest: 0xtest-digest/i)).toBeInTheDocument();
  });

  it("prevents duplicate Agent attribution submits while confirmation is pending", async () => {
    let releaseAttribution!: () => void;
    const createAttribution = vi.fn(async (input) => {
      await new Promise<void>((resolve) => {
        releaseAttribution = resolve;
      });

      return {
        ...input,
        id: "attr_0xpending-digest_volatility-sniper",
        status: "submitted" as const
      };
    });

    render(
      <ArenaShell
        attributionClient={{
          createAttribution,
          listAttributions: vi.fn()
        }}
        createPredictDigest={() => "0xpending-digest"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));
    const primaryAction = screen.getByRole("button", { name: /Primary action: Back Agent/i });
    fireEvent.click(primaryAction);

    await waitFor(() => expect(createAttribution).toHaveBeenCalledTimes(1));
    expect(primaryAction).toBeDisabled();

    fireEvent.click(primaryAction);
    expect(createAttribution).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseAttribution();
    });
    expect(await screen.findByText(/Agent attribution submitted/i)).toBeInTheDocument();
  });

  it("shows attribution failures without creating a submitted backing", async () => {
    const createAttribution = vi.fn(async () => {
      throw new Error("Attribution backend error");
    });

    render(
      <ArenaShell
        attributionClient={{
          createAttribution,
          listAttributions: vi.fn()
        }}
        createPredictDigest={() => "0xtest-digest"}
        managerId="0xmanager"
        userAddress="0xuser"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Select ETH 30m round/i }));
    fireEvent.change(screen.getByLabelText(/Backing amount/i), { target: { value: "190" } });
    fireEvent.click(screen.getByRole("button", { name: /Primary action: Back Agent/i }));

    expect((await screen.findAllByText(/Attribution backend error/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Positions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Upcoming/i }));
    expect(within(screen.getByLabelText(/Bet Management/i)).queryByText(/190 DUSDC/i)).not.toBeInTheDocument();
  });

  it("disables draft actions after lock and explains why", () => {
    const lockedRound = mockArenaRounds[0]!;
    const lockedDraft = {
      ...mockUserBackings[1]!,
      id: "locked-draft",
      roundId: lockedRound.id,
      status: "draft" as const,
      predictTxDigest: null
    };

    render(
      <BetManagementPanel
        activeTab="upcoming"
        agents={mockAgents}
        currentBackings={[]}
        currentRound={lockedRound}
        historyBackings={[]}
        rounds={mockArenaRounds}
        upcomingBackings={[lockedDraft]}
        onCancelBacking={() => undefined}
        onCloseMintedBacking={() => undefined}
        onModifyBacking={() => undefined}
        onTabChange={() => undefined}
        onViewOnChart={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /Cancel Draft/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Modify/i })).toBeDisabled();
    expect(screen.getByText(/Actions disabled after T-30s lock/i)).toBeInTheDocument();
  });

  it("shows value-difference copy for already minted upcoming Predict positions", () => {
    const upcomingRound = mockArenaRounds[1]!;
    const mintedBacking = {
      ...mockUserBackings[0]!,
      id: "minted-upcoming",
      roundId: upcomingRound.id,
      status: "submitted" as const,
      predictTxDigest: "0xminted-upcoming",
      estimatedValue: 141.5
    };

    render(
      <BetManagementPanel
        activeTab="upcoming"
        agents={mockAgents}
        currentBackings={[]}
        currentRound={upcomingRound}
        historyBackings={[]}
        rounds={mockArenaRounds}
        upcomingBackings={[mintedBacking]}
        onCancelBacking={() => undefined}
        onCloseMintedBacking={() => undefined}
        onModifyBacking={() => undefined}
        onTabChange={() => undefined}
        onViewOnChart={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /Close \/ Redeem/i })).toBeInTheDocument();
    expect(screen.getByText(/Estimated value may differ from original backing amount: 141\.5 DUSDC now/i)).toBeInTheDocument();
  });

  it("shows failed attribution status on backed positions", () => {
    const upcomingRound = mockArenaRounds[1]!;
    const failedBacking = {
      ...mockUserBackings[1]!,
      id: "failed-attribution-backing",
      roundId: upcomingRound.id,
      status: "submitted" as const,
      predictTxDigest: "0xfailed-digest",
      attributionId: null,
      attributionStatus: "failed" as const,
      attributionError: "Attribution backend error"
    };

    render(
      <BetManagementPanel
        activeTab="upcoming"
        agents={mockAgents}
        currentBackings={[]}
        currentRound={upcomingRound}
        historyBackings={[]}
        rounds={mockArenaRounds}
        upcomingBackings={[failedBacking]}
        onCancelBacking={() => undefined}
        onCloseMintedBacking={() => undefined}
        onModifyBacking={() => undefined}
        onTabChange={() => undefined}
        onViewOnChart={() => undefined}
      />
    );

    expect(screen.getByText(/Agent attribution: failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Attribution error: Attribution backend error/i)).toBeInTheDocument();
  });
});
