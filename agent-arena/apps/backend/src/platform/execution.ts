import type { PlatformMockStore } from "./mock-store";
import { evaluateIntentRisk } from "./risk";
import type {
  AgentIntent,
  DirectionalMarket,
  ExecutionRecord,
  IntentStatus,
  PositionRef,
  RangeMarket,
  RiskDecision
} from "./types";
import { type ValidatedIntentPayload, validateIntentPayload } from "./validation";

export interface MockExecutionResponse {
  status: IntentStatus;
  intentId: string;
  riskDecisionId: string;
  executionId?: string;
  predictTxDigest?: string;
  rejectionCode?: string;
}

export interface PredictIntentExecutionAdapterInput {
  intentId: string;
  riskDecisionId: string;
  executionId: string;
  agentId: string;
  walletId: string;
  predictOperation: PredictIntentExecutionPayload["operation"];
  predictPayload: PredictIntentExecutionPayload;
}

export type PredictIntentExecutionPayload =
  | {
    operation: "mint_directional";
    market: DirectionalMarket;
    quantity: string;
    maxCost: string;
  }
  | {
    operation: "mint_range";
    market: RangeMarket;
    quantity: string;
    maxCost: string;
  }
  | {
    operation: "redeem_directional" | "redeem_range";
    positionRef: PositionRef;
    quantity: string;
    minProceeds?: string;
  }
  | {
    operation: "close_directional" | "close_range";
    positionRef: PositionRef;
    minProceeds?: string;
  };

export interface PredictIntentExecutionAdapterResult {
  status: ExecutionRecord["status"];
  predictTxDigest?: string | null;
}

export interface SubmitIntentExecutionOptions {
  predictExecutionAdapter?: (
    input: PredictIntentExecutionAdapterInput
  ) => PredictIntentExecutionAdapterResult | Promise<PredictIntentExecutionAdapterResult>;
}

const predictExecutionFailedCode = "PREDICT_EXECUTION_FAILED";

export class PlatformExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformExecutionError";
  }
}

export function submitIntentWithMockExecution(
  store: PlatformMockStore,
  payload: unknown
): MockExecutionResponse;
export function submitIntentWithMockExecution(
  store: PlatformMockStore,
  payload: unknown,
  options: Required<Pick<SubmitIntentExecutionOptions, "predictExecutionAdapter">>
): Promise<MockExecutionResponse>;
export function submitIntentWithMockExecution(
  store: PlatformMockStore,
  payload: unknown,
  options: SubmitIntentExecutionOptions = {}
): MockExecutionResponse | Promise<MockExecutionResponse> {
  const validated = validateIntentPayload(payload);
  const existingIntent = store.findIntentByIdempotencyKey(
    validated.agentId,
    validated.competitionId,
    validated.idempotencyKey
  );

  if (existingIntent) {
    const replayIntent = createIntent(existingIntent.id, validated, existingIntent.status, existingIntent.rejectionCode);
    if (!hasSameIntentInput(existingIntent, replayIntent)) {
      throw new PlatformExecutionError("IDEMPOTENCY_CONFLICT");
    }

    return createStoredResponse(store, existingIntent);
  }

  const intentId = `intent_${store.listIntents().length + 1}`;
  const draftIntent = createIntent(intentId, validated, "accepted", null);
  store.saveIntent(draftIntent);

  const riskEvaluation = evaluateIntentRisk({
    intent: draftIntent,
    competition: store.getCompetition(draftIntent.competitionId),
    tradingWallet: store.getTradingWalletByAgentId(draftIntent.agentId)
  });

  const riskDecisionId = `risk_${store.listRiskDecisions().length + 1}`;
  const riskDecision: RiskDecision = {
    id: riskDecisionId,
    intentId,
    accepted: riskEvaluation.accepted,
    rejectionCode: riskEvaluation.rejectionCode,
    createdAt: draftIntent.createdAt
  };

  store.saveRiskDecision(riskDecision);

  if (!riskEvaluation.accepted) {
    const rejectedIntent = createIntent(intentId, validated, "rejected", riskEvaluation.rejectionCode);
    store.saveIntent(rejectedIntent);

    return {
      status: "rejected",
      intentId,
      riskDecisionId,
      rejectionCode: riskEvaluation.rejectionCode ?? undefined
    };
  }

  if (draftIntent.action === "hold") {
    return {
      status: "accepted",
      intentId,
      riskDecisionId
    };
  }

  const executionId = `exec_${store.listExecutions().length + 1}`;
  if (options.predictExecutionAdapter) {
    return executeWithPredictAdapter({
      store,
      intent: draftIntent,
      riskDecisionId,
      executionId,
      predictExecutionAdapter: options.predictExecutionAdapter
    });
  }

  const execution = createMockExecution(executionId, draftIntent, riskDecisionId);
  store.saveExecution(execution);
  const executedIntent = createIntent(intentId, validated, "executed", null);
  store.saveIntent(executedIntent);

  return {
    status: "executed",
    intentId,
    riskDecisionId,
    executionId,
    predictTxDigest: execution.predictTxDigest ?? undefined
  };
}

async function executeWithPredictAdapter(input: {
  store: PlatformMockStore;
  intent: AgentIntent;
  riskDecisionId: string;
  executionId: string;
  predictExecutionAdapter: NonNullable<SubmitIntentExecutionOptions["predictExecutionAdapter"]>;
}): Promise<MockExecutionResponse> {
  const wallet = input.store.getTradingWalletByAgentId(input.intent.agentId);
  if (!wallet) {
    throw new PlatformExecutionError("WALLET_NOT_BOUND");
  }

  const queuedExecution: ExecutionRecord = {
    id: input.executionId,
    intentId: input.intent.id,
    agentId: input.intent.agentId,
    competitionId: input.intent.competitionId,
    riskDecisionId: input.riskDecisionId,
    status: "queued",
    predictTxDigest: null,
    action: input.intent.action,
    createdAt: input.intent.createdAt
  };
  input.store.saveExecution(queuedExecution);

  const predictPayload = predictPayloadForIntent(input.intent);
  const result = await callPredictExecutionAdapter({
    predictExecutionAdapter: input.predictExecutionAdapter,
    adapterInput: {
      intentId: input.intent.id,
      riskDecisionId: input.riskDecisionId,
      executionId: input.executionId,
      agentId: input.intent.agentId,
      walletId: wallet.id,
      predictOperation: predictPayload.operation,
      predictPayload
    }
  });

  const execution: ExecutionRecord = {
    ...queuedExecution,
    status: result.status,
    predictTxDigest: result.predictTxDigest ?? null
  };
  input.store.saveExecution(execution);

  const intentStatus = intentStatusForExecutionStatus(result.status);
  const rejectionCode = intentStatus === "failed" ? predictExecutionFailedCode : null;
  input.store.saveIntent({
    ...input.intent,
    status: intentStatus,
    rejectionCode
  });

  return {
    status: intentStatus,
    intentId: input.intent.id,
    riskDecisionId: input.riskDecisionId,
    executionId: input.executionId,
    predictTxDigest: execution.predictTxDigest ?? undefined,
    rejectionCode: rejectionCode ?? undefined
  };
}

async function callPredictExecutionAdapter(input: {
  predictExecutionAdapter: NonNullable<SubmitIntentExecutionOptions["predictExecutionAdapter"]>;
  adapterInput: PredictIntentExecutionAdapterInput;
}): Promise<PredictIntentExecutionAdapterResult> {
  try {
    return await input.predictExecutionAdapter(input.adapterInput);
  } catch {
    return {
      status: "failed",
      predictTxDigest: null
    };
  }
}

function intentStatusForExecutionStatus(status: ExecutionRecord["status"]): IntentStatus {
  if (status === "confirmed") {
    return "executed";
  }

  if (status === "partial") {
    return "partial";
  }

  if (status === "failed") {
    return "failed";
  }

  return "accepted";
}

function predictPayloadForIntent(intent: AgentIntent): PredictIntentExecutionPayload {
  if (intent.action === "open_directional") {
    if (intent.market?.kind !== "directional" || !intent.quantity || !intent.maxCost) {
      throw new PlatformExecutionError("PREDICT_PAYLOAD_INVALID:open_directional");
    }

    return {
      operation: "mint_directional",
      market: intent.market,
      quantity: intent.quantity,
      maxCost: intent.maxCost
    };
  }

  if (intent.action === "open_range") {
    if (intent.market?.kind !== "range" || !intent.quantity || !intent.maxCost) {
      throw new PlatformExecutionError("PREDICT_PAYLOAD_INVALID:open_range");
    }

    return {
      operation: "mint_range",
      market: intent.market,
      quantity: intent.quantity,
      maxCost: intent.maxCost
    };
  }

  if (intent.action === "reduce") {
    if (!intent.positionRef || !intent.quantity) {
      throw new PlatformExecutionError("PREDICT_PAYLOAD_INVALID:reduce");
    }

    return {
      operation: intent.positionRef.kind === "range" ? "redeem_range" : "redeem_directional",
      positionRef: intent.positionRef,
      quantity: intent.quantity,
      ...(intent.minProceeds ? { minProceeds: intent.minProceeds } : {})
    };
  }

  if (intent.action === "close") {
    if (!intent.positionRef) {
      throw new PlatformExecutionError("PREDICT_PAYLOAD_INVALID:close");
    }

    return {
      operation: intent.positionRef.kind === "range" ? "close_range" : "close_directional",
      positionRef: intent.positionRef,
      ...(intent.minProceeds ? { minProceeds: intent.minProceeds } : {})
    };
  }

  throw new PlatformExecutionError(`PREDICT_OPERATION_UNSUPPORTED:${intent.action}`);
}

function createIntent(
  id: string,
  payload: ValidatedIntentPayload,
  status: IntentStatus,
  rejectionCode: string | null
): AgentIntent {
  return {
    id,
    competitionId: payload.competitionId,
    agentId: payload.agentId,
    idempotencyKey: payload.idempotencyKey,
    action: payload.action,
    market: payload.market,
    positionRef: payload.positionRef,
    quantity: payload.quantity,
    maxCost: payload.maxCost,
    minProceeds: payload.minProceeds,
    confidence: payload.confidence,
    reason: payload.reason,
    createdAt: payload.createdAt,
    status,
    rejectionCode
  };
}

function createMockExecution(
  id: string,
  intent: AgentIntent,
  riskDecisionId: string
): ExecutionRecord {
  return {
    id,
    intentId: intent.id,
    agentId: intent.agentId,
    competitionId: intent.competitionId,
    riskDecisionId,
    status: "confirmed",
    predictTxDigest: `0xmock_${id}`,
    action: intent.action,
    createdAt: intent.createdAt
  };
}

function createStoredResponse(store: PlatformMockStore, intent: AgentIntent): MockExecutionResponse {
  const riskDecision = store.findRiskDecisionByIntentId(intent.id);
  if (!riskDecision) {
    throw new PlatformExecutionError("MISSING_RISK_DECISION");
  }

  if (intent.status === "rejected") {
    return {
      status: "rejected",
      intentId: intent.id,
      riskDecisionId: riskDecision.id,
      rejectionCode: intent.rejectionCode ?? riskDecision.rejectionCode ?? undefined
    };
  }

  const execution = store.findExecutionByIntentId(intent.id);

  if (intent.status === "accepted") {
    return {
      status: "accepted",
      intentId: intent.id,
      riskDecisionId: riskDecision.id,
      executionId: execution?.id,
      predictTxDigest: execution?.predictTxDigest ?? undefined
    };
  }

  if (!execution) {
    throw new PlatformExecutionError("MISSING_EXECUTION");
  }

  return {
    status: intent.status,
    intentId: intent.id,
    riskDecisionId: riskDecision.id,
    executionId: execution.id,
    predictTxDigest: execution.predictTxDigest ?? undefined,
    rejectionCode: intent.status === "failed" ? intent.rejectionCode ?? predictExecutionFailedCode : undefined
  };
}

function hasSameIntentInput(left: AgentIntent, right: AgentIntent): boolean {
  return serializeIntentInput(left) === serializeIntentInput(right);
}

function serializeIntentInput(intent: AgentIntent): string {
  return JSON.stringify({
    competitionId: intent.competitionId,
    agentId: intent.agentId,
    idempotencyKey: intent.idempotencyKey,
    action: intent.action,
    market: intent.market,
    positionRef: intent.positionRef,
    quantity: intent.quantity,
    maxCost: intent.maxCost,
    minProceeds: intent.minProceeds,
    confidence: intent.confidence,
    reason: intent.reason,
    createdAt: intent.createdAt
  });
}
