import { useMemo, useState } from "react";
import { MatchHeader } from "./MatchHeader";
import { BotCardRail } from "../bots/BotCardRail";
import { BotDetailDrawer } from "../bots/BotDetailDrawer";
import { KlineBattlefield } from "../chart/KlineBattlefield";
import { PredictionModal } from "../prediction/PredictionModal";
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

interface ArenaShellProps {
  onGoHome?: () => void;
  onGoLiveArena?: () => void;
}

export function ArenaShell({ onGoHome = () => undefined, onGoLiveArena = () => undefined }: ArenaShellProps) {
  const [arenaState, setArenaState] = useState(() => createInitialArenaState(mockArenaMatch));
  const [predictionOpen, setPredictionOpen] = useState(false);
  const selectedAgent = useMemo(
    () => (arenaState.selectedAgentId ? getAgentById(arenaState.match, arenaState.selectedAgentId) : arenaState.match.agents[0]),
    [arenaState.match, arenaState.selectedAgentId]
  );

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <MatchHeader
        match={arenaState.match}
        phase={arenaState.phase}
        onAdvance={() => setArenaState((current) => advancePhase(current))}
        onGoHome={onGoHome}
        onGoLiveArena={onGoLiveArena}
      />

      <div className="mx-auto grid min-h-[calc(100vh-112px)] max-w-[1440px] grid-cols-1 border-x border-outline-variant/60 bg-surface-container-lowest xl:h-[calc(100vh-112px)] xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_340px] xl:overflow-hidden">
        <div className="grid min-w-0 xl:min-h-0 xl:grid-rows-[minmax(300px,1fr)_minmax(260px,330px)]">
          <KlineBattlefield match={arenaState.match} />
          <BotCardRail
            activeSort={arenaState.activeSort}
            match={arenaState.match}
            phase={arenaState.phase}
            selectedAgentId={arenaState.selectedAgentId}
            userPosition={arenaState.userPosition}
            winnerId={arenaState.winnerId}
            onSelect={(agentId) => setArenaState((current) => selectAgent(current, agentId))}
            onSettle={() => setArenaState((current) => settleMatch(current))}
            onSortChange={(mode) => setArenaState((current) => setAgentSort(current, mode))}
          />
        </div>

        <BotDetailDrawer agent={selectedAgent} match={arenaState.match} onBackAgent={() => setPredictionOpen(true)} />
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
