import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  createArenaChartMarketReference,
  createPublicActionFeedItems,
  createUserAgentArenaProfile
} from "./features/platform/arena-ui";
import { createPlatformClient } from "./features/platform/client";
import { platformConfig } from "./features/platform/config";
import { mockPlatformSnapshot } from "./features/platform/mock";
import type { MarketSnapshot } from "./features/platform/types";
import {
  createInitialPlatformState,
  getSelectedAgent,
  getSelectedCompetition,
  selectPlatformView,
  type PlatformView
} from "./state/platform";

const apiBaseUrl = platformConfig.apiBaseUrl;

interface AppProps {
  liveMarketLoader?: () => Promise<LiveBtcMarketSnapshot>;
  platformFetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}

export default function App({ liveMarketLoader, platformFetcher }: AppProps = {}) {
  const [state, setState] = useState(() => createInitialPlatformState(mockPlatformSnapshot));
  const [marketState, setMarketState] = useState<MarketSnapshot | null>(null);
  const marketStateRequestSequenceRef = useRef(0);
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
  const chartMarketReference = useMemo(
    () =>
      selectedCompetition
        ? createArenaChartMarketReference({
            competitionId: selectedCompetition.id,
            intents: state.intents,
            marketState,
            positions: state.positions
          })
        : null,
    [marketState, selectedCompetition, state.intents, state.positions]
  );
  const platformClient = useMemo(
    () => createPlatformClient({ baseUrl: apiBaseUrl, fetcher: platformFetcher }),
    [platformFetcher]
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

  useEffect(() => {
    if (state.activeView !== "arena" || !selectedCompetition) {
      setMarketState(null);
      return;
    }

    let cancelled = false;
    let requestPending = false;

    const loadMarketState = async () => {
      if (requestPending) {
        return;
      }

      requestPending = true;
      const requestSequence = marketStateRequestSequenceRef.current + 1;
      marketStateRequestSequenceRef.current = requestSequence;

      try {
        const nextMarketState = await platformClient.getCompetitionMarketState(selectedCompetition.id);
        if (!cancelled && marketStateRequestSequenceRef.current === requestSequence) {
          setMarketState(nextMarketState);
        }
      } catch {
        if (!cancelled && marketStateRequestSequenceRef.current === requestSequence) {
          setMarketState(null);
        }
      } finally {
        requestPending = false;
      }
    };

    void loadMarketState();
    const intervalId = window.setInterval(() => {
      void loadMarketState();
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [platformClient, selectedCompetition, state.activeView]);

  function navigate(view: PlatformView) {
    const clearedClaimRoute = Boolean(claimRegistrationCode) && typeof window !== "undefined";

    if (clearedClaimRoute) {
      window.history.pushState({}, "", "/");
    }

    setState((currentState) => {
      const nextState = selectPlatformView(currentState, view);
      return clearedClaimRoute && nextState === currentState ? { ...currentState } : nextState;
    });
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
            marketReference={chartMarketReference}
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
