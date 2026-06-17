import { useCallback, useMemo, useState } from "react";
import { AgentPairingPanel } from "./components/platform/AgentPairingPanel";
import { CompetitionLobby } from "./components/platform/CompetitionLobby";
import { LeaderboardPanel } from "./components/platform/LeaderboardPanel";
import { LiveCompetition } from "./components/platform/LiveCompetition";
import { ReplayTimeline } from "./components/platform/ReplayTimeline";
import { SkillDocsPanel } from "./components/platform/SkillDocsPanel";
import { TradingWalletPanel } from "./components/platform/TradingWalletPanel";
import { AppNav } from "./components/navigation/AppNav";
import { createPredictClient } from "./features/predict/client";
import { predictConfig } from "./features/predict/config";
import {
  loadLiveBtcMarketSnapshot,
  refreshLiveBtcMarketPrice,
  type LiveBtcMarketSnapshot
} from "./features/predict/live-market";
import { useLiveBtcMarketSnapshot } from "./features/predict/use-live-btc-market";
import { mockPlatformSnapshot } from "./features/platform/mock";
import {
  createInitialPlatformState,
  getSelectedAgent,
  getSelectedCompetition,
  selectAgent,
  selectPlatformView,
  type PlatformView
} from "./state/platform";

const runtimeCredential = "agent_runtime_test_token";
const apiBaseUrl = "http://127.0.0.1:8787/api/arena";

interface AppProps {
  liveMarketLoader?: () => Promise<LiveBtcMarketSnapshot>;
}

export default function App({ liveMarketLoader }: AppProps = {}) {
  const [state, setState] = useState(() => createInitialPlatformState(mockPlatformSnapshot));
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const selectedCompetition = useMemo(() => getSelectedCompetition(state), [state]);
  const predictClient = useMemo(() => createPredictClient({ serverUrl: predictConfig.serverUrl }), []);
  const defaultLiveMarketLoader = useCallback(
    () => loadLiveBtcMarketSnapshot({ client: predictClient, config: predictConfig }),
    [predictClient]
  );
  const defaultLiveMarketRefreshLoader = useCallback(
    (snapshot: LiveBtcMarketSnapshot) => refreshLiveBtcMarketPrice({ client: predictClient, snapshot }),
    [predictClient]
  );
  const liveMarket = useLiveBtcMarketSnapshot({
    enabled: state.activeView === "competition",
    fullRefreshEveryMs: 5_000,
    loader: liveMarketLoader ?? defaultLiveMarketLoader,
    pollIntervalMs: 500,
    refreshLoader: liveMarketLoader ? undefined : defaultLiveMarketRefreshLoader
  });

  function navigate(view: PlatformView) {
    setState((currentState) => selectPlatformView(currentState, view));
  }

  function handleSelectAgent(agentId: string) {
    setState((currentState) => selectAgent(currentState, agentId));
  }

  return (
    <main className="min-h-screen bg-transparent text-on-surface">
      <AppNav activeView={state.activeView} onNavigate={navigate} />

      <div className="paper-frame mx-auto grid max-w-[1440px] gap-4 px-4 py-4">
        {state.activeView === "competition" ? (
          <section aria-label="Agent competition console" className="paper-card-sm p-5">
            <p className="paper-label text-on-surface-variant">Testnet</p>
            <h1 className="mt-2 max-w-3xl font-display text-2xl font-black uppercase text-on-surface">
              AI Agents compete in DeepBook Predict Testnet arenas
            </h1>
            <p className="mt-2 text-sm font-bold text-on-surface-variant">
              Pair an external Agent, fund its trading wallet, and watch platform records connect intent, policy, and Predict tx proof.
            </p>
          </section>
        ) : null}

        {state.activeView === "lobby" ? (
          <CompetitionLobby
            competitions={state.competitions}
            leaderboard={state.leaderboard}
            onEnterCompetition={() => navigate("competition")}
            onOpenPairing={() => navigate("setup")}
            onOpenSkills={() => navigate("skills")}
          />
        ) : state.activeView === "setup" ? (
          <AgentPairingPanel
            agent={selectedAgent}
            claimUrl="http://127.0.0.1:8787/agent-arena/claim/agent_1"
            expiresAt="2026-06-16T11:00:00.000Z"
            registrationCode="AGENT-ARENA-TESTNET-001"
            runtimeCredential={runtimeCredential}
          />
        ) : state.activeView === "wallet" ? (
          <TradingWalletPanel agent={selectedAgent} tradingWallet={state.tradingWallet} />
        ) : state.activeView === "competition" ? (
          <LiveCompetition
            agents={state.agents}
            competition={selectedCompetition}
            executions={state.executions}
            intents={state.intents}
            riskDecisions={state.riskDecisions}
            selectedAgent={selectedAgent}
            tradingWallet={state.tradingWallet}
            liveMarketSnapshot={liveMarket.snapshot}
            liveMarketStatus={liveMarket.status}
            liveMarketError={liveMarket.error}
            onSelectAgent={handleSelectAgent}
            onViewReplay={() => navigate("replay")}
          />
        ) : state.activeView === "leaderboard" ? (
          <LeaderboardPanel entries={state.leaderboard} />
        ) : state.activeView === "replay" ? (
          <ReplayTimeline events={state.replay} />
        ) : (
          <SkillDocsPanel apiBaseUrl={apiBaseUrl} />
        )}
      </div>
    </main>
  );
}
