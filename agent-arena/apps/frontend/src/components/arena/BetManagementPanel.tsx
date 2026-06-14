import { getAgentById, getRoundById } from "../../mock/arena";
import { isRoundLocked } from "../../state/arena";
import type { Agent, AgentRoundState, ArenaRound, BackingPosition } from "../../types/arena";
import { getPredictQuoteAssetLabel } from "../../features/predict/config";

type ManagementTab = "upcoming" | "current" | "history";
const QUOTE_ASSET_LABEL = getPredictQuoteAssetLabel();

interface BetManagementPanelProps {
  activeTab: ManagementTab;
  currentRound: ArenaRound;
  agents: Agent[];
  rounds: ArenaRound[];
  compact?: boolean;
  upcomingBackings: BackingPosition[];
  currentBackings: BackingPosition[];
  historyBackings: BackingPosition[];
  onTabChange: (tab: ManagementTab) => void;
  onCancelBacking: (backingId: string) => void;
  onCloseMintedBacking: (backingId: string) => void;
  onModifyBacking: (backing: BackingPosition) => void;
  onViewOnChart: (agentId: string) => void;
}

export function BetManagementPanel({
  activeTab,
  currentRound,
  agents,
  rounds,
  compact = false,
  upcomingBackings,
  currentBackings,
  historyBackings,
  onTabChange,
  onCancelBacking,
  onCloseMintedBacking,
  onModifyBacking,
  onViewOnChart
}: BetManagementPanelProps) {
  return (
    <section aria-label="Bet Management" className={`paper-card-sm min-h-0 ${compact ? "flex flex-col p-3" : "p-4"}`}>
      <div>
        <p className="paper-label text-primary">Bet Management</p>
        <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">
          {compact ? "My positions" : "Predict positions by lifecycle"}
        </h2>
      </div>

      <div className={`flex flex-wrap gap-2 ${compact ? "mt-2" : "mt-4"}`}>
        {([
          ["upcoming", "Upcoming"],
          ["current", "Current"],
          ["history", "History"]
        ] as const).map(([id, label]) => (
          <button
            className={`border-2 border-outline-variant font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000] ${
              activeTab === id
                ? "bg-primary-container text-white"
                : "bg-surface-container-lowest text-on-surface-variant"
            } ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`min-h-0 pr-1 ${compact ? "mt-3 max-h-[190px] space-y-2 overflow-y-auto" : "mt-4 space-y-3"}`}>
        {activeTab === "upcoming"
          ? renderUpcoming(upcomingBackings, rounds, agents, onCancelBacking, onModifyBacking, onCloseMintedBacking)
          : null}
        {activeTab === "current"
          ? renderCurrent(currentBackings, currentRound, rounds, agents, onCloseMintedBacking, onViewOnChart)
          : null}
        {activeTab === "history" ? renderHistory(historyBackings, rounds, agents) : null}
      </div>
    </section>
  );
}

function renderUpcoming(
  backings: BackingPosition[],
  rounds: ArenaRound[],
  agents: Agent[],
  onCancelBacking: (backingId: string) => void,
  onModifyBacking: (backing: BackingPosition) => void,
  onCloseMintedBacking: (backingId: string) => void
) {
  if (backings.length === 0) {
    return <p className="text-sm font-medium text-on-surface-variant">No upcoming backings yet.</p>;
  }

  return backings.map((backing) => {
    const agent = getAgentById(agents, backing.agentId);
    const round = getRoundById(rounds, backing.roundId);
    const roundLocked = isRoundLocked(round);
    const cancellable = !backing.predictTxDigest && (backing.status === "draft" || backing.status === "pending_signature");
    const editableBeforeLock = cancellable && !roundLocked;
    const hasMintedPredictPosition = Boolean(backing.predictTxDigest);

    return (
      <article className="paper-inset p-3" key={backing.id}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display font-black uppercase text-on-surface">{agent.name}</div>
            <div className="paper-label mt-1 text-on-surface-variant">
              {backing.predictPositionType} / {backing.status}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-on-surface">{backing.amount} {QUOTE_ASSET_LABEL}</div>
            <div className="font-mono text-[10px] text-on-surface-variant">Lock {round.locksAt}</div>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium text-on-surface-variant">
          <div>Round: {round.marketSymbol} {round.durationLabel}</div>
          <div>Status: {backing.status}</div>
        </div>

        {renderAttributionDetails(backing)}

        <div className="mt-3 flex flex-wrap gap-2">
          {cancellable ? (
            <>
              <button
                className="paper-button px-3 py-2 font-display text-[10px] font-black uppercase"
                disabled={!editableBeforeLock}
                type="button"
                onClick={() => onCancelBacking(backing.id)}
              >
                Cancel Draft
              </button>
              <button
                className="paper-button px-3 py-2 font-display text-[10px] font-black uppercase"
                disabled={!editableBeforeLock}
                type="button"
                onClick={() => onModifyBacking(backing)}
              >
                Modify
              </button>
              {roundLocked ? (
                <p className="basis-full text-xs font-medium text-on-surface-variant">
                  Actions disabled after T-30s lock. Use close or redeem only for minted Predict exposure.
                </p>
              ) : null}
            </>
          ) : hasMintedPredictPosition ? (
            <>
              <button
                className="paper-button paper-button-primary px-3 py-2 font-display text-[10px] font-black uppercase"
                type="button"
                onClick={() => onCloseMintedBacking(backing.id)}
              >
                Close / Redeem
              </button>
              <p className="basis-full text-xs font-medium text-on-surface-variant">
                Estimated value may differ from original backing amount: {backing.estimatedValue.toFixed(1)} {QUOTE_ASSET_LABEL} now.
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-on-surface-variant">
              Submitted backing cannot be modified here after signing begins.
            </p>
          )}
        </div>
      </article>
    );
  });
}

function renderCurrent(
  backings: BackingPosition[],
  currentRound: ArenaRound,
  rounds: ArenaRound[],
  agents: Agent[],
  onCloseMintedBacking: (backingId: string) => void,
  onViewOnChart: (agentId: string) => void
) {
  if (backings.length === 0) {
    return <p className="text-sm font-medium text-on-surface-variant">No live Predict positions in this round.</p>;
  }

  return backings.map((backing) => {
    const agent = getAgentById(agents, backing.agentId);
    const round = getRoundById(rounds, backing.roundId);
    const exposure = currentRound.agentStates.find((state) => state.agentId === backing.agentId);

    return (
      <article className="paper-inset p-3" key={backing.id}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display font-black uppercase text-on-surface">{agent.name}</div>
            <div className="paper-label mt-1 text-on-surface-variant">
              {backing.predictPositionType} / {backing.status}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-on-surface">{backing.amount} {QUOTE_ASSET_LABEL}</div>
            <div className="font-mono text-[10px] text-on-surface-variant">Est. {backing.estimatedValue.toFixed(1)}</div>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium text-on-surface-variant">
          <div>Round: {round.marketSymbol} {round.durationLabel}</div>
          <div>Position status: {exposure?.status ?? "flat"}</div>
          <div>Agent live PnL: {formatSignedPercent(exposure?.floatingPnl ?? 0)}</div>
          <div>Current estimated value: {backing.estimatedValue.toFixed(1)}</div>
        </div>

        {renderAttributionDetails(backing)}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="paper-button px-3 py-2 font-display text-[10px] font-black uppercase"
            type="button"
            onClick={() => onViewOnChart(agent.id)}
          >
            View on Chart
          </button>
          <button
            className="paper-button paper-button-primary px-3 py-2 font-display text-[10px] font-black uppercase"
            type="button"
            onClick={() => onCloseMintedBacking(backing.id)}
          >
            Close / Redeem
          </button>
        </div>
      </article>
    );
  });
}

function renderHistory(backings: BackingPosition[], rounds: ArenaRound[], agents: Agent[]) {
  if (backings.length === 0) {
    return <p className="text-sm font-medium text-on-surface-variant">No position history in this round.</p>;
  }

  return backings.map((backing) => {
    const agent = getAgentById(agents, backing.agentId);
    const round = getRoundById(rounds, backing.roundId);
    const gross = backing.finalValue ?? backing.estimatedValue;
    const roi = backing.finalValue ? ((backing.finalValue - backing.amount) / backing.amount) * 100 : 0;
    const result = backing.finalValue && backing.finalValue >= backing.amount ? "Positive" : "Negative";

    return (
      <article className="paper-inset p-3" key={backing.id}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display font-black uppercase text-on-surface">{agent.name}</div>
            <div className="paper-label mt-1 text-on-surface-variant">
              {backing.predictPositionType} / {backing.status}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-on-surface">{gross.toFixed(1)} {QUOTE_ASSET_LABEL}</div>
            <div className="font-mono text-[10px] text-on-surface-variant">{formatSignedPercent(roi)}</div>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium text-on-surface-variant">
          <div>Round: {round.marketSymbol} {round.durationLabel}</div>
          <div>Result: {result}</div>
          <div>Fee: {backing.fee ?? 0}</div>
          <div>Transaction digest: {backing.redeemTxDigest ?? backing.predictTxDigest ?? "n/a"}</div>
        </div>

        {renderAttributionDetails(backing)}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="paper-button px-3 py-2 font-display text-[10px] font-black uppercase"
            disabled
            type="button"
          >
            Replay coming soon
          </button>
        </div>
      </article>
    );
  });
}

function renderAttributionDetails(backing: BackingPosition) {
  if (!backing.predictTxDigest && backing.attributionStatus === "not_started") {
    return null;
  }

  return (
    <div className="mt-3 grid gap-1 font-mono text-[10px] font-bold uppercase text-on-surface-variant">
      <div>Agent attribution: {backing.attributionStatus}</div>
      {backing.attributionId ? <div>Attribution id: {backing.attributionId}</div> : null}
      {backing.predictTxDigest ? <div>Transaction digest: {backing.predictTxDigest}</div> : null}
      {backing.attributionError ? <div>Attribution error: {backing.attributionError}</div> : null}
    </div>
  );
}

function formatSignedPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}
