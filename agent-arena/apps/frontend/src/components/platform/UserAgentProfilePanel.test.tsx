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
    const writeText = vi.fn(async (_text: string) => undefined);
    setClipboard(writeText);

    render(<UserAgentProfilePanel profile={createProfile()} />);

    expect(screen.getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy trading wallet/i }));

    expect(writeText).toHaveBeenCalledWith("0xagentwallet_agent_1");
    expect(await screen.findByRole("status")).toHaveTextContent("Trading wallet copied");
  });

  it("shows the funding wallet copy action in the compact arena profile", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    setClipboard(writeText);

    render(<UserAgentProfilePanel profile={createProfile()} variant="compact" />);

    expect(screen.getByText("0xagentwallet_agent_1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy trading wallet/i }));

    expect(writeText).toHaveBeenCalledWith("0xagentwallet_agent_1");
  });

  it("shows runtime credential rotation only for the connected owner Agent", () => {
    const profile = createProfile();
    const rotation = createRotationCallbacks();

    const { rerender } = render(
      <UserAgentProfilePanel
        connectedOwnerAddress="0xowner"
        onCreateRuntimeCredentialRotationChallenge={rotation.onCreateChallenge}
        onRotateRuntimeCredential={rotation.onRotate}
        onSignRuntimeCredentialRotationMessage={rotation.onSignMessage}
        profile={profile}
      />
    );

    expect(screen.getByRole("button", { name: /rotate runtime credential/i })).toBeInTheDocument();

    rerender(
      <UserAgentProfilePanel
        connectedOwnerAddress="0xother"
        onCreateRuntimeCredentialRotationChallenge={rotation.onCreateChallenge}
        onRotateRuntimeCredential={rotation.onRotate}
        onSignRuntimeCredentialRotationMessage={rotation.onSignMessage}
        profile={profile}
      />
    );

    expect(screen.queryByRole("button", { name: /rotate runtime credential/i })).not.toBeInTheDocument();
  });

  it("rotates runtime credentials and copies handoff with the rotated token", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    setClipboard(writeText);
    const rotation = createRotationCallbacks();

    render(
      <UserAgentProfilePanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        connectedOwnerAddress="0xowner"
        onCreateRuntimeCredentialRotationChallenge={rotation.onCreateChallenge}
        onRotateRuntimeCredential={rotation.onRotate}
        onSignRuntimeCredentialRotationMessage={rotation.onSignMessage}
        profile={createProfile()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /rotate runtime credential/i }));

    expect(await screen.findByText("agent_runtime_rotated")).toBeInTheDocument();
    expect(rotation.onCreateChallenge).toHaveBeenCalledWith("agent_1", {
      ownerAddress: "0xowner",
      reason: "owner requested runtime credential rotation"
    });
    expect(rotation.onSignMessage).toHaveBeenCalledWith("rotation message");
    expect(rotation.onRotate).toHaveBeenCalledWith("agent_1", {
      ownerAddress: "0xowner",
      signature: "0xsigned-rotation",
      nonce: "nonce-1",
      expiresAt: "2026-06-18T02:10:00.000Z",
      reason: "owner requested runtime credential rotation",
      message: "rotation message",
      domain: "agent-arena-runtime-credential-rotation:v1",
      currentCredentialVersion: 1
    });

    fireEvent.click(screen.getByRole("button", { name: /copy agent handoff/i }));
    const handoff = JSON.parse(writeText.mock.calls[0]?.[0] ?? "{}");
    expect(handoff).toMatchObject({
      baseUrl: "http://127.0.0.1:8787/api/arena",
      agentId: "agent_1",
      token: "agent_runtime_rotated",
      credentialVersion: 2
    });
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

function createRotationCallbacks() {
  return {
    onCreateChallenge: vi.fn(async () => ({
      agentId: "agent_1",
      ownerAddress: "0xowner",
      reason: "owner requested runtime credential rotation",
      domain: "agent-arena-runtime-credential-rotation:v1",
      chainId: "sui:testnet",
      currentCredentialVersion: 1,
      nextCredentialVersion: 2,
      nonce: "nonce-1",
      expiresAt: "2026-06-18T02:10:00.000Z",
      message: "rotation message"
    })),
    onSignMessage: vi.fn(async () => "0xsigned-rotation"),
    onRotate: vi.fn(async () => ({
      runtimeCredential: {
        token: "agent_runtime_rotated",
        shownOnce: true,
        credentialVersion: 2,
        scopes: ["agent:read"]
      },
      registry: {
        status: "disabled" as const,
        txDigest: null
      }
    }))
  };
}
