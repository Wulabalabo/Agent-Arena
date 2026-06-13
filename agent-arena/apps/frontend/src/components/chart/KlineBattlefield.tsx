import { useMemo, useState } from "react";
import type { Agent, ArenaRound, TradeMarker } from "../../types/arena";

interface KlineBattlefieldProps {
  round: ArenaRound;
  agents: Agent[];
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

export function KlineBattlefield({ round, agents }: KlineBattlefieldProps) {
  const width = 960;
  const height = 360;
  const padding = 36;
  const candles = round.candles.length > 0 ? round.candles : [{ id: "empty", timestamp: round.startsAt, open: 0, high: 0, low: 0, close: 0 }];
  const currentPrice = candles[candles.length - 1]?.close ?? 0;
  const prices = candles.flatMap((candle) => [candle.high, candle.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const cushion = Math.max((maxPrice - minPrice) * 0.15, 0.02);
  const min = minPrice - cushion;
  const max = maxPrice + cushion;
  const scaleY = (price: number) => height - padding - ((price - min) / Math.max(max - min, 0.0001)) * (height - padding * 2);
  const step = (width - padding * 2) / Math.max(candles.length - 1, 1);
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const [selectedMarkerId, setSelectedMarkerId] = useState(round.tradeMarkers[0]?.id ?? null);
  const selectedMarker = useMemo(
    () => round.tradeMarkers.find((marker) => marker.id === selectedMarkerId) ?? round.tradeMarkers[0],
    [round.tradeMarkers, selectedMarkerId]
  );
  const boundaryPositions = [
    { label: "Round Start", x: padding, timestamp: round.startsAt },
    { label: "Lock Boundary", x: padding + Math.max(step - 16, 32), timestamp: round.locksAt },
    { label: "Round End", x: padding + (candles.length - 1) * step, timestamp: round.endsAt }
  ];

  return (
    <section
      aria-label="K-line battlefield"
      className="paper-card flex min-h-[320px] flex-col overflow-hidden xl:min-h-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-outline-variant bg-surface-container-low px-4 py-2.5">
        <div className="min-w-0">
          <p className="paper-label text-outline">Battlefield</p>
          <h2 className="truncate font-display text-base font-black uppercase text-on-surface">Market Price / Agent Trade Markers</h2>
        </div>
        <div className="paper-chip paper-chip-green hidden shrink-0 px-2 py-1 sm:inline-flex">
          <span className="h-2 w-2 bg-on-surface" />
          Predict-aware agent tape
        </div>
      </div>

      <div className="paper-grid relative min-h-[280px] flex-1 xl:min-h-0">
        <div className="absolute left-4 top-4 z-10">
          <div className="font-display text-2xl font-black uppercase text-on-surface md:text-3xl">{round.marketSymbol}</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs font-bold text-on-surface-variant">
            <span>{round.durationLabel} arena round</span>
            <span className="text-success">{round.status}</span>
            <span>{round.predictOracleId}</span>
          </div>
          <div className="paper-chip mt-2 px-2 py-1 font-mono text-xs">
            Current price: {currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
        </div>
        <svg className="h-full min-h-[280px] w-full xl:min-h-0" role="img" viewBox={`0 0 ${width} ${height}`}>
          <rect fill="#ffffff" height={height} width={width} />
          {[0, 1, 2, 3, 4].map((line) => {
            const y = padding + line * ((height - padding * 2) / 4);
            return <line key={line} stroke="#cfe2ff" strokeWidth="1" x1={padding} x2={width - padding} y1={y} y2={y} />;
          })}

          {boundaryPositions.map((boundary) => (
            <g key={boundary.label}>
              <line stroke="#000000" strokeDasharray="6 6" strokeWidth="1.5" x1={boundary.x} x2={boundary.x} y1={padding} y2={height - padding} />
              <text fill="#191b23" fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" textAnchor="middle" x={boundary.x} y={padding - 8}>
                {boundary.label}
              </text>
            </g>
          ))}

          {candles.map((candle, index) => {
            const x = padding + index * step;
            const open = scaleY(candle.open);
            const close = scaleY(candle.close);
            const high = scaleY(candle.high);
            const low = scaleY(candle.low);
            const rising = candle.close >= candle.open;

            return (
              <g key={candle.id}>
                <line stroke="#000000" strokeWidth="2" x1={x} x2={x} y1={high} y2={low} />
                <rect
                  fill={rising ? "#00873e" : "#fd761a"}
                  stroke="#000000"
                  strokeWidth="2"
                  height={Math.max(Math.abs(close - open), 4)}
                  rx="0"
                  width="16"
                  x={x - 8}
                  y={Math.min(open, close)}
                />
              </g>
            );
          })}

          {round.tradeMarkers.map((marker) => {
            const agent = agentById.get(marker.agentId);
            const x = padding + marker.candleIndex * step;
            const markerCandle = candles[Math.min(marker.candleIndex, candles.length - 1)];
            const y = scaleY(markerCandle?.close ?? currentPrice);
            const selectMarker = () => setSelectedMarkerId(marker.id);

            return (
              <g
                aria-label={`${agent?.name ?? "Agent"} ${marker.action} marker`}
                data-testid="trade-avatar-marker"
                key={marker.id}
                role="button"
                tabIndex={0}
                onClick={selectMarker}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectMarker();
                  }
                }}
                onMouseEnter={selectMarker}
              >
                <circle
                  cx={x}
                  cy={y}
                  fill="#ffffff"
                  r="13"
                  stroke="#000000"
                  strokeWidth={selectedMarker?.id === marker.id ? "3" : "2"}
                >
                  <title>{`${agent?.name ?? "Agent"} ${marker.timestamp} ${marker.action} Predict price ${marker.price}, confidence ${marker.confidence}, Predict ${marker.predictPosition.label}: ${marker.reason}`}</title>
                </circle>
                <text
                  dominantBaseline="central"
                  fill={agent?.color ?? "#191b23"}
                  fontFamily="JetBrains Mono"
                  fontSize="9"
                  fontWeight="900"
                  textAnchor="middle"
                  x={x}
                  y={y}
                >
                  {agent?.avatar ?? "AI"}
                </text>
                <text fill="#191b23" fontFamily="JetBrains Mono" fontSize="10" fontWeight="900" textAnchor="middle" x={x} y={y - 18}>
                  {actionLabel[marker.action] ?? marker.action}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-3 border-t-2 border-outline-variant bg-surface-container-low px-4 py-3 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-2 md:grid-cols-3">
          {boundaryPositions.map((boundary) => (
            <div className="paper-inset p-2" key={boundary.label}>
              <div className="paper-label text-outline">{boundary.label}</div>
              <div className="mt-1 font-mono text-xs font-bold text-on-surface">{boundary.timestamp}</div>
            </div>
          ))}
        </div>

        <MarkerDetail marker={selectedMarker} agentById={agentById} />
      </div>
    </section>
  );
}

function MarkerDetail({
  marker,
  agentById
}: {
  marker: TradeMarker | undefined;
  agentById: Map<string, Agent>;
}) {
  if (!marker) {
    return (
      <section className="paper-inset p-3">
        <p className="paper-label text-outline">Marker Detail</p>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">No trade markers in this round yet.</p>
      </section>
    );
  }

  const agent = agentById.get(marker.agentId);

  return (
    <section className="paper-inset p-3">
      <p className="paper-label text-outline">Marker Detail</p>
      <div className="mt-2 grid gap-2 text-sm font-medium text-on-surface-variant">
        <div>Agent: <span className="text-on-surface">{agent?.name ?? marker.agentId}</span></div>
        <div>Timestamp: <span className="text-on-surface">{marker.timestamp}</span></div>
        <div>Action: <span className="text-on-surface">{marker.action}</span></div>
        <div>Confidence: <span className="text-on-surface">{marker.confidence}</span></div>
        <div>Predict price: <span className="text-on-surface">{marker.price}</span></div>
        <div>Predict label: <span className="text-on-surface">{marker.predictPosition.label}</span></div>
        <div>Range / Market: <span className="text-on-surface">{marker.predictPosition.rangeKey ?? marker.predictPosition.marketKey ?? "n/a"}</span></div>
        <div>Reason: <span className="text-on-surface">{marker.reason}</span></div>
      </div>
    </section>
  );
}
