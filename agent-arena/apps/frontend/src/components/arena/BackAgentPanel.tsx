import { useMemo, useState } from "react";
import type { Agent, ArenaRound, BackingDraft } from "../../types/arena";
import { isRoundLocked } from "../../state/arena";
import { getPredictQuoteAssetLabel, predictConfig } from "../../features/predict/config";
import { getPredictReadiness } from "../../features/predict/readiness";

type TransactionStage = "Connect wallet" | "Create PredictManager" | "Deposit quote asset" | "Back Agent" | "Confirming" | "Backed" | "Failed";

interface BackAgentPanelProps {
  round: ArenaRound;
  agent: Agent;
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
    <section className="paper-card-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="paper-label text-primary">Back Agent</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">{agent.name}</h2>
        </div>
        <span
          className={`paper-chip px-2 py-1 ${
            roundLocked ? "paper-chip-red" : "paper-chip-green"
          }`}
        >
          {roundLocked ? "Locked" : "Open"}
        </span>
      </div>

      <div className="paper-inset mt-3 p-3">
        <p className="paper-label text-outline">Selected Agent Summary</p>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">{agent.strategySummary}</p>
        <div className="paper-label mt-2 text-on-surface-variant">
          {agent.strategyType} / {agent.supportedPositionTypes.join(" / ")} / {Math.round(agent.winRate * 100)}% win rate
        </div>
      </div>

      <label className="paper-label mt-4 block text-on-surface-variant" htmlFor="backing-amount">
        Backing amount
      </label>
      <input
        aria-label="Backing amount"
        className="mt-2 w-full border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm font-bold text-on-surface"
        id="backing-amount"
        min={1}
        step={10}
        type="number"
        value={amountInput}
        onChange={(event) => onAmountChange(event.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {quickAmounts.map((amount) => (
          <button
            className="paper-button px-3 py-2 font-display text-[10px] font-black uppercase"
            key={amount}
            type="button"
            onClick={() => onQuickAmount(amount)}
          >
            {amount} {quoteAssetLabel}
          </button>
        ))}
      </div>

      <section className="paper-inset mt-4 p-3">
        <p className="paper-label text-outline">Transaction readiness</p>
        <ul className="mt-2 space-y-2 text-sm font-medium text-on-surface-variant">
          <li>{readiness.wallet ? "Ready" : "Missing"} - Wallet connected</li>
          <li>{readiness.manager ? "Ready" : "Missing"} - PredictManager available</li>
          <li>{readiness.deposit ? "Ready" : "Missing"} - Quote asset deposited</li>
          <li>Predict action - predict::{predictAction}</li>
          <li>Quote asset - {quoteAssetLabel}</li>
        </ul>
        <p className="mt-3 text-xs font-medium text-on-surface-variant">{predictReadiness.reasons[0]}</p>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {transactionStages.map((stage) => (
          <button
            className={`border-2 border-outline-variant px-2.5 py-1.5 font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000] ${
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

      <div className="paper-inset mt-3 p-3 font-mono text-[10px] font-bold uppercase text-on-surface-variant">
        Lock Boundary: {round.locksAt} / Round Start: {round.startsAt} / Round End: {round.endsAt}
      </div>

      {transactionStage === "Failed" ? (
        <div className="paper-inset mt-3 bg-[#ffdad6] p-3 text-sm font-bold text-error">
          {attributionError ?? "Retry after wallet failure."}
        </div>
      ) : null}
      {transactionStage === "Backed" ? (
        <div className="paper-inset mt-3 bg-[#c1ffc5] p-3 text-sm font-bold text-tertiary">
          Agent attribution submitted for {(draft?.amount ?? Number(amountInput)) || 0} {quoteAssetLabel}
          {attributionDigest ? ` / ${attributionDigest}` : ""}.
        </div>
      ) : null}

      <button
        aria-label={`Primary action: ${predictReadiness.label}`}
        className="paper-button paper-button-primary mt-4 w-full px-4 py-3 font-display text-xs font-black uppercase"
        disabled={predictReadiness.disabled || transactionStage === "Confirming"}
        type="button"
        onClick={handlePrimaryAction}
      >
        {predictReadiness.label}
      </button>

      <button
        className="paper-button mt-3 w-full px-4 py-3 font-display text-xs font-black uppercase"
        disabled={roundLocked}
        type="button"
        onClick={onSaveDraft}
      >
        Save Draft
      </button>
    </section>
  );
}
