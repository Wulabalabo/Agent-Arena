import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUserAgentArenaProfile } from "../../features/platform/arena-ui";
import { mockPlatformSnapshot } from "../../features/platform/mock";
import { UserAgentProfilePanel } from "./UserAgentProfilePanel";

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

describe("UserAgentProfilePanel", () => {
  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
      return;
    }

    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("copies the trading wallet address for funding", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);

    render(<UserAgentProfilePanel profile={createProfile()} />);

    expect(screen.getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy trading wallet/i }));

    expect(writeText).toHaveBeenCalledWith("0xagentwallet_agent_1");
    expect(await screen.findByRole("status")).toHaveTextContent("Trading wallet copied");
  });

  it("shows the funding wallet copy action in the compact arena profile", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);

    render(<UserAgentProfilePanel profile={createProfile()} variant="compact" />);

    expect(screen.getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy trading wallet/i }));

    expect(writeText).toHaveBeenCalledWith("0xagentwallet_agent_1");
  });
});

function createProfile() {
  return createUserAgentArenaProfile({
    agent: mockPlatformSnapshot.agents[0],
    tradingWallet: mockPlatformSnapshot.tradingWallet,
    positions: mockPlatformSnapshot.positions,
    intents: mockPlatformSnapshot.intents,
    executions: mockPlatformSnapshot.executions,
    leaderboard: mockPlatformSnapshot.leaderboard
  });
}

function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined
  });
}
