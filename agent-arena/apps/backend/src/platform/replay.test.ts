import { describe, expect, it } from "bun:test";
import { buildReplayEvents } from "./replay";
import type { AgentIntent, ExecutionRecord, RiskDecision } from "./types";

describe("platform replay events", () => {
  it("returns intent, risk, and execution events in timeline order", () => {
    const intent: AgentIntent = {
      id: "intent_1",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      idempotencyKey: "intent-replay",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z",
      status: "executed",
      rejectionCode: null
    };
    const riskDecision: RiskDecision = {
      id: "risk_1",
      intentId: intent.id,
      accepted: true,
      rejectionCode: null,
      createdAt: "2026-06-15T10:03:13.000Z"
    };
    const execution: ExecutionRecord = {
      id: "exec_1",
      intentId: intent.id,
      agentId: intent.agentId,
      competitionId: intent.competitionId,
      riskDecisionId: riskDecision.id,
      status: "confirmed",
      predictTxDigest: "0xmock_exec_1",
      action: intent.action,
      createdAt: "2026-06-15T10:03:14.000Z"
    };

    const events = buildReplayEvents({
      agentId: intent.agentId,
      intents: [intent],
      riskDecisions: [riskDecision],
      executions: [execution]
    });

    expect(events.map((event) => event.label)).toEqual([
      "Intent submitted",
      "Risk accepted",
      "Predict transaction confirmed"
    ]);
    expect(events[2]).toMatchObject({
      copyValue: "0xmock_exec_1",
      txDigest: "0xmock_exec_1"
    });
  });

  it("labels failed Predict executions without calling them confirmed", () => {
    const intent: AgentIntent = {
      id: "intent_1",
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      idempotencyKey: "intent-replay-failed",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z",
      status: "failed",
      rejectionCode: "PREDICT_EXECUTION_FAILED"
    };
    const riskDecision: RiskDecision = {
      id: "risk_1",
      intentId: intent.id,
      accepted: true,
      rejectionCode: null,
      createdAt: "2026-06-15T10:03:13.000Z"
    };
    const execution: ExecutionRecord = {
      id: "exec_1",
      intentId: intent.id,
      agentId: intent.agentId,
      competitionId: intent.competitionId,
      riskDecisionId: riskDecision.id,
      status: "failed",
      predictTxDigest: "0xfailed_digest",
      action: intent.action,
      createdAt: "2026-06-15T10:03:14.000Z"
    };

    const events = buildReplayEvents({
      agentId: intent.agentId,
      intents: [intent],
      riskDecisions: [riskDecision],
      executions: [execution]
    });

    expect(events[2]).toMatchObject({
      label: "Predict transaction failed",
      summary: "DeepBook Predict transaction failed on Testnet.",
      txDigest: "0xfailed_digest"
    });
  });
});
