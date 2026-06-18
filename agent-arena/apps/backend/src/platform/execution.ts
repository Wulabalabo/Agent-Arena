import type { PlatformMockStore } from "./mock-store";
import { createPerformanceLedgerRecord } from "./performance-ledger";
import { evaluateIntentRisk } from "./risk";
import type {
  AgentIntent,
  DirectionalMarket,
  ExecutionRecord,
  ExecutionStatus,
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
    budgetRaw?: string;
    quantity: string;
    maxCost: string;
  }
  | {
    operation: "mint_range";
    market: RangeMarket;
    budgetRaw?: string;
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
  actualCostRaw?: string | null;
  actualProceedsRaw?: string | null;
  errorCode?: string;
  errorMessage?: string;
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
  recordIntentLedger(store, draftIntent);

  const riskEvaluation = evaluateIntentRisk({
    intent: draftIntent,
    competition: store.getCompetition(draftIntent.competitionId),
    tradingWallet: store.getTradingWalletByAgentId(draftIntent.agentId),
    hasPendingExecution: hasPendingTradeExecution(store, draftIntent)
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
  recordRiskLedger(store, draftIntent, riskDecision);

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
  recordExecutionLedger(store, draftIntent, execution);
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
  const rejectionCode = intentStatus === "failed"
    ? result.errorCode ?? predictExecutionFailedCode
    : null;
  recordExecutionLedger(input.store, input.intent, execution, rejectionCode, {
    costRaw: result.actualCostRaw,
    proceedsRaw: result.actualProceedsRaw
  });
  recordRealizedPositionLedger(input.store, input.intent, execution, result);
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

function hasPendingTradeExecution(store: PlatformMockStore, intent: AgentIntent): boolean {
  if (intent.action === "hold") {
    return false;
  }

  return store.listExecutions().some((execution) => (
    execution.agentId === intent.agentId &&
    execution.competitionId === intent.competitionId &&
    execution.action !== "hold" &&
    isPendingExecutionStatus(execution.status)
  ));
}

function isPendingExecutionStatus(status: ExecutionStatus): boolean {
  return status === "queued" || status === "signed" || status === "submitted";
}

function recordIntentLedger(store: PlatformMockStore, intent: AgentIntent): void {
  const wallet = store.getTradingWalletByAgentId(intent.agentId);
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    ...createLedgerBase(store, intent, wallet),
    kind: "intent",
    riskDecisionId: null,
    executionId: null,
    txDigest: null,
    status: intent.status,
    errorCode: intent.rejectionCode,
    policyDrift: "none"
  }));
}

function recordRiskLedger(store: PlatformMockStore, intent: AgentIntent, riskDecision: RiskDecision): void {
  const wallet = store.getTradingWalletByAgentId(intent.agentId);
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    ...createLedgerBase(store, intent, wallet),
    kind: "risk",
    riskDecisionId: riskDecision.id,
    executionId: null,
    txDigest: null,
    status: riskDecision.accepted ? "accepted" : "rejected",
    errorCode: riskDecision.rejectionCode,
    policyDrift: "none"
  }));
}

function recordExecutionLedger(
  store: PlatformMockStore,
  intent: AgentIntent,
  execution: ExecutionRecord,
  errorCode?: string | null,
  financials: {
    costRaw?: string | null;
    proceedsRaw?: string | null;
  } = {}
): void {
  const wallet = store.getTradingWalletByAgentId(intent.agentId);
  const base = createLedgerBase(store, intent, wallet);
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    ...base,
    kind: "execution",
    riskDecisionId: execution.riskDecisionId,
    executionId: execution.id,
    txDigest: execution.predictTxDigest,
    status: execution.status,
    errorCode: execution.status === "failed" ? errorCode ?? predictExecutionFailedCode : null,
    costRaw: financials.costRaw === undefined ? base.costRaw : financials.costRaw,
    proceedsRaw: financials.proceedsRaw === undefined ? base.proceedsRaw : financials.proceedsRaw,
    policyDrift: "none"
  }));
}

function recordRealizedPositionLedger(
  store: PlatformMockStore,
  intent: AgentIntent,
  execution: ExecutionRecord,
  result: PredictIntentExecutionAdapterResult
): void {
  if (
    intent.action !== "close" ||
    (execution.status !== "confirmed" && execution.status !== "partial") ||
    !intent.positionRef?.openExecutionId ||
    !result.actualProceedsRaw
  ) {
    return;
  }

  const openExecution = findOpenExecutionLedgerRow(store, intent.agentId, intent.positionRef.openExecutionId);
  if (!openExecution?.costRaw || !isRawInteger(openExecution.costRaw) || !isRawInteger(result.actualProceedsRaw)) {
    return;
  }

  const wallet = store.getTradingWalletByAgentId(intent.agentId);
  const base = createLedgerBase(store, intent, wallet);
  store.recordPerformanceLedger(createPerformanceLedgerRecord({
    ...base,
    kind: "position",
    riskDecisionId: execution.riskDecisionId,
    executionId: execution.id,
    txDigest: execution.predictTxDigest,
    positionKind: intent.positionRef.kind,
    quantityRaw: intent.quantity ?? intent.positionRef.quantity ?? openExecution.quantityRaw,
    costRaw: openExecution.costRaw,
    proceedsRaw: result.actualProceedsRaw,
    realizedPnlRaw: subtractRawAmounts(result.actualProceedsRaw, openExecution.costRaw),
    status: "realized",
    errorCode: null,
    policyDrift: "none"
  }));
}

function findOpenExecutionLedgerRow(store: PlatformMockStore, agentId: string, executionId: string) {
  return store.listPerformanceLedger({ agentId }).find((row) => (
    row.kind === "execution" &&
    row.executionId === executionId &&
    row.status === "confirmed"
  ));
}

function createLedgerBase(
  store: PlatformMockStore,
  intent: AgentIntent,
  wallet: ReturnType<PlatformMockStore["getTradingWalletByAgentId"]>
) {
  const binding = store.getIdentityBindingByAgentId(intent.agentId);
  const agent = store.getAgent(intent.agentId);
  const market = intent.market;
  const positionKind = market?.kind ?? intent.positionRef?.kind ?? null;

  return {
    agentDraftId: binding?.agentDraftId ?? null,
    registrationCodeHash: binding?.registrationCodeHash ?? null,
    agentId: intent.agentId,
    ownerAddress: binding?.ownerAddress ?? agent?.ownerAddress ?? null,
    tradingWalletId: wallet?.id ?? binding?.tradingWalletId ?? null,
    walletAddress: wallet?.address ?? binding?.walletAddress ?? null,
    predictManagerId: wallet?.predictManagerId ?? binding?.predictManagerId ?? null,
    competitionId: intent.competitionId,
    oracleId: market?.oracleId ?? null,
    expiryMs: market?.expiry ?? null,
    intentId: intent.id,
    action: intent.action,
    positionKind,
    quantityRaw: intent.quantity ?? intent.positionRef?.quantity ?? null,
    costRaw: intent.maxCost ?? null,
    proceedsRaw: intent.minProceeds ?? null,
    createdAt: intent.createdAt,
    serverReceivedAt: intent.createdAt
  };
}

function predictPayloadForIntent(intent: AgentIntent): PredictIntentExecutionPayload {
  if (intent.action === "open_directional") {
    if (intent.market?.kind !== "directional" || !intent.quantity || !intent.maxCost) {
      throw new PlatformExecutionError("PREDICT_PAYLOAD_INVALID:open_directional");
    }

    return {
      operation: "mint_directional",
      market: intent.market,
      ...(intent.budgetRaw ? { budgetRaw: intent.budgetRaw } : {}),
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
      ...(intent.budgetRaw ? { budgetRaw: intent.budgetRaw } : {}),
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
    budgetRaw: payload.budgetRaw,
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
    budgetRaw: intent.budgetRaw,
    quantity: intent.quantity,
    maxCost: intent.maxCost,
    minProceeds: intent.minProceeds,
    confidence: intent.confidence,
    reason: intent.reason,
    createdAt: intent.createdAt
  });
}

function isRawInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

function subtractRawAmounts(left: string, right: string): string {
  return (BigInt(left) - BigInt(right)).toString();
}
