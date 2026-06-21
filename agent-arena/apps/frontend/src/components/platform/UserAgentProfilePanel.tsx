import { Copy, KeyRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { UserAgentArenaProfile } from "../../features/platform/arena-ui";
import type {
  RuntimeCredential,
  RuntimeCredentialRotationChallenge,
  RuntimeCredentialRotationRegistryProof,
  RuntimeCredentialRotationResponse
} from "../../features/platform/types";

interface UserAgentProfilePanelProps {
  apiBaseUrl?: string;
  className?: string;
  connectedOwnerAddress?: string | null;
  onCreateRuntimeCredentialRotationChallenge?: (
    agentId: string,
    input: { ownerAddress: string; reason: string }
  ) => Promise<RuntimeCredentialRotationChallenge>;
  onRotateRuntimeCredential?: (
    agentId: string,
    input: {
      ownerAddress: string;
      nonce: string;
      txDigest: string;
    }
  ) => Promise<RuntimeCredentialRotationResponse>;
  onSignAndExecuteRegistryTransaction?: (proof: RuntimeCredentialRotationRegistryProof) => Promise<string>;
  profile: UserAgentArenaProfile;
  summary?: ReactNode;
  variant?: "full" | "compact";
}

const compactActionClass =
  "inline-flex min-h-7 w-fit max-w-full items-center justify-center gap-1.5 rounded-sm border border-outline bg-surface px-2 py-1 font-display text-[9px] font-black uppercase text-on-surface transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-55";
const compactPrimaryActionClass =
  "inline-flex min-h-7 w-fit max-w-full items-center justify-center gap-1.5 rounded-sm border border-outline-variant bg-primary px-2 py-1 font-display text-[9px] font-black uppercase text-on-primary transition hover:bg-primary-container";

export function UserAgentProfilePanel({
  apiBaseUrl,
  className = "",
  connectedOwnerAddress,
  onCreateRuntimeCredentialRotationChallenge,
  onRotateRuntimeCredential,
  onSignAndExecuteRegistryTransaction,
  profile,
  summary,
  variant = "full"
}: UserAgentProfilePanelProps) {
  const compact = variant === "compact";
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [handoffCopyStatus, setHandoffCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [rotationStatus, setRotationStatus] = useState<"idle" | "rotating" | "rotated" | "failed">("idle");
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [rotatedCredential, setRotatedCredential] = useState<RuntimeCredential | null>(null);
  const tradingWalletAddress = profile.tradingWalletAddress;
  const rotationReason = "owner requested runtime credential rotation";
  const ownerAddress = connectedOwnerAddress?.trim() ?? "";
  const canRotateRuntimeCredential = Boolean(
    profile.agentId &&
    ownerAddress &&
    profile.ownerAddress &&
    normalizeAddress(profile.ownerAddress) === normalizeAddress(ownerAddress) &&
    onCreateRuntimeCredentialRotationChallenge &&
    onRotateRuntimeCredential &&
    onSignAndExecuteRegistryTransaction
  );

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

  async function rotateRuntimeCredential() {
    if (
      !profile.agentId ||
      !ownerAddress ||
      !onCreateRuntimeCredentialRotationChallenge ||
      !onRotateRuntimeCredential ||
      !onSignAndExecuteRegistryTransaction
    ) {
      return;
    }

    setRotationStatus("rotating");
    setRotationError(null);
    setHandoffCopyStatus("idle");

    try {
      const challenge = await onCreateRuntimeCredentialRotationChallenge(profile.agentId, {
        ownerAddress,
        reason: rotationReason
      });
      if (!challenge.registryProof) {
        throw new Error("Runtime credential rotation registry proof is unavailable");
      }
      const txDigest = await onSignAndExecuteRegistryTransaction(challenge.registryProof);
      const response = await onRotateRuntimeCredential(profile.agentId, {
        ownerAddress: challenge.ownerAddress,
        nonce: challenge.nonce,
        txDigest
      });
      setRotatedCredential(response.runtimeCredential);
      setRotationStatus("rotated");
    } catch (error) {
      setRotationStatus("failed");
      setRotationError(error instanceof Error ? error.message : "Runtime credential rotation failed");
    }
  }

  async function copyRotatedHandoff() {
    if (!rotatedCredential || !profile.agentId || !navigator.clipboard?.writeText) {
      setHandoffCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify({
        baseUrl: apiBaseUrl ?? "",
        agentId: profile.agentId,
        token: rotatedCredential.token,
        credentialVersion: rotatedCredential.credentialVersion,
        scopes: rotatedCredential.scopes,
        walletAddress: tradingWalletAddress,
        savedAt: new Date().toISOString()
      }, null, 2));
      setHandoffCopyStatus("copied");
    } catch {
      setHandoffCopyStatus("failed");
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
  const runtimeCredentialRotationAction = canRotateRuntimeCredential ? (
    <button
      aria-label="Rotate runtime credential"
      className={compactActionClass}
      disabled={rotationStatus === "rotating"}
      onClick={() => void rotateRuntimeCredential()}
      type="button"
    >
      <KeyRound aria-hidden="true" size={12} />
      {rotationStatus === "rotating" ? "Rotating" : "Rotate credential"}
    </button>
  ) : null;
  const runtimeCredentialRotationResult = canRotateRuntimeCredential && (rotatedCredential || rotationError) ? (
    <div className="mt-2 grid gap-2">
      {rotatedCredential ? (
        <div className="paper-inset grid max-w-full gap-1.5 p-2">
          <p className="paper-label text-on-surface-variant">New runtime credential</p>
          <p className="break-all font-mono text-[11px] font-bold text-on-surface">{rotatedCredential.token}</p>
          <button
            className={compactPrimaryActionClass}
            onClick={() => void copyRotatedHandoff()}
            type="button"
          >
            <Copy aria-hidden="true" size={12} />
            Copy Agent handoff
          </button>
          {handoffCopyStatus === "copied" ? (
            <p className="text-[11px] font-bold text-on-surface-variant">Runtime handoff copied.</p>
          ) : null}
          {handoffCopyStatus === "failed" ? (
            <p className="text-[11px] font-bold text-error">Copy failed.</p>
          ) : null}
        </div>
      ) : null}
      {rotationError ? <p className="text-[11px] font-bold text-error">{rotationError}</p> : null}
    </div>
  ) : null;

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
          <WalletCredentialRow
            action={tradingWalletCopyAction}
            rotationAction={runtimeCredentialRotationAction}
            value={tradingWalletAddress ?? "not created"}
          />
          {tradingWalletCopyStatus}
          {runtimeCredentialRotationResult}
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
          <WalletCredentialRow
            action={tradingWalletCopyAction}
            rotationAction={runtimeCredentialRotationAction}
            value={tradingWalletAddress ?? "not created"}
          />
          <DetailLine label="DUSDC balance" value={profile.quoteBalance ?? "not available"} />
          <DetailLine label="Testnet SUI" value={profile.testnetSuiBalance ?? "not available"} />
          <DetailLine label="Latest Predict tx" value={profile.latestPredictTxDigest ?? "not submitted"} />
          {profile.twitterHandle ? <DetailLine label="Twitter" value={`@${profile.twitterHandle}`} /> : null}
          {tradingWalletCopyStatus}
          {runtimeCredentialRotationResult}
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

function WalletCredentialRow({
  action = null,
  rotationAction = null,
  value
}: {
  action?: ReactNode;
  rotationAction?: ReactNode;
  value: ReactNode;
}) {
  return (
    <div aria-label="Trading wallet credential controls" className="mt-2 flex flex-wrap items-start justify-between gap-2">
      <p className="min-w-0 flex-1 break-all font-mono text-[11px] font-bold text-on-surface-variant">
        <span className="font-display text-[10px] uppercase">Trading wallet: </span>
        {value}
        {action}
      </p>
      {rotationAction ? <div className="ml-auto shrink-0">{rotationAction}</div> : null}
    </div>
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

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}
