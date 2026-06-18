import type {
  AgentIntent,
  AgentPositionSnapshot,
  AgentProfile,
  Competition,
  ExecutionRecord,
  LeaderboardEntry,
  PairingDraft,
  PlatformErrorBody,
  ReplayEvent,
  RuntimeCredential,
  SubmitIntentInput,
  TradingWallet
} from "./types";

const runtimeAuthHeader = "x-agent-arena-agent-token";

type PlatformFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface CreatePlatformClientOptions {
  baseUrl: string;
  fetcher?: PlatformFetcher;
}

interface InitAgentPairingInput {
  displayName: string;
}

interface ClaimAgentInput {
  registrationCode: string;
  ownerAddress: string;
  signature: string;
  twitterHandle?: string;
}

interface ClaimAgentResponse {
  agent: AgentProfile;
  tradingWallet: TradingWallet;
  runtimeCredential: RuntimeCredential;
}

interface CompetitionListResponse {
  competitions: Competition[];
}

interface CompetitionResponse {
  competition: Competition;
}

interface TradingWalletResponse {
  wallet: TradingWallet;
}

interface AgentPositionsResponse {
  positions: AgentPositionSnapshot[];
}

interface ExecutionResponse {
  execution: ExecutionRecord;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

interface ReplayResponse {
  events: ReplayEvent[];
}

export class PlatformClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor({ code, message, retryable = false }: { code: string; message: string; retryable?: boolean }) {
    super(message);
    this.name = "PlatformClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function createPlatformClient({ baseUrl, fetcher = fetch }: CreatePlatformClientOptions) {
  const root = normalizeBaseUrl(baseUrl);

  return {
    initAgentPairing: (input: InitAgentPairingInput) =>
      requestJson<PairingDraft>(fetcher, `${root}/agent/init`, jsonPost(input)),
    claimAgent: (input: ClaimAgentInput) =>
      requestJson<ClaimAgentResponse>(fetcher, `${root}/owner/agents/claim`, jsonPost(input)),
    getAgentMe: (runtimeCredential: string) =>
      requestJson<AgentProfile>(fetcher, `${root}/agent/me`, {
        headers: createRuntimeHeaders(runtimeCredential)
      }),
    getAgentWallet: (runtimeCredential: string) =>
      requestJson<TradingWalletResponse>(fetcher, `${root}/agent/wallet`, {
        headers: createRuntimeHeaders(runtimeCredential)
      }).then((response) => response.wallet),
    listAgentPositions: (runtimeCredential: string, competitionId: string) =>
      requestJson<AgentPositionsResponse>(
        fetcher,
        `${root}/agent/positions?competitionId=${encodeURIComponent(competitionId)}`,
        {
          headers: createRuntimeHeaders(runtimeCredential)
        }
      ).then((response) => response.positions),
    listCompetitions: () =>
      requestJson<CompetitionListResponse>(fetcher, `${root}/competition/list-active`).then((response) => response.competitions),
    getCompetition: (competitionId: string) =>
      requestJson<CompetitionResponse>(fetcher, `${root}/competition/${encodeURIComponent(competitionId)}`).then(
        (response) => response.competition
      ),
    submitIntent: (runtimeCredential: string, intent: SubmitIntentInput) =>
      requestJson<AgentIntent>(
        fetcher,
        `${root}/intents`,
        jsonPost(createSubmitIntentBody(intent), createRuntimeHeaders(runtimeCredential))
      ),
    getExecution: (runtimeCredential: string, executionId: string) =>
      requestJson<ExecutionResponse>(fetcher, `${root}/executions/${encodeURIComponent(executionId)}`, {
        headers: createRuntimeHeaders(runtimeCredential)
      }).then((response) => response.execution),
    listLeaderboard: (competitionId: string) =>
      requestJson<LeaderboardResponse>(
        fetcher,
        `${root}/leaderboard?competitionId=${encodeURIComponent(competitionId)}`
      ).then((response) => response.entries),
    listReplay: (agentId: string) =>
      requestJson<ReplayResponse>(fetcher, `${root}/owner/agents/${encodeURIComponent(agentId)}/replay`).then(
        (response) => response.events
      )
  };
}

async function requestJson<T>(fetcher: PlatformFetcher, url: string, init?: RequestInit): Promise<T> {
  const response = init ? await fetcher(url, init) : await fetcher(url);
  const payload = response.status === 204 ? undefined : await readJson(response, response.ok);

  if (!response.ok) {
    throw createPlatformError(response, payload);
  }

  return payload as T;
}

async function readJson(response: Response, requireValidJson: boolean): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (requireValidJson) {
      throw error;
    }

    return undefined;
  }
}

function createPlatformError(response: Response, payload: unknown): PlatformClientError {
  const body = payload as PlatformErrorBody | undefined;
  const error = body?.error;

  if (error) {
    return new PlatformClientError({
      code: error.code,
      message: error.message,
      retryable: error.retryable
    });
  }

  return new PlatformClientError({
    code: "REQUEST_FAILED",
    message: `Platform request failed: ${response.status}`,
    retryable: false
  });
}

function jsonPost(body: unknown, headers?: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function createSubmitIntentBody(intent: SubmitIntentInput): SubmitIntentInput {
  const body: SubmitIntentInput = {
    competitionId: intent.competitionId,
    agentId: intent.agentId,
    idempotencyKey: intent.idempotencyKey,
    action: intent.action,
    confidence: intent.confidence,
    reason: intent.reason,
    createdAt: intent.createdAt
  };

  if (intent.market !== undefined) {
    body.market = intent.market;
  }

  if (intent.positionRef !== undefined) {
    body.positionRef = intent.positionRef;
  }

  if (intent.budgetRaw !== undefined) {
    body.budgetRaw = intent.budgetRaw;
  }

  if (intent.quantity !== undefined) {
    body.quantity = intent.quantity;
  }

  if (intent.maxCost !== undefined) {
    body.maxCost = intent.maxCost;
  }

  if (intent.minProceeds !== undefined) {
    body.minProceeds = intent.minProceeds;
  }

  return body;
}

function createRuntimeHeaders(runtimeCredential: string): Record<string, string> {
  return {
    [runtimeAuthHeader]: runtimeCredential
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
