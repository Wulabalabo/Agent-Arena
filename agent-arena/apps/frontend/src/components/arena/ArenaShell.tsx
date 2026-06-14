import { useMemo, useState } from "react";
import { getAgentById, mockAgents, mockArenaRounds, mockUserBackings } from "../../mock/arena";
import {
  cancelBacking,
  closeMintedBacking,
  createInitialArenaState,
  createOrUpdateDraft,
  getSelectedAgent,
  getSelectedRound,
  recordBackedPosition,
  selectAgent,
  selectRound,
  setAgentSort
} from "../../state/arena";
import { createAttributionClient } from "../../features/attribution/client";
import type { AttributionRecord } from "../../features/attribution/client";
import { buildCreateAttributionInput } from "../../features/attribution/payload";
import { getPredictQuoteAssetLabel } from "../../features/predict/config";
import type { Agent, ArenaRound, ArenaState, BackingPosition, BackingStatus, TradeMarker } from "../../types/arena";
import { BackAgentPanel } from "./BackAgentPanel";
import { BetManagementPanel } from "./BetManagementPanel";
import { AgentCardRail } from "../bots/AgentCardRail";
import { KlineBattlefield } from "../chart/KlineBattlefield";

const upcomingStatuses: BackingStatus[] = ["draft", "pending_signature", "submitted", "backed"];
const currentStatuses: BackingStatus[] = ["locked", "live", "redeemable"];
const historyStatuses: BackingStatus[] = ["redeemed", "cancelled", "failed"];
const LOCAL_DRAFT_ID_PREFIX = "local-draft";
const QUOTE_ASSET_LABEL = getPredictQuoteAssetLabel();

type ManagementTab = "upcoming" | "current" | "history";
type ArenaPanelTab = "back" | "positions" | "tape";
type AttributionNoticeStatus = "idle" | "pending" | "submitted" | "failed";
type AttributionClient = ReturnType<typeof createAttributionClient>;

interface ArenaShellProps {
  attributionClient?: AttributionClient;
  createPredictDigest?: () => string;
  managerId?: string;
  userAddress?: string;
}

export function ArenaShell({
  attributionClient = createAttributionClient(),
  createPredictDigest = createMockPredictDigest,
  managerId = "mock-manager",
  userAddress = "mock-wallet"
}: ArenaShellProps = {}) {
  const [arenaState, setArenaState] = useState<ArenaState>(() =>
    createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings)
  );
  const [amountInput, setAmountInput] = useState("100");
  const [managementTab, setManagementTab] = useState<ManagementTab>("current");
  const [activePanelTab, setActivePanelTab] = useState<ArenaPanelTab>("positions");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [attributionNoticeStatus, setAttributionNoticeStatus] = useState<AttributionNoticeStatus>("idle");
  const [attributionDigest, setAttributionDigest] = useState<string | null>(null);
  const [attributionError, setAttributionError] = useState<string | null>(null);

  const selectedRound = useMemo(() => getSelectedRound(arenaState), [arenaState]);
  const selectedAgent = useMemo(() => getSelectedAgent(arenaState), [arenaState]);
  const selectedRoundAgents = useMemo(
    () => selectedRound.agentIds.map((agentId) => getAgentById(arenaState.agents, agentId)),
    [arenaState.agents, selectedRound]
  );
  const selectedRoundState = useMemo(
    () => selectedRound.agentStates.find((state) => state.agentId === selectedAgent.id),
    [selectedAgent.id, selectedRound]
  );

  const upcomingBackings = useMemo(
    () => getBackingsForRound(arenaState.userBackings, selectedRound.id, upcomingStatuses),
    [arenaState.userBackings, selectedRound.id]
  );
  const currentBackings = useMemo(
    () => getBackingsForRound(arenaState.userBackings, selectedRound.id, currentStatuses),
    [arenaState.userBackings, selectedRound.id]
  );
  const historyBackings = useMemo(
    () => getBackingsForRound(arenaState.userBackings, selectedRound.id, historyStatuses),
    [arenaState.userBackings, selectedRound.id]
  );

  const upcomingDraft =
    arenaState.backingDraft && arenaState.backingDraft.roundId === selectedRound.id ? arenaState.backingDraft : null;
  const localDraftBacking = useMemo(
    () =>
      upcomingDraft
        ? createLocalDraftBacking(
            selectedRound,
            getAgentById(arenaState.agents, upcomingDraft.agentId),
            upcomingDraft.amount
          )
        : null,
    [arenaState.agents, selectedRound, upcomingDraft]
  );
  const managedUpcomingBackings = useMemo(
    () => (localDraftBacking ? [...upcomingBackings, localDraftBacking] : upcomingBackings),
    [localDraftBacking, upcomingBackings]
  );

  const handleSaveDraft = () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    setArenaState((current) =>
      createOrUpdateDraft(current, {
        roundId: selectedRound.id,
        agentId: selectedAgent.id,
        amount
      })
    );
    setManagementTab("upcoming");
    setActivePanelTab("positions");
    setSidePanelOpen(true);
  };

  const handleBackAgent = async () => {
    const amount = Number(amountInput);
    const digest = createPredictDigest();
    const input = buildCreateAttributionInput({
      round: selectedRound,
      agent: selectedAgent,
      amount,
      digest,
      userAddress,
      managerId
    });

    setAttributionDigest(digest);
    setAttributionError(null);
    setAttributionNoticeStatus("pending");

    try {
      const attribution = await attributionClient.createAttribution(input);
      setArenaState((current) =>
        recordBackedPosition(current, createRecordBackedPositionInput(input, attribution))
      );
      setAttributionNoticeStatus("submitted");
      setManagementTab("upcoming");
      setActivePanelTab("positions");
      setSidePanelOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attribution request failed";
      setAttributionError(message);
      setAttributionNoticeStatus("failed");
      throw error;
    }
  };

  const handleModifyBacking = (backing: BackingPosition) => {
    setArenaState((current) => {
      const nextState = selectAgent(current, backing.agentId);
      return createOrUpdateDraft(nextState, {
        roundId: backing.roundId,
        agentId: backing.agentId,
        amount: backing.amount
      });
    });
    setAmountInput(String(backing.amount));
  };

  return (
    <section
      aria-label="Live Arena workspace"
      className="paper-frame mx-auto flex max-w-[1440px] flex-col bg-surface/90 xl:h-[calc(100svh-46px)] xl:overflow-hidden"
    >
      <div className="shrink-0 border-b-2 border-outline-variant bg-surface-container-lowest px-4 py-3 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="paper-label text-outline">Predict-aware arena</p>
            <h1 className="mt-1 font-display text-3xl font-black uppercase leading-none text-on-surface">Live Arena</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-5 text-on-surface-variant">
              Watch agent trade markers hit the tape, switch rounds, and back the operator you trust before the T-30s lock.
            </p>
          </div>

          <RoundSchedule
            rounds={arenaState.rounds}
            selectedRoundId={selectedRound.id}
            onSelectRound={(roundId) => {
              const nextRound = arenaState.rounds.find((round) => round.id === roundId);
              setArenaState((current) => selectRound(current, roundId));
              setManagementTab("current");
              setSelectedMarkerId(null);
              setActivePanelTab(nextRound?.status === "upcoming" ? "back" : "positions");
            }}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_190px] gap-3 px-4 py-4 xl:px-5">
        <div
          className={`grid min-h-0 gap-3 ${
            sidePanelOpen ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "xl:grid-cols-[minmax(0,1fr)_56px]"
          }`}
        >
          <KlineBattlefield
            agents={selectedRoundAgents}
            round={selectedRound}
            selectedMarkerId={selectedMarkerId}
            onMarkerSelect={(marker) => {
              setSelectedMarkerId(marker.id);
              setActivePanelTab("tape");
              setSidePanelOpen(true);
            }}
          />

          <aside aria-label="Arena action panel" className="paper-card-sm min-h-0 overflow-hidden p-3">
            {sidePanelOpen ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="paper-label text-primary">Arena Panel</p>
                    <h2 className="truncate font-display text-lg font-black uppercase text-on-surface">
                      {selectedRound.marketSymbol} {selectedRound.durationLabel}
                    </h2>
                  </div>
                  <button
                    aria-label="Collapse Arena panel"
                    className="paper-button shrink-0 px-2 py-1.5 font-display text-[10px] font-black uppercase"
                    type="button"
                    onClick={() => setSidePanelOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="mb-2 grid shrink-0 grid-cols-3 gap-2">
                  {([
                    ["back", "Back Agent"],
                    ["positions", "Positions"],
                    ["tape", "Agent Tape"]
                  ] as const).map(([id, label]) => (
                    <button
                      className={`border-2 border-outline-variant px-2 py-1.5 font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000] ${
                        activePanelTab === id
                          ? "bg-primary-container text-white"
                          : "bg-surface-container-lowest text-on-surface-variant"
                      }`}
                      key={id}
                      type="button"
                      onClick={() => setActivePanelTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  {activePanelTab === "back" ? (
                    <BackAgentPanel
                      agent={selectedAgent}
                      amountInput={amountInput}
                      attributionDigest={attributionDigest}
                      attributionError={attributionError}
                      draft={upcomingDraft}
                      round={selectedRound}
                      roundState={selectedRoundState}
                      onAmountChange={setAmountInput}
                      onBackAgent={handleBackAgent}
                      onQuickAmount={(value) => setAmountInput(String(value))}
                      onSaveDraft={handleSaveDraft}
                    />
                  ) : null}

                  {activePanelTab === "positions" ? (
                    <BetManagementPanel
                      activeTab={managementTab}
                      agents={arenaState.agents}
                      currentBackings={currentBackings}
                      currentRound={selectedRound}
                      compact
                      historyBackings={historyBackings}
                      rounds={arenaState.rounds}
                      upcomingBackings={managedUpcomingBackings}
                      onCancelBacking={(backingId) =>
                        setArenaState((current) =>
                          backingId.startsWith(LOCAL_DRAFT_ID_PREFIX)
                            ? { ...current, backingDraft: null }
                            : cancelBacking(current, backingId)
                        )
                      }
                      onCloseMintedBacking={(backingId) => setArenaState((current) => closeMintedBacking(current, backingId))}
                      onModifyBacking={handleModifyBacking}
                      onTabChange={setManagementTab}
                      onViewOnChart={(agentId) => setArenaState((current) => selectAgent(current, agentId))}
                    />
                  ) : null}

                  {activePanelTab === "tape" ? (
                    <AgentOperationTape agents={arenaState.agents} round={selectedRound} selectedMarkerId={selectedMarkerId} />
                  ) : null}
                </div>

                <AttributionNotice
                  digest={attributionDigest}
                  error={attributionError}
                  quoteAssetLabel={QUOTE_ASSET_LABEL}
                  status={attributionNoticeStatus}
                />

                {upcomingDraft ? (
                  <div className="paper-card-sm mt-2 shrink-0 bg-primary-container p-2 text-xs font-bold text-white">
                    Draft saved for {getAgentById(arenaState.agents, upcomingDraft.agentId).name}: {upcomingDraft.amount} {QUOTE_ASSET_LABEL}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                aria-label="Expand Arena panel"
                className="grid h-full w-full place-items-center border-2 border-outline-variant bg-surface-container-lowest font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000]"
                type="button"
                onClick={() => setSidePanelOpen(true)}
              >
                Panel
              </button>
            )}
          </aside>
        </div>

        <AgentCardRail
          activeSort={arenaState.activeSort}
          agents={selectedRoundAgents}
          compact
          selectedAgentId={selectedAgent.id}
          onSelect={(agentId) => setArenaState((current) => selectAgent(current, agentId))}
          onSortChange={(mode) => setArenaState((current) => setAgentSort(current, mode))}
        />
      </div>
    </section>
  );
}

function AttributionNotice({
  status,
  digest,
  error,
  quoteAssetLabel
}: {
  status: AttributionNoticeStatus;
  digest: string | null;
  error: string | null;
  quoteAssetLabel: string;
}) {
  if (status === "idle") {
    return null;
  }

  if (status === "failed") {
    return (
      <div className="paper-card-sm mt-2 shrink-0 bg-[#ffdad6] p-2 text-xs font-bold text-error">
        {error ?? "Attribution request failed"}
      </div>
    );
  }

  return (
    <div className="paper-card-sm mt-2 shrink-0 bg-[#c1ffc5] p-2 text-xs font-bold text-tertiary">
      {status === "submitted" ? "Agent attribution submitted" : "Agent attribution pending"}
      {digest ? ` / ${digest}` : ""}
      <span className="ml-1 text-on-surface-variant">({quoteAssetLabel})</span>
    </div>
  );
}

function AgentOperationTape({
  round,
  agents,
  selectedMarkerId
}: {
  round: ArenaRound;
  agents: Agent[];
  selectedMarkerId: string | null;
}) {
  return (
    <section aria-label="Agent operation tape" className="paper-inset h-full overflow-y-auto p-3">
      <p className="paper-label text-outline">Agent operation tape</p>
      <div className="mt-3 grid gap-2">
        {round.tradeMarkers.map((marker) => {
          const agent = getAgentById(agents, marker.agentId);

          return (
            <article className="grid grid-cols-[32px_1fr] gap-2" key={marker.id}>
              <span
                className="grid h-8 w-8 place-items-center border-2 border-outline-variant bg-surface-container-high font-display text-[10px] font-black"
                style={{ color: agent.color }}
              >
                {agent.avatar}
              </span>
              <div
                className={`min-w-0 border-2 border-outline-variant px-2 py-1.5 ${
                  marker.id === selectedMarkerId ? "bg-primary-container/10 shadow-[3px_3px_0_#000]" : "bg-surface-container-lowest"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-xs font-black uppercase text-on-surface">{agent.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-on-surface-variant">{marker.timestamp}</div>
                  </div>
                  <span className="shrink-0 bg-primary-container px-2 py-1 font-display text-[10px] font-black uppercase text-white">
                    {formatTradeAction(marker.action)}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">{marker.reason}</p>
                <div className="paper-label mt-1 truncate text-on-surface-variant">
                  Confidence {marker.confidence} / Predict {marker.predictPosition.label}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function createMockPredictDigest(): string {
  return `0xmock-predict-digest-${Date.now().toString(16)}`;
}

function createRecordBackedPositionInput(
  input: ReturnType<typeof buildCreateAttributionInput>,
  attribution: AttributionRecord
): Parameters<typeof recordBackedPosition>[1] {
  const base = {
    userAddress: input.userAddress,
    managerId: input.managerId,
    roundId: input.roundId,
    agentId: input.agentId,
    amount: input.amount,
    predictTxDigest: input.digest,
    attributionId: attribution.id,
    attributionStatus: attribution.status,
    attributionError: null
  };

  if (input.predictPositionType === "range") {
    return {
      ...base,
      predictPositionType: "range",
      marketKey: null,
      rangeKey: input.rangeKey ?? ""
    };
  }

  return {
    ...base,
    predictPositionType: "directional",
    marketKey: input.marketKey ?? "",
    rangeKey: null
  };
}

function getBackingsForRound(backings: BackingPosition[], roundId: string, statuses: BackingStatus[]): BackingPosition[] {
  return backings.filter((backing) => backing.roundId === roundId && statuses.includes(backing.status));
}

function RoundSchedule({
  rounds,
  selectedRoundId,
  onSelectRound
}: {
  rounds: ArenaRound[];
  selectedRoundId: string;
  onSelectRound: (roundId: string) => void;
}) {
  return (
    <section aria-label="Round selector" className="grid min-w-[320px] gap-2 sm:grid-cols-3 lg:min-w-[520px]">
      {rounds.map((round) => (
        <button
          aria-label={`Select ${round.marketSymbol} ${round.durationLabel} round`}
          className={`border-2 border-outline-variant p-2.5 text-left transition ${
            round.id === selectedRoundId
              ? "bg-primary-container text-white shadow-[4px_4px_0_#000]"
              : "bg-surface-container-lowest text-on-surface-variant shadow-[3px_3px_0_#000] hover:bg-surface-container"
          }`}
          key={round.id}
          type="button"
          onClick={() => onSelectRound(round.id)}
        >
          <div className={`font-display text-sm font-black uppercase ${round.id === selectedRoundId ? "text-white" : "text-on-surface"}`}>
            {round.marketSymbol} {round.durationLabel}
          </div>
          <div className="paper-label mt-1">{round.status}</div>
          <div className="mt-1.5 grid gap-1 font-mono text-[10px] font-medium">
            <span>Lock countdown: {getLockCountdownLabel(round)}</span>
            <span>Backing volume: {round.totalBackingVolume.toLocaleString()} {QUOTE_ASSET_LABEL}</span>
          </div>
        </button>
      ))}
    </section>
  );
}

function getLockCountdownLabel(round: ArenaRound): string {
  if (round.status === "upcoming") {
    return "T-30s before start";
  }

  if (round.status === "locking") {
    return "Locking now";
  }

  return "Locked";
}

function formatTradeAction(action: string): string {
  return action.replaceAll("_", " ");
}

function createLocalDraftBacking(round: ArenaRound, agent: Agent, amount: number): BackingPosition {
  const base = {
    id: `${LOCAL_DRAFT_ID_PREFIX}-${round.id}-${agent.id}`,
    userAddress: "mock-wallet",
    managerId: null,
    roundId: round.id,
    agentId: agent.id,
    amount,
    status: "draft" as const,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    predictTxDigest: null,
    attributionId: null,
    attributionStatus: "not_started" as const,
    attributionError: null,
    estimatedValue: amount,
    finalValue: null,
    fee: null,
    redeemTxDigest: null
  };

  if (agent.supportedPositionTypes.includes("range")) {
    return {
      ...base,
      predictPositionType: "range",
      marketKey: null,
      rangeKey: `${round.marketSymbol}_${round.durationLabel}_LOCAL_RANGE`
    };
  }

  return {
    ...base,
    predictPositionType: "directional",
    marketKey: `${round.marketSymbol}_${round.durationLabel}_LOCAL_DIRECTION`,
    rangeKey: null
  };
}
