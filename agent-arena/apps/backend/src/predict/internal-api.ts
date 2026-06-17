import {
  createMemoryExecutionStore,
  type MemoryExecutionStore
} from "./execution-store";
import { createPredictConfig } from "./config";
import { PredictGuardrailError, assertRawIntegerString, evaluatePreSubmitGuardrails } from "./guardrails";
import { assertInternalRequest } from "./internal-auth";
import { type DiscoveredPredictManager, PredictManagerError, planManagerSetup } from "./manager";
import type { PredictSetupExecutor } from "./setup-executor";
import {
  buildPredictOperationPlan,
  type BuildPredictOperationPlanInput,
  type PredictOperation,
  type PredictOperationPlan
} from "./transactions";
import type { CoinBalanceReader, InternalTradingWallet } from "./types";
import { createMemoryWalletStore, type MemoryWalletStore } from "./wallet-store";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-agent-arena-internal-token"
};

interface InternalPredictHandlerOptions {
  internalToken?: string;
  walletStore?: MemoryWalletStore;
  executionStore?: MemoryExecutionStore;
  balanceReader?: CoinBalanceReader;
  quoteAssetType?: string;
  resolveManager?: (wallet: InternalTradingWallet) => Promise<DiscoveredPredictManager | null>;
  setupExecutor?: PredictSetupExecutor;
  enablePredictSubmit?: boolean;
  env?: Record<string, string | undefined>;
}

export function createInternalPredictFetchHandler({
  internalToken,
  walletStore,
  executionStore = createMemoryExecutionStore(),
  balanceReader,
  quoteAssetType,
  resolveManager,
  setupExecutor,
  enablePredictSubmit,
  env
}: InternalPredictHandlerOptions) {
  let resolvedWalletStore = walletStore;
  let resolvedQuoteAssetType = quoteAssetType;
  let resolvedEnablePredictSubmit = enablePredictSubmit;

  return async function handleInternalPredictRequest(request: Request): Promise<Response> {
    try {
      assertInternalRequest(request, internalToken);
      if (request.method === "OPTIONS") {
        return emptyResponse(204);
      }

      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname === "/api/arena/internal/wallets" && request.method === "POST") {
        const resolved = getWalletStore();
        return await handleCreateWallet(request, resolved.walletStore, resolved.quoteAssetType);
      }

      const balanceMatch = pathname.match(/^\/api\/arena\/internal\/wallets\/([^/]+)\/balances$/);
      if (balanceMatch && request.method === "GET") {
        return await handleGetBalances(balanceMatch[1]!, getWalletStore().walletStore);
      }

      if (pathname === "/api/arena/internal/predict/setup" && request.method === "POST") {
        const resolved = getWalletStore();
        return await handleSetup(
          request,
          resolved.walletStore,
          resolveManager,
          setupExecutor,
          resolved.enablePredictSubmit
        );
      }

      if (pathname === "/api/arena/internal/predict/preview" && request.method === "POST") {
        const resolved = getWalletStore();
        return await handlePreview(request, resolved.walletStore, resolved.quoteAssetType);
      }

      if (pathname === "/api/arena/internal/predict/execute" && request.method === "POST") {
        return await handleExecute(request, getWalletStore().walletStore, executionStore);
      }

      if (pathname === "/api/arena/internal/predict/executions" && request.method === "GET") {
        return jsonResponse({
          executions: await executionStore.listExecutions({
            walletId: url.searchParams.get("walletId") ?? undefined
          })
        });
      }

      return errorResponse(501, "NOT_IMPLEMENTED", "Internal Predict API endpoints are not implemented yet");
    } catch (error) {
      return internalErrorToResponse(error);
    }
  };

  function getWalletStore(): {
    walletStore: MemoryWalletStore;
    quoteAssetType: string;
    enablePredictSubmit: boolean;
  } {
    if (resolvedWalletStore) {
      if (!resolvedQuoteAssetType) {
        throw new InternalApiError(
          503,
          "PREDICT_CONFIG_REQUIRED",
          "Predict quote asset type is required for injected internal wallet stores"
        );
      }

      return {
        walletStore: resolvedWalletStore,
        quoteAssetType: resolvedQuoteAssetType,
        enablePredictSubmit: resolvedEnablePredictSubmit === true
      };
    }

    try {
      const config = createPredictConfig(env);
      resolvedQuoteAssetType = config.quoteAssetType;
      resolvedEnablePredictSubmit = config.enablePredictSubmit;
      resolvedWalletStore = createMemoryWalletStore({
        walletSecret: config.walletSecret,
        balanceReader,
        quoteAssetType: config.quoteAssetType
      });

      return {
        walletStore: resolvedWalletStore,
        quoteAssetType: resolvedQuoteAssetType,
        enablePredictSubmit: resolvedEnablePredictSubmit === true
      };
    } catch (error) {
      const suffix = error instanceof Error ? `: ${error.message}` : "";
      throw new InternalApiError(
        503,
        "PREDICT_CONFIG_REQUIRED",
        `Predict config is required before creating an internal wallet store${suffix}`
      );
    }
  }
}

async function handleCreateWallet(
  request: Request,
  walletStore: MemoryWalletStore,
  quoteAssetType: string
): Promise<Response> {
  const body = await parseJsonBody(request);
  const wallet = await walletStore.createWallet({
    agentId: requiredString(body, "agentId"),
    bindingMode: requiredBindingMode(body),
    label: optionalString(body, "label")
  });

  return jsonResponse({
    wallet,
    funding: fundingInstructions(quoteAssetType)
  }, 201);
}

async function handleGetBalances(
  walletId: string,
  walletStore: MemoryWalletStore
): Promise<Response> {
  const balances = await walletStore.getBalances(decodeURIComponent(walletId));

  return jsonResponse({
    walletId: balances.walletId,
    address: balances.address,
    balances: {
      suiMist: balances.suiBalanceRaw,
      sui: formatRawUnits(balances.suiBalanceRaw, 9),
      dusdcRaw: balances.dusdcBalanceRaw,
      dusdc: formatRawUnits(balances.dusdcBalanceRaw, 6)
    },
    fundingStatus: rawPositive(balances.suiBalanceRaw) && rawPositive(balances.dusdcBalanceRaw)
      ? "funded"
      : "funding_required",
    quoteAssetType: balances.quoteAssetType
  });
}

async function handleSetup(
  request: Request,
  walletStore: MemoryWalletStore,
  resolveManager: ((wallet: InternalTradingWallet) => Promise<DiscoveredPredictManager | null>) | undefined,
  setupExecutor: PredictSetupExecutor | undefined,
  enablePredictSubmit: boolean
): Promise<Response> {
  const body = await parseJsonBody(request);
  const wallet = await loadWallet(walletStore, requiredString(body, "walletId"));
  const manager = resolveManager ? await resolveManager(wallet) : null;
  const dryRunOnly = body.dryRunOnly === true;
  const setupPlan = planManagerSetup({
    manager,
    dryRunOnly,
    depositDusdcRaw: optionalRawString(body, "depositDusdcRaw")
  });
  const baseResponse = buildSetupBaseResponse(wallet, manager, setupPlan);

  if (setupPlan.createManager === "dry_run_only") {
    const transactions = setupExecutor?.dryRunCreateManager
      ? [await setupExecutor.dryRunCreateManager({ wallet })]
      : [];

    return jsonResponse({
      ...baseResponse,
      transactions
    });
  }

  if (setupPlan.createManager === "submit_required") {
    if (!enablePredictSubmit) {
      return errorResponseWithDetails(
        501,
        "PREDICT_SUBMIT_DISABLED",
        "Real Predict setup submit is disabled. Set AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true and pass an explicit submit request.",
        baseResponse
      );
    }

    if (!setupExecutor?.submitCreateManager) {
      throw new InternalApiError(
        503,
        "PREDICT_SETUP_EXECUTOR_REQUIRED",
        "Predict setup executor is required before submitting create_manager"
      );
    }

    const transaction = await setupExecutor.submitCreateManager({ wallet });
    if (!transaction.managerId) {
      throw new InternalApiError(
        502,
        "PREDICT_MANAGER_ID_MISSING",
        "Predict create_manager submitted but the manager id was not returned"
      );
    }
    const transactions = [transaction];
    let depositStatus = "not_requested";

    if (setupPlan.depositDusdcRaw && BigInt(setupPlan.depositDusdcRaw) > 0n) {
      if (!setupExecutor.submitDeposit) {
        throw new InternalApiError(
          503,
          "PREDICT_SETUP_EXECUTOR_REQUIRED",
          "Predict setup executor is required before submitting deposit"
        );
      }

      transactions.push(await setupExecutor.submitDeposit({
        wallet,
        managerId: transaction.managerId,
        amountRaw: setupPlan.depositDusdcRaw
      }));
      depositStatus = "submitted";
    }

    return jsonResponse({
      ...baseResponse,
      manager: {
        id: transaction.managerId,
        status: "ready",
        source: "submitted"
      },
      setupPhases: {
        ...baseResponse.setupPhases,
        createManager: "submitted",
        depositStatus,
        ...(depositStatus === "submitted" ? {} : { depositBlockedReason: undefined })
      },
      transactions
    });
  }

  if (setupPlan.depositStatus === "ready_to_dry_run" && setupPlan.managerId && setupPlan.depositDusdcRaw) {
    if (dryRunOnly) {
      const transactions = setupExecutor?.dryRunDeposit
        ? [await setupExecutor.dryRunDeposit({
          wallet,
          managerId: setupPlan.managerId,
          amountRaw: setupPlan.depositDusdcRaw
        })]
        : [];

      return jsonResponse({
        ...baseResponse,
        transactions
      });
    }

    if (!enablePredictSubmit) {
      return errorResponseWithDetails(
        501,
        "PREDICT_SUBMIT_DISABLED",
        "Real Predict setup submit is disabled. Set AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true and pass an explicit submit request.",
        baseResponse
      );
    }

    if (!setupExecutor?.submitDeposit) {
      throw new InternalApiError(
        503,
        "PREDICT_SETUP_EXECUTOR_REQUIRED",
        "Predict setup executor is required before submitting deposit"
      );
    }

    const transaction = await setupExecutor.submitDeposit({
      wallet,
      managerId: setupPlan.managerId,
      amountRaw: setupPlan.depositDusdcRaw
    });

    return jsonResponse({
      ...baseResponse,
      setupPhases: {
        ...baseResponse.setupPhases,
        depositStatus: "submitted"
      },
      transactions: [transaction]
    });
  }

  return jsonResponse({
    ...baseResponse,
    transactions: []
  });
}

async function handlePreview(
  request: Request,
  walletStore: MemoryWalletStore,
  quoteAssetType: string
): Promise<Response> {
  const body = await parseJsonBody(request);
  const wallet = await loadWallet(walletStore, requiredString(body, "walletId"));
  const requestedOperation = requiredOperation(body);
  const previewOperation = previewOperationFor(requestedOperation);
  const operationPlan = buildPlanFromRequest(body, previewOperation);
  const hasRequestEstimate = body.estimatedCostRaw !== undefined || body.estimatedProceedsRaw !== undefined;
  const estimatedCostRaw = optionalRawEstimate(body, "estimatedCostRaw") ?? "0";
  const estimatedProceedsRaw = optionalRawEstimate(body, "estimatedProceedsRaw") ?? "0";

  assertRawIntegerString(estimatedCostRaw, "estimatedCostRaw");
  assertRawIntegerString(estimatedProceedsRaw, "estimatedProceedsRaw");

  return jsonResponse({
    walletId: wallet.id,
    address: wallet.address,
    operation: requestedOperation,
    operationPlan,
    quoteAsset: {
      symbol: "DUSDC",
      type: quoteAssetType,
      decimals: 6
    },
    quote: {
      previewSource: hasRequestEstimate ? "request_estimate" : "mock_internal",
      estimatedCostRaw,
      estimatedCost: formatRawUnits(estimatedCostRaw, 6),
      estimatedProceedsRaw,
      estimatedProceeds: formatRawUnits(estimatedProceedsRaw, 6),
      costRaw: estimatedCostRaw,
      cost: formatRawUnits(estimatedCostRaw, 6),
      payoutRaw: estimatedProceedsRaw,
      payout: formatRawUnits(estimatedProceedsRaw, 6)
    }
  });
}

function buildSetupBaseResponse(
  wallet: InternalTradingWallet,
  manager: DiscoveredPredictManager | null,
  setupPlan: {
    createManager: string;
    depositStatus: string;
    managerId?: string;
    depositDusdcRaw?: string;
  }
): {
  walletId: string;
  address: string;
  manager: { id?: string; status: string; source?: string };
  setupPhases: Record<string, string>;
  depositDusdcRaw?: string;
} {
  return {
    walletId: wallet.id,
    address: wallet.address,
    manager: manager
      ? {
        id: manager.managerId,
        status: "ready",
        source: manager.source
      }
      : {
        status: "missing"
      },
    setupPhases: {
      managerDiscovery: manager ? manager.source : "missing",
      createManager: setupPlan.createManager,
      depositStatus: setupPlan.depositStatus,
      ...(setupPlan.depositStatus === "blocked_until_manager_exists"
        ? { depositBlockedReason: "manager_object_required_before_deposit_dry_run" }
        : {})
    },
    depositDusdcRaw: setupPlan.depositDusdcRaw
  };
}

async function handleExecute(
  request: Request,
  walletStore: MemoryWalletStore,
  executionStore: MemoryExecutionStore
): Promise<Response> {
  const body = await parseJsonBody(request);
  const wallet = await loadWallet(walletStore, requiredString(body, "walletId"));
  const operation = requiredOperation(body);
  const operationPlan = buildPlanFromRequest(body, operation);
  const execution = await executionStore.createExecution({
    walletId: wallet.id,
    agentId: wallet.agentId,
    operation,
    status: "planned",
    operationPlan,
    managerId: optionalString(body, "managerId"),
    oracleId: optionalString(body, "oracleId"),
    expiryMs: operationPlan.expiryMs,
    quantityRaw: operationPlan.quantityRaw,
    previewCostRaw: optionalRawString(body, "estimatedCostRaw"),
    previewPayoutRaw: optionalRawString(body, "estimatedProceedsRaw"),
    maxCostRaw: operationPlan.maxCostRaw,
    minProceedsRaw: operationPlan.minProceedsRaw
  });

  try {
    evaluateGuardrailsWhenEstimated(body, operation);
  } catch (error) {
    if (error instanceof PredictGuardrailError) {
      const failedExecution = await executionStore.updateExecution(execution.id, {
        status: "failed",
        errorCode: error.code,
        errorMessage: error.message
      });
      await executionStore.recordSigningAudit({
        walletId: wallet.id,
        agentId: wallet.agentId,
        executionId: execution.id,
        operation,
        transactionKind: "pre_submit_guardrail",
        status: "failed",
        errorCode: error.code
      });

      return errorResponseWithDetails(
        error.code === "INVALID_RAW_AMOUNT" ? 400 : 409,
        error.code,
        error.message,
        { execution: failedExecution }
      );
    }
    throw error;
  }

  const disabledExecution = await executionStore.updateExecution(execution.id, {
    status: "failed",
    errorCode: "PREDICT_SUBMIT_DISABLED",
    errorMessage: "Real Predict submit is disabled for Task 7."
  });
  await executionStore.recordSigningAudit({
    walletId: wallet.id,
    agentId: wallet.agentId,
    executionId: execution.id,
    operation,
    transactionKind: "predict_submit_disabled",
    status: "failed",
    errorCode: "PREDICT_SUBMIT_DISABLED"
  });

  return errorResponseWithDetails(
    501,
    "PREDICT_SUBMIT_DISABLED",
    "Real Predict submit is disabled for Task 7.",
    { execution: disabledExecution }
  );
}

function internalErrorToResponse(error: unknown): Response {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
  }

  if (error instanceof Error && error.message === "INTERNAL_API_DISABLED") {
    return errorResponse(503, "INTERNAL_API_DISABLED", "Internal API is disabled");
  }

  if (error instanceof PredictGuardrailError) {
    const status = error.code === "INVALID_RAW_AMOUNT" ? 400 : 409;
    return errorResponse(status, error.code, error.message);
  }

  if (error instanceof PredictManagerError) {
    return errorResponse(400, error.code, error.message);
  }

  if (error instanceof InternalApiError) {
    return errorResponse(error.status, error.code, error.message);
  }

  if (error instanceof Error) {
    const planErrorCode = predictPlanErrorCode(error);
    if (planErrorCode) {
      return errorResponse(400, planErrorCode, error.message);
    }

    switch (error.message) {
      case "WALLET_NOT_FOUND":
        return errorResponse(404, "WALLET_NOT_FOUND", "Wallet not found");
      case "BALANCE_READER_NOT_CONFIGURED":
        return errorResponse(503, "BALANCE_READER_NOT_CONFIGURED", "Wallet balance reader is not configured");
      case "CLAIMED_AGENT_BINDING_NOT_ENABLED":
        return errorResponse(400, "CLAIMED_AGENT_BINDING_NOT_ENABLED", "Claimed Agent wallet binding is not enabled");
      case "UNKNOWN_PREDICT_OPERATION":
        return errorResponse(400, "UNKNOWN_PREDICT_OPERATION", "Unknown Predict operation");
      case "EXECUTION_NOT_FOUND":
        return errorResponse(404, "EXECUTION_NOT_FOUND", "Execution not found");
    }
  }

  return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({
    error: {
      code,
      message
    }
  }, status);
}

function errorResponseWithDetails(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown>
): Response {
  return jsonResponse({
    error: {
      code,
      message
    },
    ...details
  }, status);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({
      "content-type": "application/json"
    })
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: withCors()
  });
}

function withCors(headers: HeadersInit = {}): Headers {
  return new Headers({
    ...corsHeaders,
    ...headers
  });
}

class InternalApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "InternalApiError";
  }
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const rawBody = await request.json();
    if (!isRecord(rawBody)) {
      throw new InternalApiError(400, "INVALID_INPUT", "JSON body must be an object");
    }
    return rawBody;
  } catch (error) {
    if (error instanceof InternalApiError) {
      throw error;
    }
    throw new InternalApiError(400, "INVALID_INPUT", "Malformed JSON body");
  }
}

async function loadWallet(
  walletStore: MemoryWalletStore,
  walletId: string
): Promise<InternalTradingWallet> {
  const wallet = await walletStore.getWallet(walletId);
  if (!wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }
  return wallet;
}

function fundingInstructions(quoteAssetType: string) {
  return {
    network: "testnet",
    requiredAssets: [
      {
        symbol: "SUI",
        purpose: "gas",
        suggestedAmount: "1"
      },
      {
        symbol: "DUSDC",
        type: quoteAssetType,
        decimals: 6,
        purpose: "Predict quote asset",
        suggestedAmount: "10"
      }
    ]
  };
}

function buildPlanFromRequest(
  body: Record<string, unknown>,
  operation: PredictOperation
): PredictOperationPlan {
  assertNoCallerTargets(body);

  return buildPredictOperationPlan({
    operation,
    direction: directionFromRequest(body),
    strikeRaw: optionalRawString(body, "strikeRaw"),
    lowerStrikeRaw: optionalRawString(body, "lowerStrikeRaw"),
    higherStrikeRaw: optionalRawString(body, "higherStrikeRaw"),
    expiryMs: optionalRawString(body, "expiryMs"),
    quantityRaw: optionalRawString(body, "quantityRaw"),
    resolvedQuantityRaw: optionalRawString(body, "resolvedQuantityRaw"),
    maxCostRaw: optionalRawString(body, "maxCostRaw"),
    minProceedsRaw: optionalRawString(body, "minProceedsRaw"),
    predictObjectId: optionalString(body, "predictObjectId"),
    managerId: optionalString(body, "managerId"),
    oracleId: optionalString(body, "oracleId"),
    marketId: optionalString(body, "marketId"),
    positionId: optionalString(body, "positionId"),
    quoteCoinObjectId: optionalString(body, "quoteCoinObjectId"),
    clockObjectId: optionalString(body, "clockObjectId")
  } satisfies BuildPredictOperationPlanInput);
}

function previewOperationFor(operation: PredictOperation): PredictOperation {
  if (operation === "mint_range" || operation === "redeem_range" || operation === "preview_range") {
    return "preview_range";
  }

  if (
    operation === "mint_directional" ||
    operation === "redeem_directional" ||
    operation === "close_directional" ||
    operation === "preview_directional"
  ) {
    return "preview_directional";
  }

  throw new InternalApiError(
    400,
    "PREVIEW_UNSUPPORTED_OPERATION",
    `${operation} cannot be quoted through the Predict preview endpoint`
  );
}

function evaluateGuardrailsWhenEstimated(
  body: Record<string, unknown>,
  operation: PredictOperation
): void {
  const estimatedCostRaw = optionalRawEstimate(body, "estimatedCostRaw");
  const maxCostRaw = optionalRawString(body, "maxCostRaw");
  const estimatedProceedsRaw = optionalRawEstimate(body, "estimatedProceedsRaw");
  const minProceedsRaw = optionalRawString(body, "minProceedsRaw");

  if (estimatedCostRaw !== undefined && maxCostRaw !== undefined) {
    evaluatePreSubmitGuardrails({
      operation,
      estimatedCostRaw,
      maxCostRaw
    });
  }

  if (estimatedProceedsRaw !== undefined && minProceedsRaw !== undefined) {
    evaluatePreSubmitGuardrails({
      operation,
      estimatedProceedsRaw,
      minProceedsRaw
    });
  }
}

function requiredOperation(body: Record<string, unknown>): PredictOperation {
  const operation = requiredString(body, "operation");
  if (
    operation === "preview_directional" ||
    operation === "preview_range" ||
    operation === "mint_directional" ||
    operation === "redeem_directional" ||
    operation === "close_directional" ||
    operation === "mint_range" ||
    operation === "redeem_range" ||
    operation === "deposit_dusdc" ||
    operation === "create_manager"
  ) {
    return operation;
  }

  throw new InternalApiError(400, "UNKNOWN_PREDICT_OPERATION", "Unknown Predict operation");
}

function requiredBindingMode(body: Record<string, unknown>): "internal_probe" | "claimed_agent" {
  const bindingMode = requiredString(body, "bindingMode");
  if (bindingMode === "internal_probe" || bindingMode === "claimed_agent") {
    return bindingMode;
  }
  throw new InternalApiError(400, "INVALID_INPUT", "Invalid wallet binding mode");
}

function directionFromRequest(body: Record<string, unknown>): "up" | "down" | undefined {
  const direction = optionalString(body, "direction");
  if (direction === "up" || direction === "down") {
    return direction;
  }

  if (typeof body.isUp === "boolean") {
    return body.isUp ? "up" : "down";
  }

  return undefined;
}

function requiredString(body: Record<string, unknown>, fieldName: string): string {
  const value = optionalString(body, fieldName);
  if (value === undefined) {
    throw new InternalApiError(400, "INVALID_INPUT", `Missing ${fieldName}`);
  }
  return value;
}

function optionalString(body: Record<string, unknown>, fieldName: string): string | undefined {
  const value = body[fieldName];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalRawString(body: Record<string, unknown>, fieldName: string): string | undefined {
  const value = body[fieldName];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return undefined;
}

function optionalRawEstimate(body: Record<string, unknown>, fieldName: string): string | undefined {
  if (!Object.hasOwn(body, fieldName) || body[fieldName] === undefined || body[fieldName] === null) {
    return undefined;
  }

  const value = optionalRawString(body, fieldName);
  if (value === undefined) {
    throw new PredictGuardrailError("INVALID_RAW_AMOUNT", fieldName);
  }

  return value;
}

function assertNoCallerTargets(body: Record<string, unknown>): void {
  for (const key of ["moveTarget", "moveTargets", "target", "targets", "functionTarget"]) {
    if (Object.hasOwn(body, key)) {
      throw new Error("ARBITRARY_MOVE_TARGET_NOT_ALLOWED");
    }
  }
}

function predictPlanErrorCode(error: Error): string | null {
  const message = error.message;
  if (message.startsWith("UNKNOWN_PREDICT_OPERATION")) {
    return "UNKNOWN_PREDICT_OPERATION";
  }

  if (
    message === "INVALID_RANGE_BOUNDS" ||
    message === "INVALID_MARKET_DIRECTION" ||
    message === "CLOSE_QUANTITY_MUST_BE_BACKEND_RESOLVED" ||
    message === "ARBITRARY_MOVE_TARGET_NOT_ALLOWED"
  ) {
    return message;
  }

  return null;
}

function formatRawUnits(rawValue: string, decimals: number): string {
  const raw = assertRawIntegerString(rawValue, "rawValue").replace(/^0+(?=\d)/, "");
  if (decimals === 0) {
    return raw;
  }

  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+(?=\d)/, "") || "0";
  const fraction = padded.slice(-decimals);
  return `${whole}.${fraction}`;
}

function rawPositive(rawValue: string): boolean {
  return BigInt(assertRawIntegerString(rawValue, "rawValue")) > 0n;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
