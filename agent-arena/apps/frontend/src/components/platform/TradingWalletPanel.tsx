import { Copy, ShieldCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentProfile, OwnerWithdrawalRecord, TradingWallet } from "../../features/platform/types";

interface TradingWalletPanelProps {
  agent: AgentProfile;
  tradingWallet: TradingWallet;
  ownerWithdrawal?: OwnerWithdrawalRecord;
}

export function TradingWalletPanel({ agent, ownerWithdrawal, tradingWallet }: TradingWalletPanelProps) {
  return (
    <section aria-label="Testnet trading wallet" className="paper-card-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Testnet trading wallet</p>
          <h2 className="mt-1 truncate font-display text-lg font-black uppercase text-on-surface">{agent.displayName}</h2>
          <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">{tradingWallet.id}</p>
        </div>
        <span className={`paper-chip shrink-0 px-2 py-1 ${tradingWallet.status === "active" ? "paper-chip-green" : "paper-chip-red"}`}>
          {tradingWallet.status}
        </span>
      </div>

      <div className="paper-inset mt-3 p-3">
        <InfoRow icon={<Wallet aria-hidden="true" size={16} />} label="Deposit address" value={tradingWallet.address} />
        <button className="paper-button mt-3 inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase" type="button">
          <Copy aria-hidden="true" size={14} />
          Copy deposit address
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label="Container ID" value={tradingWallet.id} />
        <Metric label="Testnet SUI" value={tradingWallet.testnetSuiBalance} />
        <Metric label="Quote" value={tradingWallet.quoteBalance} />
        <Metric label="PredictManager" value={tradingWallet.predictManagerStatus} />
      </div>

      <div className="paper-inset mt-3 p-3">
        <InfoRow
          icon={<ShieldCheck aria-hidden="true" size={16} />}
          label="Never exposes private keys"
          value="Wallet is the execution container. The platform signs only approved DeepBook Predict operations for this agent."
        />
        <MonoInfo label="PredictManager ID" value={tradingWallet.predictManagerId ?? "not created"} />
      </div>

      {ownerWithdrawal ? (
        <div className="paper-inset mt-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <InfoRow
              icon={<ShieldCheck aria-hidden="true" size={16} />}
              label="Owner withdrawal"
              value={ownerWithdrawal.txDigest ?? ownerWithdrawal.recipientAddress ?? tradingWallet.address}
            />
            <span className={`paper-chip shrink-0 px-2 py-1 ${ownerWithdrawal.status === "failed" ? "paper-chip-red" : "paper-chip-green"}`}>
              {ownerWithdrawal.status}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Metric label="Amount raw" value={ownerWithdrawal.amountRaw} />
            <Metric label="Recipient" value={ownerWithdrawal.recipientAddress ?? tradingWallet.address} />
          </div>
        </div>
      ) : null}

      <button className="paper-button paper-button-primary mt-3 px-3 py-2 font-display text-xs font-black uppercase" type="button">
        Refresh balances
      </button>
    </section>
  );
}

function MonoInfo({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 min-w-0 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
    </p>
  );
}

interface InfoRowProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-on-surface-variant">{icon}</span>
        <p className="paper-label text-on-surface-variant">{label}</p>
      </div>
      <p className="mt-1 break-all font-mono text-xs font-bold text-on-surface">{value}</p>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: ReactNode;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="paper-inset min-w-0 p-2">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-bold text-on-surface">{value}</p>
    </div>
  );
}
