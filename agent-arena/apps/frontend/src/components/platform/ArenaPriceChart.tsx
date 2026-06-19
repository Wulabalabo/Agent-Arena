import { Activity, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ArenaChartMarketReference } from "../../features/platform/arena-ui";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";

const traceLimit = 36;
const viewBoxWidth = 640;
const viewBoxHeight = 232;
const plotBounds = {
  bottom: 172,
  left: 22,
  right: 552,
  top: 28
} as const;

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
  marketReference?: ArenaChartMarketReference | null;
  snapshot: LiveBtcMarketSnapshot | null;
  status: LiveBtcMarketStatus;
}

export function ArenaPriceChart({ error, marketReference = null, snapshot, status }: ArenaPriceChartProps) {
  const price = snapshot?.price;
  const oracle = snapshot?.oracle;
  const spot = price?.spot;
  const priceUpdatedAt = price?.updatedAt;
  const hasActiveReferenceTrace = Boolean(price) && status !== "error";
  const [tracePoints, setTracePoints] = useState<PriceTracePoint[]>([]);
  const renderedTracePointsRef = useRef<PriceTracePoint[]>([]);
  const [renderedTracePoints, setRenderedTracePointsState] = useState<PriceTracePoint[]>([]);
  const setRenderedTracePoints = (points: PriceTracePoint[]) => {
    renderedTracePointsRef.current = points;
    setRenderedTracePointsState(points);
  };
  const visibleTracePoints = useMemo(() => {
    if (!hasActiveReferenceTrace || typeof spot !== "number" || !priceUpdatedAt) {
      return [];
    }

    return tracePoints.length > 0 ? tracePoints : seedTrace(spot, priceUpdatedAt);
  }, [hasActiveReferenceTrace, priceUpdatedAt, spot, tracePoints]);
  const chartSourcePoints = renderedTracePoints.length > 0 ? renderedTracePoints : visibleTracePoints;
  const referencePrices = useMemo(() => createReferencePrices(marketReference), [marketReference]);
  const chartPriceRange = useMemo(() => createPriceRange(visibleTracePoints, referencePrices), [referencePrices, visibleTracePoints]);
  const chartGeometry = useMemo(
    () => createChartGeometry(chartSourcePoints, chartPriceRange, marketReference),
    [chartPriceRange, chartSourcePoints, marketReference]
  );

  useEffect(() => {
    if (typeof spot !== "number" || !priceUpdatedAt || status === "error") {
      return;
    }

    setTracePoints((currentPoints) => {
      const latestPoint = currentPoints[currentPoints.length - 1];
      if (latestPoint?.spot === spot && latestPoint.updatedAt === priceUpdatedAt) {
        return currentPoints;
      }

      const nextPoints = currentPoints.length > 0 ? currentPoints : seedTrace(spot, priceUpdatedAt);
      return [...nextPoints, { spot, updatedAt: priceUpdatedAt }].slice(-traceLimit);
    });
  }, [priceUpdatedAt, spot, status]);

  useEffect(() => {
    if (!hasActiveReferenceTrace || visibleTracePoints.length === 0) {
      setRenderedTracePoints([]);
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setRenderedTracePoints(visibleTracePoints);
      return;
    }

    const startPoints = alignTracePoints(renderedTracePointsRef.current, visibleTracePoints);
    const startAt = window.performance.now();
    const durationMs = 360;
    let frameId = 0;

    const animate = (now: number) => {
      const progress = clamp((now - startAt) / durationMs, 0, 1);
      const easedProgress = easeOutCubic(progress);
      const nextPoints = visibleTracePoints.map((point, index) => ({
        spot: lerp(startPoints[index]?.spot ?? point.spot, point.spot, easedProgress),
        updatedAt: point.updatedAt
      }));

      setRenderedTracePoints(nextPoints);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [hasActiveReferenceTrace, visibleTracePoints]);

  return (
    <section aria-label="BTC reference chart" className="paper-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">BTC reference chart</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Binance BTCUSDT line</h2>
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
          <span className="paper-chip paper-chip-green px-2 py-1">Active BTC price line</span>
        ) : (
          <span className="paper-chip px-2 py-1">Waiting for BTC reference data</span>
        )}
      </div>

      <div className="relative mt-4 h-72 w-full overflow-hidden rounded-sm border-2 border-black bg-white text-slate-700">
        <svg aria-label="BTC price line chart" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="img" viewBox="0 0 640 232">
          <path d="M22 28H552M22 76H552M22 124H552M22 172H552" stroke="#e5e7eb" strokeWidth="1" />
          {hasActiveReferenceTrace ? (
            <>
              {chartGeometry.referenceLines.map((referenceLine) => (
                <line
                  data-testid={`btc-${referenceLine.id}-line`}
                  key={referenceLine.id}
                  stroke="#cbd5e1"
                  strokeDasharray="7 8"
                  strokeWidth="1.4"
                  x1={plotBounds.left}
                  x2={plotBounds.right}
                  y1={referenceLine.y}
                  y2={referenceLine.y}
                />
              ))}
              <path
                d={chartGeometry.tracePath}
                data-testid="btc-reference-line"
                fill="none"
                stroke="#f59e0b"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </>
          ) : (
            <>
              <path
                d="M38 126C82 112 104 118 141 96C181 73 220 81 260 93C302 106 335 91 371 82C414 72 449 93 486 83C519 74 541 79 552 76"
                fill="none"
                stroke="#cbd5e1"
                strokeDasharray="10 10"
                strokeLinecap="round"
                strokeWidth="3"
              />
            </>
          )}
        </svg>
        {hasActiveReferenceTrace ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-10 aspect-square w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#f59e0b] bg-white"
              data-testid="btc-current-marker"
              style={{
                left: `${(chartGeometry.lastPoint.x / viewBoxWidth) * 100}%`,
                top: `${(chartGeometry.lastPoint.y / viewBoxHeight) * 100}%`
              }}
            >
              <span className="absolute left-1/2 top-1/2 aspect-square w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f59e0b]" />
            </span>
            {chartGeometry.referenceLines.map((referenceLine) => (
              <span
                className="pointer-events-none absolute h-5 min-w-14 -translate-y-1/2 rounded-full bg-[#8b949e] px-2 text-center font-mono text-[10px] font-black leading-5 text-white"
                key={referenceLine.id}
                style={{ left: `${(566 / viewBoxWidth) * 100}%`, top: `${(referenceLine.y / viewBoxHeight) * 100}%` }}
              >
                {referenceLine.label}
              </span>
            ))}
            {chartGeometry.priceTicks.map((tick) => (
              <span
                className="pointer-events-none absolute right-3 -translate-y-1/2 font-mono text-[11px] font-bold text-slate-500"
                data-testid="btc-price-tick"
                key={`${tick.value}-${tick.y}`}
                style={{ top: `${(tick.y / viewBoxHeight) * 100}%` }}
              >
                {formatAxisUsd(tick.value)}
              </span>
            ))}
            {chartGeometry.timeTicks.map((tick) => (
              <span
                className="pointer-events-none absolute bottom-2 font-mono text-[11px] font-bold text-slate-500"
                data-testid="btc-time-tick"
                key={`${tick.updatedAt}-${tick.x}`}
                style={{
                  left: `${(tick.x / viewBoxWidth) * 100}%`,
                  transform: createTimeTickTransform(tick.anchor)
                }}
              >
                {formatTimeUtc(tick.updatedAt)}
              </span>
            ))}
            {price ? (
              <>
                <span
                  className="pointer-events-none absolute -translate-x-full -translate-y-1/2 text-right font-mono text-xs font-black text-slate-900"
                  data-testid="btc-current-price-label"
                  style={{ left: `${(plotBounds.right / viewBoxWidth) * 100}%`, top: `${(199 / viewBoxHeight) * 100}%` }}
                >
                  {formatUsd(price.spot)}
                </span>
                <span
                  className="pointer-events-none absolute -translate-x-full -translate-y-1/2 text-right font-mono text-[11px] font-extrabold text-slate-500"
                  data-testid="btc-current-time-label"
                  style={{ left: `${(plotBounds.right / viewBoxWidth) * 100}%`, top: `${(219 / viewBoxHeight) * 100}%` }}
                >
                  {formatTimeUtc(price.updatedAt)}
                </span>
              </>
            ) : null}
          </>
        ) : null}
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

interface PriceTick {
  value: number;
  y: number;
}

interface TimeTick {
  anchor: "end" | "middle" | "start";
  updatedAt: string;
  x: number;
}

interface ReferenceLine {
  id: "higher-strike" | "lower-strike" | "strike";
  label: string;
  y: number;
}

function seedTrace(spot: number, updatedAt: string): PriceTracePoint[] {
  const baseTime = new Date(updatedAt).getTime();
  return Array.from({ length: 18 }, (_, index) => {
    const phase = index / 2.3;
    const drift = (index - 17) * spot * 0.000003;
    const pulse = Math.sin(phase) * spot * 0.00024;
    const pressure = Math.cos(phase * 0.7) * spot * 0.00012;
    const pointTime = Number.isNaN(baseTime) ? updatedAt : new Date(baseTime - (17 - index) * 15_000).toISOString();

    return {
      spot: spot + drift + pulse + pressure,
      updatedAt: pointTime
    };
  });
}

function createChartGeometry(
  points: PriceTracePoint[],
  priceRange: ReturnType<typeof createPriceRange>,
  marketReference: ArenaChartMarketReference | null
) {
  const scaledPoints = scaleTracePoints(points, priceRange);
  const tracePath = createSmoothLinePath(scaledPoints);

  return {
    lastPoint: scaledPoints[scaledPoints.length - 1] ?? { x: plotBounds.right, y: 100 },
    priceTicks: createPriceTicks(priceRange),
    referenceLines: createReferenceLines(marketReference, priceRange),
    timeTicks: createTimeTicks(points, scaledPoints),
    tracePath
  };
}

function createPriceRange(points: PriceTracePoint[], referencePrices: number[] = []) {
  const values = points.map((point) => point.spot);
  values.push(...referencePrices);

  if (values.length === 0) {
    return {
      max: 1,
      mid: 0.5,
      min: 0
    };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const midpoint = (rawMax + rawMin) / 2;
  const anchor = points[points.length - 1]?.spot ?? midpoint;
  const minimumRange = Math.max(Math.abs(anchor) * 0.0025, 1);
  const rawRange = rawMax - rawMin;
  const adjustedRange = Math.max(rawRange, minimumRange);
  const min = midpoint - adjustedRange / 2;
  const max = midpoint + adjustedRange / 2;
  const range = max - min || Math.max(max * 0.0001, 1);
  const paddedMin = min - range * 0.04;
  const paddedMax = max + range * 0.04;

  return {
    max: paddedMax,
    mid: (paddedMax + paddedMin) / 2,
    min: paddedMin
  };
}

function createReferencePrices(marketReference: ArenaChartMarketReference | null): number[] {
  if (!marketReference) {
    return [];
  }

  if (marketReference.kind === "directional") {
    return [marketReference.strike].filter(Number.isFinite);
  }

  return [marketReference.lowerStrike, marketReference.higherStrike].filter(Number.isFinite);
}

function createReferenceLines(
  marketReference: ArenaChartMarketReference | null,
  priceRange: ReturnType<typeof createPriceRange>
): ReferenceLine[] {
  if (!marketReference) {
    return [];
  }

  if (marketReference.kind === "directional") {
    return [
      {
        id: "strike",
        label: "Strike",
        y: scalePrice(marketReference.strike, priceRange)
      }
    ];
  }

  return [
    {
      id: "lower-strike",
      label: "Range low",
      y: scalePrice(marketReference.lowerStrike, priceRange)
    },
    {
      id: "higher-strike",
      label: "Range high",
      y: scalePrice(marketReference.higherStrike, priceRange)
    }
  ];
}

function scaleTracePoints(points: PriceTracePoint[], priceRange: ReturnType<typeof createPriceRange>): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const xSpan = plotBounds.right - plotBounds.left;
  const denominator = Math.max(points.length - 1, 1);

  return points.map((point, index) => ({
    x: round(plotBounds.left + (index / denominator) * xSpan),
    y: scalePrice(point.spot, priceRange)
  }));
}

function scalePrice(value: number, priceRange: ReturnType<typeof createPriceRange>): number {
  const ySpan = plotBounds.bottom - plotBounds.top;
  const paddedRange = priceRange.max - priceRange.min || 1;
  return round(plotBounds.bottom - ((value - priceRange.min) / paddedRange) * ySpan);
}

function createSmoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M${points[0].x} ${points[0].y}`;
  }

  let path = `M${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const cp1x = round(p1.x + (p2.x - p0.x) / 6);
    const cp1y = round(p1.y + (p2.y - p0.y) / 6);
    const cp2x = round(p2.x - (p3.x - p1.x) / 6);
    const cp2y = round(p2.y - (p3.y - p1.y) / 6);
    path += `C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  return path;
}

function createPriceTicks(priceRange: ReturnType<typeof createPriceRange>): PriceTick[] {
  const tickCount = 4;
  const range = priceRange.max - priceRange.min || 1;

  return Array.from({ length: tickCount }, (_, index) => {
    const value = priceRange.max - (range * index) / (tickCount - 1);
    return {
      value,
      y: scalePrice(value, priceRange)
    };
  });
}

function createTimeTicks(points: PriceTracePoint[], scaledPoints: ChartPoint[]): TimeTick[] {
  if (points.length < 3 || scaledPoints.length < 3) {
    return [];
  }

  const lastIndex = points.length - 1;
  const indexes = [0, Math.floor((lastIndex - 1) / 2)];
  const anchors: TimeTick["anchor"][] = ["start", "middle"];
  const latestUpdatedAt = points[lastIndex].updatedAt;

  return indexes
    .filter((pointIndex, index, sourceIndexes) => sourceIndexes.indexOf(pointIndex) === index)
    .filter((pointIndex) => points[pointIndex].updatedAt !== latestUpdatedAt)
    .map((pointIndex, index) => ({
      anchor: anchors[index],
      updatedAt: points[pointIndex].updatedAt,
      x: scaledPoints[pointIndex].x
    }));
}

function alignTracePoints(startPoints: PriceTracePoint[], endPoints: PriceTracePoint[]): PriceTracePoint[] {
  if (startPoints.length === endPoints.length) {
    return startPoints;
  }

  if (startPoints.length === 0) {
    return endPoints;
  }

  if (startPoints.length > endPoints.length) {
    return startPoints.slice(startPoints.length - endPoints.length);
  }

  const missingCount = endPoints.length - startPoints.length;
  const firstPoint = startPoints[0] ?? endPoints[0];
  return [...Array.from({ length: missingCount }, () => firstPoint), ...startPoints];
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function createTimeTickTransform(anchor: TimeTick["anchor"]): string {
  if (anchor === "middle") {
    return "translateX(-50%)";
  }

  if (anchor === "end") {
    return "translateX(-100%)";
  }

  return "translateX(0)";
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

function formatAxisUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
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
