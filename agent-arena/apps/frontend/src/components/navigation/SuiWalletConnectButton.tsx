import { Wallet } from "lucide-react";
import { useContext, useState } from "react";
import {
  DAppKitContext,
  useDAppKit,
  useWalletConnection,
  useWallets
} from "@mysten/dapp-kit-react";

export function SuiWalletConnectButton() {
  const dAppKit = useContext(DAppKitContext);

  if (!dAppKit) {
    return (
      <button
        className="paper-button px-3 py-1.5 font-display text-xs font-black uppercase"
        disabled
        type="button"
      >
        No wallet detected
      </button>
    );
  }

  return <SuiWalletConnectButtonContent />;
}

function SuiWalletConnectButtonContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showWalletList, setShowWalletList] = useState(false);
  const dAppKit = useDAppKit();
  const connection = useWalletConnection();
  const wallets = useWallets();
  const isConnected = connection.status === "connected";
  const hasWallets = wallets.length > 0;

  async function handlePrimaryClick() {
    if (isConnected) {
      setShowWalletList(false);
      setDialogOpen(true);
      return;
    }

    if (hasWallets) {
      setShowWalletList(true);
      setDialogOpen(true);
    }
  }

  async function handleWalletConnect(wallet: (typeof wallets)[number]) {
    setDialogOpen(false);
    setShowWalletList(false);
    await dAppKit.connectWallet({ wallet });
  }

  async function handleDisconnect() {
    setDialogOpen(false);
    setShowWalletList(false);
    await dAppKit.disconnectWallet();
  }

  async function handleCopyAddress() {
    const address = connection.account?.address;

    if (!address || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Copy support is optional; the full address remains visible in the menu.
    }
  }

  return (
    <div className="relative">
      <button
        className="paper-button paper-button-primary inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
        disabled={connection.status === "connecting" || (!isConnected && !hasWallets)}
        onClick={() => void handlePrimaryClick()}
        type="button"
      >
        <Wallet aria-hidden="true" size={14} />
        {connection.status === "connecting"
          ? "Connecting…"
          : isConnected
            ? `Owner ${formatAddress(connection.account.address)}`
            : hasWallets
              ? "Connect Owner"
              : "No wallet detected"}
      </button>

      {dialogOpen ? (
        <div
          aria-label={isConnected ? "Owner wallet options" : "Connect owner wallet"}
          className="paper-card-sm absolute right-0 top-12 z-50 grid min-w-64 gap-2 p-3"
          role="dialog"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="paper-label text-on-surface-variant">
              {isConnected ? "Owner wallet" : "Connect owner wallet"}
            </p>
            <button
              aria-label="Close wallet dialog"
              className="paper-button px-2 py-1 font-display text-[10px] font-black uppercase"
              onClick={() => setDialogOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          {isConnected && connection.account ? (
            <div className="paper-inset min-w-0 p-2">
              <p className="paper-label text-on-surface-variant">Connected address</p>
              <p className="mt-1 break-all font-mono text-[11px] font-bold text-on-surface">
                {connection.account.address}
              </p>
            </div>
          ) : null}
          {isConnected ? (
            <div className="grid gap-2">
              <button
                className="paper-button inline-flex items-center justify-between gap-3 px-3 py-2 text-left font-display text-xs font-black uppercase"
                onClick={() => void handleCopyAddress()}
                type="button"
              >
                Copy address
                <Wallet aria-hidden="true" size={14} />
              </button>
              <button
                className="paper-button inline-flex items-center justify-between gap-3 px-3 py-2 text-left font-display text-xs font-black uppercase"
                disabled={!hasWallets}
                onClick={() => setShowWalletList((current) => !current)}
                type="button"
              >
                Switch wallet
                <Wallet aria-hidden="true" size={14} />
              </button>
              <button
                className="paper-button inline-flex items-center justify-between gap-3 px-3 py-2 text-left font-display text-xs font-black uppercase"
                onClick={() => void handleDisconnect()}
                type="button"
              >
                Disconnect
                <Wallet aria-hidden="true" size={14} />
              </button>
            </div>
          ) : null}
          {showWalletList ? (
            <div className="grid gap-2">
              {wallets.map((wallet) => (
                <button
                  className="paper-button inline-flex items-center justify-between gap-3 px-3 py-2 text-left font-display text-xs font-black uppercase"
                  key={wallet.name}
                  onClick={() => void handleWalletConnect(wallet)}
                  type="button"
                >
                  <span>{wallet.name}</span>
                  <Wallet aria-hidden="true" size={14} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
