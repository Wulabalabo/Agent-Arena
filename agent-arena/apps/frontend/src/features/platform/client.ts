import type {
  AgentIntent,
  AgentPositionSnapshot,
  AgentProfile,
  Competition,
  ExecutionRecord,
  LeaderboardEntry,
  MarketSnapshot,
  OwnerAgentProfile,
  PairingDraft,
  PlatformErrorBody,
  PrepareAgentClaimResponse,
  PublicArenaActivity,
  ReplayEvent,
  RegistryWriteSummary,
  RuntimeCredential,
  RuntimeCredentialRotationChallenge,
  RuntimeCredentialRotationPrepareResponse,
  RuntimeCredentialRotationResponse,
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

interface PrepareAgentClaimInput {
  registrationCode: string;
  ownerAddress: string;
  twitterHandle?: string;
}

interface FinalizeAgentClaimInput {
  pendingClaimId: string;
  txDigest: string;
}

interface ClaimAgentResponse {
  agent: AgentProfile;
  tradingWallet: TradingWallet;
  runtimeCredential: RuntimeCredential;
  registry?: RegistryWriteSummary;
}

interface CompetitionListResponse {
  competitions: Competition[];
}

interface CompetitionResponse {
  competition: Competition;
}

interface MarketStateResponse {
  marketState: MarketSnapshot;
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

interface RuntimeCredentialRotationTxInput {
  ownerAddress: string;
  nonce: string;
  txDigest: string;
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
    prepareAgentClaim: (input: PrepareAgentClaimInput) =>
      requestJson<PrepareAgentClaimResponse>(fetcher, `${root}/owner/agents/claim/prepare`, jsonPost(input)),
    finalizeAgentClaim: (input: FinalizeAgentClaimInput) =>
      requestJson<ClaimAgentResponse>(fetcher, `${root}/owner/agents/claim/finalize`, jsonPost(input)),
    prepareRuntimeCredentialRotation: (
      agentId: string,
      input: { ownerAddress: string; reason: string }
    ) =>
      requestJson<RuntimeCredentialRotationPrepareResponse>(
        fetcher,
        `${root}/owner/agents/${encodeURIComponent(agentId)}/runtime-credential/rotation-prepare`,
        jsonPost(input)
      ),
    createRuntimeCredentialRotationChallenge: (
      agentId: string,
      input: { ownerAddress: string; reason: string }
    ) =>
      requestJson<RuntimeCredentialRotationPrepareResponse>(
        fetcher,
        `${root}/owner/agents/${encodeURIComponent(agentId)}/runtime-credential/rotation-prepare`,
        jsonPost(input)
      ).then((response) => ({
        ...response.challenge,
        registryProof: response.registryProof
    })),
    rotateRuntimeCredential: (
      agentId: string,
      input: RuntimeCredentialRotationTxInput
    ) =>
      requestJson<RuntimeCredentialRotationResponse>(
        fetcher,
        `${root}/owner/agents/${encodeURIComponent(agentId)}/runtime-credential/rotate`,
        jsonPost(input)
      ),
    getOwnerAgentProfile: (ownerAddress: string) =>
      requestJson<OwnerAgentProfile>(
        fetcher,
        `${root}/owner/agent?ownerAddress=${encodeURIComponent(ownerAddress)}`
      ),
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
    getCompetitionMarketState: (competitionId: string) =>
      requestJson<MarketStateResponse>(
        fetcher,
        `${root}/competition/${encodeURIComponent(competitionId)}/market-state`
      ).then((response) => response.marketState),
    listCompetitionPublicActivity: (competitionId: string, ownerAddress?: string | null) =>
      requestJson<PublicArenaActivity>(
        fetcher,
        createPublicFeedUrl(root, competitionId, ownerAddress)
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

function createPublicFeedUrl(root: string, competitionId: string, ownerAddress?: string | null): string {
  const ownerQuery = ownerAddress ? `?ownerAddress=${encodeURIComponent(ownerAddress)}` : "";
  return `${root}/competition/${encodeURIComponent(competitionId)}/public-feed${ownerQuery}`;
}
