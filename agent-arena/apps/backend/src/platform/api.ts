import {
  PlatformAuthError,
  authenticateAgentRequest,
  createAgentCredential
} from "./auth";
import { getAllowedOperations } from "./competitions";
import {
  PlatformExecutionError,
  submitIntentWithMockExecution
} from "./execution";
import { PlatformMockStore } from "./mock-store";
import {
  calculateMvpScore,
  sortLeaderboard,
  type LeaderboardEntry
} from "./scoring";
import type { AgentIntent, Competition, ExecutionRecord } from "./types";
import { PlatformInputError } from "./validation";

const defaultCompetitionId = "btc-15m-001";
const mockNow = "2026-06-15T00:00:00.000Z";
const arenaPrefix = "/api/arena";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type, x-agent-arena-api-key"
};

export function createPlatformFetchHandler(store = new PlatformMockStore()) {
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
          authHeader: "x-agent-arena-api-key",
          endpoints: [
            "GET /api/arena/__introspection",
            "POST /api/arena/auth/register",
            "GET /api/arena/agent/me",
            "GET /api/arena/agent/wallet",
            "POST /api/arena/owner/agents/:id/wallet",
            "GET /api/arena/competition/list-active",
            "GET /api/arena/competition/:id",
            "GET /api/arena/competition/:id/market-state",
            "POST /api/arena/intents",
            "GET /api/arena/leaderboard?competitionId=..."
          ]
        });
      }

      if (request.method === "POST" && matchesRoute(route, ["auth", "register"])) {
        return await registerAgent(request, store);
      }

      if (request.method === "GET" && matchesRoute(route, ["agent", "me"])) {
        const auth = authenticateAgentRequest(request, store);
        const agent = store.getAgent(auth.agentId);
        if (!agent) {
          return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
        }

        return jsonResponse({ agent });
      }

      if (request.method === "GET" && matchesRoute(route, ["agent", "wallet"])) {
        const auth = authenticateAgentRequest(request, store);
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
        return await bindOwnerWallet(request, store, route[2]);
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

      if (request.method === "GET" && matchesRoute(route, ["leaderboard"])) {
        return getLeaderboard(url, store);
      }

      return errorResponse(404, "NOT_FOUND", "Route not found");
    } catch (error) {
      return errorToResponse(error);
    }
  };
}

async function registerAgent(request: Request, store: PlatformMockStore): Promise<Response> {
  const body = await readJsonObject(request);
  const name = validateNonEmptyString(body.name, "name").trim();
  const twitterHandle = validateOptionalString(body.twitterHandle, "twitterHandle");
  const agent = store.createAgent({ name, twitterHandle });
  const credential = createAgentCredential(store, agent.id, mockNow);

  return jsonResponse({
    agent,
    apiKey: credential.apiKey
  }, 201);
}

async function bindOwnerWallet(
  request: Request,
  store: PlatformMockStore,
  agentId: string
): Promise<Response> {
  const auth = authenticateAgentRequest(request, store);
  if (auth.agentId !== agentId) {
    return errorResponse(403, "AGENT_MISMATCH", "Authenticated agent cannot bind this wallet");
  }

  const agent = store.getAgent(agentId);
  if (!agent) {
    return errorResponse(404, "AGENT_NOT_FOUND", "Agent not found");
  }

  const body = await readOptionalJsonObject(request);
  const requestedAddress = body.address === undefined
    ? undefined
    : validateNonEmptyString(body.address, "address").trim();
  const wallet = store.bindTradingWallet(agentId, requestedAddress ?? `0xagentwallet_${agentId}`);

  return jsonResponse({
    wallet,
    agent: store.getAgent(agentId)
  }, 201);
}

async function submitIntent(request: Request, store: PlatformMockStore): Promise<Response> {
  const auth = authenticateAgentRequest(request, store);
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
    executions: store.listExecutions().filter((execution) => execution.competitionId === competitionId),
    intents: store.listIntents().filter((intent) => intent.competitionId === competitionId),
    intentsById
  });

  return jsonResponse({
    competitionId,
    entries: entries.length > 0 ? sortLeaderboard(entries) : []
  });
}

function createLeaderboardEntries({
  executions,
  intents,
  intentsById
}: {
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

  return [...executionsByAgentId.entries()].map(([agentId, agentExecutions]) => {
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
      agentId,
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
      finalExecutionAt
    };
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

async function readOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return {};
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

function validateNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlatformInputError(`${field} must be a non-empty string`);
  }

  return value;
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
