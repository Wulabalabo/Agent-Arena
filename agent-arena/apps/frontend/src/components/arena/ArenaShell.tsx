import { useMemo, useState } from "react";
import { MatchHeader } from "./MatchHeader";
import { BotCardRail } from "../bots/BotCardRail";
import { BotDetailDrawer } from "../bots/BotDetailDrawer";
import { KlineBattlefield } from "../chart/KlineBattlefield";
import { PredictionModal } from "../prediction/PredictionModal";
import { SettlementOverlay } from "../settlement/SettlementOverlay";
import { getAgentById } from "../../mock/arena";
import { mockArenaMatch } from "../../mock/arena";
import {
  advancePhase,
  confirmPrediction,
  createInitialArenaState,
  selectAgent,
  setAgentSort,
  settleMatch
} from "../../state/arena";

export function ArenaShell() {
  const [arenaState, setArenaState] = useState(() => createInitialArenaState(mockArenaMatch));
  const [predictionOpen, setPredictionOpen] = useState(false);
  const selectedAgent = useMemo(
    () => (arenaState.selectedAgentId ? getAgentById(arenaState.match, arenaState.selectedAgentId) : arenaState.match.agents[0]),
    [arenaState.match, arenaState.selectedAgentId]
  );

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <MatchHeader
        match={arenaState.match}
        phase={arenaState.phase}
        onAdvance={() => setArenaState((current) => advancePhase(current))}
        onSettle={() => setArenaState((current) => settleMatch(current))}
      />

      <div className="grid min-h-[calc(100vh-88px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <KlineBattlefield match={arenaState.match} />
          <BotCardRail
            activeSort={arenaState.activeSort}
            match={arenaState.match}
            selectedAgentId={arenaState.selectedAgentId}
            onSelect={(agentId) => setArenaState((current) => selectAgent(current, agentId))}
            onSortChange={(mode) => setArenaState((current) => setAgentSort(current, mode))}
          />
          {arenaState.phase === "settled" && arenaState.winnerId ? (
            <SettlementOverlay
              match={arenaState.match}
              userPosition={arenaState.userPosition}
              winnerId={arenaState.winnerId}
            />
          ) : null}
        </div>

        <BotDetailDrawer agent={selectedAgent} onBackAgent={() => setPredictionOpen(true)} />
      </div>

      {predictionOpen ? (
        <PredictionModal
          agent={selectedAgent}
          userPosition={arenaState.userPosition}
          onClose={() => setPredictionOpen(false)}
          onConfirm={(amount) =>
            setArenaState((current) => confirmPrediction(current, selectedAgent.id, amount))
          }
        />
      ) : null}
    </main>
  );
}
