import type { ReactNode } from "react";
import type { PublicActionFeedItem } from "../../features/platform/arena-ui";

interface PublicActionFeedProps {
  items: PublicActionFeedItem[];
}

export function PublicActionFeed({ items }: PublicActionFeedProps) {
  let scoreUpdateLabelUsed = false;

  return (
    <aside aria-label="Public action feed" className="paper-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Public action feed</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Public action feed</h2>
        </div>
        <span className="paper-chip px-2 py-1">{items.length} items</span>
      </div>

      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => {
            const actionLabel = formatActionLabel(item, scoreUpdateLabelUsed);
            if (item.action === "score_update" && !scoreUpdateLabelUsed) {
              scoreUpdateLabelUsed = true;
            }

            return (
              <article className="paper-inset p-3" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="paper-label text-on-surface-variant">{formatTimestamp(item.timestamp)}</p>
                    <h3 className="mt-1 font-display text-sm font-black uppercase text-on-surface">{actionLabel}</h3>
                    <p
                      aria-label={`Agent ${item.agentDisplayName}`}
                      className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant"
                      title={item.agentDisplayName}
                    >
                      Agent {formatDisplayToken(item.agentDisplayName)}
                    </p>
                  </div>
                  <span className={`paper-chip shrink-0 px-2 py-1 ${statusChipClass(item.status)}`}>{item.status}</span>
                </div>

                <p className="mt-2 break-all font-mono text-[11px] font-bold text-on-surface-variant">
                  <span className="font-display text-[10px] uppercase">Market: </span>
                  {formatMarket(item)}
                </p>
                {item.reason ? <FeedLine label="Reason" value={item.reason} /> : null}
                {item.rejectionCode ? <FeedLine label="Rejection code" value={item.rejectionCode} /> : null}
                {item.predictTxDigest ? <FeedLine label="Predict tx" value={item.predictTxDigest} /> : null}
                {item.scoreDelta !== undefined || item.pnlDeltaPct !== undefined ? (
                  <FeedLine label="Score and PnL" value={formatScoreAndPnl(item)} />
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="paper-inset p-3 text-sm font-semibold text-on-surface-variant">No public actions yet.</p>
        )}
      </div>
    </aside>
  );
}

function FeedLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="mt-2 min-w-0 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
    </p>
  );
}

function formatActionLabel(item: PublicActionFeedItem, scoreUpdateLabelUsed: boolean): string {
  if (item.action === "rejected") {
    return "policy rejection";
  }

  if (item.action === "score_update" && scoreUpdateLabelUsed) {
    return "score delta";
  }

  return item.action.replace(/_/g, " ");
}

function formatMarket(item: PublicActionFeedItem): string {
  if (item.direction) {
    return `Direction ${item.direction}`;
  }

  if (item.lowerStrike && item.higherStrike) {
    return `Range ${item.lowerStrike}-${item.higherStrike}`;
  }

  if (item.action === "score_update") {
    return "Leaderboard scoring";
  }

  if (item.action === "executed") {
    return "Predict execution";
  }

  return "Market detail unavailable";
}

function formatScoreAndPnl(item: PublicActionFeedItem): string {
  const score = item.scoreDelta === undefined ? "Score n/a" : `Score ${item.scoreDelta.toFixed(2)}`;
  const pnl = item.pnlDeltaPct === undefined ? "PnL n/a" : `PnL ${(item.pnlDeltaPct * 100).toFixed(2)}%`;
  return `${score} / ${pnl}`;
}

function formatDisplayToken(value: string): string {
  return value.replace(/\s+/g, " / ");
}

function formatTimestamp(value: string): string {
  return `${value.slice(11, 19)} UTC`;
}

function statusChipClass(status: PublicActionFeedItem["status"]): string {
  switch (status) {
    case "accepted":
    case "executed":
    case "info":
      return "paper-chip-green";
    case "rejected":
    case "failed":
      return "paper-chip-red";
    case "partial":
      return "paper-chip-orange";
    case "queued":
      return "";
  }
}
