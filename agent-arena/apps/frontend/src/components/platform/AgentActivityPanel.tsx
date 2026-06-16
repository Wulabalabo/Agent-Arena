import type { ReactNode } from "react";
import type { AgentIntent, ExecutionRecord, RiskDecision, TradingWallet } from "../../features/platform/types";

interface AgentActivityPanelProps {
  executions: ExecutionRecord[];
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  tradingWallet: TradingWallet;
}

export function AgentActivityPanel({ executions, intents, riskDecisions, tradingWallet }: AgentActivityPanelProps) {
  return (
    <section aria-label="Agent activity" className="paper-card-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Agent activity</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Platform records</h2>
        </div>
        <span className="paper-chip paper-chip-green px-2 py-1">Testnet</span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ActivitySection title="Intents">
          {intents.length > 0 ? (
            intents.map((intent) => (
              <RecordBlock key={intent.id}>
                <RecordHeader label={intent.id} value={`${intent.status} / ${formatAction(intent.action)}`} />
                <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">{intent.reason}</p>
                {intent.rejectionCode ? <MonoLine label="Policy code" value={formatIntentRejection(intent.rejectionCode)} /> : null}
                {intent.market ? <MonoLine label="Market" value={formatMarket(intent)} /> : null}
                {intent.quantity ? <MonoLine label="Quantity" value={intent.quantity} /> : null}
                {intent.maxCost ? <MonoLine label="Max cost" value={intent.maxCost} /> : null}
              </RecordBlock>
            ))
          ) : (
            <EmptyState>No intents yet.</EmptyState>
          )}
        </ActivitySection>

        <ActivitySection title="Risk">
          {riskDecisions.length > 0 ? (
            riskDecisions.map((decision, index) => (
              <RecordBlock key={decision.id}>
                <RecordHeader label={`decision_${index + 1}`} value={decision.accepted ? "accepted" : "rejected"} />
                <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">
                  {decision.policyMessage.replace(/risk/gi, "policy").replace(/wallet/gi, "account")}
                </p>
                {decision.rejectionCode ? <MonoLine label="Rejection" value={decision.rejectionCode} /> : null}
              </RecordBlock>
            ))
          ) : (
            <EmptyState>No policy decisions yet.</EmptyState>
          )}
        </ActivitySection>

        <ActivitySection title="Executions">
          {executions.length > 0 ? (
            executions.map((execution) => (
              <RecordBlock key={execution.id}>
                <RecordHeader label={execution.id} value={`${execution.status} / ${formatAction(execution.action)}`} />
                <MonoLine label="Predict tx" value={execution.predictTxDigest ?? "pending"} />
              </RecordBlock>
            ))
          ) : (
            <EmptyState>No Predict executions yet.</EmptyState>
          )}
        </ActivitySection>

        <ActivitySection title="Wallet">
          <RecordBlock>
            <RecordHeader label={formatAddress(tradingWallet.address)} value={tradingWallet.status} />
            <MonoLine label="Testnet SUI" value={tradingWallet.testnetSuiBalance} />
            <MonoLine label="Quote balance" value={tradingWallet.quoteBalance} />
            <MonoLine label="Predict manager" value={tradingWallet.predictManagerStatus} />
          </RecordBlock>
        </ActivitySection>
      </div>
    </section>
  );
}

interface ActivitySectionProps {
  ariaLabel?: string;
  children: ReactNode;
  title: ReactNode;
}

function ActivitySection({ ariaLabel, children, title }: ActivitySectionProps) {
  return (
    <section aria-label={ariaLabel ?? String(title)} className="paper-inset min-w-0 p-3">
      <h3 className="font-display text-xs font-black uppercase text-on-surface">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

interface RecordHeaderProps {
  label: string;
  value: string;
}

function RecordHeader({ label, value }: RecordHeaderProps) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <p className="truncate font-mono text-[11px] font-bold text-on-surface">{label}</p>
      <span className="paper-chip shrink-0 px-2 py-1">{value}</span>
    </div>
  );
}

interface MonoLineProps {
  label: string;
  value: string;
}

function MonoLine({ label, value }: MonoLineProps) {
  return (
    <p className="mt-2 min-w-0 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
    </p>
  );
}

function RecordBlock({ children }: { children: ReactNode }) {
  return <article className="rounded-md border border-outline/60 bg-surface-container/70 p-2">{children}</article>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-on-surface-variant">{children}</p>;
}

function formatMarket(intent: AgentIntent) {
  if (!intent.market) {
    return "none";
  }

  if (intent.market.kind === "directional") {
    return `${intent.market.kind} / ${intent.market.strike} / ${intent.market.isUp ? "up" : "down"}`;
  }

  return `${intent.market.kind} / ${intent.market.lowerStrike}-${intent.market.higherStrike}`;
}

function formatAction(value: string) {
  return value.replace(/_/g, " ");
}

function formatIntentRejection(value: string) {
  return formatAction(value).replace(/^RISK\s+/i, "");
}

function formatAddress(value: string) {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-7)}`;
}
