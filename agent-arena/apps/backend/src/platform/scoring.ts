import type { AgentProfile, PerformanceLedgerRecord } from "./types";

export interface MvpScoreInput {
  netPnlPct: number;
  maxDrawdownPct: number;
  capitalEfficiencyPct: number;
  hitRatePct: number;
  executionCount: number;
  invalidIntentCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  displayName: string;
  twitterHandle: string | null;
  twitterVerified: boolean;
  score: number;
  netPnlPct: number;
  maxDrawdownPct: number;
  capitalEfficiencyPct: number;
  hitRatePct: number;
  executionCount: number;
  invalidIntentCount: number;
  finalExecutionAt: string;
}

export function calculateMvpScore(input: MvpScoreInput): number {
  const overtradePenalty = Math.max(0, input.executionCount - 6) * 1.5;

  return (
    (input.netPnlPct * 100)
    - (input.maxDrawdownPct * 30)
    + (input.capitalEfficiencyPct * 10)
    + (input.hitRatePct * 5)
    - overtradePenalty
    - (input.invalidIntentCount * 2)
  );
}

export function sortLeaderboard(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .map((entry) => ({ ...entry }))
    .sort((left, right) => (
      compareDescendingNumber(left.score, right.score)
      || compareDescendingNumber(left.netPnlPct, right.netPnlPct)
      || compareAscendingNumber(left.maxDrawdownPct, right.maxDrawdownPct)
      || compareAscendingString(left.finalExecutionAt, right.finalExecutionAt)
      || compareAscendingString(left.agentId, right.agentId)
    ));
}

export function createLedgerLeaderboardEntries(input: {
  agents: readonly AgentProfile[];
  ledger: readonly PerformanceLedgerRecord[];
  competitionId: string;
}): LeaderboardEntry[] {
  const agentsById = new Map(input.agents.map((agent) => [agent.id, agent]));
  const rowsByAgentId = new Map<string, PerformanceLedgerRecord[]>();
  for (const row of input.ledger) {
    if (row.competitionId !== input.competitionId) {
      continue;
    }

    const rows = rowsByAgentId.get(row.agentId) ?? [];
    rows.push(row);
    rowsByAgentId.set(row.agentId, rows);
  }

  const entries = [...rowsByAgentId.entries()]
    .map(([agentId, rows]) => {
      const agent = agentsById.get(agentId);
      if (!agent) {
        return null;
      }

      const countableExecutions = rows.filter((row) => (
        row.kind === "execution" &&
        (row.status === "confirmed" || row.status === "confirmed_policy_drift" || row.status === "partial")
      ));
      const invalidIntentCount = rows.filter((row) => (
        (row.kind === "intent" && row.status === "rejected") ||
        (row.kind === "execution" && row.status === "failed")
      )).length;
      const executionCount = countableExecutions.length;
      const finalExecutionAt = countableExecutions
        .map((row) => row.createdAt)
        .sort()
        .at(-1) ?? agent.createdAt;
      const realizedMetrics = createRealizedPositionMetrics(rows);
      const hitRatePct = realizedMetrics?.hitRatePct ?? (executionCount === 0 ? 0 : 1);
      const netPnlPct = realizedMetrics?.netPnlPct ?? (executionCount * 0.01);
      const maxDrawdownPct = realizedMetrics?.maxDrawdownPct ?? (invalidIntentCount * 0.005);
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
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);

  return sortLeaderboard(entries).map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

function compareDescendingNumber(left: number, right: number): number {
  return right - left;
}

function compareAscendingNumber(left: number, right: number): number {
  return left - right;
}

function compareAscendingString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function createRealizedPositionMetrics(rows: readonly PerformanceLedgerRecord[]): {
  hitRatePct: number;
  netPnlPct: number;
  maxDrawdownPct: number;
} | null {
  const realizedRows = rows
    .filter((row) => (
      row.kind === "position" &&
      row.status === "realized" &&
      isRawInteger(row.costRaw) &&
      isRawInteger(row.proceedsRaw)
    ))
    .sort((left, right) => compareAscendingString(left.createdAt, right.createdAt));

  if (realizedRows.length === 0) {
    return null;
  }

  let totalCostRaw = 0n;
  let totalPnlRaw = 0n;
  let winningRows = 0;
  let cumulativePnlRaw = 0n;
  let peakPnlRaw = 0n;
  let maxDrawdownRaw = 0n;

  for (const row of realizedRows) {
    const costRaw = BigInt(row.costRaw!);
    const pnlRaw = getRealizedPnlRaw(row);
    if (pnlRaw === null) {
      continue;
    }

    totalCostRaw += costRaw;
    totalPnlRaw += pnlRaw;
    if (pnlRaw > 0n) {
      winningRows += 1;
    }

    cumulativePnlRaw += pnlRaw;
    if (cumulativePnlRaw > peakPnlRaw) {
      peakPnlRaw = cumulativePnlRaw;
    }

    const drawdownRaw = peakPnlRaw - cumulativePnlRaw;
    if (drawdownRaw > maxDrawdownRaw) {
      maxDrawdownRaw = drawdownRaw;
    }
  }

  if (totalCostRaw <= 0n) {
    return null;
  }

  return {
    hitRatePct: winningRows / realizedRows.length,
    netPnlPct: toRatio(totalPnlRaw, totalCostRaw),
    maxDrawdownPct: toRatio(maxDrawdownRaw, totalCostRaw)
  };
}

function getRealizedPnlRaw(row: PerformanceLedgerRecord): bigint | null {
  if (isRawInteger(row.realizedPnlRaw)) {
    return BigInt(row.realizedPnlRaw);
  }

  if (!isRawInteger(row.proceedsRaw) || !isRawInteger(row.costRaw)) {
    return null;
  }

  return BigInt(row.proceedsRaw) - BigInt(row.costRaw);
}

function isRawInteger(value: string | null | undefined): value is string {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

function toRatio(numerator: bigint, denominator: bigint): number {
  return Number(numerator) / Number(denominator);
}
