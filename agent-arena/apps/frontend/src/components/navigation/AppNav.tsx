import { Bell, Settings } from "lucide-react";

interface AppNavProps {
  activeView: "lobby" | "arena";
  onGoHome: () => void;
  onGoLiveArena: () => void;
}

export function AppNav({ activeView, onGoHome, onGoLiveArena }: AppNavProps) {
  return (
    <div className="mx-auto flex h-11 max-w-[1440px] items-center justify-between border-x border-outline-variant px-4">
      <div className="flex items-center gap-6">
        <button
          className="font-display text-sm font-bold uppercase text-on-surface hover:text-primary"
          type="button"
          onClick={onGoHome}
        >
          Agent Arena
        </button>
        <nav className="hidden items-center gap-1 md:flex">
          <button
            className={`rounded px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.05em] ${
              activeView === "arena" ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-container"
            }`}
            type="button"
            onClick={onGoLiveArena}
          >
            Live Arena
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label="Notifications"
          className="rounded border border-outline-variant bg-surface-container p-1.5 text-on-surface-variant"
          type="button"
        >
          <Bell size={15} />
        </button>
        <button
          aria-label="Settings"
          className="rounded border border-outline-variant bg-surface-container p-1.5 text-on-surface-variant"
          type="button"
        >
          <Settings size={15} />
        </button>
        <button className="rounded bg-primary-container px-3 py-1.5 font-mono text-xs font-bold text-on-primary" type="button">
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

