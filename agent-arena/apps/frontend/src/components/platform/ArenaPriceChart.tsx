import { Activity, Radio } from "lucide-react";
import type { ReactNode } from "react";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
  year: "numeric"
});

interface ArenaPriceChartProps {
  error: string | null;
  snapshot: LiveBtcMarketSnapshot | null;
  status: LiveBtcMarketStatus;
}

export function ArenaPriceChart({ error, snapshot, status }: ArenaPriceChartProps) {
  const price = snapshot?.price;
  const oracle = snapshot?.oracle;
  const hasActiveReferenceTrace = Boolean(price) && status !== "error";

  return (
    <section aria-label="BTC reference chart" className="paper-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">BTC reference chart</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Binance BTCUSDT heartbeat</h2>
        </div>
        <span className={`paper-chip shrink-0 px-2 py-1 ${hasActiveReferenceTrace ? "paper-chip-green" : status === "error" ? "paper-chip-red" : ""}`}>
          <Radio aria-hidden="true" size={12} />
          {status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="paper-chip paper-chip-blue px-2 py-1">
          <Radio aria-hidden="true" size={12} />
          Binance BTCUSDT reference display
        </span>
        <span className="paper-chip px-2 py-1">
          <Activity aria-hidden="true" size={12} />
          Predict oracle drives arena settlement
        </span>
        {hasActiveReferenceTrace ? (
          <span className="paper-chip paper-chip-green px-2 py-1">Active BTC reference trace</span>
        ) : (
          <span className="paper-chip px-2 py-1">Waiting for BTC reference data</span>
        )}
      </div>

      <div className="mt-4 h-44 w-full overflow-hidden rounded-sm border-2 border-black bg-[#111827] text-white">
        <svg aria-hidden="true" className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 640 176">
          <defs>
            <linearGradient id="arena-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 38H640M0 88H640M0 138H640" stroke="#374151" strokeDasharray="6 8" strokeWidth="1" />
          {hasActiveReferenceTrace ? (
            <>
              <path d="M72 20V78M128 54V124M184 30V92M240 62V146M296 42V112M352 24V86M408 58V132M464 34V102M520 48V118M576 26V92" stroke="#e5e7eb" strokeWidth="4" />
              <path d="M72 56H128M128 86H184M184 58H240M240 112H296M296 76H352M352 52H408M408 96H464M464 68H520M520 82H576" stroke="#facc15" strokeWidth="3" />
              <path d="M24 120C62 118 76 66 112 74C151 83 158 130 200 116C239 103 245 38 288 50C332 62 324 119 368 107C412 95 414 40 456 54C494 66 496 124 536 108C570 94 582 48 616 52" fill="none" stroke="#22c55e" strokeLinecap="round" strokeWidth="5" />
              <path d="M24 120C62 118 76 66 112 74C151 83 158 130 200 116C239 103 245 38 288 50C332 62 324 119 368 107C412 95 414 40 456 54C494 66 496 124 536 108C570 94 582 48 616 52V176H24Z" fill="url(#arena-chart-fill)" />
              <circle cx="616" cy="52" fill="#ffffff" r="6" />
            </>
          ) : (
            <>
              <path d="M72 68V108M128 70V112M184 66V106M240 72V116M296 70V112M352 68V108M408 72V116M464 70V112M520 68V108M576 72V116" stroke="#6b7280" strokeWidth="4" />
              <path d="M24 100C78 92 116 112 168 100C222 88 260 112 312 100C366 88 404 112 456 100C510 88 556 112 616 100" fill="none" stroke="#9ca3af" strokeDasharray="10 10" strokeLinecap="round" strokeWidth="5" />
            </>
          )}
        </svg>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <ChartMetric
          label="Reference BTC"
          value={price ? formatUsd(price.spot) : "Waiting"}
          detail={price?.updatedAt ? `Updated ${formatTimeUtc(price.updatedAt)}` : "Waiting for BTC reference data"}
        />
        <ChartMetric
          label="Predict oracle"
          value={oracle?.oracleId ?? "Waiting"}
          detail={snapshot?.predictId ? `Predict ${snapshot.predictId}` : "No oracle loaded"}
        />
        <ChartMetric
          label="Oracle expiry"
          value={oracle ? formatDuration(oracle.secondsToExpiry) : "Waiting"}
          detail={oracle?.expiresAt ? formatUtc(oracle.expiresAt) : "No active BTC future"}
        />
        <ChartMetric
          label="Predict status"
          value={error ?? snapshot?.serverStatus ?? status}
          detail={snapshot?.fetchedAt ? `Fetched ${formatUtcWithMs(snapshot.fetchedAt)}` : "Awaiting market snapshot"}
        />
      </div>
    </section>
  );
}

function ChartMetric({ detail, label, value }: { detail: string; label: string; value: ReactNode }) {
  return (
    <div className="paper-inset min-w-0 p-3">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-2 truncate font-mono text-xs font-black text-on-surface">{value}</p>
      <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">{detail}</p>
    </div>
  );
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatUtc(value: string): string {
  const parts = readUtcDateTimeParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}` : "Time unavailable";
}

function formatUtcWithMs(value: string): string {
  const parts = readUtcDateTimeParts(value);
  return parts
    ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${parts.millisecond} ${parts.timeZoneName}`
    : "Time unavailable";
}

function formatTimeUtc(value: string): string {
  const parts = readUtcDateTimeParts(value);
  return parts ? `${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}` : "Time unavailable";
}

function readUtcDateTimeParts(value: string | null | undefined): {
  day: string;
  hour: string;
  millisecond: string;
  minute: string;
  month: string;
  second: string;
  timeZoneName: string;
  year: string;
} | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = utcDateTimeFormatter.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }

    return result;
  }, {});

  if (!parts.day || !parts.hour || !parts.minute || !parts.month || !parts.second || !parts.year) {
    return null;
  }

  return {
    day: parts.day,
    hour: parts.hour,
    millisecond: String(date.getUTCMilliseconds()).padStart(3, "0"),
    minute: parts.minute,
    month: parts.month,
    second: parts.second,
    timeZoneName: parts.timeZoneName ?? "UTC",
    year: parts.year
  };
}
