import type { ArenaMatch } from "../../types/arena";

interface KlineBattlefieldProps {
  match: ArenaMatch;
}

export function KlineBattlefield({ match }: KlineBattlefieldProps) {
  const width = 960;
  const height = 360;
  const padding = 36;
  const prices = match.candles.flatMap((candle) => [candle.high, candle.low]);
  const min = Math.min(...prices) - 0.02;
  const max = Math.max(...prices) + 0.02;
  const scaleY = (price: number) => height - padding - ((price - min) / (max - min)) * (height - padding * 2);
  const step = (width - padding * 2) / Math.max(match.candles.length - 1, 1);
  const agentById = new Map(match.agents.map((agent) => [agent.id, agent]));

  return (
    <section
      aria-label="K-line battlefield"
      className="flex min-h-[320px] flex-col overflow-hidden border-b border-outline-variant bg-surface-container-lowest xl:min-h-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-4 py-2.5">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-outline">Battlefield</p>
          <h2 className="truncate font-display text-base font-semibold text-on-surface">Market Price / Agent Trade Markers</h2>
        </div>
        <div className="hidden shrink-0 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant sm:flex">
          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_12px_rgba(94,230,167,0.8)]" />
          Live / Binary rank-1 markets
        </div>
      </div>

      <div className="relative min-h-[280px] flex-1 xl:min-h-0">
        <div className="absolute left-4 top-4 z-10">
          <div className="font-mono text-2xl font-bold text-on-surface md:text-3xl">1.2452</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs text-on-surface-variant">
            <span>SUI/USDC</span>
            <span className="text-success">+4.2%</span>
            <span>(24H)</span>
          </div>
        </div>
      <svg className="h-full min-h-[280px] w-full xl:min-h-0" role="img" viewBox={`0 0 ${width} ${height}`}>
        <rect fill="#0c0e11" height={height} width={width} />
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding + line * ((height - padding * 2) / 4);
          return <line key={line} stroke="#404752" strokeOpacity="0.48" strokeWidth="1" x1={padding} x2={width - padding} y1={y} y2={y} />;
        })}

        {match.candles.map((candle, index) => {
          const x = padding + index * step;
          const open = scaleY(candle.open);
          const close = scaleY(candle.close);
          const high = scaleY(candle.high);
          const low = scaleY(candle.low);
          const rising = candle.close >= candle.open;

          return (
            <g key={candle.id}>
              <line stroke={rising ? "#5ee6a7" : "#ffb4ab"} strokeWidth="2" x1={x} x2={x} y1={high} y2={low} />
              <rect
                fill={rising ? "#5ee6a7" : "#ffb4ab"}
                fillOpacity="0.88"
                height={Math.max(Math.abs(close - open), 4)}
                rx="2"
                width="16"
                x={x - 8}
                y={Math.min(open, close)}
              />
            </g>
          );
        })}

        {match.events.map((event) => {
          const agent = agentById.get(event.agentId);
          const x = padding + event.candleIndex * step;
          const y = scaleY(event.price);

          return (
            <g data-testid="trade-avatar-marker" key={event.id}>
              <circle cx={x} cy={y} fill="#1e2023" r="13" stroke={agent?.color ?? "#e2e2e6"} strokeWidth="2">
                <title>{`${agent?.name ?? "Agent"} ${event.action} @ ${event.price}: ${event.reason}`}</title>
              </circle>
              <text
                dominantBaseline="central"
                fill={agent?.color ?? "#e2e2e6"}
                fontFamily="JetBrains Mono"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                x={x}
                y={y}
              >
                {agent?.avatar ?? "AI"}
              </text>
              <text fill="#c0c7d4" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" textAnchor="middle" x={x} y={y - 18}>
                {event.action === "buy" ? "BUY" : event.action === "sell" ? "SELL" : "RISK"}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </section>
  );
}
