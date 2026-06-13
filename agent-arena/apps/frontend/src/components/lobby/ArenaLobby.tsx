import { ArrowRight, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { getAgentById, getSortedAgents, mockAgents, mockArenaRounds } from "../../mock/arena";
import { getPredictQuoteAssetLabel } from "../../features/predict/config";

interface ArenaLobbyProps {
  onEnterArena: () => void;
  onOpenWorkshop: () => void;
}

const QUOTE_ASSET_LABEL = getPredictQuoteAssetLabel();

export function ArenaLobby({ onEnterArena, onOpenWorkshop }: ArenaLobbyProps) {
  const sortedAgents = getSortedAgents(mockAgents, "leaderboard");
  const currentRound = mockArenaRounds.find((round) => round.status === "live") ?? mockArenaRounds[0];
  const upcomingRound = mockArenaRounds.find((round) => round.status === "upcoming") ?? mockArenaRounds[1];
  const currentTopAgent = getAgentById(mockAgents, currentRound.agentIds[0]!);
  const upcomingTopAgent = getAgentById(mockAgents, upcomingRound.agentIds[0]!);

  return (
    <section className="paper-frame mx-auto max-w-[1440px] bg-surface/90">
      <div className="grid gap-6 border-b-2 border-outline-variant px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="py-2">
          <div className="flex flex-wrap gap-2">
            <div className="paper-chip paper-chip-green px-2 py-1">Sui Predict native</div>
            <div className="paper-chip px-2 py-1">Live network</div>
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-black leading-[1.05] text-on-surface md:text-5xl">
            Back AI trading agents in Sui Predict arenas.
          </h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-on-surface-variant">
            Choose an Agent, watch it trade Predict markets, and review the round result after settlement.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="paper-button paper-button-primary inline-flex items-center gap-2 px-4 py-3 font-display text-xs font-black uppercase"
              type="button"
              onClick={onEnterArena}
            >
              Enter Live Arena
              <ArrowRight size={15} />
            </button>
            <button
              className="paper-button px-4 py-3 font-display text-xs font-black uppercase"
              type="button"
              onClick={onOpenWorkshop}
            >
              Open Workshop
            </button>
          </div>
        </div>

        <div className="paper-hero-chip">
          <span className="paper-chip paper-chip-green absolute right-3 top-3 px-2 py-1">Live network</span>
        </div>
      </div>

      <div className="px-4 py-6 md:px-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <ArenaCard
            heading="Current Arena"
            roundLabel={`${currentRound.marketSymbol} ${currentRound.durationLabel}`}
            round={currentRound}
            topAgent={currentTopAgent.name}
            onOpen={onEnterArena}
          />
          <ArenaCard
            heading="Upcoming Arena"
            roundLabel={`${upcomingRound.marketSymbol} ${upcomingRound.durationLabel}`}
            round={upcomingRound}
            topAgent={upcomingTopAgent.name}
            onOpen={onEnterArena}
          />
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="paper-label text-outline">Elite Agents</p>
              <h2 className="font-display text-2xl font-black uppercase text-on-surface">Current popularity board</h2>
            </div>
            <button className="hidden font-display text-xs font-bold underline decoration-primary decoration-2 md:inline" type="button" onClick={onEnterArena}>
              View leaderboard
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sortedAgents.slice(0, 4).map((agent) => (
                <button
                  className="paper-card-sm relative overflow-hidden p-4 text-left transition hover:-translate-y-0.5"
                  key={agent.id}
                  type="button"
                  onClick={onEnterArena}
                >
                  <span className="absolute inset-x-0 top-0 h-2" style={{ background: agent.color }} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-9 w-9 place-items-center border-2 border-outline-variant bg-surface-container-high font-display text-xs font-black"
                        style={{ color: agent.color }}
                      >
                        {agent.avatar}
                      </span>
                      <div>
                        <div className="font-display text-base font-black uppercase text-on-surface">{agent.name}</div>
                        <div className="paper-label text-on-surface-variant">
                          {agent.strategyType}
                        </div>
                      </div>
                    </div>
                    <div className="paper-chip paper-chip-green px-2 py-1">#{agent.popularityRank}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MiniStat label="Win Rate" value={`${Math.round(agent.winRate * 100)}%`} />
                    <MiniStat label="Recent Form" value={agent.recentForm.join("")} />
                    <MiniStat label="Risk" value={agent.riskLabel} />
                  </div>
                </button>
              ))}
          </div>
        </section>

        <section className="mt-8 bg-[#111318] p-5 text-white shadow-[6px_6px_0_#000]">
          <div className="text-center">
            <p className="paper-label text-white/70">How it works</p>
            <h2 className="font-display text-2xl font-black uppercase">Protocol Loop</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { icon: "1", label: "Select Arena", body: "Browse active market races and inspect agent form." },
              { icon: "2", label: "Back Agent", body: "Stake behind your chosen AI before the lock boundary." },
              { icon: "3", label: "Collect Sui", body: "Redeem settled Predict exposure with agent attribution intact." }
            ].map((item, index) => (
              <div className="text-center" key={item.label}>
                <div
                  className={`mx-auto grid h-8 w-8 place-items-center border-2 border-black font-display text-sm font-black text-white ${
                    index === 0 ? "bg-primary-container" : index === 1 ? "bg-secondary-container text-on-surface" : "bg-tertiary-container"
                  }`}
                >
                  {item.icon}
                </div>
                <h3 className="mt-3 font-display text-sm font-black uppercase">{item.label}</h3>
                <p className="mt-2 text-xs font-medium leading-5 text-white/70">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="paper-card grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={15} />
                <span className="paper-label text-outline">Workshop teaser</span>
              </div>
              <h2 className="mt-4 font-display text-2xl font-black uppercase text-on-surface">
                Prototype the next operator before you deploy it.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-on-surface-variant">
                Use the mock Agent Workshop to tune brain, strategy, data inputs, and risk before previewing the card back in the Arena.
              </p>
              <button
                className="paper-button paper-button-primary mt-5 px-4 py-3 font-display text-xs font-black uppercase"
                type="button"
                onClick={onOpenWorkshop}
              >
                Start Building
              </button>
            </div>
            <div className="paper-hero-chip min-h-[11rem]" />
          </section>

          <section className="paper-card bg-tertiary-container p-5 text-white">
            <p className="paper-label text-white/80">Predict-native proof</p>
            <h2 className="mt-3 font-display text-xl font-black uppercase">Sui Native</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-white/90">
              Built for Sui composability. Your studios are represented by PredictManager round exposure.
            </p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck size={15} />
                PredictManager
              </div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Trophy size={15} />
                Redeem visible
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function ArenaCard({
  heading,
  roundLabel,
  round,
  topAgent,
  onOpen
}: {
  heading: string;
  roundLabel: string;
  round: (typeof mockArenaRounds)[number];
  topAgent: string;
  onOpen: () => void;
}) {
  return (
    <article className="paper-card-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b-2 border-outline-variant bg-secondary-container px-4 py-2">
        <p className="paper-label text-on-surface">{heading}</p>
        <span className="paper-label text-on-surface">Agent pool open</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-black uppercase text-on-surface">{roundLabel}</h3>
          <p className="paper-label mt-1 text-outline">{round.predictOracleId}</p>
        </div>
        <span className="paper-chip paper-chip-green px-2 py-1">
          {round.status}
        </span>
        </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Time to lock" value={round.status === "upcoming" ? "T-30s before start" : "Locked"} />
        <Metric
          label={round.status === "upcoming" ? "Time to start" : "Time to end"}
          value={round.status === "upcoming" ? `Starts at ${round.startsAt}` : `Ends at ${round.endsAt}`}
        />
        <Metric label="Agent Count" value={String(round.agentIds.length)} />
        <Metric label="Top Agent" value={topAgent} />
        <Metric label="Backing Volume" value={`${round.totalBackingVolume.toLocaleString()} ${QUOTE_ASSET_LABEL}`} />
        <Metric label="Predict Oracle" value={round.predictOracleId} />
      </dl>

      <button
        className="paper-button paper-button-primary mt-4 w-full px-4 py-3 font-display text-xs font-black uppercase"
        type="button"
        onClick={onOpen}
      >
        Open Arena
      </button>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-inset p-2">
      <dt className="paper-label text-outline">{label}</dt>
      <dd className="mt-1 font-mono text-xs font-bold text-on-surface">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-inset px-2 py-2">
      <div className="paper-label text-[9px] text-outline">{label}</div>
      <div className="mt-1 font-mono text-xs font-bold text-on-surface">{value}</div>
    </div>
  );
}
