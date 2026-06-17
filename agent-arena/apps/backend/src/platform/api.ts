import {
  PlatformAuthError,
  authenticateAgentRuntimeRequest,
  createAgentRuntimeCredential,
  runtimeTokenHeader
} from "./auth";
import { getAllowedOperations } from "./competitions";
import {
  PlatformExecutionError,
  submitIntentWithMockExecution
} from "./execution";
import { PlatformMockStore } from "./mock-store";
import { buildReplayEvents } from "./replay";
import {
  calculateMvpScore,
  sortLeaderboard,
  type LeaderboardEntry
} from "./scoring";
import type { AgentIntent, Competition, ExecutionRecord, OwnerWithdrawalStatus } from "./types";
import { PlatformInputError } from "./validation";
import {
  validateDisplayName,
  validateNonEmptyString,
  validateOwnerWithdrawalPayload
} from "./validation";

const defaultCompetitionId = "btc-15m-001";
const mockNow = "2026-06-15T00:00:00.000Z";
const arenaPrefix = "/api/arena";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": `content-type, ${runtimeTokenHeader}`
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

export interface CreatePlatformFetchHandlerOptions {
  ownerWithdrawalService?: (input: OwnerWithdrawalServiceInput) => Promise<OwnerWithdrawalServiceResult>;
}

export function createPlatformFetchHandler(
  store = new PlatformMockStore(),
  options: CreatePlatformFetchHandlerOptions = {}
) {
  if (!store.getCompetition(defaultCompetitionId)) {
    store.seedCompetition();
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
            "POST /api/arena/agent/init",
            "POST /api/arena/owner/agents/claim",
            "GET /api/arena/agent/me",
            "GET /api/arena/agent/wallet",
            "GET /api/arena/competition/list-active",
            "GET /api/arena/competition/:id",
            "GET /api/arena/competition/:id/market-state",
            "POST /api/arena/intents",
            "GET /api/arena/intents/:id",
            "GET /api/arena/leaderboard?competitionId=...",
            "POST /api/arena/owner/trading-wallets/:walletId/withdraw",
            "GET /api/arena/owner/agents/:id/replay"
          ]
        });
      }

      if (request.method === "POST" && matchesRoute(route, ["agent", "init"])) {
        return await initAgentPairing(request, store);
      }

      if (request.method === "POST" && matchesRoute(route, ["owner", "agents", "claim"])) {
        return await claimAgent(request, store);
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
        const agent = store.getAgent(auth.agentId);
        if (!agent) {
          return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
        }

        return jsonResponse(agent);
      }

      if (request.method === "GET" && matchesRoute(route, ["agent", "wallet"])) {
        const auth = authenticateAgentRuntimeRequest(request, store);
        return jsonResponse({
          wallet: store.getTradingWalletByAgentId(auth.agentId) ?? null
        });
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
        const competition = store.getCompetition(defaultCompetitionId);
        return jsonResponse({
          competitions: competition && competition.status === "live" ? [competition] : []
        });
      }

      if (request.method === "GET" && route.length === 2 && route[0] === "competition") {
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
        const competition = store.getCompetition(route[1]);
        if (!competition) {
          return errorResponse(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        return jsonResponse({ marketState: createMarketState(competition) });
      }

      if (request.method === "POST" && matchesRoute(route, ["intents"])) {
        return await submitIntent(request, store);
      }

      if (request.method === "GET" && route.length === 2 && route[0] === "intents") {
        return getIntent(route[1], store);
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

async function initAgentPairing(request: Request, store: PlatformMockStore): Promise<Response> {
  const body = await readJsonObject(request);
  const displayName = validateDisplayName(body.displayName);
  const draft = store.createPairingDraft(displayName);

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
  store: PlatformMockStore
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
  const wallet = store.bindTradingWallet(agent.id, `0xagentwallet_${agent.id}`);
  const credential = createAgentRuntimeCredential(store, agent.id, mockNow);

  return jsonResponse({
    agent: store.getAgent(agent.id),
    tradingWallet: wallet,
    runtimeCredential: {
      token: credential.token,
      shownOnce: true,
      scopes: credential.scopes
    }
  }, 201);
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

async function submitIntent(request: Request, store: PlatformMockStore): Promise<Response> {
  const auth = authenticateAgentRuntimeRequest(request, store);
  const body = await readJsonObject(request);
  const bodyAgentId = validateNonEmptyString(body.agentId, "agentId");
  if (bodyAgentId !== auth.agentId) {
    return errorResponse(403, "AGENT_MISMATCH", "Authenticated agent does not match intent agentId");
  }

  const result = submitIntentWithMockExecution(store, body);
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

  return jsonResponse(result, 201);
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
      intent.status === "rejected"
    )).length;
    const executedIntentCount = agentExecutions.filter((execution) => (
      intentsById.get(execution.intentId)?.status === "executed"
    )).length;
    const executionCount = agentExecutions.length;
    const finalExecutionAt = agentExecutions
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

function getIntent(intentId: string, store: PlatformMockStore): Response {
  const intent = store.findIntentById(intentId);
  if (!intent) {
    return errorResponse(404, "INTENT_NOT_FOUND", "Intent not found");
  }

  return jsonResponse({ intent });
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

function createMarketState(competition: Competition) {
  return {
    competitionId: competition.id,
    marketSymbol: competition.marketSymbol,
    status: competition.status,
    allowedOperations: getAllowedOperations(competition.status),
    oracleId: competition.oracleId,
    expiry: competition.expiry,
    startsAt: competition.startsAt,
    expiresAt: competition.expiresAt,
    settlesAt: competition.settlesAt,
    predictObjectId: competition.predictObjectId
  };
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
