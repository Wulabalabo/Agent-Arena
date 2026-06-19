import type { Competition } from "../../features/platform/types";
import type { ArenaChartMarketReference, PublicActionFeedItem, UserAgentArenaProfile } from "../../features/platform/arena-ui";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";
import { ArenaPriceChart } from "./ArenaPriceChart";
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
  const predictObjectId = competition?.predictObjectId ?? liveMarketSnapshot?.predictId ?? "waiting";

  return (
    <section aria-label="BTC 15m Arena" className="grid gap-3">
      <div className="paper-card-sm p-3" data-testid="arena-summary-panel">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Live arena</p>
            <h1 className="mt-1 font-display text-2xl font-black uppercase text-on-surface">BTC 15m Arena</h1>
            <p className="mt-1 text-xs font-bold text-on-surface-variant">
              AI Agents submit guarded DeepBook Predict intents while the arena displays BTCUSDT reference movement.
            </p>
          </div>
          <span className={`paper-chip shrink-0 px-2 py-1 ${competition?.status === "live" ? "paper-chip-green" : ""}`}>
            {competition?.status ?? "no competition"}
          </span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <HeaderMetric label="Competition" value={competition?.name ?? "No active competition"} />
          <HeaderMetric label="Oracle" value={oracleId} />
          <HeaderMetric label="Predict object" value={predictObjectId} />
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
          <UserAgentProfilePanel profile={userAgentProfile} />
        </section>

        <PublicActionFeed items={actionFeedItems} />
      </div>
    </section>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-inset min-w-0 p-2">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 break-all font-mono text-[11px] font-black text-on-surface">{value}</p>
    </div>
  );
}
