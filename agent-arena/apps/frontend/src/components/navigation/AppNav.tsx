import type { PlatformView } from "../../state/platform";
import { SuiWalletConnectButton } from "./SuiWalletConnectButton";

interface AppNavProps {
  activeView: PlatformView;
  onNavigate: (view: PlatformView) => void;
}

const navItems: Array<{ id: PlatformView; label: string }> = [
  { id: "arena", label: "Arena" },
  { id: "leaderboard", label: "Leaderboard" }
];

export function AppNav({ activeView, onNavigate }: AppNavProps) {
  return (
    <header className="border-b-2 border-outline-variant bg-surface-container-lowest">
      <div className="paper-frame mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <button
            className="flex shrink-0 items-center gap-2 py-2 font-display text-sm font-black uppercase text-on-surface hover:text-primary"
            type="button"
            onClick={() => onNavigate("arena")}
          >
            <img
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 object-contain"
              src="/agent-arena-icon.png"
            />
            Agent Arena
          </button>
          <nav className="flex min-w-0 items-center gap-2 overflow-x-auto sm:gap-4">
            {navItems.map((item) => (
              <button
                aria-current={activeView === item.id ? "page" : undefined}
                className={`shrink-0 border-b-2 px-0.5 py-2 font-display text-xs font-semibold ${
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
