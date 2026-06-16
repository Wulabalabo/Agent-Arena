import { Copy, ShieldCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentProfile } from "../../features/platform/types";

interface AgentPairingPanelProps {
  agent: AgentProfile;
  registrationCode: string;
  claimUrl: string;
  expiresAt: string;
  runtimeCredential: string;
}

export function AgentPairingPanel({
  agent,
  registrationCode,
  claimUrl,
  expiresAt,
  runtimeCredential
}: AgentPairingPanelProps) {
  const twitterStatus = agent.twitterHandle ? (agent.twitterVerified ? "Verified" : "Unverified") : "No Twitter handle";

  return (
    <section aria-label="Pair Agent" className="paper-card-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Pair Agent</p>
          <h2 className="mt-1 truncate font-display text-lg font-black uppercase text-on-surface">{agent.displayName}</h2>
          <p className="mt-1 truncate font-mono text-[11px] font-bold text-on-surface-variant">
            @{agent.twitterHandle ?? "no_handle"} · {twitterStatus}
          </p>
        </div>
        <span className="paper-chip paper-chip-orange shrink-0 px-2 py-1">{agent.runtimeStatus}</span>
      </div>

      <div className="paper-inset mt-3 p-3">
        <InfoRow
          icon={<Wallet aria-hidden="true" size={16} />}
          label="Connect owner wallet"
          value={`Registration code ${registrationCode} · claim URL ${claimUrl}`}
        />
        <p className="mt-2 font-mono text-[10px] font-bold uppercase text-on-surface-variant">Expires {formatDateTime(expiresAt)}</p>
      </div>

      <div className="paper-inset mt-3 p-3">
        <InfoRow
          icon={<ShieldCheck aria-hidden="true" size={16} />}
          label="Agent Runtime Credential"
          value={runtimeCredential}
        />
        <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">
          Runtime can submit approved arena intents and cannot withdraw funds from the trading wallet.
        </p>
      </div>

      <button className="paper-button paper-button-primary mt-3 inline-flex items-center gap-2 px-3 py-2 font-display text-xs font-black uppercase" type="button">
        <Copy aria-hidden="true" size={14} />
        Copy pairing details
      </button>
    </section>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(new Date(value));
}
