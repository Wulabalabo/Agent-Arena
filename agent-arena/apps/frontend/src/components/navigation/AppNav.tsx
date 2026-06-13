import { useState } from "react";

interface AppNavProps {
  activeView: "lobby" | "arena" | "workshop";
  onNavigate: (view: "lobby" | "arena" | "workshop") => void;
}

const navItems: Array<{ id: "lobby" | "arena" | "workshop"; label: string }> = [
  { id: "lobby", label: "Lobby" },
  { id: "arena", label: "Live Arena" },
  { id: "workshop", label: "Workshop" }
];

export function AppNav({ activeView, onNavigate }: AppNavProps) {
  const [walletConnected, setWalletConnected] = useState(false);

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
            <span className="border-b-2 border-transparent px-0.5 py-1 font-display text-xs font-semibold text-on-surface-variant/70">
              Portfolio
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="paper-chip paper-chip-green hidden px-2 py-1 md:inline-flex">
            Predicting
          </span>
          <button
            className="paper-button paper-button-primary px-3 py-1.5 font-display text-xs font-black uppercase"
            type="button"
            onClick={() => setWalletConnected((connected) => !connected)}
          >
            {walletConnected ? "Wallet Connected" : "Connect Wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}
