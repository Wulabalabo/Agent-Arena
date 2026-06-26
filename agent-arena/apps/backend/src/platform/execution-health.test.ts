import { describe, expect, it } from "bun:test";
import { createExecutionHealth, isRetryableExecutionPhase } from "./execution-health";
import type { ExecutionRecord } from "./types";

const baseExecution: ExecutionRecord = {
  id: "exec_1",
  intentId: "intent_1",
  agentId: "agent_1",
  competitionId: "btc-15m-001",
  riskDecisionId: "risk_1",
  status: "queued",
  predictTxDigest: null,
  action: "open_directional",
  createdAt: "2026-06-25T00:00:00.000Z"
};

describe("execution health", () => {
  it("marks queued executions retryable when no signing attempt exists", () => {
    const health = createExecutionHealth({
      execution: {
        ...baseExecution,
        queuedAt: "2026-06-25T00:00:00.000Z"
      },
      nowMs: Date.parse("2026-06-25T00:00:22.000Z")
    });

    expect(health).toMatchObject({
      executionId: "exec_1",
      status: "queued",
      ageMs: 22000,
      terminal: false,
      retryable: true,
      retryableReason: "NO_SIGNING_ATTEMPT"
    });
  });

  it("marks submitted executions non-retryable until chain status is inspected", () => {
    const health = createExecutionHealth({
      execution: {
        ...baseExecution,
        status: "submitted",
        submittedAt: "2026-06-25T00:00:03.000Z",
        predictTxDigest: "0xdigest"
      },
      nowMs: Date.parse("2026-06-25T00:00:25.000Z")
    });

    expect(health).toMatchObject({
      status: "submitted",
      ageMs: 22000,
      terminal: false,
      retryable: false,
      retryableReason: "CHAIN_STATUS_REQUIRED",
      predictTxDigest: "0xdigest"
    });
  });

  it("marks confirmed executions with a digest terminal instead of chain-status-required", () => {
    const health = createExecutionHealth({
      execution: {
        ...baseExecution,
        status: "confirmed",
        submittedAt: "2026-06-25T00:00:03.000Z",
        confirmedAt: "2026-06-25T00:00:08.000Z",
        predictTxDigest: "0xconfirmed"
      },
      nowMs: Date.parse("2026-06-25T00:00:25.000Z")
    });

    expect(health).toMatchObject({
      status: "confirmed",
      terminal: true,
      retryable: false,
      retryableReason: "TERMINAL",
      predictTxDigest: "0xconfirmed"
    });
  });

  it("marks failed executions without a digest terminal and non-retryable", () => {
    const health = createExecutionHealth({
      execution: {
        ...baseExecution,
        status: "failed",
        failedAt: "2026-06-25T00:00:05.000Z",
        predictTxDigest: null,
        failureCode: "PREDICT_EXECUTION_FAILED"
      },
      nowMs: Date.parse("2026-06-25T00:00:25.000Z")
    });

    expect(health).toMatchObject({
      status: "failed",
      terminal: true,
      retryable: false,
      retryableReason: "TERMINAL",
      predictTxDigest: null,
      failureCode: "PREDICT_EXECUTION_FAILED"
    });
  });

  it("treats confirmed, partial, and failed-after-chain-check as terminal", () => {
    expect(isRetryableExecutionPhase("confirmed")).toBe(false);
    expect(isRetryableExecutionPhase("partial")).toBe(false);
    expect(isRetryableExecutionPhase("failed_after_chain_check")).toBe(false);
  });
});
