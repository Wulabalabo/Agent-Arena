import { useMemo, useState } from "react";
import type { Agent, AgentRoundState, ArenaRound, BackingDraft } from "../../types/arena";
import { isRoundLocked } from "../../state/arena";
import { getPredictQuoteAssetLabel, predictConfig } from "../../features/predict/config";
import { getPredictReadiness } from "../../features/predict/readiness";

type TransactionStage = "Connect wallet" | "Create PredictManager" | "Deposit quote asset" | "Back Agent" | "Confirming" | "Backed" | "Failed";

interface BackAgentPanelProps {
  round: ArenaRound;
  agent: Agent;
  roundState?: AgentRoundState;
  draft: BackingDraft | null;
  amountInput: string;
  attributionDigest: string | null;
  attributionError: string | null;
  onAmountChange: (value: string) => void;
  onQuickAmount: (value: number) => void;
  onBackAgent: () => Promise<void>;
  onSaveDraft: () => void;
}

const quickAmounts = [50, 100, 250, 500];
const transactionStages: TransactionStage[] = [
  "Connect wallet",
  "Create PredictManager",
  "Deposit quote asset",
  "Back Agent",
  "Confirming",
  "Backed",
  "Failed"
];

export function BackAgentPanel({
  round,
  agent,
  roundState,
  draft,
  amountInput,
  attributionDigest,
  attributionError,
  onAmountChange,
  onQuickAmount,
  onBackAgent,
  onSaveDraft
}: BackAgentPanelProps) {
  const [transactionStage, setTransactionStage] = useState<TransactionStage>("Connect wallet");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const roundLocked = isRoundLocked(round);
  const readiness = useMemo(
    () => ({
      wallet: transactionStage !== "Connect wallet",
      manager: !["Connect wallet", "Create PredictManager"].includes(transactionStage),
      deposit: !["Connect wallet", "Create PredictManager", "Deposit quote asset"].includes(transactionStage)
    }),
    [transactionStage]
  );
  const predictReadiness = getPredictReadiness({
    walletConnected: readiness.wallet,
    hasManager: readiness.manager,
    hasEnoughDeposit: readiness.deposit,
    roundLocked,
    mockMode: predictConfig.mockMode,
    liveWalletFlow: predictConfig.liveWalletFlow
  });
  const predictAction = agent.supportedPositionTypes.includes("range") ? "mint_range" : "mint";
  const quoteAssetLabel = getPredictQuoteAssetLabel();
  const bestMarketType = agent.supportedPositionTypes.includes("range")
    ? agent.supportedPositionTypes.includes("directional")
      ? "Directional / Range"
      : "Range"
    : "Directional";

  const handlePrimaryAction = async () => {
    if (roundLocked || transactionStage === "Confirming") {
      return;
    }

    if (predictReadiness.primaryAction === "back_agent") {
      setTransactionStage("Confirming");

      try {
        await onBackAgent();
        setTransactionStage("Backed");
      } catch {
        setTransactionStage("Failed");
      }

      return;
    }

    if (transactionStage === "Connect wallet") {
      setTransactionStage("Create PredictManager");
      return;
    }

    if (transactionStage === "Create PredictManager") {
      setTransactionStage("Deposit quote asset");
      return;
    }

    if (transactionStage === "Deposit quote asset") {
      setTransactionStage("Back Agent");
      return;
    }

    if (transactionStage === "Back Agent" || transactionStage === "Backed") {
      onSaveDraft();
      setTransactionStage("Backed");
    }
  };

  return (
    <section aria-label="Back Agent action ticket" className="paper-card-sm min-h-0 overflow-y-auto overflow-x-hidden p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-primary">Back Agent</p>
          <h2 className="mt-1 truncate font-display text-lg font-black uppercase text-on-surface">{agent.name}</h2>
        </div>
        <span
          className={`paper-chip px-2 py-1 ${
            roundLocked ? "paper-chip-red" : "paper-chip-green"
          }`}
        >
          {roundLocked ? "Locked" : "Open"}
        </span>
      </div>

      <label className="paper-label mt-2 block text-on-surface-variant" htmlFor="backing-amount">
        Backing amount
      </label>
      <input
        aria-label="Backing amount"
        className="mt-1 w-full border-2 border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-mono text-sm font-bold text-on-surface"
        id="backing-amount"
        min={1}
        step={10}
        type="number"
        value={amountInput}
        onChange={(event) => onAmountChange(event.target.value)}
      />

      <div className="mt-2 grid grid-cols-4 gap-2">
        {quickAmounts.map((amount) => (
          <button
            className="paper-button px-2 py-1 font-display text-[10px] font-black uppercase"
            key={amount}
            type="button"
            onClick={() => onQuickAmount(amount)}
          >
            {amount}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <button
          aria-label={`Primary action: ${predictReadiness.label}`}
          className="paper-button paper-button-primary px-4 py-2.5 font-display text-xs font-black uppercase"
          disabled={predictReadiness.disabled || transactionStage === "Confirming"}
          type="button"
          onClick={handlePrimaryAction}
        >
          {predictReadiness.label}
        </button>

        <button
          className="paper-button px-3 py-2.5 font-display text-xs font-black uppercase"
          disabled={roundLocked}
          type="button"
          onClick={onSaveDraft}
        >
          Save Draft
        </button>
      </div>

      <div className="paper-inset mt-2 p-2">
        <p className="truncate text-xs font-semibold text-on-surface-variant">
          <span className="paper-label mr-1 text-outline">Selected Agent Summary</span>
          {agent.strategySummary}
        </p>
        <div className="paper-label mt-1 truncate text-on-surface-variant">
          {agent.strategyType} / {agent.supportedPositionTypes.join(" / ")} / Current Backing Pool {agent.backingVolume.toLocaleString()} {quoteAssetLabel}
        </div>
      </div>

      <div className="paper-inset mt-2 p-2 text-[10px] font-bold text-on-surface-variant">
        <div className="truncate">
          <span className="paper-label mr-1 text-[9px] text-on-surface-variant">Win Rate</span>
          <span className="font-mono text-on-surface">{Math.round(agent.winRate * 100)}%</span>
          <span className="mx-1">/</span>
          <span className="paper-label mr-1 text-[9px] text-on-surface-variant">Floating PnL</span>
          <span className="font-mono text-on-surface">{formatSignedPercent(roundState?.floatingPnl ?? 0)}</span>
          <span className="mx-1">/</span>
          <span className="paper-label mr-1 text-[9px] text-on-surface-variant">Max Drawdown</span>
          <span className="font-mono text-on-surface">{Math.round(agent.maxDrawdown * 100)}%</span>
        </div>
        <div className="mt-1 truncate">
          <span className="paper-label mr-1 text-[9px] text-on-surface-variant">Best Market Type</span>
          <span className="font-mono text-on-surface">{bestMarketType}</span>
          <span className="mx-1">/</span>
          <span className="paper-label mr-1 text-[9px] text-on-surface-variant">Last Action</span>
          <span className="font-mono text-on-surface">{formatAction(roundState?.lastAction ?? "none")}</span>
          <span className="mx-1">/</span>
          <span className="paper-label mr-1 text-[9px] text-on-surface-variant">Recent Outcomes</span>
          <span className="inline-flex gap-1 align-middle">
            {agent.recentForm.map((result, index) => (
              <span className={`paper-chip px-1 py-0.5 text-[9px] ${result === "W" ? "paper-chip-green" : "paper-chip-red"}`} key={`${agent.id}-${index}`}>
                {result}
              </span>
            ))}
          </span>
        </div>
      </div>

      <section className="paper-inset mt-2 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-bold text-on-surface-variant">
            <span className="paper-label mr-1 text-outline">Transaction readiness</span>
            {readiness.wallet ? "Ready" : "Missing"} wallet / {readiness.manager ? "Ready" : "Missing"} manager /{" "}
            {readiness.deposit ? "Ready" : "Missing"} deposit / Predict action - predict::{predictAction} / Quote asset -{" "}
            {quoteAssetLabel} / {predictConfig.mockMode ? "Mock mode" : "Live wallet flow"}
          </p>
          <button
            aria-controls="back-agent-diagnostics"
            aria-expanded={diagnosticsOpen}
            className="paper-button shrink-0 px-2 py-1.5 font-display text-[10px] font-black uppercase"
            type="button"
            onClick={() => setDiagnosticsOpen((open) => !open)}
          >
            {diagnosticsOpen ? "Hide diagnostics" : "Show diagnostics"}
          </button>
        </div>
        <p className="mt-1 truncate text-[10px] font-medium text-on-surface-variant">{predictReadiness.reasons[0]}</p>

        {diagnosticsOpen ? (
          <div
            aria-label="Demo transaction controls"
            className="mt-2 border-t-2 border-outline-variant pt-2"
            id="back-agent-diagnostics"
            role="region"
          >
            <p className="paper-label text-outline">Demo transaction controls</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {transactionStages.map((stage) => (
                <button
                  className={`border-2 border-outline-variant px-2 py-1 font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000] ${
                    transactionStage === stage
                      ? "bg-primary-container text-white"
                      : "bg-surface-container-lowest text-on-surface-variant"
                  }`}
                  key={stage}
                  type="button"
                  onClick={() => setTransactionStage(stage)}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {transactionStage === "Failed" ? (
        <div className="paper-inset mt-2 bg-[#ffdad6] p-2.5 text-sm font-bold text-error">
          {attributionError ?? "Retry after wallet failure."}
        </div>
      ) : null}
      {transactionStage === "Backed" ? (
        <div className="paper-inset mt-2 bg-[#c1ffc5] p-2.5 text-sm font-bold text-tertiary">
          Agent attribution submitted for {(draft?.amount ?? Number(amountInput)) || 0} {quoteAssetLabel}
          {attributionDigest ? ` / ${attributionDigest}` : ""}.
        </div>
      ) : null}
    </section>
  );
}

function formatSignedPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatAction(action: AgentRoundState["lastAction"] | "none"): string {
  return action === "none" ? "Waiting" : action.replaceAll("_", " ");
}
