import { Copy, ShieldCheck, Wallet } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { createPlatformClient, PlatformClientError } from "../../features/platform/client";
import type { AgentProfile, RegistryWriteSummary, RuntimeCredential, TradingWallet } from "../../features/platform/types";

type PlatformFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface AgentClaimPanelProps {
  apiBaseUrl: string;
  claimButtonLabel?: string;
  connectedWalletAddress?: string | null;
  fetcher?: PlatformFetcher;
  manualClaimEnabled?: boolean;
  missingWalletMessage?: string;
  registrationCode: string;
  walletOptions?: ClaimWalletOption[];
  walletProvider?: ClaimWalletProvider | null;
}

interface ClaimResult {
  agent: AgentProfile;
  tradingWallet: TradingWallet;
  runtimeCredential: RuntimeCredential;
  registry?: RegistryWriteSummary;
}

export interface ClaimWalletOption {
  id: string;
  name: string;
  provider: ClaimWalletProvider;
}

export interface ClaimWalletAccount {
  address: string;
}

export interface ClaimWalletProvider {
  connect?: () => Promise<unknown>;
  requestPermissions?: (permissions?: string[]) => Promise<unknown>;
  getAccounts?: () => Promise<ClaimWalletAccount[]> | ClaimWalletAccount[];
  signPersonalMessage?: (input: { message: Uint8Array; account?: ClaimWalletAccount }) => Promise<unknown>;
  signMessage?: (input: { message: Uint8Array; account?: ClaimWalletAccount }) => Promise<unknown>;
}

export function AgentClaimPanel({
  apiBaseUrl,
  claimButtonLabel,
  connectedWalletAddress,
  fetcher,
  manualClaimEnabled = true,
  missingWalletMessage = "No Sui wallet detected.",
  registrationCode,
  walletOptions = [],
  walletProvider
}: AgentClaimPanelProps) {
  const [code, setCode] = useState(registrationCode);
  const [ownerAddress, setOwnerAddress] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [status, setStatus] = useState<"idle" | "claiming" | "claimed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const client = useMemo(() => createPlatformClient({ baseUrl: apiBaseUrl, fetcher }), [apiBaseUrl, fetcher]);
  const directWalletProvider = walletProvider ?? null;
  const hasWalletClaim = !manualClaimEnabled || Boolean(directWalletProvider) || walletOptions.length > 0;
  const shouldOpenWalletDialog = !directWalletProvider && walletOptions.length > 0;
  const canClaim = manualClaimEnabled || Boolean(directWalletProvider) || walletOptions.length > 0;
  const displayedOwnerAddress = ownerAddress || connectedWalletAddress;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (shouldOpenWalletDialog) {
      setWalletDialogOpen(true);
      return;
    }
    if (!canClaim) {
      setError(missingWalletMessage);
      return;
    }

    setStatus("claiming");
    setError(null);

    try {
      const signedClaim = directWalletProvider
        ? await signClaimWithWallet(directWalletProvider, code.trim())
        : {
          ownerAddress: ownerAddress.trim(),
          signature: "local-owner-claim"
        };
      await submitSignedClaim(signedClaim);
    } catch (claimError) {
      handleClaimError(claimError);
    }
  }

  async function handleWalletOptionClaim(provider: ClaimWalletProvider) {
    setWalletDialogOpen(false);
    setStatus("claiming");
    setError(null);

    try {
      await submitSignedClaim(await signClaimWithWallet(provider, code.trim()));
    } catch (claimError) {
      handleClaimError(claimError);
    }
  }

  async function submitSignedClaim(signedClaim: { ownerAddress: string; signature: string }) {
    setOwnerAddress(signedClaim.ownerAddress);
    const result = await client.claimAgent({
      registrationCode: code.trim(),
      ownerAddress: signedClaim.ownerAddress,
      signature: signedClaim.signature,
      ...(twitterHandle.trim() ? { twitterHandle: twitterHandle.trim() } : {})
    });
    setClaimResult(result);
    setCopyStatus("idle");
    setStatus("claimed");
  }

  function handleClaimError(claimError: unknown) {
    setStatus("failed");
    setError(claimError instanceof PlatformClientError || claimError instanceof Error
      ? claimError.message
      : "Claim failed");
  }

  async function handleCopyHandoff() {
    if (!claimResult) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(createAgentRuntimeHandoff({
        apiBaseUrl,
        claimResult
      }), null, 2));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <section aria-label="Claim Agent" className="paper-card-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Owner Claim</p>
          <h1 className="mt-1 font-display text-xl font-black uppercase text-on-surface">Claim Agent Runtime</h1>
        </div>
        <span className="paper-chip paper-chip-green shrink-0 px-2 py-1">Testnet</span>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <label className="grid gap-1">
          <span className="paper-label text-on-surface-variant">Registration code</span>
          <input
            autoComplete="off"
            className="min-h-10 rounded-[3px] border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm font-bold text-on-surface"
            name="registrationCode"
            onChange={(event) => setCode(event.target.value)}
            required
            spellCheck={false}
            type="text"
            value={code}
          />
        </label>

        {hasWalletClaim ? (
          <div className="paper-inset p-3">
            <span className="paper-label text-on-surface-variant">Owner wallet</span>
            <p className="mt-1 break-all font-mono text-xs font-bold text-on-surface">
              {displayedOwnerAddress || (walletOptions.length > 0 || directWalletProvider
                ? "Connect to read address and sign claim."
                : missingWalletMessage)}
            </p>
          </div>
        ) : (
          <label className="grid gap-1">
            <span className="paper-label text-on-surface-variant">Owner wallet address</span>
            <input
              autoComplete="off"
              className="min-h-10 rounded-[3px] border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm font-bold text-on-surface"
              name="ownerAddress"
              onChange={(event) => setOwnerAddress(event.target.value)}
              placeholder="0x…"
              required
              spellCheck={false}
              type="text"
              value={ownerAddress}
            />
          </label>
        )}

        <label className="grid gap-1">
          <span className="paper-label text-on-surface-variant">Twitter handle</span>
          <input
            autoComplete="off"
            className="min-h-10 rounded-[3px] border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm font-bold text-on-surface"
            name="twitterHandle"
            onChange={(event) => setTwitterHandle(event.target.value)}
            placeholder="@handle…"
            spellCheck={false}
            type="text"
            value={twitterHandle}
          />
        </label>

        <button
          className="paper-button paper-button-primary inline-flex items-center justify-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
          disabled={status === "claiming" || !canClaim}
          onClick={shouldOpenWalletDialog ? () => setWalletDialogOpen(true) : undefined}
          type={shouldOpenWalletDialog ? "button" : "submit"}
        >
          <Wallet aria-hidden="true" size={14} />
          {status === "claiming"
            ? "Claiming…"
            : claimButtonLabel
              ? claimButtonLabel
              : !canClaim
                ? "No wallet detected"
              : hasWalletClaim
                ? "Connect wallet and claim"
                : "Claim Agent"}
        </button>
      </form>

      {walletDialogOpen ? (
        <div aria-label="Connect owner wallet" className="paper-inset mt-3 grid gap-2 p-3" role="dialog">
          <div className="flex items-center justify-between gap-3">
            <p className="paper-label text-on-surface-variant">Connect owner wallet</p>
            <button
              aria-label="Close wallet dialog"
              className="paper-button px-2 py-1 font-display text-[10px] font-black uppercase"
              onClick={() => setWalletDialogOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="grid gap-2">
            {walletOptions.map((option) => (
              <button
                className="paper-button inline-flex items-center justify-between gap-3 px-3 py-2 text-left font-display text-xs font-black uppercase"
                key={option.id}
                onClick={() => void handleWalletOptionClaim(option.provider)}
                type="button"
              >
                <span>{option.name}</span>
                <Wallet aria-hidden="true" size={14} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="paper-inset mt-3 p-3 text-sm font-bold text-error">
          {error}
        </div>
      ) : null}

      {claimResult ? (
        <div className="paper-inset mt-4 grid gap-3 p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="text-on-surface-variant" size={16} />
              <p className="paper-label text-on-surface-variant">Agent Runtime Credential</p>
            </div>
            <p className="mt-1 break-all font-mono text-xs font-bold text-on-surface">
              {claimResult.runtimeCredential.token}
            </p>
          </div>
          <div className="grid gap-1 font-mono text-[11px] font-bold text-on-surface-variant">
            <p>Agent {claimResult.agent.id}</p>
            <p>Owner wallet {claimResult.agent.ownerAddress}</p>
            <p>Trading wallet {claimResult.tradingWallet.address}</p>
            <p>PredictManager {claimResult.tradingWallet.predictManagerStatus}</p>
            {claimResult.registry ? <p>{formatRegistrySummary(claimResult.registry)}</p> : null}
          </div>
          <button
            className="paper-button paper-button-primary inline-flex items-center justify-center gap-2 px-3 py-2 font-display text-xs font-black uppercase"
            onClick={() => void handleCopyHandoff()}
            type="button"
          >
            <Copy aria-hidden="true" size={14} />
            Copy Agent handoff
          </button>
          {copyStatus === "copied" ? (
            <p className="text-xs font-bold text-on-surface-variant">Runtime handoff copied.</p>
          ) : null}
          {copyStatus === "failed" ? (
            <p className="text-xs font-bold text-error">Copy failed. Select the credential text manually.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatRegistrySummary(registry: RegistryWriteSummary): string {
  if (registry.status === "submitted" && registry.txDigest) {
    return `Registry tx ${registry.txDigest}`;
  }

  if (registry.status === "failed") {
    return `Registry ${registry.errorCode ?? "failed"}`;
  }

  return "Registry disabled";
}

function createAgentRuntimeHandoff({
  apiBaseUrl,
  claimResult
}: {
  apiBaseUrl: string;
  claimResult: ClaimResult;
}) {
  return {
    baseUrl: apiBaseUrl,
    agentId: claimResult.agent.id,
    token: claimResult.runtimeCredential.token,
    scopes: claimResult.runtimeCredential.scopes,
    tradingWalletId: claimResult.tradingWallet.id,
    walletAddress: claimResult.tradingWallet.address,
    predictManagerId: claimResult.tradingWallet.predictManagerId,
    savedAt: new Date().toISOString(),
    funding: {
      minimumDusdcRaw: "10000000",
      hardGasFloorSui: "0.1",
      recommendedGasSui: "1"
    }
  };
}

async function signClaimWithWallet(
  provider: ClaimWalletProvider,
  registrationCode: string
): Promise<{ ownerAddress: string; signature: string }> {
  const connectResult = provider.connect ? await provider.connect() : undefined;
  const permissionResult = connectResult ? undefined : await requestViewAccountPermission(provider);
  const account = findWalletAccount(connectResult)
    ?? findWalletAccount(permissionResult)
    ?? await firstProviderAccount(provider);
  if (!account) {
    throw new Error("Owner wallet address is unavailable");
  }

  const message = new TextEncoder().encode(
    `Agent Arena owner claim\nregistrationCode:${registrationCode}\nownerAddress:${account.address}`
  );
  const signatureResult = provider.signPersonalMessage
    ? await provider.signPersonalMessage({ message, account })
    : await provider.signMessage?.({ message, account });
  const signature = readWalletSignature(signatureResult);
  if (!signature) {
    throw new Error("Owner wallet signature is unavailable");
  }

  return {
    ownerAddress: account.address,
    signature
  };
}

async function requestViewAccountPermission(provider: ClaimWalletProvider): Promise<unknown> {
  if (!provider.requestPermissions) {
    return undefined;
  }

  return await provider.requestPermissions(["viewAccount"]);
}

async function firstProviderAccount(provider: ClaimWalletProvider): Promise<ClaimWalletAccount | null> {
  const accounts = provider.getAccounts ? await provider.getAccounts() : [];
  return Array.isArray(accounts) ? accounts.find(isWalletAccount) ?? null : null;
}

function findWalletAccount(value: unknown): ClaimWalletAccount | null {
  if (isWalletAccount(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (isWalletAccount(value.account)) {
    return value.account;
  }

  if (Array.isArray(value.accounts)) {
    return value.accounts.find(isWalletAccount) ?? null;
  }

  if (typeof value.address === "string" && value.address.trim()) {
    return { address: value.address.trim() };
  }

  return null;
}

function readWalletSignature(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!isRecord(value)) {
    return null;
  }

  return typeof value.signature === "string" && value.signature.trim()
    ? value.signature.trim()
    : null;
}

function isWalletAccount(value: unknown): value is ClaimWalletAccount {
  return isRecord(value) && typeof value.address === "string" && value.address.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
