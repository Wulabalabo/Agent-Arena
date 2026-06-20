import { Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { UserAgentArenaProfile } from "../../features/platform/arena-ui";

interface UserAgentProfilePanelProps {
  className?: string;
  profile: UserAgentArenaProfile;
  summary?: ReactNode;
  variant?: "full" | "compact";
}

export function UserAgentProfilePanel({ className = "", profile, summary, variant = "full" }: UserAgentProfilePanelProps) {
  const compact = variant === "compact";
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const tradingWalletAddress = profile.tradingWalletAddress;

  async function copyTradingWallet() {
    const clipboard = navigator.clipboard;
    if (!tradingWalletAddress || !clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await clipboard.writeText(tradingWalletAddress);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  const tradingWalletCopyAction = tradingWalletAddress ? (
    <button
      aria-label="Copy trading wallet"
      className="ml-2 inline-flex size-6 items-center justify-center rounded-sm border border-outline bg-surface text-on-surface transition hover:bg-surface-muted"
      onClick={copyTradingWallet}
      title="Copy trading wallet"
      type="button"
    >
      <Copy aria-hidden="true" size={12} />
    </button>
  ) : null;
  const tradingWalletCopyStatus = (
    <p className={copyStatus === "idle" ? "sr-only" : "mt-2 font-mono text-[11px] font-black text-on-surface"} role="status">
      {copyStatus === "copied" ? "Trading wallet copied" : copyStatus === "failed" ? "Trading wallet copy failed" : ""}
    </p>
  );

  return (
    <section aria-label="My Agent profile" className={`paper-card-sm p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">My Agent profile</p>
          <h2 className={`mt-1 font-display font-black uppercase text-on-surface ${compact ? "text-base" : "text-lg"}`}>My Agent</h2>
          <p className={`mt-2 truncate font-display font-black uppercase text-on-surface ${compact ? "text-lg" : "text-xl"}`}>
            {profile.displayName}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {summary}
          <span className={`paper-chip shrink-0 px-2 py-1 ${accountStateClass(profile.accountState)}`}>
            {formatToken(profile.accountState)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-5">
        <ProfileMetric label="Runtime" value={formatToken(profile.runtimeStatus)} />
        <ProfileMetric label="Exposure" value={formatToken(profile.exposureStatus)} />
        <ProfileMetric label="Position" value={profile.positionLabel} />
        <ProfileMetric label="Wallet balance" value={profile.walletBalanceLabel} />
        <ProfileMetric label="Realized PnL" value={formatPercent(profile.realizedPnlPct)} />
      </div>

      {compact ? (
        <section aria-label="My Agent funding wallet" className="paper-inset mt-3 p-3">
          <DetailLine label="Trading wallet" value={tradingWalletAddress ?? "not created"} action={tradingWalletCopyAction} />
          {tradingWalletCopyStatus}
        </section>
      ) : null}

      {!compact ? <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section aria-label="My Agent position" className="paper-inset p-3">
          <h3 className="font-display text-xs font-black uppercase text-on-surface">Position and PnL</h3>
          <DetailLine label="Open quantity raw" value={profile.openQuantityRaw ?? "flat"} />
          <DetailLine label="Submitted budget raw" value={profile.submittedBudgetRaw ?? "none"} />
          <DetailLine label="Unrealized PnL" value={formatPercent(profile.unrealizedPnlPct)} />
          <DetailLine label="Latest intent" value={profile.latestIntentId ?? "none"} />
          <DetailLine label="Latest execution" value={profile.latestExecutionId ?? "none"} />
        </section>

        <section aria-label="My Agent wallet details" className="paper-inset p-3">
          <h3 className="font-display text-xs font-black uppercase text-on-surface">Wallet and owner</h3>
          <DetailLine label="Agent id" value={profile.agentId ?? "unclaimed"} />
          <DetailLine label="Owner" value={profile.ownerAddress ?? "not connected"} />
          <DetailLine
            label="Trading wallet"
            value={tradingWalletAddress ?? "not created"}
            action={tradingWalletCopyAction}
          />
          <DetailLine label="DUSDC balance" value={profile.quoteBalance ?? "not available"} />
          <DetailLine label="Testnet SUI" value={profile.testnetSuiBalance ?? "not available"} />
          <DetailLine label="Latest Predict tx" value={profile.latestPredictTxDigest ?? "not submitted"} />
          {profile.twitterHandle ? <DetailLine label="Twitter" value={`@${profile.twitterHandle}`} /> : null}
          {tradingWalletCopyStatus}
        </section>
      </div> : null}
    </section>
  );
}

function ProfileMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="paper-inset min-w-0 p-3">
      <p className="paper-label text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-black text-on-surface">{value}</p>
    </div>
  );
}

function DetailLine({ action = null, label, value }: { action?: ReactNode; label: string; value: ReactNode }) {
  return (
    <p className="mt-2 min-w-0 break-all font-mono text-[11px] font-bold text-on-surface-variant">
      <span className="font-display text-[10px] uppercase">{label}: </span>
      {value}
      {action}
    </p>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? "not scored" : `${(value * 100).toFixed(2)}%`;
}

function formatToken(value: string): string {
  return value.replace(/_/g, " ");
}

function accountStateClass(value: UserAgentArenaProfile["accountState"]): string {
  if (value === "open_exposure" || value === "flat") {
    return "paper-chip-green";
  }

  if (value === "attention" || value === "no_owner_wallet") {
    return "paper-chip-red";
  }

  return "paper-chip-orange";
}
