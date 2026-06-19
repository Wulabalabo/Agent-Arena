import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuiWalletConnectButton } from "./SuiWalletConnectButton";

const dappKitState = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  connection: {
    account: null as { address: string } | null,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    isReconnecting: false,
    status: "disconnected" as const,
    supportedIntents: [] as string[],
    wallet: null
  } as {
    account: { address: string } | null;
    isConnected: boolean;
    isConnecting: boolean;
    isDisconnected: boolean;
    isReconnecting: boolean;
    status: "connected" | "connecting" | "disconnected" | "reconnecting";
    supportedIntents: string[];
    wallet: unknown;
  },
  wallets: [] as Array<{ name: string }>
}));

vi.mock("@mysten/dapp-kit-react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    DAppKitContext: React.createContext({}),
    useDAppKit: () => ({
      connectWallet: dappKitState.connectWallet,
      disconnectWallet: dappKitState.disconnectWallet
    }),
    useWalletConnection: () => dappKitState.connection,
    useWallets: () => dappKitState.wallets
  };
});

describe("SuiWalletConnectButton", () => {
  beforeEach(() => {
    dappKitState.connectWallet.mockReset();
    dappKitState.disconnectWallet.mockReset();
    dappKitState.connection = {
      account: null,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: "disconnected",
      supportedIntents: [],
      wallet: null
    };
    dappKitState.wallets = [{ name: "Sui Wallet" }];
  });

  it("connects through Mysten dApp Kit from the menu button", () => {
    render(<SuiWalletConnectButton />);

    fireEvent.click(screen.getByRole("button", { name: /Connect Owner/i }));

    expect(screen.getByRole("dialog", { name: /Connect owner wallet/i })).toBeInTheDocument();
    expect(dappKitState.connectWallet).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sui Wallet" }));

    expect(dappKitState.connectWallet).toHaveBeenCalledWith({ wallet: dappKitState.wallets[0] });
  });

  it("opens an account menu when already connected and disconnects only from the menu", () => {
    dappKitState.connection = {
      account: { address: "0x1234567890abcdef" },
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: "connected",
      supportedIntents: [],
      wallet: { name: "Sui Wallet" }
    };

    render(<SuiWalletConnectButton />);

    fireEvent.click(screen.getByRole("button", { name: /Owner 0x1234...cdef/i }));

    expect(dappKitState.disconnectWallet).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /Owner wallet options/i })).toBeInTheDocument();
    expect(screen.getByText("0x1234567890abcdef")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch wallet/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));

    expect(dappKitState.disconnectWallet).toHaveBeenCalled();
  });

  it("does not expose a fake connect action when no SDK wallet is detected", () => {
    dappKitState.wallets = [];

    render(<SuiWalletConnectButton />);

    expect(screen.getByRole("button", { name: /No wallet detected/i })).toBeDisabled();
  });
});
