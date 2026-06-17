import { Activity, Clock3, Play, Radio, RotateCcw } from "lucide-react";
import type {
  AgentIntent,
  AgentPositionSnapshot,
  AgentProfile,
  Competition,
  ExecutionRecord,
  RiskDecision,
  TradingWallet
} from "../../features/platform/types";
import type { LiveBtcMarketEvent, LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";
import { AgentActivityPanel } from "./AgentActivityPanel";

interface LiveCompetitionProps {
  agents: AgentProfile[];
  competition?: Competition;
  executions: ExecutionRecord[];
  intents: AgentIntent[];
  positions?: AgentPositionSnapshot[];
  riskDecisions: RiskDecision[];
  selectedAgent?: AgentProfile;
  tradingWallet: TradingWallet;
  liveMarketSnapshot?: LiveBtcMarketSnapshot | null;
  liveMarketStatus?: LiveBtcMarketStatus;
  liveMarketError?: string | null;
  onSelectAgent: (agentId: string) => void;
  onViewReplay: () => void;
}

export function LiveCompetition({
  agents,
  competition,
  executions,
  intents,
  positions = [],
  riskDecisions,
  selectedAgent,
  tradingWallet,
  liveMarketSnapshot = null,
  liveMarketStatus = "idle",
  liveMarketError = null,
  onSelectAgent,
  onViewReplay
}: LiveCompetitionProps) {
  if (!competition) {
    return (
      <section aria-label="Live Competition" className="paper-card-sm p-5">
        <p className="paper-label text-on-surface-variant">Live Competition</p>
        <h1 className="mt-2 font-display text-xl font-black uppercase text-on-surface">No live arena selected</h1>
      </section>
    );
  }

  return (
    <section aria-label="Live Competition" className="space-y-4">
      <div className="paper-card-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Live Competition</p>
            <h1 className="mt-1 truncate font-display text-2xl font-black uppercase text-on-surface">{competition.name}</h1>
            <p className="mt-2 break-all font-mono text-[11px] font-bold text-on-surface-variant">
              Oracle {competition.oracleId} / Predict object {competition.predictObjectId}
            </p>
          </div>
          <button
            className="paper-button inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
            type="button"
            onClick={onViewReplay}
          >
            <RotateCcw aria-hidden="true" size={14} />
            View Replay
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="paper-inset min-h-44 p-4">
            <div className="flex items-center gap-2">
              <Play aria-hidden="true" size={16} className="text-on-surface-variant" />
              <p className="paper-label text-on-surface-variant">K-line battlefield reserved</p>
            </div>
            <LiveMarketReadout
              error={liveMarketError}
              snapshot={liveMarketSnapshot}
              status={liveMarketStatus}
            />
          </div>

          <div className="paper-inset p-4">
            <label className="paper-label text-on-surface-variant" htmlFor="selected-agent">
              Selected agent
            </label>
            <select
              className="paper-inset mt-2 w-full rounded-md px-3 py-2 font-display text-xs font-black uppercase text-on-surface"
              id="selected-agent"
              value={selectedAgent?.id ?? ""}
              onChange={(event) => onSelectAgent(event.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName}
                </option>
              ))}
            </select>

            <div className="mt-3 grid gap-2">
              <RuntimeMetric label="Runtime status" value={selectedAgent?.runtimeStatus ?? "unselected"} />
              <RuntimeMetric label="Exposure" value={selectedAgent?.exposureStatus ?? "none"} />
              <RuntimeMetric label="Trading wallet" value={selectedAgent?.tradingWalletAddress ?? "none"} />
            </div>
          </div>
        </div>

        <LiveBettingFlow snapshot={liveMarketSnapshot} />

        <div className="mt-4">
          <p className="paper-label text-on-surface-variant">Allowed actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {competition.allowedActions.map((action) => (
              <span className="paper-chip px-2 py-1" key={action}>
                {action}
              </span>
            ))}
          </div>
        </div>
      </div>

      <AgentActivityPanel
        executions={executions}
        intents={intents}
        positions={positions}
        riskDecisions={riskDecisions}
        tradingWallet={tradingWallet}
      />
    </section>
  );
}

interface RuntimeMetricProps {
  label: string;
  value: string;
}

function RuntimeMetric({ label, value }: RuntimeMetricProps) {
  return (
    <div className="min-w-0">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-bold text-on-surface">{value}</p>
    </div>
  );
}

interface LiveMarketReadoutProps {
  snapshot: LiveBtcMarketSnapshot | null;
  status: LiveBtcMarketStatus;
  error: string | null;
}

function LiveMarketReadout({ snapshot, status, error }: LiveMarketReadoutProps) {
  const price = snapshot?.price;

  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <LiveMetric
          label="BTC spot"
          value={price ? formatUsd(price.spot) : "Waiting"}
          detail={price?.updatedAt ? `Oracle price ${formatTimeUtc(price.updatedAt)}` : "0.5s refresh"}
        />
        <LiveMetric
          label="Forward"
          value={price?.forward ? formatUsd(price.forward) : "Waiting"}
          detail={price?.checkpoint ? `Checkpoint ${price.checkpoint}` : "Predict oracle"}
        />
        <LiveMetric
          label="Oracle expires"
          value={snapshot?.oracle ? formatDuration(snapshot.oracle.secondsToExpiry) : "Waiting"}
          detail={snapshot?.oracle ? formatUtc(snapshot.oracle.expiresAt) : "No future BTC oracle"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-on-surface-variant">
        <span className="paper-chip px-2 py-1">
          <Radio aria-hidden="true" size={12} />
          0.5s refresh
        </span>
        <span className="paper-chip px-2 py-1">
          <Activity aria-hidden="true" size={12} />
          {snapshot?.serverStatus ?? status}
        </span>
        {snapshot?.fetchedAt ? (
          <span className="paper-chip px-2 py-1">Last poll {formatUtcWithMs(snapshot.fetchedAt)}</span>
        ) : null}
        {error ? <span className="paper-chip paper-chip-red px-2 py-1">{error}</span> : null}
      </div>
    </div>
  );
}

interface LiveMetricProps {
  label: string;
  value: string;
  detail: string;
}

function LiveMetric({ label, value, detail }: LiveMetricProps) {
  return (
    <div className="min-w-0 border-2 border-black bg-white p-3">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-2 truncate font-display text-lg font-black text-on-surface">{value}</p>
      <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">{detail}</p>
    </div>
  );
}

function LiveBettingFlow({ snapshot }: { snapshot: LiveBtcMarketSnapshot | null }) {
  const events = snapshot?.events ?? [];

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[0.34fr_0.66fr]">
      <div className="paper-inset p-4">
        <div className="flex items-center gap-2">
          <Clock3 aria-hidden="true" size={16} className="text-on-surface-variant" />
          <p className="paper-label text-on-surface-variant">Market time</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <RuntimeMetric label="Server time" value={snapshot ? formatUtc(snapshot.serverTime) : "waiting"} />
          <RuntimeMetric label="Active BTC oracles" value={String(snapshot?.oracleCounts.activeFutureBtc ?? 0)} />
          <RuntimeMetric label="Oracle trades" value={String(snapshot?.currentOracleTradeCount ?? 0)} />
        </div>
      </div>

      <div className="paper-inset p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="paper-label text-on-surface-variant">Latest Predict flow</p>
          <p className="font-mono text-[11px] font-bold text-on-surface-variant">
            {snapshot?.fetchedAt ? `Fetched ${formatUtc(snapshot.fetchedAt)}` : "Waiting for Predict server"}
          </p>
        </div>

        <div className="mt-3 grid gap-2">
          {events.length > 0 ? (
            events.map((event) => <BettingEventRow event={event} key={event.id} quoteAssetLabel={snapshot?.quoteAssetLabel ?? "DUSDC"} />)
          ) : (
            <p className="text-sm font-semibold text-on-surface-variant">
              No Predict position events loaded yet for the selected market.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BettingEventRow({ event, quoteAssetLabel }: { event: LiveBtcMarketEvent; quoteAssetLabel: string }) {
  return (
    <div className="grid gap-2 border-2 border-black bg-white p-3 sm:grid-cols-[0.85fr_1fr_0.8fr]">
      <div className="min-w-0">
        <p className="font-display text-xs font-black uppercase text-on-surface">{formatEventKind(event.kind)}</p>
        <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">{formatUtc(event.timestamp)}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-xs font-black text-on-surface">{formatEventMarket(event)}</p>
        <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">
          {formatEventRawMarket(event)} / Qty raw {event.quantityRaw ?? "unknown"}
        </p>
      </div>
      <div className="min-w-0 text-left sm:text-right">
        <p className="font-mono text-xs font-black text-on-surface">
          {event.quoteAmount === null ? "No quote" : `${formatFixed(event.quoteAmount, 6)} ${quoteAssetLabel}`}
        </p>
        <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">
          {event.probabilityPrice === null ? "No price" : `Px ${formatFixed(event.probabilityPrice, 6)}`}
        </p>
      </div>
    </div>
  );
}

function formatEventKind(kind: LiveBtcMarketEvent["kind"]): string {
  return {
    oracle_trade: "Oracle trade",
    position_minted: "Position minted",
    position_redeemed: "Position redeemed",
    range_minted: "Range minted",
    range_redeemed: "Range redeemed"
  }[kind];
}

function formatEventMarket(event: LiveBtcMarketEvent): string {
  if (event.direction && event.strike !== null) {
    return `${event.direction} ${formatNumber(event.strike)}`;
  }

  if (event.lowerStrike !== null && event.higherStrike !== null) {
    return `${formatNumber(event.lowerStrike)} - ${formatNumber(event.higherStrike)}`;
  }

  return "Market unknown";
}

function formatEventRawMarket(event: LiveBtcMarketEvent): string {
  if (event.direction && event.strikeRaw) {
    return `Strike raw ${event.strikeRaw}`;
  }

  if (event.lowerStrikeRaw && event.higherStrikeRaw) {
    return `Range raw ${event.lowerStrikeRaw} - ${event.higherStrikeRaw}`;
  }

  return "Market raw unknown";
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatFixed(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  });
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatUtc(iso: string): string {
  return `${iso.slice(0, 19).replace("T", " ")} UTC`;
}

function formatUtcWithMs(iso: string): string {
  return `${iso.slice(0, 23).replace("T", " ")} UTC`;
}

function formatTimeUtc(iso: string): string {
  return `${iso.slice(11, 19)} UTC`;
}
