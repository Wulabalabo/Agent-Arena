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
import type { Agent, ArenaRound, ArenaState, BackingPosition, BackingStatus } from "../../types/arena";
import { BackAgentPanel } from "./BackAgentPanel";
import { BetManagementPanel } from "./BetManagementPanel";
import { TestnetStatusPanel } from "./TestnetStatusPanel";
import { AgentCardRail } from "../bots/AgentCardRail";
import { AgentDetailPanel } from "../bots/AgentDetailPanel";
import { KlineBattlefield } from "../chart/KlineBattlefield";

const upcomingStatuses: BackingStatus[] = ["draft", "pending_signature", "submitted", "backed"];
const currentStatuses: BackingStatus[] = ["locked", "live", "redeemable"];
const historyStatuses: BackingStatus[] = ["redeemed", "cancelled", "failed"];
const LOCAL_DRAFT_ID_PREFIX = "local-draft";
const QUOTE_ASSET_LABEL = getPredictQuoteAssetLabel();

type ManagementTab = "upcoming" | "current" | "history";
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

    try {
      const attribution = await attributionClient.createAttribution(input);
      setArenaState((current) =>
        recordBackedPosition(current, createRecordBackedPositionInput(input, attribution))
      );
      setManagementTab("upcoming");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attribution request failed";
      setAttributionError(message);
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
    <section className="paper-frame mx-auto max-w-[1440px] bg-surface/90">
      <div className="border-b-2 border-outline-variant bg-surface-container-lowest px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="paper-label text-outline">Predict-aware arena</p>
            <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none text-on-surface">Live Arena</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-on-surface-variant">
              Watch agent trade markers hit the tape, switch rounds, and back the operator you trust before the T-30s lock.
            </p>
          </div>

          <RoundSchedule
            rounds={arenaState.rounds}
            selectedRoundId={selectedRound.id}
            onSelectRound={(roundId) => {
              setArenaState((current) => selectRound(current, roundId));
              setManagementTab("current");
            }}
          />
        </div>
      </div>

      <div className="grid gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:px-6">
        <div className="grid gap-4">
          <KlineBattlefield agents={selectedRoundAgents} round={selectedRound} />
          <AgentCardRail
            activeSort={arenaState.activeSort}
            agents={selectedRoundAgents}
            selectedAgentId={selectedAgent.id}
            onSelect={(agentId) => setArenaState((current) => selectAgent(current, agentId))}
            onSortChange={(mode) => setArenaState((current) => setAgentSort(current, mode))}
          />
        </div>

        <div className="grid gap-4 self-start">
          <AgentDetailPanel agent={selectedAgent} roundState={selectedRoundState} />
          <TestnetStatusPanel />
          <BackAgentPanel
            agent={selectedAgent}
            amountInput={amountInput}
            attributionDigest={attributionDigest}
            attributionError={attributionError}
            draft={upcomingDraft}
            round={selectedRound}
            onAmountChange={setAmountInput}
            onBackAgent={handleBackAgent}
            onQuickAmount={(value) => setAmountInput(String(value))}
            onSaveDraft={handleSaveDraft}
          />
          <BetManagementPanel
            activeTab={managementTab}
            agents={arenaState.agents}
            currentBackings={currentBackings}
            currentRound={selectedRound}
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
          {upcomingDraft ? (
            <div className="paper-card-sm bg-primary-container p-3 text-sm font-bold text-white">
              Draft saved for {getAgentById(arenaState.agents, upcomingDraft.agentId).name}: {upcomingDraft.amount} {QUOTE_ASSET_LABEL}
            </div>
          ) : null}
        </div>
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
    <section aria-label="Round selector" className="grid min-w-[320px] gap-2 sm:grid-cols-3 lg:min-w-[560px]">
      {rounds.map((round) => (
        <button
          aria-label={`Select ${round.marketSymbol} ${round.durationLabel} round`}
          className={`border-2 border-outline-variant p-3 text-left transition ${
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
          <div className="mt-2 grid gap-1 font-mono text-[10px] font-medium">
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
