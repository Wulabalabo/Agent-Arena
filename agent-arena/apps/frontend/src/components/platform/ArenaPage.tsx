import type { Competition } from "../../features/platform/types";
import type {
  RuntimeCredentialRotationChallenge,
  RuntimeCredentialRotationResponse
} from "../../features/platform/types";
import type { ArenaChartMarketReference, PublicActionFeedItem, UserAgentArenaProfile } from "../../features/platform/arena-ui";
import type { LiveBtcMarketSnapshot } from "../../features/predict/live-market";
import type { LiveBtcMarketStatus } from "../../features/predict/use-live-btc-market";
import { ArenaPriceChart } from "./ArenaPriceChart";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";
import { PublicActionFeed } from "./PublicActionFeed";
import { UserAgentProfilePanel } from "./UserAgentProfilePanel";

interface ArenaPageProps {
  actionFeedItems: PublicActionFeedItem[];
  competition?: Competition;
  liveMarketError: string | null;
  liveMarketSnapshot: LiveBtcMarketSnapshot | null;
  liveMarketStatus: LiveBtcMarketStatus;
  marketReference: ArenaChartMarketReference | null;
  runtimeCredentialRotation?: {
    apiBaseUrl: string;
    connectedOwnerAddress: string | null;
    createChallenge: (
      agentId: string,
      input: { ownerAddress: string; reason: string }
    ) => Promise<RuntimeCredentialRotationChallenge>;
    rotateCredential: (
      agentId: string,
      input: {
        ownerAddress: string;
        signature: string;
        nonce: string;
        expiresAt: string;
        reason: string;
        message: string;
        domain: string;
        currentCredentialVersion: number;
      }
    ) => Promise<RuntimeCredentialRotationResponse>;
    signMessage?: (message: string) => Promise<string>;
  };
  userAgentProfile: UserAgentArenaProfile;
}

export function ArenaPage({
  actionFeedItems,
  competition,
  liveMarketError,
  liveMarketSnapshot,
  liveMarketStatus,
  marketReference,
  runtimeCredentialRotation,
  userAgentProfile
}: ArenaPageProps) {
  const oracleId = competition?.oracleId ?? liveMarketSnapshot?.oracle?.oracleId ?? "waiting";
  const statusSummary = <ArenaStatusSummary competition={competition} oracleId={oracleId} />;

  return (
    <section aria-label="BTC 15m Arena" className="grid gap-3">
      <section aria-label="Arena entry" className="grid gap-2" data-testid="arena-entry-panel">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="paper-label text-on-surface-variant">Live arena</p>
            <h1 className="mt-0.5 font-display text-sm font-black uppercase text-on-surface">BTC 15m Arena</h1>
          </div>
        </div>
        {userAgentProfile.agentId ? (
          <UserAgentProfilePanel
            apiBaseUrl={runtimeCredentialRotation?.apiBaseUrl}
            connectedOwnerAddress={runtimeCredentialRotation?.connectedOwnerAddress}
            onCreateRuntimeCredentialRotationChallenge={runtimeCredentialRotation?.createChallenge}
            onRotateRuntimeCredential={runtimeCredentialRotation?.rotateCredential}
            onSignRuntimeCredentialRotationMessage={runtimeCredentialRotation?.signMessage}
            profile={userAgentProfile}
            summary={statusSummary}
            variant="compact"
          />
        ) : (
          <CopyAgentPromptPanel summary={statusSummary} />
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch" data-testid="arena-live-grid">
        <ArenaPriceChart
          className="h-full min-w-0"
          error={liveMarketError}
          marketReference={marketReference}
          snapshot={liveMarketSnapshot}
          status={liveMarketStatus}
        />

        <PublicActionFeed className="h-full min-w-0" items={actionFeedItems} />
      </div>
    </section>
  );
}

function ArenaStatusSummary({ competition, oracleId }: { competition?: Competition; oracleId: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="paper-chip px-2 py-1">{competition?.name ?? "No active competition"}</span>
      <span className={`paper-chip shrink-0 px-2 py-1 ${competition?.status === "live" ? "paper-chip-green" : ""}`}>
        {competition?.status ?? "no competition"}
      </span>
      <span className="paper-chip min-w-0 max-w-full px-2 py-1">
        <span className="truncate font-mono text-[10px] font-black">Oracle {oracleId}</span>
      </span>
    </div>
  );
}
