import type { Agent, ArenaRound, TradeMarker } from "../../types/arena";

interface KlineBattlefieldProps {
  round: ArenaRound;
  agents: Agent[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (marker: TradeMarker) => void;
}

const actionLabel: Record<string, string> = {
  enter_long: "LONG",
  enter_short: "SHORT",
  mint_range: "RANGE",
  reduce: "TRIM",
  close: "CLOSE",
  reverse: "FLIP",
  take_profit: "TP",
  stop_loss: "SL"
};

export function KlineBattlefield({ round, agents, selectedMarkerId, onMarkerSelect }: KlineBattlefieldProps) {
  const width = 960;
  const height = 360;
  const padding = { top: 42, right: 72, bottom: 44, left: 28 };
  const candles =
    round.candles.length > 0 ? round.candles : [{ id: "empty", timestamp: round.startsAt, open: 0, high: 0, low: 0, close: 0 }];
  const targetPrice = candles[0]?.open ?? 0;
  const currentPrice = candles[candles.length - 1]?.close ?? targetPrice;
  const chartValues = candles.map((candle) => candle.close);
  const allPrices = [...chartValues, targetPrice, currentPrice];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const cushion = Math.max((maxPrice - minPrice) * 0.35, 8);
  const min = minPrice - cushion;
  const max = maxPrice + cushion;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const scaleX = (index: number) => padding.left + (index / Math.max(candles.length - 1, 1)) * plotWidth;
  const scaleY = (price: number) => padding.top + ((max - price) / Math.max(max - min, 0.0001)) * plotHeight;
  const linePoints = chartValues.map((value, index) => ({ x: scaleX(index), y: scaleY(value), value }));
  const linePath = buildLinePath(linePoints);
  const targetY = scaleY(targetPrice);
  const currentY = scaleY(currentPrice);
  const delta = currentPrice - targetPrice;
  const priceTicks = [0, 1, 2, 3].map((line) => max - line * ((max - min) / 3));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const countdown = getCountdownParts(round.status);
  const axisLabelX = width - 58;
  const targetBadgeX = width - 86;
  const boundaryPositions = [
    { label: "Round Start", lineX: padding.left, labelX: padding.left + 44, timestamp: round.startsAt },
    {
      label: "Lock Boundary",
      lineX: scaleX(Math.min(1, candles.length - 1)),
      labelX: padding.left + 142,
      timestamp: round.locksAt
    },
    {
      label: "Round End",
      lineX: scaleX(candles.length - 1),
      labelX: width - padding.right - 28,
      timestamp: round.endsAt
    }
  ];

  return (
    <section aria-label="Prediction price chart" className="paper-card flex min-h-0 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-[1fr_auto] gap-4 border-b-2 border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="flex min-w-0 gap-8">
          <div>
            <p className="paper-label text-outline">Target price</p>
            <div className="mt-1 font-display text-3xl font-black text-outline">{formatCurrency(targetPrice)}</div>
          </div>
          <div>
            <p className="paper-label text-[#ff8a00]">Current price</p>
            <div className="mt-1 flex items-start gap-3">
              <span className="font-display text-3xl font-black text-[#ff8a00]">{formatCurrency(currentPrice)}</span>
              <span className={`mt-1 font-mono text-xs font-black ${delta >= 0 ? "text-success" : "text-error"}`}>
                {delta >= 0 ? "+" : "-"} {formatDelta(delta)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-display text-3xl font-black text-error">
            {countdown.minutes} <span className="ml-3">{countdown.seconds}</span>
          </div>
          <div className="mt-1 flex justify-end gap-6 font-mono text-[10px] font-bold text-on-surface-variant">
            <span>min</span>
            <span>sec</span>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
          <rect fill="#ffffff" height={height} width={width} />

          {priceTicks.map((price) => {
            const y = scaleY(price);
            return (
              <g key={price}>
                <line stroke="#edf0f5" strokeWidth="1" x1={padding.left} x2={width - padding.right + 36} y1={y} y2={y} />
                <text fill="#a0a8b3" fontFamily="JetBrains Mono" fontSize="11" fontWeight="900" textAnchor="start" x={axisLabelX} y={y + 4}>
                  {formatCurrency(price)}
                </text>
              </g>
            );
          })}

          <line
            stroke="#ff8a00"
            strokeDasharray="7 7"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            x1={padding.left}
            x2={width - padding.right}
            y1={targetY}
            y2={targetY}
          />
          <line
            stroke="#98a1ad"
            strokeDasharray="7 7"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            x1={padding.left}
            x2={width - padding.right}
            y1={currentY}
            y2={currentY}
          />

          {boundaryPositions.map((boundary) => (
            <g key={boundary.label}>
              <line stroke="#d5dae2" strokeWidth="1" x1={boundary.lineX} x2={boundary.lineX} y1={padding.top} y2={height - padding.bottom} />
              <text fill="#7c8591" fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" textAnchor="middle" x={boundary.labelX} y={height - 26}>
                {boundary.label}
              </text>
              <text fill="#7c8591" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" textAnchor="middle" x={boundary.labelX} y={height - 12}>
                {formatTime(boundary.timestamp)}
              </text>
            </g>
          ))}

          <path d={linePath} fill="none" stroke="#ff8a00" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <circle cx={scaleX(candles.length - 1)} cy={currentY} fill="#ffffff" r="11" stroke="#ff8a00" strokeWidth="3" />
          {round.tradeMarkers.map((marker) => {
            const agent = agentById.get(marker.agentId);
            const x = scaleX(Math.min(marker.candleIndex, candles.length - 1));
            const y = scaleY(chartValues[Math.min(marker.candleIndex, chartValues.length - 1)] ?? currentPrice);

            return (
              <g
                aria-label={`${agent?.name ?? "Agent"} ${marker.action} marker`}
                data-testid="trade-avatar-marker"
                key={marker.id}
                onClick={() => onMarkerSelect?.(marker)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onMarkerSelect?.(marker);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <circle
                  cx={x}
                  cy={y}
                  fill={agent?.color ?? "#2563eb"}
                  r={selectedMarkerId === marker.id ? "7" : "5"}
                  stroke={selectedMarkerId === marker.id ? "#111827" : "transparent"}
                  strokeWidth="2"
                >
                  <title>{`${agent?.name ?? "Agent"} ${actionLabel[marker.action] ?? marker.action}: ${marker.reason}`}</title>
                </circle>
                <text fill="#191b23" fontFamily="JetBrains Mono" fontSize="9" fontWeight="900" textAnchor="middle" x={x} y={y - 10}>
                  {actionLabel[marker.action] ?? marker.action}
                </text>
              </g>
            );
          })}

          <g>
            <rect fill="#8f98a5" height="24" rx="4" width="76" x={targetBadgeX} y={targetY + 7} />
            <text fill="#ffffff" fontFamily="JetBrains Mono" fontSize="11" fontWeight="900" textAnchor="middle" x={targetBadgeX + 38} y={targetY + 23}>
              Target
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
}

function getCountdownParts(status: ArenaRound["status"]): { minutes: string; seconds: string } {
  if (status === "upcoming") {
    return { minutes: "30", seconds: "00" };
  }

  if (status === "settled") {
    return { minutes: "00", seconds: "00" };
  }

  return { minutes: "02", seconds: "32" };
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDelta(value: number): string {
  return `$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
