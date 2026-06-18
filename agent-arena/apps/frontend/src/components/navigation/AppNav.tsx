import type { PlatformView } from "../../state/platform";
import { SuiWalletConnectButton } from "./SuiWalletConnectButton";

interface AppNavProps {
  activeView: PlatformView;
  onNavigate: (view: PlatformView) => void;
}

const navItems: Array<{ id: PlatformView; label: string }> = [
  { id: "lobby", label: "Lobby" },
  { id: "setup", label: "Pair Agent" },
  { id: "wallet", label: "Wallet" },
  { id: "competition", label: "Competition" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "replay", label: "Replay" },
  { id: "skills", label: "Skills" }
];

export function AppNav({ activeView, onNavigate }: AppNavProps) {
  return (
    <header className="border-b-2 border-outline-variant bg-surface-container-lowest">
      <div className="paper-frame mx-auto flex h-11 max-w-[1440px] items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <button
            className="font-display text-sm font-black uppercase text-on-surface hover:text-primary"
            type="button"
            onClick={() => onNavigate("lobby")}
          >
            Agent Arena
          </button>
          <nav className="hidden items-center gap-4 md:flex">
            {navItems.map((item) => (
              <button
                className={`border-b-2 px-0.5 py-1 font-display text-xs font-semibold ${
                  activeView === item.id
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
                }`}
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="paper-chip paper-chip-green hidden px-2 py-1 md:inline-flex">
            Testnet
          </span>
          <SuiWalletConnectButton />
        </div>
      </div>
    </header>
  );
}
