import {
  PlatformAuthError,
  authenticateAgentRuntimeRequest,
  createAgentRuntimeCredential,
  runtimeTokenHeader
} from "./auth";
import { createHash } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import {
  createPredictTxUrl,
  PlatformExecutionError,
  type SubmitIntentExecutionOptions,
  submitIntentWithMockExecution
} from "./execution";
import { createMarketSnapshot } from "./market-snapshot";
import { PlatformMockStore } from "./mock-store";
import { buildReplayEvents } from "./replay";
import {
  createPerformanceLedgerRecord,
  createRegistrationCodeHash
} from "./performance-ledger";
import type {
  AgentRegistryService,
  RegistryWriteResult
} from "./registry";
import {
  reconcileSettlements,
  type ReconcileSettlementsOptions
} from "./settlement-reconciler";
import {
  calculateMvpScore,
  createLedgerLeaderboardEntries,
  sortLeaderboard,
  type LeaderboardEntry
} from "./scoring";
import { publicSkillDocs } from "../skill-docs";
import { internalTokenHeader } from "../predict/internal-auth";
import {
  createMockCompetition,
  type AgentProfile,
  type AgentIntent,
  type Competition,
  type ExecutionRecord,
  type MarketSnapshot,
  type OwnerWithdrawalStatus,
  type TradingWallet
} from "./types";
import { PlatformInputError } from "./validation";
import {
  validateDisplayName,
  validateNonEmptyString,
  validateOwnerWithdrawalPayload
} from "./validation";

const defaultCompetitionId = "btc-15m-001";
const mockNow = "2026-06-15T00:00:00.000Z";
const arenaPrefix = "/api/arena";
const btc15mDurationMs = 15 * 60 * 1000;
const defaultFrontendBaseUrl = "http://127.0.0.1:5173";
const pairingDraftTtlMs = 15 * 60 * 1000;
const runtimeCredentialRotationDomain = "agent-arena-runtime-credential-rotation:v1";
const runtimeCredentialRotationChainId = "sui:testnet";
const runtimeCredentialRotationTtlMs = 10 * 60 * 1000;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": `content-type, ${runtimeTokenHeader}, ${internalTokenHeader}`
};

export interface OwnerWithdrawalServiceInput {
  ownerAddress: string;
  agentId: string;
  walletId: string;
  walletAddress: string;
  managerId: string;
  amountRaw: string;
  recipientAddress?: string;
}

export interface OwnerWithdrawalServiceResult {
  status: OwnerWithdrawalStatus;
  txDigest?: string | null;
}

export interface OwnerSignatureVerifierInput {
  ownerAddress: string;
  message: string;
  signature: string;
}

export type OwnerSignatureVerifier = (input: OwnerSignatureVerifierInput) => Promise<boolean>;

export interface AgentWalletServiceInput {
  agentId: string;
  displayName: string;
}

export interface AgentWalletServiceResult {
  id: string;
  address: string;
  testnetSuiBalance?: string;
  quoteBalance?: string;
  predictManagerStatus?: "missing" | "ready";
  predictManagerId?: string | null;
}

export interface AgentMarketDataResult {
  competition: Competition;
  marketState: MarketSnapshot;
}

export interface CreatePlatformFetchHandlerOptions {
  agentWalletService?: (input: AgentWalletServiceInput) => Promise<AgentWalletServiceResult>;
  agentWalletReader?: (wallet: TradingWallet) => Promise<Partial<AgentWalletServiceResult>>;
  frontendBaseUrl?: string;
  marketDataProvider?: () => Promise<AgentMarketDataResult>;
  now?: () => number;
  ownerWithdrawalService?: (input: OwnerWithdrawalServiceInput) => Promise<OwnerWithdrawalServiceResult>;
  ownerSignatureVerifier?: OwnerSignatureVerifier;
  predictExecutionAdapter?: SubmitIntentExecutionOptions["predictExecutionAdapter"];
  registryService?: AgentRegistryService;
  settlementClaimExecutor?: ReconcileSettlementsOptions["executeSettlementClaim"];
  settlementRedemptionReader?: ReconcileSettlementsOptions["readSettlementRedemption"];
  settlementInternalToken?: string;
}

export function createPlatformFetchHandler(
  store = new PlatformMockStore(),
  options: CreatePlatformFetchHandlerOptions = {}
) {
  if (!store.getCompetition(defaultCompetitionId)) {
    store.seedCompetition(createRollingBtc15mCompetition(defaultCompetitionId));
  }

  return async function handlePlatformRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return emptyResponse(204);
    }

    try {
      const url = new URL(request.url);
      const route = getArenaRoute(url.pathname);
      if (!route) {
        return errorResponse(404, "NOT_FOUND", "Route not found");
      }

      if (request.method === "GET" && route.length === 1 && route[0] === "__introspection") {
        return jsonResponse({
          service: "agent-arena-platform",
          seededCompetitionId: defaultCompetitionId,
          authHeader: runtimeTokenHeader,
          endpoints: [
            "GET /api/arena/__introspection",
            "GET /api/arena/skills",
            "POST /api/arena/agent/init",
            "POST /api/arena/owner/agents/claim",
            "POST /api/arena/owner/agents/:id/runtime-credential/rotation-challenge",
            "POST /api/arena/owner/agents/:id/runtime-credential/rotate",
            "GET /api/arena/owner/agent?ownerAddress=...",
            "GET /api/arena/agent/me",
            "GET /api/arena/agent/wallet",
            "GET /api/arena/competition/list-active",
            "GET /api/arena/competition/:id",
            "GET /api/arena/competition/:id/market-state",
            "GET /api/arena/competition/:id/public-feed",
            "GET /api/arena/agent/positions?competitionId=...",
            "POST /api/arena/intents",
            "GET /api/arena/intents/:id",
            "GET /api/arena/executions/:id",
            "GET /api/arena/leaderboard?competitionId=...",
            "POST /api/arena/owner/trading-wallets/:walletId/withdraw",
            "GET /api/arena/owner/agents/:id/replay"
          ]
        });
      }

      if (request.method === "GET" && matchesRoute(route, ["skills"])) {
        return jsonResponse({
          skills: publicSkillDocs.map(({ filename: _filename, ...skill }) => skill)
        });
      }

      if (request.method === "POST" && matchesRoute(route, ["agent", "init"])) {
        return await initAgentPairing(request, store, options);
      }

      if (request.method === "POST" && matchesRoute(route, ["owner", "agents", "claim"])) {
        return await claimAgent(request, store, {
          agentWalletService: options.agentWalletService,
          now: options.now,
          registryService: options.registryService
        });
      }

      if (request.method === "POST" && matchesRoute(route, ["settlements", "reconcile"])) {
        return await reconcileSettlementsRoute(request, store, options);
      }

      if (
        request.method === "POST" &&
        route.length === 5 &&
        route[0] === "owner" &&
        route[1] === "agents" &&
        route[3] === "runtime-credential" &&
        route[4] === "rotation-challenge"
      ) {
        return await createRuntimeCredentialRotationChallengeRoute(request, store, route[2], options);
      }

      if (
        request.method === "POST" &&
        route.length === 5 &&
        route[0] === "owner" &&
        route[1] === "agents" &&
        route[3] === "runtime-credential" &&
        route[4] === "rotate"
      ) {
        return await rotateRuntimeCredentialRoute(request, store, route[2], options);
      }

      if (request.method === "GET" && matchesRoute(route, ["owner", "agent"])) {
        return await getOwnerAgentProfile(url, store, options);
      }

      if (
        request.method === "POST" &&
        route.length === 4 &&
        route[0] === "owner" &&
        route[1] === "trading-wallets" &&
        route[3] === "withdraw"
      ) {
        return await withdrawTradingWallet(request, store, route[2], options.ownerWithdrawalService);
      }

      if (request.method === "POST" && matchesRoute(route, ["auth", "register"])) {
        return errorResponse(410, "DEPRECATED_ENDPOINT", "Use POST /api/arena/agent/init and owner claim");
      }

      if (request.method === "GET" && matchesRoute(route, ["agent", "me"])) {
        const auth = authenticateAgentRuntimeRequest(request, store);
        await maybeReconcileAgentSettlements(store, options, auth.agentId);
        const agent = store.getAgent(auth.agentId);
        if (!agent) {
          return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
        }

        return jsonResponse(agent);
      }

      if (request.method === "GET" && matchesRoute(route, ["agent", "wallet"])) {
        const auth = authenticateAgentRuntimeRequest(request, store);
        const wallet = store.getTradingWalletByAgentId(auth.agentId);
        return jsonResponse({
          wallet: wallet ? await refreshTradingWallet(store, wallet, options.agentWalletReader) : null
        });
      }

      if (request.method === "GET" && matchesRoute(route, ["agent", "positions"])) {
        const auth = authenticateAgentRuntimeRequest(request, store);
        await maybeReconcileAgentSettlements(store, options, auth.agentId);
        return getAgentPositions(url, store, auth.agentId);
      }

      if (
        request.method === "POST" &&
        route.length === 4 &&
        route[0] === "owner" &&
        route[1] === "agents" &&
        route[3] === "wallet"
      ) {
        return errorResponse(410, "DEPRECATED_ENDPOINT", "Wallet generation happens during owner claim");
      }

      if (request.method === "GET" && matchesRoute(route, ["competition", "list-active"])) {
        if (options.marketDataProvider) {
          const { competition } = await options.marketDataProvider();
          return jsonResponse({
            competitions: competition.status === "live" ? [competition] : []
          });
        }

        ensureCurrentDefaultCompetition(store);
        const competition = store.getCompetition(defaultCompetitionId);
        return jsonResponse({
          competitions: competition && competition.status === "live" ? [competition] : []
        });
      }

      if (request.method === "GET" && route.length === 2 && route[0] === "competition") {
        if (options.marketDataProvider && route[1] === defaultCompetitionId) {
          const { competition } = await options.marketDataProvider();
          return jsonResponse({ competition });
        }

        ensureCurrentDefaultCompetition(store);
        const competition = store.getCompetition(route[1]);
        if (!competition) {
          return errorResponse(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        return jsonResponse({ competition });
      }

      if (
        request.method === "GET" &&
        route.length === 3 &&
        route[0] === "competition" &&
        route[2] === "market-state"
      ) {
        if (options.marketDataProvider && route[1] === defaultCompetitionId) {
          const { marketState } = await options.marketDataProvider();
          return jsonResponse({ marketState });
        }

        ensureCurrentDefaultCompetition(store);
        const competition = store.getCompetition(route[1]);
        if (!competition) {
          return errorResponse(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        return jsonResponse({ marketState: createMarketSnapshot(competition, Date.now()) });
      }

      if (
        request.method === "GET" &&
        route.length === 3 &&
        route[0] === "competition" &&
        route[2] === "public-feed"
      ) {
        return getCompetitionPublicFeed(url, route[1], store);
      }

      if (request.method === "POST" && matchesRoute(route, ["intents"])) {
        return await submitIntent(request, store, {
          agentWalletReader: options.agentWalletReader,
          now: options.now,
          predictExecutionAdapter: options.predictExecutionAdapter,
          settlementClaimExecutor: options.settlementClaimExecutor,
          settlementRedemptionReader: options.settlementRedemptionReader
        });
      }

      if (request.method === "GET" && route.length === 2 && route[0] === "intents") {
        const auth = authenticateAgentRuntimeRequest(request, store);
        return getIntent(route[1], store, auth.agentId);
      }

      if (request.method === "GET" && route.length === 2 && route[0] === "executions") {
        const auth = authenticateAgentRuntimeRequest(request, store);
        return getExecution(route[1], store, auth.agentId);
      }

      if (request.method === "GET" && matchesRoute(route, ["leaderboard"])) {
        return getLeaderboard(url, store);
      }

      if (
        request.method === "GET" &&
        route.length === 4 &&
        route[0] === "owner" &&
        route[1] === "agents" &&
        route[3] === "replay"
      ) {
        return getAgentReplay(route[2], store);
      }

      return errorResponse(404, "NOT_FOUND", "Route not found");
    } catch (error) {
      return errorToResponse(error);
    }
  };
}

function ensureCurrentDefaultCompetition(store: PlatformMockStore): void {
  const competition = store.getCompetition(defaultCompetitionId);
  if (!competition) {
    store.seedCompetition(createRollingBtc15mCompetition(defaultCompetitionId));
    return;
  }

  if (competition.status !== "live") {
    return;
  }

  const nowMs = Date.now();
  const startsAtMs = Date.parse(competition.startsAt);
  const expiresAtMs = Date.parse(competition.expiresAt);
  if (Number.isNaN(startsAtMs) || Number.isNaN(expiresAtMs) || startsAtMs > nowMs || expiresAtMs <= nowMs) {
    store.seedCompetition(createRollingBtc15mCompetition(defaultCompetitionId, nowMs));
  }
}

function createRollingBtc15mCompetition(id: string, nowMs = Date.now()): Competition {
  const startsAtMs = Math.floor(nowMs / btc15mDurationMs) * btc15mDurationMs;
  const expiresAtMs = startsAtMs + btc15mDurationMs;
  const base = createMockCompetition(id);

  return {
    ...base,
    status: "live",
    expiry: new Date(expiresAtMs).toISOString(),
    startsAt: new Date(startsAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    settlesAt: null
  };
}

async function refreshTradingWallet(
  store: PlatformMockStore,
  wallet: TradingWallet,
  agentWalletReader: CreatePlatformFetchHandlerOptions["agentWalletReader"]
): Promise<TradingWallet> {
  if (!agentWalletReader) {
    return wallet;
  }

  const refreshed = await agentWalletReader(wallet);
  const updated = store.updateTradingWallet(wallet.id, {
    testnetSuiBalance: refreshed.testnetSuiBalance ?? wallet.testnetSuiBalance,
    quoteBalance: refreshed.quoteBalance ?? wallet.quoteBalance,
    predictManagerStatus: refreshed.predictManagerStatus ?? wallet.predictManagerStatus,
    predictManagerId: refreshed.predictManagerId === undefined
      ? wallet.predictManagerId
      : refreshed.predictManagerId
  });
  syncIdentityBindingWithWallet(store, updated.agentId, updated);
  return updated;
}

async function initAgentPairing(
  request: Request,
  store: PlatformMockStore,
  options: Pick<CreatePlatformFetchHandlerOptions, "frontendBaseUrl" | "now">
): Promise<Response> {
  const body = await readJsonObject(request);
  const displayName = validateDisplayName(body.displayName);
  const draft = store.createPairingDraft(displayName, {
    claimBaseUrl: `${normalizeBaseUrl(options.frontendBaseUrl ?? Bun.env.AGENT_ARENA_FRONTEND_BASE_URL ?? defaultFrontendBaseUrl)}/agent-arena/claim`,
    nowMs: options.now?.() ?? Date.now(),
    ttlMs: pairingDraftTtlMs
  });

  return jsonResponse({
    agentDraftId: draft.id,
    displayName: draft.displayName,
    registrationCode: draft.registrationCode,
    claimUrl: draft.claimUrl,
    expiresAt: draft.expiresAt
  }, 201);
}

async function claimAgent(
  request: Request,
  store: PlatformMockStore,
  options: Pick<CreatePlatformFetchHandlerOptions, "agentWalletService" | "now" | "registryService"> = {}
): Promise<Response> {
  const body = await readJsonObject(request);
  const registrationCode = validateNonEmptyString(body.registrationCode, "registrationCode").trim();
  const ownerAddress = validateNonEmptyString(body.ownerAddress, "ownerAddress").trim();
  validateNonEmptyString(body.signature, "signature");
  const twitterHandle = validateOptionalString(body.twitterHandle, "twitterHandle");
  const draft = store.findPairingDraftByRegistrationCode(registrationCode);
  if (!draft || draft.status !== "pending") {
    return errorResponse(400, "INVALID_REGISTRATION_CODE", "Registration code is invalid or already claimed");
  }

  const agent = store.createClaimedAgent({
    displayName: draft.displayName,
    ownerAddress,
    twitterHandle
  });
  store.markPairingDraftClaimed(draft.id);
  const walletResult = options.agentWalletService
    ? await options.agentWalletService({
      agentId: agent.id,
      displayName: agent.displayName
    })
    : {
      id: `wallet_${agent.id}`,
      address: `0xagentwallet_${agent.id}`,
      testnetSuiBalance: "0",
      quoteBalance: "0",
      predictManagerStatus: "missing" as const,
      predictManagerId: null
    };
  const wallet = store.bindTradingWallet(agent.id, walletResult.address, {
    id: walletResult.id,
    testnetSuiBalance: walletResult.testnetSuiBalance ?? "0",
    quoteBalance: walletResult.quoteBalance ?? "0",
    predictManagerStatus: walletResult.predictManagerStatus ?? "missing",
    predictManagerId: walletResult.predictManagerId ?? null
  });
  const registrationCodeHash = createRegistrationCodeHash(registrationCode);
  store.saveIdentityBinding({
    agentDraftId: draft.id,
    registrationCodeHash,
    agentId: agent.id,
    ownerAddress,
    twitterHandle: agent.twitterHandle,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: wallet.predictManagerId,
    createdAt: draft.createdAt,
    claimedAt: mockNow
  });
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    kind: "pairing",
    agentDraftId: draft.id,
    registrationCodeHash,
    agentId: agent.id,
    ownerAddress,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: wallet.predictManagerId,
    competitionId: null,
    oracleId: null,
    expiryMs: null,
    intentId: null,
    riskDecisionId: null,
    executionId: null,
    txDigest: null,
    action: null,
    positionKind: null,
    quantityRaw: null,
    costRaw: null,
    proceedsRaw: null,
    status: "claimed",
    errorCode: null,
    policyDrift: "none",
    createdAt: draft.createdAt,
    serverReceivedAt: mockNow
  }));
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    kind: "wallet_binding",
    agentDraftId: draft.id,
    registrationCodeHash,
    agentId: agent.id,
    ownerAddress,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: wallet.predictManagerId,
    competitionId: null,
    oracleId: null,
    expiryMs: null,
    intentId: null,
    riskDecisionId: null,
    executionId: null,
    txDigest: null,
    action: null,
    positionKind: null,
    quantityRaw: null,
    costRaw: null,
    proceedsRaw: null,
    status: wallet.status,
    errorCode: null,
    policyDrift: "none",
    createdAt: wallet.createdAt,
    serverReceivedAt: mockNow
  }));
  const credential = createAgentRuntimeCredential(store, agent.id, mockNow);
  const registry = await registerClaimedAgent({
    agent,
    draft,
    ownerAddress,
    store,
    wallet,
    nowMs: options.now?.() ?? Date.parse(mockNow),
    registryService: options.registryService
  });

  return jsonResponse({
    agent: store.getAgent(agent.id),
    tradingWallet: wallet,
    runtimeCredential: {
      token: credential.token,
      shownOnce: true,
      credentialVersion: credential.credentialVersion,
      scopes: credential.scopes
    },
    registry
  }, 201);
}

async function registerClaimedAgent(input: {
  agent: AgentProfile;
  draft: { id: string; createdAt: string };
  ownerAddress: string;
  store: PlatformMockStore;
  wallet: TradingWallet;
  nowMs: number;
  registryService?: AgentRegistryService;
}): Promise<RegistryWriteResult> {
  if (!input.registryService) {
    return {
      status: "disabled",
      txDigest: null
    };
  }

  return await input.registryService.registerAgent({
    agentId: input.agent.id,
    agentDraftId: input.draft.id,
    ownerAddress: input.ownerAddress,
    tradingWalletAddress: input.wallet.address,
    metadataHash: createAgentRegistryMetadataHash({
      agentId: input.agent.id,
      agentDraftId: input.draft.id,
      displayName: input.agent.displayName,
      twitterHandle: input.agent.twitterHandle,
      ownerAddress: input.ownerAddress,
      tradingWalletAddress: input.wallet.address,
      createdAt: input.draft.createdAt
    }),
    platformCreatedAtMs: input.nowMs
  });
}

function createAgentRegistryMetadataHash(value: Record<string, string | null>): string {
  const canonical = JSON.stringify(Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  ));
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

async function createRuntimeCredentialRotationChallengeRoute(
  request: Request,
  store: PlatformMockStore,
  agentId: string,
  options: Pick<CreatePlatformFetchHandlerOptions, "now">
): Promise<Response> {
  const body = await readJsonObject(request);
  const ownerAddress = validateNonEmptyString(body.ownerAddress, "ownerAddress").trim();
  const reason = validateNonEmptyString(body.reason, "reason").trim();
  const agent = store.getAgent(agentId);
  if (!agent) {
    return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
  }
  if (normalizeAddress(agent.ownerAddress) !== normalizeAddress(ownerAddress)) {
    return errorResponse(403, "OWNER_MISMATCH", "Owner address does not match the Agent owner");
  }

  const currentCredential = store.findLatestRuntimeCredentialByAgentId(agentId);
  if (!currentCredential) {
    return errorResponse(409, "RUNTIME_CREDENTIAL_NOT_FOUND", "No active runtime credential exists for this Agent");
  }

  const nowMs = options.now?.() ?? Date.now();
  const challengeBase = {
    agentId,
    ownerAddress,
    reason,
    domain: runtimeCredentialRotationDomain,
    chainId: runtimeCredentialRotationChainId,
    currentCredentialVersion: currentCredential.credentialVersion,
    nextCredentialVersion: currentCredential.credentialVersion + 1,
    nonce: crypto.randomUUID(),
    expiresAt: new Date(nowMs + runtimeCredentialRotationTtlMs).toISOString(),
    consumedAt: null
  };
  const challenge = store.saveRuntimeCredentialRotationChallenge({
    ...challengeBase,
    message: createRuntimeCredentialRotationMessage(challengeBase)
  });

  return jsonResponse({ challenge }, 201);
}

async function rotateRuntimeCredentialRoute(
  request: Request,
  store: PlatformMockStore,
  agentId: string,
  options: Pick<CreatePlatformFetchHandlerOptions, "now" | "ownerSignatureVerifier" | "registryService">
): Promise<Response> {
  const body = await readJsonObject(request);
  if (typeof body.ownerAddress !== "string" || typeof body.signature !== "string") {
    return errorResponse(401, "OWNER_AUTH_REQUIRED", "Owner wallet authentication is required");
  }
  const ownerAddress = body.ownerAddress.trim();
  const signature = body.signature.trim();
  if (!ownerAddress || !signature) {
    return errorResponse(401, "OWNER_AUTH_REQUIRED", "Owner wallet authentication is required");
  }
  const nonce = validateNonEmptyString(body.nonce, "nonce").trim();
  const expiresAt = validateNonEmptyString(body.expiresAt, "expiresAt").trim();
  const reason = validateNonEmptyString(body.reason, "reason").trim();
  const message = validateNonEmptyString(body.message, "message");
  const domain = validateNonEmptyString(body.domain, "domain").trim();
  const currentCredentialVersion = validatePositiveInteger(body.currentCredentialVersion, "currentCredentialVersion");

  const agent = store.getAgent(agentId);
  if (!agent) {
    return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
  }
  if (normalizeAddress(agent.ownerAddress) !== normalizeAddress(ownerAddress)) {
    return errorResponse(403, "OWNER_MISMATCH", "Owner address does not match the Agent owner");
  }

  const challenge = store.findRuntimeCredentialRotationChallenge(nonce);
  if (!challenge || challenge.agentId !== agentId || normalizeAddress(challenge.ownerAddress) !== normalizeAddress(ownerAddress)) {
    return errorResponse(404, "ROTATION_CHALLENGE_NOT_FOUND", "Runtime credential rotation challenge not found");
  }
  if (challenge.reason !== reason) {
    return errorResponse(400, "ROTATION_REASON_MISMATCH", "Rotation reason does not match the challenge");
  }
  if (challenge.domain !== domain) {
    return errorResponse(400, "ROTATION_DOMAIN_MISMATCH", "Rotation domain does not match the challenge");
  }
  if (challenge.message !== message) {
    return errorResponse(400, "ROTATION_MESSAGE_MISMATCH", "Rotation message does not match the challenge");
  }
  if (challenge.expiresAt !== expiresAt) {
    return errorResponse(400, "ROTATION_EXPIRY_MISMATCH", "Rotation expiry does not match the challenge");
  }
  if (challenge.chainId !== runtimeCredentialRotationChainId) {
    return errorResponse(400, "ROTATION_CHAIN_MISMATCH", "Rotation chain does not match Testnet");
  }
  if (challenge.currentCredentialVersion !== currentCredentialVersion) {
    return errorResponse(409, "CREDENTIAL_VERSION_CONFLICT", "Runtime credential version changed");
  }
  const signatureIsValid = await (options.ownerSignatureVerifier ?? verifyOwnerPersonalMessageSignature)({
    ownerAddress,
    message,
    signature
  });
  if (!signatureIsValid) {
    return errorResponse(
      401,
      "OWNER_SIGNATURE_INVALID",
      "Owner signature is invalid for this rotation challenge"
    );
  }

  const nowMs = options.now?.() ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const rotation = tryRotateRuntimeCredential(store, {
    agentId,
    ownerAddress,
    nonce,
    reason,
    domain,
    chainId: runtimeCredentialRotationChainId,
    currentCredentialVersion,
    now,
    revocationReason: "owner_rotation"
  });
  if (rotation instanceof Response) {
    return rotation;
  }

  const registry = options.registryService?.recordRuntimeCredentialRotation
    ? await options.registryService.recordRuntimeCredentialRotation({
      agentId,
      ownerAddress,
      previousCredentialVersion: rotation.previousCredential.credentialVersion,
      nextCredentialVersion: rotation.credential.credentialVersion,
      rotationHash: createAgentRegistryMetadataHash({
        agentId,
        ownerAddress,
        nonce,
        reason,
        previousCredentialVersion: String(rotation.previousCredential.credentialVersion),
        nextCredentialVersion: String(rotation.credential.credentialVersion),
        createdAt: now
      }),
      platformCreatedAtMs: nowMs
    })
    : { status: "disabled" as const, txDigest: null };

  return jsonResponse({
    runtimeCredential: {
      token: rotation.credential.token,
      shownOnce: true,
      credentialVersion: rotation.credential.credentialVersion,
      scopes: rotation.credential.scopes
    },
    registry
  }, 201);
}

async function verifyOwnerPersonalMessageSignature(input: OwnerSignatureVerifierInput): Promise<boolean> {
  try {
    await verifyPersonalMessageSignature(new TextEncoder().encode(input.message), input.signature, {
      address: input.ownerAddress
    });
    return true;
  } catch {
    return false;
  }
}

function tryRotateRuntimeCredential(
  store: PlatformMockStore,
  input: Parameters<PlatformMockStore["rotateRuntimeCredentialForAgent"]>[0]
): ReturnType<PlatformMockStore["rotateRuntimeCredentialForAgent"]> | Response {
  try {
    return store.rotateRuntimeCredentialForAgent(input);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ROTATION_FAILED";
    const status = code === "ROTATION_NONCE_CONSUMED" ||
      code === "CREDENTIAL_VERSION_CONFLICT" ||
      code === "ROTATION_CHALLENGE_EXPIRED"
      ? 409
      : code === "OWNER_MISMATCH"
        ? 403
        : 400;
    return errorResponse(status, code, code);
  }
}

function createRuntimeCredentialRotationMessage(input: {
  agentId: string;
  ownerAddress: string;
  reason: string;
  domain: string;
  chainId: string;
  currentCredentialVersion: number;
  nextCredentialVersion: number;
  nonce: string;
  expiresAt: string;
}): string {
  return [
    "Agent Arena runtime credential rotation",
    `domain: ${input.domain}`,
    `chainId: ${input.chainId}`,
    `agentId: ${input.agentId}`,
    `ownerAddress: ${input.ownerAddress}`,
    `currentCredentialVersion: ${input.currentCredentialVersion}`,
    `nextCredentialVersion: ${input.nextCredentialVersion}`,
    `nonce: ${input.nonce}`,
    `reason: ${input.reason}`,
    `expiresAt: ${input.expiresAt}`
  ].join("\n");
}

async function reconcileSettlementsRoute(
  request: Request,
  store: PlatformMockStore,
  options: Pick<
    CreatePlatformFetchHandlerOptions,
    "now" | "settlementClaimExecutor" | "settlementInternalToken" | "settlementRedemptionReader"
  >
): Promise<Response> {
  const expectedToken = options.settlementInternalToken?.trim();
  if (!expectedToken) {
    return errorResponse(503, "SETTLEMENT_RECONCILER_DISABLED", "Settlement reconciler is not configured");
  }

  if (request.headers.get(internalTokenHeader) !== expectedToken) {
    return errorResponse(401, "UNAUTHORIZED", "Internal settlement token is required");
  }

  const summary = await reconcileSettlements(store, {
    nowMs: options.now?.() ?? Date.now(),
    executeSettlementClaim: options.settlementClaimExecutor,
    readSettlementRedemption: options.settlementRedemptionReader
  });
  return jsonResponse(summary);
}

async function getOwnerAgentProfile(
  url: URL,
  store: PlatformMockStore,
  options: Pick<CreatePlatformFetchHandlerOptions, "now" | "settlementClaimExecutor" | "settlementRedemptionReader">
): Promise<Response> {
  const ownerAddress = url.searchParams.get("ownerAddress")?.trim();
  if (!ownerAddress) {
    return errorResponse(400, "INVALID_INPUT", "ownerAddress query parameter is required");
  }

  const normalizedOwnerAddress = normalizeAddress(ownerAddress);
  const agent = findCurrentOwnerAgent(store, normalizedOwnerAddress);

  if (!agent) {
    return jsonResponse(createEmptyOwnerAgentProfile());
  }

  await maybeReconcileAgentSettlements(store, options, agent.id);
  const currentAgent = store.getAgent(agent.id) ?? agent;
  const competitionId = defaultCompetitionId;
  const competition = store.getCompetition(competitionId);
  const tradingWallet = store.getTradingWalletByAgentId(currentAgent.id) ?? null;
  syncIdentityBindingWithWallet(store, currentAgent.id, tradingWallet);
  const intents = store.listIntents().filter(
    (intent) => intent.agentId === currentAgent.id && intent.competitionId === competitionId
  );
  const executions = store.listExecutions().filter(
    (execution) => execution.agentId === currentAgent.id && execution.competitionId === competitionId
  );
  const leaderboard = competition
    ? createCompetitionLeaderboardEntries(competitionId, store).filter((entry) => entry.agentId === currentAgent.id)
    : [];

  return jsonResponse({
    agent: currentAgent,
    tradingWallet,
    positions: store.listPositionSnapshots({ agentId: currentAgent.id, competitionId }),
    intents,
    executions,
    leaderboard
  });
}

function createEmptyOwnerAgentProfile() {
  return {
    agent: null,
    tradingWallet: null,
    positions: [],
    intents: [],
    executions: [],
    leaderboard: []
  };
}

async function withdrawTradingWallet(
  request: Request,
  store: PlatformMockStore,
  walletId: string,
  ownerWithdrawalService: CreatePlatformFetchHandlerOptions["ownerWithdrawalService"]
): Promise<Response> {
  const body = await readJsonObject(request);
  if (typeof body.ownerAddress !== "string" || typeof body.signature !== "string") {
    return errorResponse(401, "OWNER_AUTH_REQUIRED", "Owner wallet authentication is required");
  }

  const payload = validateOwnerWithdrawalPayload(body);
  const wallet = store.getTradingWalletById(walletId);
  if (!wallet) {
    return errorResponse(404, "WALLET_NOT_FOUND", "Trading wallet not found");
  }

  const agent = store.getAgent(wallet.agentId);
  if (!agent) {
    return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
  }

  if (payload.ownerAddress !== agent.ownerAddress) {
    return errorResponse(403, "OWNER_MISMATCH", "Owner address does not match the trading wallet owner");
  }

  if (agent.exposureStatus !== "flat" && payload.closeFirst !== true) {
    return errorResponse(
      409,
      "OPEN_EXPOSURE_EXISTS",
      "Close or settle the Agent exposure before withdrawing manager DUSDC"
    );
  }

  if (!ownerWithdrawalService) {
    return errorResponse(503, "OWNER_WITHDRAWAL_SERVICE_REQUIRED", "Owner withdrawal service is not configured");
  }

  const result = await ownerWithdrawalService({
    ownerAddress: payload.ownerAddress,
    agentId: agent.id,
    walletId: wallet.id,
    walletAddress: wallet.address,
    managerId: payload.managerId,
    amountRaw: payload.amountRaw,
    recipientAddress: payload.recipientAddress
  });
  const withdrawal = store.recordOwnerWithdrawal({
    ownerAddress: payload.ownerAddress,
    agentId: agent.id,
    walletId: wallet.id,
    managerId: payload.managerId,
    amountRaw: payload.amountRaw,
    recipientAddress: payload.recipientAddress,
    txDigest: result.txDigest ?? null,
    status: result.status
  });

  return jsonResponse({ withdrawal }, 201);
}

async function submitIntent(
  request: Request,
  store: PlatformMockStore,
  options: Pick<
    CreatePlatformFetchHandlerOptions,
    "agentWalletReader" | "now" | "predictExecutionAdapter" | "settlementClaimExecutor" | "settlementRedemptionReader"
  >
): Promise<Response> {
  const auth = authenticateAgentRuntimeRequest(request, store);
  const wallet = store.getTradingWalletByAgentId(auth.agentId);
  if (wallet) {
    await refreshTradingWallet(store, wallet, options.agentWalletReader);
  }
  await maybeReconcileAgentSettlements(store, options, auth.agentId);

  const body = await readJsonObject(request);
  const bodyAgentId = validateNonEmptyString(body.agentId, "agentId");
  if (bodyAgentId !== auth.agentId) {
    return errorResponse(403, "AGENT_MISMATCH", "Authenticated agent does not match intent agentId");
  }

  const result = await submitIntentWithMockExecution(
    store,
    body,
    options.predictExecutionAdapter ? { predictExecutionAdapter: options.predictExecutionAdapter } : {}
  );
  if (result.status === "rejected") {
    return errorResponse(
      400,
      result.rejectionCode ?? "INTENT_REJECTED",
      `Intent rejected: ${result.rejectionCode ?? "INTENT_REJECTED"}`,
      {
        intentId: result.intentId,
        riskDecisionId: result.riskDecisionId,
        status: result.status
      }
    );
  }

  if (result.status === "failed") {
    return errorResponse(
      502,
      result.rejectionCode ?? "PREDICT_EXECUTION_FAILED",
      `Predict execution failed: ${result.rejectionCode ?? "PREDICT_EXECUTION_FAILED"}`,
      {
        intentId: result.intentId,
        riskDecisionId: result.riskDecisionId,
        executionId: result.executionId,
        predictTxDigest: result.predictTxDigest,
        predictTxUrl: result.predictTxUrl,
        status: result.status
      }
    );
  }

  return jsonResponse(result, 201);
}

async function maybeReconcileAgentSettlements(
  store: PlatformMockStore,
  options: Pick<CreatePlatformFetchHandlerOptions, "now" | "settlementClaimExecutor" | "settlementRedemptionReader">,
  agentId: string
): Promise<void> {
  if (!options.settlementClaimExecutor) {
    return;
  }

  await reconcileSettlements(store, {
    agentId,
    nowMs: options.now?.() ?? Date.now(),
    executeSettlementClaim: options.settlementClaimExecutor,
    readSettlementRedemption: options.settlementRedemptionReader
  });
}

function getLeaderboard(url: URL, store: PlatformMockStore): Response {
  const competitionId = url.searchParams.get("competitionId");
  if (!competitionId) {
    return errorResponse(400, "INVALID_INPUT", "competitionId query parameter is required");
  }

  const competition = store.getCompetition(competitionId);
  if (!competition) {
    return errorResponse(404, "COMPETITION_NOT_FOUND", "Competition not found");
  }

  const ledger = store.listPerformanceLedger({ competitionId });
  if (ledger.length > 0) {
    return jsonResponse({
      competitionId,
      entries: createLedgerLeaderboardEntries({
        agents: store.listAgents(),
        ledger,
        competitionId
      })
    });
  }

  const intentsById = new Map(store.listIntents().map((intent) => [intent.id, intent]));
  const entries = createLeaderboardEntries({
    store,
    executions: store.listExecutions().filter((execution) => execution.competitionId === competitionId),
    intents: store.listIntents().filter((intent) => intent.competitionId === competitionId),
    intentsById
  });

  return jsonResponse({
    competitionId,
    entries
  });
}

function getCompetitionPublicFeed(url: URL, competitionId: string, store: PlatformMockStore): Response {
  const competition = store.getCompetition(competitionId);
  if (!competition) {
    return errorResponse(404, "COMPETITION_NOT_FOUND", "Competition not found");
  }

  const intents = store.listIntents().filter((intent) => intent.competitionId === competitionId);
  const executions = store.listExecutions().filter((execution) => execution.competitionId === competitionId);
  const intentsById = new Map(store.listIntents().map((intent) => [intent.id, intent]));
  const ledger = store.listPerformanceLedger({ competitionId });
  const leaderboard = ledger.length > 0
    ? createLedgerLeaderboardEntries({
        agents: store.listAgents(),
        ledger,
        competitionId
      })
    : createLeaderboardEntries({
        store,
        executions,
        intents,
        intentsById
      });
  const agentIds = new Set([
    ...intents.map((intent) => intent.agentId),
    ...executions.map((execution) => execution.agentId),
    ...leaderboard.map((entry) => entry.agentId)
  ]);
  const ownerAddress = url.searchParams.get("ownerAddress")?.trim() ?? null;
  const ownerAgentIds = ownerAddress
    ? findOwnerAgents(store, normalizeAddress(ownerAddress)).map((agent) => agent.id)
    : [];
  const agents = store.listAgents()
    .filter((agent) => agentIds.has(agent.id))
    .map((agent) => ({
      id: agent.id,
      displayName: agent.displayName,
      twitterHandle: agent.twitterHandle,
      twitterVerified: agent.twitterVerified
    }));

  return jsonResponse({
    agents,
    intents,
    executions,
    leaderboard,
    ownerAgentIds
  });
}

function createCompetitionLeaderboardEntries(competitionId: string, store: PlatformMockStore): LeaderboardEntry[] {
  const ledger = store.listPerformanceLedger({ competitionId });
  if (ledger.length > 0) {
    return createLedgerLeaderboardEntries({
      agents: store.listAgents(),
      ledger,
      competitionId
    });
  }

  const intentsById = new Map(store.listIntents().map((intent) => [intent.id, intent]));
  return createLeaderboardEntries({
    store,
    executions: store.listExecutions().filter((execution) => execution.competitionId === competitionId),
    intents: store.listIntents().filter((intent) => intent.competitionId === competitionId),
    intentsById
  });
}

function createLeaderboardEntries({
  store,
  executions,
  intents,
  intentsById
}: {
  store: PlatformMockStore;
  executions: ExecutionRecord[];
  intents: AgentIntent[];
  intentsById: Map<string, AgentIntent>;
}): LeaderboardEntry[] {
  const executionsByAgentId = new Map<string, ExecutionRecord[]>();
  for (const execution of executions) {
    const agentExecutions = executionsByAgentId.get(execution.agentId) ?? [];
    agentExecutions.push(execution);
    executionsByAgentId.set(execution.agentId, agentExecutions);
  }

  const entries = [...executionsByAgentId.entries()].map(([agentId, agentExecutions]) => {
    const agent = store.getAgent(agentId);
    if (!agent) {
      return null;
    }

    const invalidIntentCount = intents.filter((intent) => (
      intent.agentId === agentId &&
      (intent.status === "rejected" || intent.status === "failed")
    )).length;
    const countableExecutions = agentExecutions.filter((execution) => (
      execution.status === "confirmed" || execution.status === "partial"
    ));
    const executedIntentCount = countableExecutions.filter((execution) => (
      intentsById.get(execution.intentId)?.status === "executed"
    )).length;
    const executionCount = countableExecutions.length;
    const finalExecutionAt = countableExecutions
      .map((execution) => execution.createdAt)
      .sort()
      .at(-1) ?? mockNow;
    const hitRatePct = executionCount === 0 ? 0 : executedIntentCount / executionCount;
    const netPnlPct = executionCount * 0.01;
    const maxDrawdownPct = invalidIntentCount * 0.005;
    const capitalEfficiencyPct = Math.min(1, executionCount / 6);

    return {
      rank: 0,
      agentId,
      displayName: agent.displayName,
      twitterHandle: agent.twitterHandle,
      twitterVerified: agent.twitterVerified,
      score: calculateMvpScore({
        netPnlPct,
        maxDrawdownPct,
        capitalEfficiencyPct,
        hitRatePct,
        executionCount,
        invalidIntentCount
      }),
      netPnlPct,
      maxDrawdownPct,
      capitalEfficiencyPct,
      hitRatePct,
      executionCount,
      invalidIntentCount,
      finalExecutionAt
    };
  }).filter((entry): entry is LeaderboardEntry => entry !== null);

  return sortLeaderboard(entries).map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

function getAgentPositions(url: URL, store: PlatformMockStore, agentId: string): Response {
  const competitionId = url.searchParams.get("competitionId");
  if (!competitionId) {
    return errorResponse(400, "INVALID_INPUT", "competitionId query parameter is required");
  }

  return jsonResponse({
    positions: store.listPositionSnapshots({ agentId, competitionId })
  });
}

function getIntent(intentId: string, store: PlatformMockStore, agentId: string): Response {
  const intent = store.findIntentById(intentId);
  if (!intent || intent.agentId !== agentId) {
    return errorResponse(404, "INTENT_NOT_FOUND", "Intent not found");
  }

  return jsonResponse({ intent });
}

function getExecution(executionId: string, store: PlatformMockStore, agentId: string): Response {
  const execution = store.findExecutionById(executionId);
  if (!execution || execution.agentId !== agentId) {
    return errorResponse(404, "EXECUTION_NOT_FOUND", "Execution not found");
  }

  return jsonResponse({
    execution: {
      ...execution,
      predictTxUrl: createPredictTxUrl(execution.predictTxDigest) ?? null
    }
  });
}

function getAgentReplay(agentId: string, store: PlatformMockStore): Response {
  const agent = store.getAgent(agentId);
  if (!agent) {
    return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
  }

  return jsonResponse({
    events: buildReplayEvents({
      agentId,
      intents: store.listIntents(),
      riskDecisions: store.listRiskDecisions(),
      executions: store.listExecutions()
    })
  });
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function findOwnerAgents(store: PlatformMockStore, normalizedOwnerAddress: string): AgentProfile[] {
  return store.listAgents().filter(
    (candidate) => normalizeAddress(candidate.ownerAddress) === normalizedOwnerAddress
  );
}

function findCurrentOwnerAgent(store: PlatformMockStore, normalizedOwnerAddress: string): AgentProfile | undefined {
  return findOwnerAgents(store, normalizedOwnerAddress)
    .sort((left, right) => compareOwnerAgentPriority(store, right, left))[0];
}

function compareOwnerAgentPriority(store: PlatformMockStore, left: AgentProfile, right: AgentProfile): number {
  const leftTime = getOwnerAgentLatestActivityMs(store, left);
  const rightTime = getOwnerAgentLatestActivityMs(store, right);
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const leftReadiness = getOwnerAgentReadinessScore(store, left);
  const rightReadiness = getOwnerAgentReadinessScore(store, right);
  if (leftReadiness !== rightReadiness) {
    return leftReadiness - rightReadiness;
  }

  return getAgentNumericId(left.id) - getAgentNumericId(right.id);
}

function getOwnerAgentLatestActivityMs(store: PlatformMockStore, agent: AgentProfile): number {
  const binding = store.getIdentityBindingByAgentId(agent.id);
  const wallet = store.getTradingWalletByAgentId(agent.id);
  const intentTimes = store.listIntents()
    .filter((intent) => intent.agentId === agent.id)
    .map((intent) => Date.parse(intent.createdAt));
  const executionTimes = store.listExecutions()
    .filter((execution) => execution.agentId === agent.id)
    .map((execution) => Date.parse(execution.createdAt));
  const candidates = [
    Date.parse(agent.createdAt),
    binding ? Date.parse(binding.createdAt) : NaN,
    binding ? Date.parse(binding.claimedAt) : NaN,
    wallet ? Date.parse(wallet.createdAt) : NaN,
    ...intentTimes,
    ...executionTimes
  ].filter(Number.isFinite);

  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function getOwnerAgentReadinessScore(store: PlatformMockStore, agent: AgentProfile): number {
  const wallet = store.getTradingWalletByAgentId(agent.id);
  let score = 0;
  if (wallet?.status === "active") {
    score += 1;
  }
  if (wallet?.predictManagerStatus === "ready") {
    score += 2;
  }
  if (wallet?.predictManagerId) {
    score += 2;
  }
  if (agent.runtimeStatus === "active") {
    score += 1;
  }
  if (agent.exposureStatus !== "flat" && agent.exposureStatus !== "settled") {
    score += 1;
  }

  return score;
}

function getAgentNumericId(agentId: string): number {
  const match = agentId.match(/_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function syncIdentityBindingWithWallet(
  store: PlatformMockStore,
  agentId: string,
  wallet: TradingWallet | null
): void {
  if (!wallet) {
    return;
  }

  const binding = store.getIdentityBindingByAgentId(agentId);
  if (!binding) {
    return;
  }

  if (
    binding.tradingWalletId === wallet.id &&
    binding.walletAddress === wallet.address &&
    binding.predictManagerId === wallet.predictManagerId
  ) {
    return;
  }

  store.saveIdentityBinding({
    ...binding,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: wallet.predictManagerId
  });
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.trim().length === 0) {
    throw new PlatformInputError("request body must be JSON");
  }

  return parseJsonObject(text);
}

function parseJsonObject(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PlatformInputError("request body must be valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PlatformInputError("request body must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function validateOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new PlatformInputError(`${field} must be a string`);
  }

  return value;
}

function validatePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new PlatformInputError(`${field} must be a positive integer`);
  }

  return value;
}

function getArenaRoute(pathname: string): string[] | null {
  if (pathname !== arenaPrefix && !pathname.startsWith(`${arenaPrefix}/`)) {
    return null;
  }

  return pathname
    .slice(arenaPrefix.length)
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

function matchesRoute(route: readonly string[], expected: readonly string[]): boolean {
  return route.length === expected.length && expected.every((segment, index) => route[index] === segment);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({
      "content-type": "application/json"
    })
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: withCors()
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response {
  return jsonResponse({
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  }, status);
}

function errorToResponse(error: unknown): Response {
  if (error instanceof PlatformAuthError) {
    return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
  }

  if (error instanceof PlatformInputError) {
    return errorResponse(400, "INVALID_INPUT", error.message);
  }

  if (error instanceof PlatformExecutionError) {
    return errorResponse(400, error.message, error.message);
  }

  return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
}

function withCors(headers: HeadersInit = {}): Headers {
  return new Headers({
    ...corsHeaders,
    ...headers
  });
}
