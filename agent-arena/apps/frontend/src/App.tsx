import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DAppKitContext, useWalletConnection } from "@mysten/dapp-kit-react";
import { ArenaPage } from "./components/platform/ArenaPage";
import { LeaderboardPanel } from "./components/platform/LeaderboardPanel";
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
import type { AgentProfile, MarketSnapshot, OwnerAgentProfile, PublicArenaActivity } from "./features/platform/types";
import {
  createInitialPlatformState,
  getSelectedCompetition,
  selectPlatformView,
  type PlatformView
} from "./state/platform";

const apiBaseUrl = platformConfig.apiBaseUrl;
const MARKET_STATE_REFRESH_INTERVAL_MS = 5_000;
const PUBLIC_ACTIVITY_REFRESH_INTERVAL_MS = 15_000;
const OWNER_AGENT_PROFILE_REFRESH_INTERVAL_MS = 15_000;
const emptyPublicArenaActivity: PublicArenaActivity = {
  agents: [],
  intents: [],
  executions: [],
  leaderboard: [],
  ownerAgentIds: []
};

interface AppProps {
  connectedOwnerAddress?: string | null;
  liveMarketLoader?: () => Promise<LiveBtcMarketSnapshot>;
  platformFetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}

export default function App({ connectedOwnerAddress, liveMarketLoader, platformFetcher }: AppProps = {}) {
  const dAppKit = useContext(DAppKitContext);

  if (!dAppKit) {
    return (
      <AppContent
        connectedOwnerAddress={connectedOwnerAddress ?? null}
        liveMarketLoader={liveMarketLoader}
        platformFetcher={platformFetcher}
      />
    );
  }

  return (
    <WalletAwareApp
      connectedOwnerAddress={connectedOwnerAddress}
      liveMarketLoader={liveMarketLoader}
      platformFetcher={platformFetcher}
    />
  );
}

function WalletAwareApp({ connectedOwnerAddress, liveMarketLoader, platformFetcher }: AppProps) {
  const connection = useWalletConnection();
  const ownerAddress =
    connectedOwnerAddress ?? (connection.status === "connected" ? connection.account.address : null);

  return (
    <AppContent
      connectedOwnerAddress={ownerAddress}
      liveMarketLoader={liveMarketLoader}
      platformFetcher={platformFetcher}
    />
  );
}

function AppContent({ connectedOwnerAddress, liveMarketLoader, platformFetcher }: AppProps) {
  const [state, setState] = useState(() => createInitialPlatformState(mockPlatformSnapshot));
  const [marketState, setMarketState] = useState<MarketSnapshot | null>(null);
  const [publicActivity, setPublicActivity] = useState<PublicArenaActivity | null>(null);
  const [ownerAgentProfile, setOwnerAgentProfile] = useState<OwnerAgentProfile | null>(null);
  const [ownerAgentProfileAddress, setOwnerAgentProfileAddress] = useState<string | null>(null);
  const marketStateRequestSequenceRef = useRef(0);
  const publicActivityRequestSequenceRef = useRef(0);
  const ownerAgentProfileRequestSequenceRef = useRef(0);
  const selectedCompetition = useMemo(() => getSelectedCompetition(state), [state]);
  const claimRegistrationCode = getClaimRegistrationCode();
  const normalizedConnectedOwnerAddress = connectedOwnerAddress ? normalizeAddress(connectedOwnerAddress) : null;
  const ownerAgentProfileMatchesConnection = ownerAgentProfileAddress === normalizedConnectedOwnerAddress;
  const ownerAgent = useMemo(
    () =>
      ownerAgentProfileMatchesConnection
        ? ownerAgentProfile?.agent ?? null
        : findOwnerAgent(state.agents, connectedOwnerAddress ?? null),
    [connectedOwnerAddress, ownerAgentProfile, ownerAgentProfileMatchesConnection, state.agents]
  );
  const userAgentProfile = useMemo(
    () =>
      createUserAgentArenaProfile({
        agent: ownerAgent,
        tradingWallet: ownerAgentProfileMatchesConnection ? ownerAgentProfile?.tradingWallet ?? null : state.tradingWallet,
        positions: ownerAgentProfileMatchesConnection ? ownerAgentProfile?.positions ?? [] : state.positions,
        intents: ownerAgentProfileMatchesConnection ? ownerAgentProfile?.intents ?? [] : state.intents,
        executions: ownerAgentProfileMatchesConnection ? ownerAgentProfile?.executions ?? [] : state.executions,
        leaderboard: ownerAgentProfileMatchesConnection ? ownerAgentProfile?.leaderboard ?? [] : state.leaderboard
      }),
    [
      ownerAgent,
      ownerAgentProfile,
      ownerAgentProfileMatchesConnection,
      state.tradingWallet,
      state.positions,
      state.intents,
      state.executions,
      state.leaderboard
    ]
  );
  const publicActionFeedItems = useMemo(
    () => {
      const activity = publicActivity ?? emptyPublicArenaActivity;

      return createPublicActionFeedItems({
        agents: activity.agents ?? [],
        intents: activity.intents ?? [],
        executions: activity.executions ?? [],
        leaderboard: activity.leaderboard ?? [],
        ownerAgentId: ownerAgent?.id ?? null,
        ownerAgentIds: activity.ownerAgentIds ?? []
      });
    },
    [ownerAgent?.id, publicActivity]
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
    if (state.activeView !== "arena" || claimRegistrationCode || !connectedOwnerAddress) {
      setOwnerAgentProfile(null);
      setOwnerAgentProfileAddress(null);
      return;
    }

    let cancelled = false;
    let requestPending = false;
    const normalizedOwnerAddress = normalizeAddress(connectedOwnerAddress);
    setOwnerAgentProfile(null);
    setOwnerAgentProfileAddress(null);

    const loadOwnerAgentProfile = async () => {
      if (requestPending) {
        return;
      }

      requestPending = true;
      const requestSequence = ownerAgentProfileRequestSequenceRef.current + 1;
      ownerAgentProfileRequestSequenceRef.current = requestSequence;

      try {
        const nextOwnerAgentProfile = await platformClient.getOwnerAgentProfile(connectedOwnerAddress);
        if (!cancelled && ownerAgentProfileRequestSequenceRef.current === requestSequence) {
          setOwnerAgentProfile(nextOwnerAgentProfile);
          setOwnerAgentProfileAddress(normalizedOwnerAddress);
        }
      } catch {
        if (!cancelled && ownerAgentProfileRequestSequenceRef.current === requestSequence) {
          setOwnerAgentProfile(null);
          setOwnerAgentProfileAddress(normalizedOwnerAddress);
        }
      } finally {
        requestPending = false;
      }
    };

    void loadOwnerAgentProfile();
    const intervalId = window.setInterval(() => {
      void loadOwnerAgentProfile();
    }, OWNER_AGENT_PROFILE_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [claimRegistrationCode, connectedOwnerAddress, platformClient, state.activeView]);

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
    }, MARKET_STATE_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [platformClient, selectedCompetition, state.activeView]);

  useEffect(() => {
    if (state.activeView !== "arena" || !selectedCompetition) {
      setPublicActivity(null);
      return;
    }

    let cancelled = false;
    let requestPending = false;

    const loadPublicActivity = async () => {
      if (requestPending) {
        return;
      }

      requestPending = true;
      const requestSequence = publicActivityRequestSequenceRef.current + 1;
      publicActivityRequestSequenceRef.current = requestSequence;

      try {
        const nextPublicActivity = await platformClient.listCompetitionPublicActivity(
          selectedCompetition.id,
          connectedOwnerAddress
        );
        if (!cancelled && publicActivityRequestSequenceRef.current === requestSequence) {
          setPublicActivity(nextPublicActivity);
        }
      } catch {
        if (!cancelled && publicActivityRequestSequenceRef.current === requestSequence) {
          setPublicActivity(null);
        }
      } finally {
        requestPending = false;
      }
    };

    void loadPublicActivity();
    const intervalId = window.setInterval(() => {
      void loadPublicActivity();
    }, PUBLIC_ACTIVITY_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [connectedOwnerAddress, platformClient, selectedCompetition, state.activeView]);

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

function findOwnerAgent(agents: AgentProfile[], ownerAddress: string | null): AgentProfile | null {
  if (!ownerAddress) {
    return null;
  }

  const normalizedOwnerAddress = normalizeAddress(ownerAddress);
  return agents
    .filter((agent) => normalizeAddress(agent.ownerAddress) === normalizedOwnerAddress)
    .sort((left, right) => compareOwnerAgentPriority(right, left))[0] ?? null;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function compareOwnerAgentPriority(left: AgentProfile, right: AgentProfile): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
  if (safeLeftTime !== safeRightTime) {
    return safeLeftTime - safeRightTime;
  }

  return getAgentNumericId(left.id) - getAgentNumericId(right.id);
}

function getAgentNumericId(agentId: string): number {
  const match = agentId.match(/_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function getClaimRegistrationCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const match = window.location.pathname.match(/^\/agent-arena\/claim\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
