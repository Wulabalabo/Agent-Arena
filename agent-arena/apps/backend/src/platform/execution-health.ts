import type {
  ExecutionHealthPhase,
  ExecutionRecord,
  ExecutionRetryableReason
} from "./types";

export interface ExecutionHealthSummary {
  executionId: string;
  status: ExecutionHealthPhase;
  ageMs: number;
  terminal: boolean;
  retryable: boolean;
  retryableReason: ExecutionRetryableReason;
  predictTxDigest: string | null;
  failureCode: string | null;
}

export function createExecutionHealth({
  execution,
  nowMs
}: {
  execution: ExecutionRecord;
  nowMs: number;
}): ExecutionHealthSummary {
  const status = executionHealthPhase(execution);
  const terminal = isTerminalExecutionPhase(status);
  const retryable = isRetryableExecutionRecord(execution, status);
  const retryableReason = executionRetryableReason(execution, status, retryable, terminal);

  return {
    executionId: execution.id,
    status,
    ageMs: Math.max(0, nowMs - Date.parse(executionAgeAnchor(execution))),
    terminal,
    retryable,
    retryableReason,
    predictTxDigest: execution.predictTxDigest,
    failureCode: execution.failureCode ?? null
  };
}

export function isRetryableExecutionPhase(status: ExecutionHealthPhase): boolean {
  return status === "queued" || status === "planned";
}

function executionHealthPhase(execution: ExecutionRecord): ExecutionHealthPhase {
  if (execution.failureCode === "FAILED_AFTER_CHAIN_CHECK") {
    return "failed_after_chain_check";
  }

  if (execution.plannedAt && execution.status === "queued") {
    return "planned";
  }

  return execution.status;
}

function isTerminalExecutionPhase(status: ExecutionHealthPhase): boolean {
  return status === "confirmed" ||
    status === "partial" ||
    status === "failed" ||
    status === "failed_after_chain_check";
}

function isRetryableExecutionRecord(execution: ExecutionRecord, status: ExecutionHealthPhase): boolean {
  if (!isRetryableExecutionPhase(status)) {
    return false;
  }

  return !execution.signedAt && !execution.submittedAt && !execution.predictTxDigest;
}

function executionRetryableReason(
  execution: ExecutionRecord,
  status: ExecutionHealthPhase,
  retryable: boolean,
  terminal: boolean
): ExecutionRetryableReason {
  if (retryable) {
    return "NO_SIGNING_ATTEMPT";
  }

  if (status === "submitted" || execution.predictTxDigest) {
    return "CHAIN_STATUS_REQUIRED";
  }

  return terminal ? "TERMINAL" : "NOT_RETRYABLE";
}

function executionAgeAnchor(execution: ExecutionRecord): string {
  return execution.submittedAt ??
    execution.signedAt ??
    execution.plannedAt ??
    execution.queuedAt ??
    execution.createdAt;
}
