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
      className="min-h-[360px] overflow-hidden border-b border-stone-800 bg-stone-950"
    >
      <div className="flex items-center justify-between border-b border-stone-800 px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase text-stone-500">Battlefield</p>
          <h2 className="text-base font-semibold text-stone-100">Market Price / Agent Trade Markers</h2>
        </div>
        <div className="text-sm text-stone-400">Binary rank-1 markets / agent contracts</div>
      </div>

      <svg className="h-[360px] w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        <rect fill="#11100e" height={height} width={width} />
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding + line * ((height - padding * 2) / 4);
          return <line key={line} stroke="#292524" strokeWidth="1" x1={padding} x2={width - padding} y1={y} y2={y} />;
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
              <line stroke={rising ? "#22c55e" : "#ef4444"} strokeWidth="2" x1={x} x2={x} y1={high} y2={low} />
              <rect
                fill={rising ? "#22c55e" : "#ef4444"}
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
            <g key={event.id}>
              <circle cx={x} cy={y} fill={agent?.color ?? "#f5f5f4"} r="8" stroke="#11100e" strokeWidth="3">
                <title>{`${agent?.name ?? "Agent"} ${event.action} @ ${event.price}: ${event.reason}`}</title>
              </circle>
              <text fill="#d6d3d1" fontSize="10" textAnchor="middle" x={x} y={y - 13}>
                {event.action === "buy" ? "BUY" : event.action === "sell" ? "SELL" : "RISK"}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
