import type { AgentIntent, ExecutionRecord, ReplayEvent, RiskDecision } from "./types";

export function buildReplayEvents({
  agentId,
  intents,
  riskDecisions,
  executions
}: {
  agentId: string;
  intents: AgentIntent[];
  riskDecisions: RiskDecision[];
  executions: ExecutionRecord[];
}): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const riskByIntentId = new Map(riskDecisions.map((risk) => [risk.intentId, risk]));
  const executionsByIntentId = new Map(executions.map((execution) => [execution.intentId, execution]));

  for (const intent of intents.filter((item) => item.agentId === agentId)) {
    events.push({
      id: `replay_intent_${intent.id}`,
      timestamp: intent.createdAt,
      label: "Intent submitted",
      summary: `${intent.action} intent submitted by ${intent.agentId}.`,
      recordId: intent.id,
      copyValue: intent.id,
      txDigest: null
    });

    const risk = riskByIntentId.get(intent.id);
    if (risk) {
      events.push({
        id: `replay_risk_${risk.id}`,
        timestamp: risk.createdAt,
        label: risk.accepted ? "Risk accepted" : "Risk rejected",
        summary: risk.accepted
          ? "Arena policy accepted the intent."
          : `Arena policy rejected the intent: ${risk.rejectionCode}.`,
        recordId: risk.id,
        copyValue: risk.id,
        txDigest: null
      });
    }

    const execution = executionsByIntentId.get(intent.id);
    if (execution) {
      const details = executionReplayDetails(execution);
      events.push({
        id: `replay_execution_${execution.id}`,
        timestamp: execution.createdAt,
        label: details.label,
        summary: details.summary,
        recordId: execution.id,
        copyValue: execution.predictTxDigest,
        txDigest: execution.predictTxDigest
      });
    }
  }

  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function executionReplayDetails(execution: ExecutionRecord): { label: string; summary: string } {
  if (execution.status === "confirmed") {
    return {
      label: "Predict transaction confirmed",
      summary: "DeepBook Predict transaction confirmed on Testnet."
    };
  }

  if (execution.status === "failed") {
    return {
      label: "Predict transaction failed",
      summary: "DeepBook Predict transaction failed on Testnet."
    };
  }

  if (execution.status === "partial") {
    return {
      label: "Predict transaction partially executed",
      summary: "DeepBook Predict transaction partially executed on Testnet."
    };
  }

  return {
    label: "Predict transaction pending",
    summary: "DeepBook Predict transaction is pending on Testnet."
  };
}
