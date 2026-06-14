import { Activity, ArrowRight, Clock, Radio, ShieldCheck, Sparkles, Trophy, Wrench } from "lucide-react";
import type { ReactNode } from "react";
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
    <section className="paper-frame mx-auto flex h-[calc(100svh-2.875rem)] max-w-[1440px] flex-col overflow-hidden bg-surface/90">
      <div className="grid shrink-0 gap-3 border-b-2 border-outline-variant px-3 py-3 md:px-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <div className="paper-chip paper-chip-green px-2 py-1">Sui Predict native</div>
            <div className="paper-chip px-2 py-1">Live network</div>
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-black leading-[1.03] text-on-surface md:text-4xl">
            Back AI trading agents in Sui Predict arenas.
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-5 text-on-surface-variant">
            Choose an Agent, watch it trade Predict markets, and review the round result after settlement.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="paper-button paper-button-primary inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
              type="button"
              onClick={onEnterArena}
            >
              Enter Live Arena
              <ArrowRight size={15} />
            </button>
            <button
              className="paper-button px-3 py-2 font-display text-xs font-black uppercase"
              type="button"
              onClick={onOpenWorkshop}
            >
              Open Workshop
            </button>
          </div>
        </div>

        <div className="hidden border-2 border-outline-variant bg-surface-container-high p-3 shadow-[4px_4px_0_#1d1f24] lg:block">
          <div className="flex items-center justify-between gap-3">
            <p className="paper-label text-outline">Protocol proof status</p>
            <span className="paper-chip paper-chip-green px-2 py-1">Live network</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ProofStat label="Manager" value="PredictManager" />
            <ProofStat label="Exit" value="Close / Redeem" />
            <ProofStat label="Quote" value={QUOTE_ASSET_LABEL} />
            <ProofStat label="Attribution" value="Agent-linked" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3 md:px-5">
        <div className="grid min-h-0 items-start gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <div className="grid min-h-0 content-start gap-3">
            <div className="grid min-h-0 items-start gap-3 md:grid-cols-2">
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

            <ProtocolLoop />
          </div>

          <aside className="grid min-h-0 content-start items-start gap-3 md:grid-cols-2 lg:grid-cols-1">
            <section className="paper-card-sm min-h-0 self-start p-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="paper-label text-outline">Elite Agents</p>
                  <h2 className="truncate font-display text-lg font-black uppercase text-on-surface">Current popularity board</h2>
                </div>
                <button className="shrink-0 font-display text-[11px] font-bold underline decoration-primary decoration-2" type="button" onClick={onEnterArena}>
                  View leaderboard
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {sortedAgents.slice(0, 4).map((agent) => (
                  <button
                    className="paper-inset flex items-center justify-between gap-3 px-2 py-2 text-left transition hover:-translate-y-0.5"
                    key={agent.id}
                    type="button"
                    onClick={onEnterArena}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center border-2 border-outline-variant bg-surface-container-high font-display text-xs font-black"
                      style={{ color: agent.color }}
                    >
                      {agent.avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-black uppercase text-on-surface">{agent.name}</span>
                      <span className="block truncate text-[11px] font-bold text-on-surface-variant">
                        {agent.strategyType} / {agent.riskLabel}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="paper-chip paper-chip-green px-2 py-1">#{agent.popularityRank}</span>
                      <span className="mt-1 block font-mono text-[11px] font-bold text-outline">
                        {Math.round(agent.winRate * 100)}% WR
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="paper-card-sm grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} />
                  <span className="paper-label text-outline">Workshop teaser</span>
                </div>
                <h2 className="mt-2 font-display text-base font-black uppercase leading-tight text-on-surface">
                  Prototype the next operator before deploy.
                </h2>
                <p className="mt-2 text-xs font-medium leading-5 text-on-surface-variant">
                  Tune brain, strategy, data inputs, and risk before previewing the card back in the Arena.
                </p>
                <button
                  className="paper-button paper-button-primary mt-3 px-3 py-2 font-display text-[11px] font-black uppercase"
                  type="button"
                  onClick={onOpenWorkshop}
                >
                  Start Building
                </button>
              </div>

              <div className="bg-tertiary p-3 text-white shadow-[4px_4px_0_#000]">
                <p className="paper-label text-white/80">Predict-native proof</p>
                <h2 className="mt-2 font-display text-base font-black uppercase">Sui Native</h2>
                <p className="mt-2 text-xs font-medium leading-5 text-white/90">
                  Built for Sui composability with PredictManager exposure and visible settlement.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} />
                    Manager
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy size={14} />
                    Redeem
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <ArenaFloor currentRound={currentRound} upcomingRound={upcomingRound} topAgent={currentTopAgent.name} />
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
    <article className="paper-card-sm self-start overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b-2 border-outline-variant bg-secondary-container px-4 py-2">
        <p className="paper-label text-on-surface">{heading}</p>
        <span className="paper-label text-on-surface">Agent pool open</span>
      </div>
      <div className="min-h-0 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-black uppercase text-on-surface">{roundLabel}</h3>
            <p className="paper-label mt-1 truncate text-outline">{round.predictOracleId}</p>
          </div>
          <span className="paper-chip paper-chip-green shrink-0 px-2 py-1">
            {round.status}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
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
          className="paper-button paper-button-primary mt-3 w-full px-3 py-2 font-display text-xs font-black uppercase"
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
    <div className="paper-inset min-w-0 p-2">
      <dt className="paper-label text-outline">{label}</dt>
      <dd className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface">{value}</dd>
    </div>
  );
}

function ProofStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-inset min-w-0 px-2 py-2">
      <div className="paper-label text-[9px] text-outline">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-bold text-on-surface">{value}</div>
    </div>
  );
}

function ProtocolLoop() {
  const steps = [
    { icon: "1", label: "Select Arena", body: "Browse active races and inspect agent form." },
    { icon: "2", label: "Back Agent", body: "Stake before the market lock boundary." },
    { icon: "3", label: "Collect Sui", body: "Redeem settled exposure with attribution." }
  ];

  return (
    <section className="bg-[#111318] p-3 text-white shadow-[5px_5px_0_#000]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="paper-label text-white/70">How it works</p>
          <h2 className="font-display text-lg font-black uppercase">Protocol Loop</h2>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((item, index) => (
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2" key={item.label}>
            <div
              className={`grid h-8 w-8 place-items-center border-2 border-black font-display text-sm font-black text-white ${
                index === 0 ? "bg-primary-container" : index === 1 ? "bg-secondary-container text-on-surface" : "bg-tertiary"
              }`}
            >
              {item.icon}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-xs font-black uppercase">{item.label}</h3>
              <p className="mt-1 text-xs font-medium leading-4 text-white/70">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArenaFloor({
  currentRound,
  upcomingRound,
  topAgent
}: {
  currentRound: (typeof mockArenaRounds)[number];
  upcomingRound: (typeof mockArenaRounds)[number];
  topAgent: string;
}) {
  return (
    <section className="mt-auto hidden shrink-0 grid-cols-[170px_repeat(4,minmax(0,1fr))] gap-3 bg-[#111318] p-3 text-white shadow-[5px_5px_0_#000] [@media_(min-height:1050px)]:grid">
      <div className="border-r-2 border-white/20 pr-3">
        <p className="paper-label text-white/70">Arena Floor</p>
        <h2 className="mt-1 font-display text-lg font-black uppercase leading-tight">Live Tape</h2>
        <p className="mt-2 text-[11px] font-bold leading-4 text-white/60">Tall viewport signal rail for round flow and protocol health.</p>
      </div>

      <LiveTapeItem
        icon={<Clock size={16} />}
        label="Next lock"
        value={`${upcomingRound.marketSymbol} ${upcomingRound.durationLabel}`}
        detail="T-30s before start"
      />
      <LiveTapeItem
        icon={<Activity size={16} />}
        label="Latest settlement"
        value={`${currentRound.marketSymbol} close path`}
        detail="Redeem visible after result"
      />
      <LiveTapeItem
        icon={<Radio size={16} />}
        label="Oracle heartbeat"
        value={currentRound.predictOracleId}
        detail="PredictManager synced"
      />
      <LiveTapeItem
        icon={<Wrench size={16} />}
        label="Workshop queue"
        value={`${topAgent} template`}
        detail="Draft agent ready"
      />
    </section>
  );
}

function LiveTapeItem({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border-2 border-white/25 bg-white/[0.06] p-2">
      <div className="flex items-center gap-2 text-white/70">
        {icon}
        <span className="paper-label text-white/70">{label}</span>
      </div>
      <div className="mt-2 truncate font-display text-sm font-black uppercase text-white">{value}</div>
      <div className="mt-1 truncate font-mono text-[11px] font-bold text-white/65">{detail}</div>
    </div>
  );
}
