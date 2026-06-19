import type {
  AgentAction,
  AgentIntent,
  AgentPositionSnapshot,
  AgentProfile,
  AgentRuntimeStatus,
  ExposureStatus,
  ExecutionRecord,
  LeaderboardEntry,
  MarketSnapshot,
  PublicAgentSummary,
  TradingWallet
} from "./types";

export const agentArenaJoinPrompt =
  "Read http://127.0.0.1:8787/skills/agent-arena.md and follow the instructions to join the BTC 15m Agent Arena.";

export type UserAgentArenaAccountState =
  | "no_owner_wallet"
  | "no_claimed_agent"
  | "claimed_no_runtime"
  | "flat"
  | "open_exposure"
  | "attention";

export interface PublicActionFeedItem {
  id: string;
  timestamp: string;
  agentId: string;
  agentDisplayName: string;
  action:
    | AgentAction
    | "rejected"
    | "executed"
    | "pnl_update"
    | "score_update";
  status: "accepted" | "queued" | "executed" | "rejected" | "failed" | "partial" | "info";
  direction?: "UP" | "DOWN";
  lowerStrike?: string;
  higherStrike?: string;
  confidence?: number;
  reason?: string;
  rejectionCode?: string;
  budgetRaw?: string;
  quantity?: string;
  maxCost?: string;
  minProceeds?: string;
  pnlDeltaPct?: number;
  scoreDelta?: number;
  predictTxDigest?: string;
}

export interface UserAgentArenaProfile {
  accountState: UserAgentArenaAccountState;
  agentId: string | null;
  displayName: string;
  ownerAddress: string | null;
  twitterHandle: string | null;
  twitterVerified: false;
  tradingWalletAddress: string | null;
  runtimeStatus: AgentRuntimeStatus | "none";
  exposureStatus: ExposureStatus | "none";
  positionLabel: string;
  openQuantityRaw: string | null;
  submittedBudgetRaw: string | null;
  realizedPnlPct: number | null;
  unrealizedPnlPct: number | null;
  latestIntentId: string | null;
  latestExecutionId: string | null;
  latestPredictTxDigest: string | null;
}

export type ArenaChartMarketReference =
  | {
      kind: "directional";
      strike: number;
      strikeRaw: string;
    }
  | {
      higherStrike: number;
      higherStrikeRaw: string;
      kind: "range";
      lowerStrike: number;
      lowerStrikeRaw: string;
    };

interface CreateUserAgentArenaProfileInput {
  agent: AgentProfile | null;
  tradingWallet: TradingWallet | null;
  positions: AgentPositionSnapshot[];
  intents: AgentIntent[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
}

interface CreatePublicActionFeedItemsInput {
  agents: PublicAgentSummary[];
  intents: AgentIntent[];
  executions: ExecutionRecord[];
  leaderboard: LeaderboardEntry[];
}

interface CreateArenaChartMarketReferenceInput {
  competitionId: string;
  intents: AgentIntent[];
  marketState?: MarketSnapshot | null;
  positions: AgentPositionSnapshot[];
}

export function createUserAgentArenaProfile(input: CreateUserAgentArenaProfileInput): UserAgentArenaProfile {
  const { agent, tradingWallet, positions, intents, executions, leaderboard } = input;

  if (!agent) {
    return {
      accountState: "no_claimed_agent",
      agentId: null,
      displayName: "No claimed Agent",
      ownerAddress: null,
      twitterHandle: null,
      twitterVerified: false,
      tradingWalletAddress: null,
      runtimeStatus: "none",
      exposureStatus: "none",
      positionLabel: "No active Agent",
      openQuantityRaw: null,
      submittedBudgetRaw: null,
      realizedPnlPct: null,
      unrealizedPnlPct: null,
      latestIntentId: null,
      latestExecutionId: null,
      latestPredictTxDigest: null
    };
  }

  const agentIntents = intents.filter((intent) => intent.agentId === agent.id);
  const agentExecutions = executions.filter((execution) => execution.agentId === agent.id);
  const agentTradingWallet = tradingWallet?.agentId === agent.id ? tradingWallet : null;
  const latestIntent = findNewestByCreatedAt(agentIntents);
  const latestExecution = findNewestByCreatedAt(agentExecutions);
  const openPosition = positions.find((position) => position.agentId === agent.id && position.status === "open");
  const leaderboardEntry = leaderboard.find((entry) => entry.agentId === agent.id);
  const accountState = deriveAccountState({
    agent,
    tradingWallet: agentTradingWallet,
    openPosition,
    latestIntent,
    latestExecution
  });

  return {
    accountState,
    agentId: agent.id,
    displayName: agent.displayName,
    ownerAddress: agent.ownerAddress || null,
    twitterHandle: agent.twitterHandle,
    twitterVerified: false,
    tradingWalletAddress: agentTradingWallet?.address ?? agent.tradingWalletAddress ?? null,
    runtimeStatus: agent.runtimeStatus,
    exposureStatus: agent.exposureStatus,
    positionLabel: formatPositionLabel(openPosition),
    openQuantityRaw: openPosition?.quantityRaw ?? null,
    submittedBudgetRaw: latestIntent?.budgetRaw ?? null,
    realizedPnlPct: leaderboardEntry?.netPnlPct ?? null,
    unrealizedPnlPct: null,
    latestIntentId: latestIntent?.id ?? null,
    latestExecutionId: latestExecution?.id ?? null,
    latestPredictTxDigest: latestExecution?.predictTxDigest ?? null
  };
}

export function createPublicActionFeedItems(input: CreatePublicActionFeedItemsInput): PublicActionFeedItem[] {
  const agentDisplayNames = createAgentDisplayNameLookup(input.agents, input.leaderboard);
  const intentItems = input.intents.map((intent): PublicActionFeedItem => ({
    id: `intent:${intent.id}`,
    timestamp: intent.createdAt,
    agentId: intent.agentId,
    agentDisplayName: agentDisplayNames.get(intent.agentId) ?? intent.agentId,
    action: intent.status === "rejected" ? "rejected" : intent.action,
    status: statusFromIntent(intent),
    confidence: intent.confidence,
    reason: intent.reason,
    rejectionCode: intent.rejectionCode ?? undefined,
    budgetRaw: intent.budgetRaw,
    quantity: intent.quantity,
    maxCost: intent.maxCost,
    minProceeds: intent.minProceeds,
    ...marketFields(intent)
  }));
  const executionItems = input.executions.map((execution): PublicActionFeedItem => ({
    id: `execution:${execution.id}`,
    timestamp: execution.createdAt,
    agentId: execution.agentId,
    agentDisplayName: agentDisplayNames.get(execution.agentId) ?? execution.agentId,
    action: "executed",
    status: statusFromExecution(execution),
    predictTxDigest: execution.predictTxDigest ?? undefined
  }));
  const leaderboardItems = input.leaderboard.map((entry): PublicActionFeedItem => ({
    id: `score:${entry.agentId}:${entry.finalExecutionAt}`,
    timestamp: entry.finalExecutionAt,
    agentId: entry.agentId,
    agentDisplayName: agentDisplayNames.get(entry.agentId) ?? entry.displayName,
    action: "score_update",
    status: "info",
    pnlDeltaPct: entry.netPnlPct,
    scoreDelta: entry.score
  }));

  return [...intentItems, ...executionItems, ...leaderboardItems].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp)
  );
}

export function createArenaChartMarketReference({
  competitionId,
  intents,
  marketState,
  positions
}: CreateArenaChartMarketReferenceInput): ArenaChartMarketReference | null {
  const executableMarketReference =
    marketState?.competitionId === competitionId ? marketReferenceFromMarketState(marketState) : null;
  if (executableMarketReference) {
    return executableMarketReference;
  }

  const openPosition = findNewestByUpdatedAt(
    positions.filter((position) => position.competitionId === competitionId && position.status === "open")
  );
  const positionReference = openPosition ? marketReferenceFromPosition(openPosition) : null;
  if (positionReference) {
    return positionReference;
  }

  const latestExecutableIntent = findNewestByCreatedAt(
    intents.filter(
      (intent) =>
        intent.competitionId === competitionId &&
        intent.market &&
        (intent.status === "accepted" || intent.status === "executed" || intent.status === "partial")
    )
  );

  return latestExecutableIntent?.market ? marketReferenceFromIntentMarket(latestExecutableIntent.market) : null;
}

function deriveAccountState(input: {
  agent: AgentProfile;
  tradingWallet: TradingWallet | null;
  openPosition?: AgentPositionSnapshot;
  latestIntent?: AgentIntent;
  latestExecution?: ExecutionRecord;
}): UserAgentArenaAccountState {
  const { agent, tradingWallet, openPosition, latestIntent, latestExecution } = input;

  if (!agent.ownerAddress) {
    return "no_owner_wallet";
  }

  if (agent.runtimeStatus === "waiting") {
    return "claimed_no_runtime";
  }

  if (latestIntent?.status === "rejected" || latestIntent?.status === "failed" || latestExecution?.status === "failed") {
    return "attention";
  }

  if (openPosition || agent.exposureStatus === "directional" || agent.exposureStatus === "range") {
    return "open_exposure";
  }

  if (!tradingWallet) {
    return "claimed_no_runtime";
  }

  return "flat";
}

function formatPositionLabel(position?: AgentPositionSnapshot): string {
  if (!position) {
    return "Flat";
  }

  if (position.positionRef.kind === "directional" && position.strikeRaw && position.direction) {
    return `${position.direction.toUpperCase()} ${position.strikeRaw}`;
  }

  if (position.positionRef.kind === "range" && position.lowerStrikeRaw && position.higherStrikeRaw) {
    return `Range ${position.lowerStrikeRaw}-${position.higherStrikeRaw}`;
  }

  return "Flat";
}

function findNewestByCreatedAt<T extends { createdAt: string }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function findNewestByUpdatedAt<T extends { updatedAt: string }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function createAgentDisplayNameLookup(
  agents: PublicAgentSummary[],
  leaderboard: LeaderboardEntry[]
): Map<string, string> {
  return new Map([
    ...leaderboard.map((entry): [string, string] => [entry.agentId, entry.displayName]),
    ...agents.map((agent): [string, string] => [agent.id, agent.displayName])
  ]);
}

function statusFromIntent(intent: AgentIntent): PublicActionFeedItem["status"] {
  switch (intent.status) {
    case "accepted":
      return "accepted";
    case "rejected":
      return "rejected";
    case "executed":
      return "executed";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
  }
}

function statusFromExecution(execution: ExecutionRecord): PublicActionFeedItem["status"] {
  switch (execution.status) {
    case "confirmed":
      return "executed";
    case "queued":
    case "signed":
    case "submitted":
      return "queued";
    case "failed":
      return "failed";
    case "partial":
      return "partial";
  }
}

function marketFields(intent: AgentIntent): Partial<PublicActionFeedItem> {
  if (intent.market?.kind === "directional") {
    return { direction: intent.market.isUp ? "UP" : "DOWN" };
  }

  if (intent.market?.kind === "range") {
    return {
      lowerStrike: intent.market.lowerStrike,
      higherStrike: intent.market.higherStrike
    };
  }

  return {};
}

function marketReferenceFromPosition(position: AgentPositionSnapshot): ArenaChartMarketReference | null {
  if (position.positionRef.kind === "directional" && position.strikeRaw) {
    const strike = parseRawStrike(position.strikeRaw);
    return strike === null ? null : { kind: "directional", strike, strikeRaw: position.strikeRaw };
  }

  if (position.positionRef.kind === "range" && position.lowerStrikeRaw && position.higherStrikeRaw) {
    const lowerStrike = parseRawStrike(position.lowerStrikeRaw);
    const higherStrike = parseRawStrike(position.higherStrikeRaw);
    return lowerStrike === null || higherStrike === null
      ? null
      : {
          higherStrike,
          higherStrikeRaw: position.higherStrikeRaw,
          kind: "range",
          lowerStrike,
          lowerStrikeRaw: position.lowerStrikeRaw
        };
  }

  return null;
}

function marketReferenceFromMarketState(marketState: MarketSnapshot): ArenaChartMarketReference | null {
  const directional = marketState.executableMarkets?.directional;
  if (
    marketState.status !== "live" ||
    marketState.oracleStatus !== "active" ||
    !directional ||
    directional.oracleId !== marketState.oracleId ||
    directional.expiry !== marketState.expiryMs ||
    !isActiveMarketClock(marketState)
  ) {
    return null;
  }

  const strike = parseRawStrike(directional.strike);
  return strike === null ? null : { kind: "directional", strike, strikeRaw: directional.strike };
}

function marketReferenceFromIntentMarket(market: NonNullable<AgentIntent["market"]>): ArenaChartMarketReference | null {
  if (market.kind === "directional") {
    const strike = parseRawStrike(market.strike);
    return strike === null ? null : { kind: "directional", strike, strikeRaw: market.strike };
  }

  const lowerStrike = parseRawStrike(market.lowerStrike);
  const higherStrike = parseRawStrike(market.higherStrike);
  return lowerStrike === null || higherStrike === null
    ? null
    : {
        higherStrike,
        higherStrikeRaw: market.higherStrike,
        kind: "range",
        lowerStrike,
        lowerStrikeRaw: market.lowerStrike
      };
}

function parseRawStrike(rawStrike: string): number | null {
  const value = Number(rawStrike);
  return Number.isFinite(value) ? value / 1_000_000_000 : null;
}

function isActiveMarketClock(marketState: MarketSnapshot): boolean {
  const expiryMs = readPositiveNumber(marketState.expiryMs);
  const serverTimeMs = readPositiveNumber(marketState.serverTimeMs);
  const timeToExpiryMs = readPositiveNumber(marketState.timeToExpiryMs);
  const fetchedAtMs = Date.parse(marketState.fetchedAt);

  if (expiryMs === null || serverTimeMs === null || timeToExpiryMs === null || Number.isNaN(fetchedAtMs)) {
    return false;
  }

  if (timeToExpiryMs <= 0 || serverTimeMs >= expiryMs) {
    return false;
  }

  return Math.abs(fetchedAtMs - serverTimeMs) <= 60_000;
}

function readPositiveNumber(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
