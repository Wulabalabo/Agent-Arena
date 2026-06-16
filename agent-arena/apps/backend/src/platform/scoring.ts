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
