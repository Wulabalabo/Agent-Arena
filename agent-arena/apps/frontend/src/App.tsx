import { useCallback, useMemo, useState } from "react";
import { ArenaPage } from "./components/platform/ArenaPage";
import { LeaderboardPanel } from "./components/platform/LeaderboardPanel";
import { LobbyPage } from "./components/platform/LobbyPage";
import { SuiDappKitAgentClaimPanel } from "./components/platform/SuiDappKitAgentClaimPanel";
import { AppNav } from "./components/navigation/AppNav";
import { createPredictClient } from "./features/predict/client";
import { predictConfig } from "./features/predict/config";
import {
  loadLiveBtcMarketSnapshot,
  refreshLiveBtcMarketPrice,
  type LiveBtcMarketSnapshot
} from "./features/predict/live-market";
import { useLiveBtcMarketSnapshot } from "./features/predict/use-live-btc-market";
import {
  createPublicActionFeedItems,
  createUserAgentArenaProfile
} from "./features/platform/arena-ui";
import { mockPlatformSnapshot } from "./features/platform/mock";
import {
  createInitialPlatformState,
  getSelectedAgent,
  getSelectedCompetition,
  selectPlatformView,
  type PlatformView
} from "./state/platform";

const apiBaseUrl = "http://127.0.0.1:8787/api/arena";

interface AppProps {
  liveMarketLoader?: () => Promise<LiveBtcMarketSnapshot>;
  platformFetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}

export default function App({ liveMarketLoader, platformFetcher }: AppProps = {}) {
  const [state, setState] = useState(() => createInitialPlatformState(mockPlatformSnapshot));
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const selectedCompetition = useMemo(() => getSelectedCompetition(state), [state]);
  const claimRegistrationCode = getClaimRegistrationCode();
  const userAgentProfile = useMemo(
    () =>
      createUserAgentArenaProfile({
        agent: selectedAgent,
        tradingWallet: state.tradingWallet,
        positions: state.positions,
        intents: state.intents,
        executions: state.executions,
        leaderboard: state.leaderboard
      }),
    [selectedAgent, state.tradingWallet, state.positions, state.intents, state.executions, state.leaderboard]
  );
  const publicActionFeedItems = useMemo(
    () =>
      createPublicActionFeedItems({
        agents: state.agents,
        intents: state.intents,
        executions: state.executions,
        leaderboard: state.leaderboard
      }),
    [state.agents, state.intents, state.executions, state.leaderboard]
  );
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
    enabled: state.activeView === "arena",
    fullRefreshEveryMs: 5_000,
    loader: liveMarketLoader ?? defaultLiveMarketLoader,
    pollIntervalMs: 500,
    refreshLoader: liveMarketLoader ? undefined : defaultLiveMarketRefreshLoader
  });

  function navigate(view: PlatformView) {
    setState((currentState) => selectPlatformView(currentState, view));
  }

  return (
    <main className="min-h-screen bg-transparent text-on-surface">
      <AppNav activeView={state.activeView} onNavigate={navigate} />

      <div className="paper-frame mx-auto grid max-w-[1440px] gap-4 px-4 py-4">
        {claimRegistrationCode ? (
          <SuiDappKitAgentClaimPanel
            apiBaseUrl={apiBaseUrl}
            fetcher={platformFetcher}
            registrationCode={claimRegistrationCode}
          />
        ) : state.activeView === "lobby" ? (
          <LobbyPage competition={selectedCompetition} leaderboard={state.leaderboard} />
        ) : state.activeView === "arena" ? (
          <ArenaPage
            actionFeedItems={publicActionFeedItems}
            competition={selectedCompetition}
            liveMarketError={liveMarket.error}
            liveMarketSnapshot={liveMarket.snapshot}
            liveMarketStatus={liveMarket.status}
            userAgentProfile={userAgentProfile}
          />
        ) : (
          <LeaderboardPanel competition={selectedCompetition} entries={state.leaderboard} />
        )}
      </div>
    </main>
  );
}

function getClaimRegistrationCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const match = window.location.pathname.match(/^\/agent-arena\/claim\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
