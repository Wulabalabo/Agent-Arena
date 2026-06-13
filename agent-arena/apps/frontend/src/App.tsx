import { useState } from "react";
import { ArenaShell } from "./components/arena/ArenaShell";
import { ArenaLobby } from "./components/lobby/ArenaLobby";
import { AppNav } from "./components/navigation/AppNav";
import { AgentWorkshop } from "./components/workshop/AgentWorkshop";

type AppView = "lobby" | "arena" | "workshop";

export default function App() {
  const [view, setView] = useState<AppView>("lobby");

  return (
    <main className="min-h-screen bg-transparent text-on-surface">
      <AppNav activeView={view} onNavigate={setView} />

      {view === "arena" ? (
        <ArenaShell />
      ) : view === "workshop" ? (
        <AgentWorkshop onPreviewArena={() => setView("arena")} />
      ) : (
        <ArenaLobby onEnterArena={() => setView("arena")} onOpenWorkshop={() => setView("workshop")} />
      )}
    </main>
  );
}
