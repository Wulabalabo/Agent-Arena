import { ArrowRight, Trophy } from "lucide-react";
import { getSortedAgents, mockArenaMatch } from "../../mock/arena";
import { AppNav } from "../navigation/AppNav";

interface ArenaLobbyProps {
  onEnterArena: () => void;
}

export function ArenaLobby({ onEnterArena }: ArenaLobbyProps) {
  const contenders = getSortedAgents(mockArenaMatch.agents, "leaderboard");

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <AppNav activeView="lobby" onGoHome={() => undefined} onGoLiveArena={onEnterArena} />
      </header>

      <section className="mx-auto max-w-[1440px] border-x border-outline-variant bg-surface-container-lowest">
        <div className="relative overflow-hidden border-b border-outline-variant px-4 py-12 md:px-10 md:py-16">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-35 lg:block">
            <div className="h-full w-full bg-[linear-gradient(135deg,transparent_0%,rgba(77,162,255,0.16)_45%,rgba(255,185,95,0.14)_100%)]" />
          </div>
          <div className="relative max-w-3xl">
            <div className="inline-flex rounded border border-secondary/40 bg-secondary/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
              Seasonal Tournament
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-on-surface md:text-5xl">
              Season 01: DeepBook Blitz
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">
              Strategy agents compete on the Sui Network. Deploy your best agent, analyze the order book, and claim the
              institutional prize pool.
            </p>

            <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              <LobbyMetric label="Prize Pool" value="1,250 SUI" />
              <LobbyMetric label="Prediction Volume" value="8,430 SUI" />
              <LobbyMetric label="Tournament Starts" value="02:14" />
            </div>

            <button
              className="mt-8 inline-flex items-center gap-2 rounded bg-primary-container px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.05em] text-on-primary hover:bg-primary"
              type="button"
              onClick={onEnterArena}
            >
              Enter Arena
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div className="px-4 py-8 md:px-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.05em] text-outline">Top Contenders</p>
              <h2 className="font-display text-xl font-semibold text-on-surface">Real-time agent roster</h2>
            </div>
            <button className="rounded border border-outline-variant px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant">
              All Agents
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contenders.map((agent) => (
              <button
                className="relative min-h-[160px] overflow-hidden rounded border border-outline-variant bg-surface-container-low p-4 text-left hover:border-primary/60"
                key={agent.id}
                type="button"
                onClick={onEnterArena}
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: agent.color }} />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 place-items-center rounded border border-outline-variant bg-surface-container-high font-mono text-[11px] font-bold"
                      style={{ color: agent.color }}
                    >
                      {agent.avatar}
                    </span>
                    <div>
                      <div className="font-display text-base font-semibold text-on-surface">{agent.name}</div>
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">
                        {agent.strategyClass}
                      </div>
                    </div>
                  </div>
                  <div className="rounded border border-outline-variant bg-surface-container px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-primary">
                    Class {agent.rank}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <LobbyMetric compact label="Win Rate" value={`${agent.battleScore.toFixed(1)}%`} />
                  <LobbyMetric compact label="PnL" value={`+${agent.pnl.toFixed(1)}%`} />
                  <LobbyMetric compact label="Backers" value={String(agent.audienceBacking)} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">
                  <span>{agent.predictionVolume.toLocaleString()} SUI volume</span>
                  <span>View strategy</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-primary/30 bg-primary/10 p-8 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded border border-primary/40 bg-primary/10 text-primary">
              <Trophy size={20} />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold text-on-surface">Ready to Dominate the Order Book?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
              Step into the live arena and watch autonomous strategies compete for the DeepBook Blitz pool.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LobbyMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`border-l border-outline-variant ${compact ? "px-2 py-1" : "px-3 py-2"}`}>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-outline">{label}</div>
      <div className="mt-1 font-mono text-sm font-medium text-on-surface">{value}</div>
    </div>
  );
}

