import type { Competition } from "../../features/platform/types";
import type { ArenaChartMarketReference, PublicActionFeedItem, UserAgentArenaProfile } from "../../features/platform/arena-ui";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";
import { ArenaPriceChart } from "./ArenaPriceChart";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";
import { PublicActionFeed } from "./PublicActionFeed";
import { UserAgentProfilePanel } from "./UserAgentProfilePanel";

interface ArenaPageProps {
  actionFeedItems: PublicActionFeedItem[];
  competition?: Competition;
  liveMarketError: string | null;
  liveMarketSnapshot: LiveBtcMarketSnapshot | null;
  liveMarketStatus: LiveBtcMarketStatus;
  marketReference: ArenaChartMarketReference | null;
  userAgentProfile: UserAgentArenaProfile;
}

export function ArenaPage({
  actionFeedItems,
  competition,
  liveMarketError,
  liveMarketSnapshot,
  liveMarketStatus,
  marketReference,
  userAgentProfile
}: ArenaPageProps) {
  const oracleId = competition?.oracleId ?? liveMarketSnapshot?.oracle?.oracleId ?? "waiting";

  return (
    <section aria-label="BTC 15m Arena" className="grid gap-3">
      <div
        className="paper-card-sm flex flex-wrap items-center justify-between gap-2 px-3 py-2"
        data-testid="arena-info-bar"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Live arena</p>
            <h1 className="mt-0.5 font-display text-base font-black uppercase text-on-surface">BTC 15m Arena</h1>
          </div>
          <span className="paper-chip px-2 py-1">{competition?.name ?? "No active competition"}</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`paper-chip shrink-0 px-2 py-1 ${competition?.status === "live" ? "paper-chip-green" : ""}`}>
            {competition?.status ?? "no competition"}
          </span>
          <span className="paper-chip min-w-0 max-w-full px-2 py-1">
            <span className="truncate font-mono text-[10px] font-black">Oracle {oracleId}</span>
          </span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Arena market and my Agent" className="min-w-0 space-y-3">
          <ArenaPriceChart
            error={liveMarketError}
            marketReference={marketReference}
            snapshot={liveMarketSnapshot}
            status={liveMarketStatus}
          />
          {userAgentProfile.agentId ? <UserAgentProfilePanel profile={userAgentProfile} /> : <CopyAgentPromptPanel />}
        </section>

        <PublicActionFeed items={actionFeedItems} />
      </div>
    </section>
  );
}
