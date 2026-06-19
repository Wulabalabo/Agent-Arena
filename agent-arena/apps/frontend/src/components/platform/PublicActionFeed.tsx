import type { ReactNode } from "react";
import type { PublicActionFeedItem } from "../../features/platform/arena-ui";

interface PublicActionFeedProps {
  className?: string;
  items: PublicActionFeedItem[];
}

const maxVisibleFeedItems = 8;

export function PublicActionFeed({ className = "", items }: PublicActionFeedProps) {
  const visibleItems = [...items]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, maxVisibleFeedItems);

  return (
    <aside aria-label="Public action feed" className={`paper-card-sm flex min-h-0 flex-col overflow-hidden p-3 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Public action feed</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Public action feed</h2>
        </div>
        <span className="paper-chip px-2 py-1">{formatItemCount(items.length, visibleItems.length)}</span>
      </div>

      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="mt-3 h-[420px] max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto rounded-sm border-2 border-black bg-surface-container-lowest p-2 xl:h-[560px]"
        data-testid="public-action-feed-list"
      >
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => {
            const sizeDetail = formatSizeDetail(item);

            return (
              <article className={feedBubbleClass(item)} key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="paper-label text-on-surface-variant">{formatTimestamp(item.timestamp)}</p>
                    <h3 className="mt-1 font-display text-sm font-black uppercase text-on-surface">
                      {formatHeadline(item)}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <span className={`paper-chip px-2 py-1 ${walletScopeChipClass(item.walletScope)}`}>
                      {formatWalletScope(item.walletScope)}
                    </span>
                    <span className={`paper-chip px-2 py-1 ${statusChipClass(item.status)}`}>{item.status}</span>
                  </div>
                </div>

                {sizeDetail ? <FeedLine label="Size" value={sizeDetail} /> : null}
                <FeedLine label="Market" value={formatMarket(item)} />
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

function feedBubbleClass(item: PublicActionFeedItem): string {
  const baseClass = "max-w-[92%] rounded-2xl border-2 px-3 py-2 shadow-sm";
  const alignmentClass = item.walletScope === "owner" ? "ml-auto" : "mr-auto";

  if (item.status === "rejected" || item.status === "failed") {
    return `${baseClass} ${alignmentClass} border-outline-variant bg-[#fff7f7]`;
  }

  if (item.status === "partial" || item.status === "queued") {
    return `${baseClass} ${alignmentClass} border-outline-variant bg-[#fffaf0]`;
  }

  if (item.walletScope === "owner") {
    return `${baseClass} ${alignmentClass} border-black bg-[#eef6ff]`;
  }

  return `${baseClass} ${alignmentClass} border-black bg-[#f2fbf6]`;
}

function FeedLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="mt-2 min-w-0 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
    </p>
  );
}

function formatHeadline(item: PublicActionFeedItem): string {
  if (item.action === "score_update") {
    return `${item.agentDisplayName} scored ${item.scoreDelta?.toFixed(2) ?? "n/a"}`;
  }

  if (item.action === "executed") {
    return `${item.agentDisplayName} execution confirmed`;
  }

  if (item.action === "rejected") {
    return `${item.agentDisplayName} order rejected`;
  }

  if (item.action === "open_directional" && item.direction) {
    return `${item.agentDisplayName} bought ${item.direction}`;
  }

  if (item.action === "open_range" && item.lowerStrike && item.higherStrike) {
    return `${item.agentDisplayName} bought range ${item.lowerStrike}-${item.higherStrike}`;
  }

  return `${item.agentDisplayName} ${item.action.replace(/_/g, " ")}`;
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

function formatSizeDetail(item: PublicActionFeedItem): string | null {
  if (item.budgetRaw) {
    return `Budget ${item.budgetRaw}`;
  }

  const parts: string[] = [];
  if (item.quantity) {
    parts.push(`Qty ${item.quantity}`);
  }
  if (item.maxCost) {
    parts.push(`Max cost ${item.maxCost}`);
  }
  if (item.minProceeds) {
    parts.push(`Min proceeds ${item.minProceeds}`);
  }

  return parts.length > 0 ? parts.join(" / ") : null;
}

function formatScoreAndPnl(item: PublicActionFeedItem): string {
  const score = item.scoreDelta === undefined ? "Score n/a" : `Score ${item.scoreDelta.toFixed(2)}`;
  const pnl = item.pnlDeltaPct === undefined ? "PnL n/a" : `PnL ${(item.pnlDeltaPct * 100).toFixed(2)}%`;
  return `${score} / ${pnl}`;
}

function formatWalletScope(scope: PublicActionFeedItem["walletScope"]): string {
  return scope === "owner" ? "My wallet" : "Public";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(date);
}

function formatItemCount(totalCount: number, visibleCount: number): string {
  if (totalCount > visibleCount) {
    return `${visibleCount} of ${totalCount} shown`;
  }

  return `${totalCount} ${totalCount === 1 ? "item" : "items"}`;
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

function walletScopeChipClass(scope: PublicActionFeedItem["walletScope"]): string {
  return scope === "owner" ? "paper-chip-blue" : "";
}
