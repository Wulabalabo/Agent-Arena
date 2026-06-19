import { Activity, Radio } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";

const chartWidth = 640;
const chartHeight = 176;
const traceLimit = 36;

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
  const [tracePoints, setTracePoints] = useState<PriceTracePoint[]>([]);
  const visibleTracePoints = useMemo(() => {
    if (!hasActiveReferenceTrace || !price) {
      return [];
    }

    return tracePoints.length > 0 ? tracePoints : seedTrace(price.spot, price.updatedAt);
  }, [hasActiveReferenceTrace, price, tracePoints]);
  const chartGeometry = useMemo(() => createChartGeometry(visibleTracePoints), [visibleTracePoints]);

  useEffect(() => {
    if (!price || status === "error") {
      return;
    }

    setTracePoints((currentPoints) => {
      const latestPoint = currentPoints[currentPoints.length - 1];
      if (latestPoint?.spot === price.spot && latestPoint.updatedAt === price.updatedAt) {
        return currentPoints;
      }

      const nextPoints = currentPoints.length > 0 ? currentPoints : seedTrace(price.spot, price.updatedAt);
      return [...nextPoints, { spot: price.spot, updatedAt: price.updatedAt }].slice(-traceLimit);
    });
  }, [price, status]);

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
              <path d={chartGeometry.candlePath} stroke="#e5e7eb" strokeWidth="4" />
              <path d={chartGeometry.connectorPath} stroke="#facc15" strokeWidth="3" />
              <path
                d={chartGeometry.tracePath}
                data-testid="btc-reference-trace"
                fill="none"
                stroke="#22c55e"
                strokeLinecap="round"
                strokeWidth="5"
              />
              <path d={chartGeometry.areaPath} fill="url(#arena-chart-fill)" />
              <circle cx={chartGeometry.lastPoint.x} cy={chartGeometry.lastPoint.y} fill="#ffffff" r="6" />
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

interface PriceTracePoint {
  spot: number;
  updatedAt: string;
}

interface ChartPoint {
  x: number;
  y: number;
}

function seedTrace(spot: number, updatedAt: string): PriceTracePoint[] {
  return Array.from({ length: 18 }, (_, index) => {
    const phase = index / 2.3;
    const drift = (index - 17) * spot * 0.000003;
    const pulse = Math.sin(phase) * spot * 0.00024;
    const pressure = Math.cos(phase * 0.7) * spot * 0.00012;

    return {
      spot: spot + drift + pulse + pressure,
      updatedAt
    };
  });
}

function createChartGeometry(points: PriceTracePoint[]) {
  const scaledPoints = scaleTracePoints(points);
  const tracePath = createLinePath(scaledPoints);

  return {
    areaPath: createAreaPath(scaledPoints, tracePath),
    candlePath: createCandlePath(points, scaledPoints),
    connectorPath: createConnectorPath(scaledPoints),
    lastPoint: scaledPoints[scaledPoints.length - 1] ?? { x: 616, y: 88 },
    tracePath
  };
}

function scaleTracePoints(points: PriceTracePoint[]): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const values = points.map((point) => point.spot);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(max * 0.0001, 1);
  const paddedMin = min - range * 0.18;
  const paddedMax = max + range * 0.18;
  const paddedRange = paddedMax - paddedMin || 1;
  const left = 24;
  const right = chartWidth - 24;
  const top = 18;
  const bottom = chartHeight - 24;
  const xSpan = right - left;
  const ySpan = bottom - top;
  const denominator = Math.max(points.length - 1, 1);

  return points.map((point, index) => ({
    x: round(left + (index / denominator) * xSpan),
    y: round(bottom - ((point.spot - paddedMin) / paddedRange) * ySpan)
  }));
}

function createLinePath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join("");
}

function createAreaPath(points: ChartPoint[], tracePath: string): string {
  if (points.length === 0 || !tracePath) {
    return "";
  }

  const firstPoint = points[0];
  return `${tracePath}V${chartHeight}H${firstPoint.x}V${firstPoint.y}Z`;
}

function createConnectorPath(points: ChartPoint[]): string {
  if (points.length < 2) {
    return "";
  }

  return points
    .slice(1)
    .map((point, index) => {
      const previousPoint = points[index];
      return `M${previousPoint.x} ${previousPoint.y}H${point.x}`;
    })
    .join("");
}

function createCandlePath(sourcePoints: PriceTracePoint[], scaledPoints: ChartPoint[]): string {
  if (scaledPoints.length === 0) {
    return "";
  }

  const values = sourcePoints.map((point) => point.spot);
  const range = Math.max(Math.max(...values) - Math.min(...values), values[0] * 0.00012, 1);

  return scaledPoints
    .map((point, index) => {
      const amplitude = 7 + Math.abs(Math.sin(index * 1.7)) * 13 + Math.min(range * 0.0002, 8);
      const high = clamp(point.y - amplitude, 14, chartHeight - 18);
      const low = clamp(point.y + amplitude, 14, chartHeight - 18);
      return `M${point.x} ${round(high)}V${round(low)}`;
    })
    .join("");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
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
