import { useState } from "react";
import { ArenaShell } from "./components/arena/ArenaShell";
import { ArenaLobby } from "./components/lobby/ArenaLobby";

type AppView = "lobby" | "arena";

export default function App() {
  const [view, setView] = useState<AppView>("lobby");

  if (view === "arena") {
    return <ArenaShell onGoHome={() => setView("lobby")} onGoLiveArena={() => setView("arena")} />;
  }

  return <ArenaLobby onEnterArena={() => setView("arena")} />;
}
