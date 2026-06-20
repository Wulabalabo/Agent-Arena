import {
  createMemoryExecutionStore,
  type MemoryExecutionStore
} from "./execution-store";
import { createPredictConfig } from "./config";
import {
  PredictGuardrailError,
  assertRawIntegerString,
  classifyPolicyDrift,
  evaluatePreSubmitGuardrails
} from "./guardrails";
import { assertInternalRequest } from "./internal-auth";
import { type DiscoveredPredictManager, PredictManagerError, planManagerSetup } from "./manager";
import { PredictOracleError, type ConfirmOracleExecutionRequest } from "./oracle";
import type { PredictSetupExecutor } from "./setup-executor";
import type { PredictTradeExecutor, PredictTradeTransactionSummary } from "./trade-executor";
import {
  buildPredictOperationPlan,
  type BuildPredictOperationPlanInput,
  type DirectionalMarketSide,
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
  confirmOracleForExecution?: (request: ConfirmOracleExecutionRequest) => Promise<void>;
  setupExecutor?: PredictSetupExecutor;
  tradeExecutor?: PredictTradeExecutor;
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
  confirmOracleForExecution,
  setupExecutor,
  tradeExecutor,
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
        return await handlePreview(request, resolved.walletStore, resolved.quoteAssetType, confirmOracleForExecution);
      }

      if (pathname === "/api/arena/internal/predict/execute" && request.method === "POST") {
        const resolved = getWalletStore();
        return await handleExecute(
          request,
          resolved.walletStore,
          executionStore,
          tradeExecutor,
          confirmOracleForExecution,
          resolved.enablePredictSubmit
        );
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
  quoteAssetType: string,
  confirmOracleForExecution: ((request: ConfirmOracleExecutionRequest) => Promise<void>) | undefined
): Promise<Response> {
  const body = await parseJsonBody(request);
  const wallet = await loadWallet(walletStore, requiredString(body, "walletId"));
  const requestedOperation = requiredOperation(body);
  const previewOperation = previewOperationFor(requestedOperation);
  const operationPlan = buildPlanFromRequest(body, previewOperation);
  await confirmOracleForPlan(confirmOracleForExecution, operationPlan);
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
  executionStore: MemoryExecutionStore,
  tradeExecutor: PredictTradeExecutor | undefined,
  confirmOracleForExecution: ((request: ConfirmOracleExecutionRequest) => Promise<void>) | undefined,
  enablePredictSubmit: boolean
): Promise<Response> {
  const body = await parseJsonBody(request);
  const wallet = await loadWallet(walletStore, requiredString(body, "walletId"));
  const operation = requiredOperation(body);
  const operationPlan = await buildExecutionPlanFromRequest(body, operation, wallet, tradeExecutor);
  await confirmOracleForPlan(confirmOracleForExecution, operationPlan);
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
    amountRaw: operation === "withdraw_manager_dusdc" ? operationPlan.quantityRaw : undefined,
    recipientAddress: operationPlan.objectIds.recipientAddress,
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

  if (operation === "withdraw_manager_dusdc" && body.dryRunOnly === true) {
    return await executeManagerWithdrawal({
      mode: "dry_run",
      wallet,
      operationPlan,
      executionId: execution.id,
      executionStore,
      tradeExecutor,
      enablePredictSubmit
    });
  }

  if (operation === "withdraw_manager_dusdc" && body.dryRunOnly === false) {
    return await executeManagerWithdrawal({
      mode: "submit",
      wallet,
      operationPlan,
      executionId: execution.id,
      executionStore,
      tradeExecutor,
      enablePredictSubmit
    });
  }

  if ((isDirectionalTradeOperation(operation) || isRangeTradeOperation(operation)) && body.dryRunOnly === true) {
    return await executePredictTrade({
      mode: "dry_run",
      wallet,
      operation,
      operationPlan,
      executionId: execution.id,
      executionStore,
      tradeExecutor,
      enablePredictSubmit
    });
  }

  if ((isDirectionalTradeOperation(operation) || isRangeTradeOperation(operation)) && body.dryRunOnly === false) {
    return await executePredictTrade({
      mode: "submit",
      wallet,
      operation,
      operationPlan,
      executionId: execution.id,
      executionStore,
      tradeExecutor,
      enablePredictSubmit
    });
  }

  const disabledExecution = await executionStore.updateExecution(execution.id, {
    status: "failed",
    errorCode: "PREDICT_SUBMIT_DISABLED",
    errorMessage: "Real Predict submit is disabled for this operation or missing an explicit dryRunOnly mode."
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
    "Real Predict submit is disabled for this operation or missing an explicit dryRunOnly mode.",
    { execution: disabledExecution }
  );
}

async function buildExecutionPlanFromRequest(
  body: Record<string, unknown>,
  operation: PredictOperation,
  wallet: InternalTradingWallet,
  tradeExecutor: PredictTradeExecutor | undefined
): Promise<PredictOperationPlan> {
  if (!requiresBackendResolvedPosition(operation)) {
    return buildPlanFromRequest(body, operation, wallet);
  }

  if (optionalRawString(body, "resolvedQuantityRaw") !== undefined) {
    return buildPlanFromRequest(body, operation, wallet);
  }

  if (Object.hasOwn(body, "quantityRaw")) {
    return buildPlanFromRequest(body, operation, wallet);
  }

  if (operation === "close_range" || operation === "claim_settled_range") {
    if (!tradeExecutor?.resolveRangePosition) {
      throw new InternalApiError(
        503,
        "PREDICT_RANGE_POSITION_RESOLVER_REQUIRED",
        `Predict range position resolver is required before ${operation}`
      );
    }

    const resolution = await tradeExecutor.resolveRangePosition(
      rangePositionInputFromRequest(wallet, body)
    );
    if (BigInt(assertRawIntegerString(resolution.quantityRaw, "resolvedQuantityRaw")) <= 0n) {
      throw new InternalApiError(
        404,
        "RANGE_POSITION_NOT_FOUND",
        `No open range position was found for ${operation}`
      );
    }

    return buildPredictOperationPlan({
      operation,
      lowerStrikeRaw: optionalRawString(body, "lowerStrikeRaw"),
      higherStrikeRaw: optionalRawString(body, "higherStrikeRaw"),
      expiryMs: optionalRawString(body, "expiryMs"),
      resolvedQuantityRaw: resolution.quantityRaw,
      minProceedsRaw: optionalRawString(body, "minProceedsRaw"),
      managerId: optionalString(body, "managerId"),
      oracleId: optionalString(body, "oracleId")
    });
  }

  if (!tradeExecutor?.resolveDirectionalPosition) {
    throw new InternalApiError(
      503,
      "PREDICT_POSITION_RESOLVER_REQUIRED",
      "Predict position resolver is required before close_directional"
    );
  }

  const resolution = await tradeExecutor.resolveDirectionalPosition(
    directionalPositionInputFromRequest(wallet, body)
  );
  if (BigInt(assertRawIntegerString(resolution.quantityRaw, "resolvedQuantityRaw")) <= 0n) {
    throw new InternalApiError(
      404,
      "POSITION_NOT_FOUND",
      "No open directional position was found for close_directional"
    );
  }

  return buildPredictOperationPlan({
    operation,
    direction: directionFromRequest(body),
    strikeRaw: optionalRawString(body, "strikeRaw"),
    expiryMs: optionalRawString(body, "expiryMs"),
    resolvedQuantityRaw: resolution.quantityRaw,
    minProceedsRaw: optionalRawString(body, "minProceedsRaw"),
    managerId: optionalString(body, "managerId"),
    oracleId: optionalString(body, "oracleId")
  });
}

async function executeManagerWithdrawal(input: {
  mode: "dry_run" | "submit";
  wallet: InternalTradingWallet;
  operationPlan: PredictOperationPlan;
  executionId: string;
  executionStore: MemoryExecutionStore;
  tradeExecutor: PredictTradeExecutor | undefined;
  enablePredictSubmit: boolean;
}): Promise<Response> {
  const {
    mode,
    wallet,
    operationPlan,
    executionId,
    executionStore,
    tradeExecutor,
    enablePredictSubmit
  } = input;
  const operation: PredictOperation = "withdraw_manager_dusdc";
  const amountRaw = requiredPlanValue(operationPlan.quantityRaw, "amountRaw");
  const recipientAddress = operationPlan.objectIds.recipientAddress;
  const transactionKind = tradeTransactionKind(operation, mode);

  if (mode === "submit" && !enablePredictSubmit) {
    const disabledExecution = await executionStore.updateExecution(executionId, {
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      errorMessage: "Real Predict submit is disabled. Set AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true and pass dryRunOnly=false."
    });
    await executionStore.recordSigningAudit({
      walletId: wallet.id,
      agentId: wallet.agentId,
      executionId,
      operation,
      transactionKind,
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      amountRaw,
      recipientAddress
    });

    return errorResponseWithDetails(
      501,
      "PREDICT_SUBMIT_DISABLED",
      "Real Predict submit is disabled. Set AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true and pass dryRunOnly=false.",
      { execution: disabledExecution }
    );
  }

  if (!tradeExecutor?.resolveManagerBalance) {
    throw new InternalApiError(
      503,
      "PREDICT_MANAGER_BALANCE_RESOLVER_REQUIRED",
      "Predict manager balance resolver is required before withdrawal"
    );
  }

  const managerId = requiredPlanObjectId(operationPlan, "managerId");
  const balance = await tradeExecutor.resolveManagerBalance({
    wallet,
    managerId
  });
  if (compareRawStrings(balance.balanceRaw, amountRaw) < 0) {
    const failedExecution = await executionStore.updateExecution(executionId, {
      status: "failed",
      errorCode: "INSUFFICIENT_MANAGER_BALANCE",
      errorMessage: "Requested withdrawal amount exceeds the backend-confirmed manager DUSDC balance"
    });
    await executionStore.recordSigningAudit({
      walletId: wallet.id,
      agentId: wallet.agentId,
      executionId,
      operation,
      transactionKind,
      status: "failed",
      errorCode: "INSUFFICIENT_MANAGER_BALANCE",
      amountRaw,
      recipientAddress
    });

    return errorResponseWithDetails(
      409,
      "INSUFFICIENT_MANAGER_BALANCE",
      "Requested withdrawal amount exceeds the backend-confirmed manager DUSDC balance",
      { execution: failedExecution }
    );
  }

  try {
    const transaction = mode === "dry_run"
      ? await dryRunManagerWithdrawal(tradeExecutor, wallet, operationPlan)
      : await submitManagerWithdrawal(tradeExecutor, wallet, operationPlan);
    const updatedExecution = await executionStore.updateExecution(executionId, {
      status: mode === "dry_run" ? "dry_run_ok" : "submitted",
      dryRunDigest: mode === "dry_run" ? transaction.txDigest : undefined,
      submittedAt: mode === "submit" ? new Date().toISOString() : undefined,
      txDigest: mode === "submit" ? transaction.txDigest : undefined,
      amountRaw: transaction.amountRaw,
      recipientAddress: transaction.recipientAddress,
      policyDrift: "unknown"
    });
    await recordTradeSigningAudit(executionStore, wallet, executionId, operation, transaction);

    return jsonResponse({
      execution: updatedExecution,
      transaction
    });
  } catch (error) {
    return await failedExecutionResponse(
      error,
      executionStore,
      wallet,
      executionId,
      operation,
      transactionKind,
      { amountRaw, recipientAddress }
    );
  }
}

async function executePredictTrade(input: {
  mode: "dry_run" | "submit";
  wallet: InternalTradingWallet;
  operation: PredictOperation;
  operationPlan: PredictOperationPlan;
  executionId: string;
  executionStore: MemoryExecutionStore;
  tradeExecutor: PredictTradeExecutor | undefined;
  enablePredictSubmit: boolean;
}): Promise<Response> {
  const {
    mode,
    wallet,
    operation,
    operationPlan,
    executionId,
    executionStore,
    tradeExecutor,
    enablePredictSubmit
  } = input;

  if (mode === "submit" && !enablePredictSubmit) {
    const disabledExecution = await executionStore.updateExecution(executionId, {
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      errorMessage: "Real Predict submit is disabled. Set AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true and pass dryRunOnly=false."
    });
    await executionStore.recordSigningAudit({
      walletId: wallet.id,
      agentId: wallet.agentId,
      executionId,
      operation,
      transactionKind: tradeTransactionKind(operation, mode),
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED"
    });

    return errorResponseWithDetails(
      501,
      "PREDICT_SUBMIT_DISABLED",
      "Real Predict submit is disabled. Set AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true and pass dryRunOnly=false.",
      { execution: disabledExecution }
    );
  }

  try {
    const managerBalanceFailure = await rejectInsufficientManagerBalanceBeforeMint({
      wallet,
      operation,
      operationPlan,
      executionId,
      executionStore,
      tradeExecutor,
      transactionKind: tradeTransactionKind(operation, mode)
    });
    if (managerBalanceFailure) {
      return managerBalanceFailure;
    }

    const transaction = mode === "dry_run"
      ? await dryRunPredictTrade(tradeExecutor, wallet, operation, operationPlan)
      : await submitPredictTrade(tradeExecutor, wallet, operation, operationPlan);
    const updatedExecution = await executionStore.updateExecution(executionId, {
      status: mode === "dry_run" ? "dry_run_ok" : "submitted",
      dryRunDigest: mode === "dry_run" ? transaction.txDigest : undefined,
      submittedAt: mode === "submit" ? new Date().toISOString() : undefined,
      txDigest: mode === "submit" ? transaction.txDigest : undefined,
      actualCostRaw: transaction.actualCostRaw,
      actualProceedsRaw: transaction.actualProceedsRaw,
      policyDrift: classifyPolicyDrift({
        operation,
        actualCostRaw: transaction.actualCostRaw,
        maxCostRaw: operationPlan.maxCostRaw,
        actualProceedsRaw: transaction.actualProceedsRaw,
        minProceedsRaw: operationPlan.minProceedsRaw
      })
    });
    await recordTradeSigningAudit(executionStore, wallet, executionId, operation, transaction);

    return jsonResponse({
      execution: updatedExecution,
      transaction
    });
  } catch (error) {
    return await failedExecutionResponse(
      error,
      executionStore,
      wallet,
      executionId,
      operation,
      tradeTransactionKind(operation, mode)
    );
  }
}

async function rejectInsufficientManagerBalanceBeforeMint(input: {
  wallet: InternalTradingWallet;
  operation: PredictOperation;
  operationPlan: PredictOperationPlan;
  executionId: string;
  executionStore: MemoryExecutionStore;
  tradeExecutor: PredictTradeExecutor | undefined;
  transactionKind: string;
}): Promise<Response | null> {
  const {
    wallet,
    operation,
    operationPlan,
    executionId,
    executionStore,
    tradeExecutor,
    transactionKind
  } = input;

  if (!isMintTradeOperation(operation) || !tradeExecutor?.resolveManagerBalance) {
    return null;
  }

  const managerId = requiredPlanObjectId(operationPlan, "managerId");
  const maxCostRaw = requiredPlanValue(operationPlan.maxCostRaw, "maxCostRaw");
  const balance = await tradeExecutor.resolveManagerBalance({
    wallet,
    managerId
  });
  if (compareRawStrings(balance.balanceRaw, maxCostRaw) >= 0) {
    return null;
  }

  const message = `PredictManager DUSDC balance ${balance.balanceRaw} is below required maxCostRaw ${maxCostRaw}`;
  const failedExecution = await executionStore.updateExecution(executionId, {
    status: "failed",
    errorCode: "INSUFFICIENT_MANAGER_BALANCE",
    errorMessage: message
  });
  await executionStore.recordSigningAudit({
    walletId: wallet.id,
    agentId: wallet.agentId,
    executionId,
    operation,
    transactionKind,
    status: "failed",
    errorCode: "INSUFFICIENT_MANAGER_BALANCE"
  });

  return errorResponseWithDetails(
    409,
    "INSUFFICIENT_MANAGER_BALANCE",
    message,
    {
      execution: failedExecution,
      managerBalanceRaw: balance.balanceRaw,
      requiredManagerBalanceRaw: maxCostRaw
    }
  );
}

async function dryRunPredictTrade(
  tradeExecutor: PredictTradeExecutor | undefined,
  wallet: InternalTradingWallet,
  operation: PredictOperation,
  operationPlan: PredictOperationPlan
): Promise<PredictTradeTransactionSummary> {
  if (operation === "mint_directional") {
    if (!tradeExecutor?.dryRunMintDirectional) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict trade executor is required");
    }
    return await tradeExecutor.dryRunMintDirectional(mintDirectionalExecutorInput(wallet, operationPlan));
  }

  if (
    operation === "redeem_directional" ||
    operation === "close_directional" ||
    operation === "claim_settled_directional"
  ) {
    if (!tradeExecutor?.dryRunRedeemDirectional) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict trade executor is required");
    }
    const redeemInput = await redeemDirectionalExecutorInput(tradeExecutor, wallet, operation, operationPlan);
    return await tradeExecutor.dryRunRedeemDirectional(redeemInput);
  }

  if (operation === "mint_range") {
    if (!tradeExecutor?.dryRunMintRange) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict range trade executor is required");
    }
    return await tradeExecutor.dryRunMintRange(mintRangeExecutorInput(wallet, operationPlan));
  }

  if (
    operation === "redeem_range" ||
    operation === "close_range" ||
    operation === "claim_settled_range"
  ) {
    if (!tradeExecutor?.dryRunRedeemRange) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict range trade executor is required");
    }
    const redeemInput = await redeemRangeExecutorInput(tradeExecutor, wallet, operation, operationPlan);
    return await tradeExecutor.dryRunRedeemRange(redeemInput);
  }

  throw new InternalApiError(400, "PREDICT_OPERATION_UNSUPPORTED", `${operation} is not supported for Predict trade execution`);
}

async function submitPredictTrade(
  tradeExecutor: PredictTradeExecutor | undefined,
  wallet: InternalTradingWallet,
  operation: PredictOperation,
  operationPlan: PredictOperationPlan
): Promise<PredictTradeTransactionSummary> {
  if (operation === "mint_directional") {
    if (!tradeExecutor?.submitMintDirectional) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict trade executor is required");
    }
    return await tradeExecutor.submitMintDirectional(mintDirectionalExecutorInput(wallet, operationPlan));
  }

  if (
    operation === "redeem_directional" ||
    operation === "close_directional" ||
    operation === "claim_settled_directional"
  ) {
    if (!tradeExecutor?.submitRedeemDirectional) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict trade executor is required");
    }
    const redeemInput = await redeemDirectionalExecutorInput(tradeExecutor, wallet, operation, operationPlan);
    return await tradeExecutor.submitRedeemDirectional(redeemInput);
  }

  if (operation === "mint_range") {
    if (!tradeExecutor?.submitMintRange) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict range trade executor is required");
    }
    return await tradeExecutor.submitMintRange(mintRangeExecutorInput(wallet, operationPlan));
  }

  if (
    operation === "redeem_range" ||
    operation === "close_range" ||
    operation === "claim_settled_range"
  ) {
    if (!tradeExecutor?.submitRedeemRange) {
      throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict range trade executor is required");
    }
    const redeemInput = await redeemRangeExecutorInput(tradeExecutor, wallet, operation, operationPlan);
    return await tradeExecutor.submitRedeemRange(redeemInput);
  }

  throw new InternalApiError(400, "PREDICT_OPERATION_UNSUPPORTED", `${operation} is not supported for Predict trade execution`);
}

async function dryRunManagerWithdrawal(
  tradeExecutor: PredictTradeExecutor | undefined,
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Promise<PredictTradeTransactionSummary> {
  if (!tradeExecutor?.dryRunWithdrawManagerDusdc) {
    throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict manager withdrawal executor is required");
  }
  return await tradeExecutor.dryRunWithdrawManagerDusdc(managerWithdrawalExecutorInput(wallet, operationPlan));
}

async function submitManagerWithdrawal(
  tradeExecutor: PredictTradeExecutor | undefined,
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Promise<PredictTradeTransactionSummary> {
  if (!tradeExecutor?.submitWithdrawManagerDusdc) {
    throw new InternalApiError(503, "PREDICT_TRADE_EXECUTOR_REQUIRED", "Predict manager withdrawal executor is required");
  }
  return await tradeExecutor.submitWithdrawManagerDusdc(managerWithdrawalExecutorInput(wallet, operationPlan));
}

function mintDirectionalExecutorInput(
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Parameters<NonNullable<PredictTradeExecutor["dryRunMintDirectional"]>>[0] {
  return {
    wallet,
    managerId: requiredPlanObjectId(operationPlan, "managerId"),
    oracleId: requiredPlanObjectId(operationPlan, "oracleId"),
    expiryMs: requiredPlanKeyInput(operationPlan, "expiryMs"),
    strikeRaw: requiredPlanKeyInput(operationPlan, "strikeRaw"),
    direction: requiredPlanKeyInput(operationPlan, "direction") as DirectionalMarketSide,
    quantityRaw: requiredPlanValue(operationPlan.quantityRaw, "quantityRaw"),
    maxCostRaw: requiredPlanValue(operationPlan.maxCostRaw, "maxCostRaw")
  };
}

async function redeemDirectionalExecutorInput(
  tradeExecutor: PredictTradeExecutor,
  wallet: InternalTradingWallet,
  operation: PredictOperation,
  operationPlan: PredictOperationPlan
): Promise<Parameters<NonNullable<PredictTradeExecutor["dryRunRedeemDirectional"]>>[0]> {
  const baseInput = directionalPositionInputFromPlan(wallet, operationPlan);
  const quantityRaw = requiredPlanValue(operationPlan.quantityRaw, "quantityRaw");
  const minProceedsRaw = requiredPlanValue(operationPlan.minProceedsRaw, "minProceedsRaw");

  if (operation === "redeem_directional") {
    if (!tradeExecutor.resolveDirectionalPosition) {
      throw new InternalApiError(
        503,
        "PREDICT_POSITION_RESOLVER_REQUIRED",
        "Predict position resolver is required before redeem_directional"
      );
    }

    const resolution = await tradeExecutor.resolveDirectionalPosition(baseInput);
    if (compareRawStrings(resolution.quantityRaw, quantityRaw) < 0) {
      throw new InternalApiError(
        409,
        "INSUFFICIENT_POSITION",
        "Requested redeem quantity exceeds the backend-confirmed open position"
      );
    }
  }

  if (
    operation !== "redeem_directional" &&
    operation !== "close_directional" &&
    operation !== "claim_settled_directional"
  ) {
    throw new InternalApiError(400, "PREDICT_OPERATION_UNSUPPORTED", `${operation} cannot use directional redeem`);
  }

  return {
    ...baseInput,
    operation,
    quantityRaw,
    minProceedsRaw
  };
}

function mintRangeExecutorInput(
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Parameters<NonNullable<PredictTradeExecutor["dryRunMintRange"]>>[0] {
  return {
    wallet,
    operation: "mint_range",
    managerId: requiredPlanObjectId(operationPlan, "managerId"),
    oracleId: requiredPlanObjectId(operationPlan, "oracleId"),
    expiryMs: requiredPlanKeyInput(operationPlan, "expiryMs"),
    lowerStrikeRaw: requiredPlanKeyInput(operationPlan, "lowerStrikeRaw"),
    higherStrikeRaw: requiredPlanKeyInput(operationPlan, "higherStrikeRaw"),
    quantityRaw: requiredPlanValue(operationPlan.quantityRaw, "quantityRaw"),
    maxCostRaw: requiredPlanValue(operationPlan.maxCostRaw, "maxCostRaw")
  };
}

async function redeemRangeExecutorInput(
  tradeExecutor: PredictTradeExecutor,
  wallet: InternalTradingWallet,
  operation: PredictOperation,
  operationPlan: PredictOperationPlan
): Promise<Parameters<NonNullable<PredictTradeExecutor["dryRunRedeemRange"]>>[0]> {
  const baseInput = rangePositionInputFromPlan(wallet, operationPlan);
  const quantityRaw = requiredPlanValue(operationPlan.quantityRaw, "quantityRaw");
  const minProceedsRaw = requiredPlanValue(operationPlan.minProceedsRaw, "minProceedsRaw");

  if (operation === "redeem_range") {
    if (!tradeExecutor.resolveRangePosition) {
      throw new InternalApiError(
        503,
        "PREDICT_RANGE_POSITION_RESOLVER_REQUIRED",
        "Predict range position resolver is required before redeem_range"
      );
    }

    const resolution = await tradeExecutor.resolveRangePosition(baseInput);
    if (compareRawStrings(resolution.quantityRaw, quantityRaw) < 0) {
      throw new InternalApiError(
        409,
        "INSUFFICIENT_RANGE_POSITION",
        "Requested redeem quantity exceeds the backend-confirmed open range position"
      );
    }
  }

  if (
    operation !== "redeem_range" &&
    operation !== "close_range" &&
    operation !== "claim_settled_range"
  ) {
    throw new InternalApiError(400, "PREDICT_OPERATION_UNSUPPORTED", `${operation} cannot use range redeem`);
  }

  return {
    ...baseInput,
    operation,
    quantityRaw,
    minProceedsRaw
  };
}

function directionalPositionInputFromRequest(
  wallet: InternalTradingWallet,
  body: Record<string, unknown>
): Parameters<NonNullable<PredictTradeExecutor["resolveDirectionalPosition"]>>[0] {
  return {
    wallet,
    managerId: requiredString(body, "managerId"),
    oracleId: requiredString(body, "oracleId"),
    expiryMs: requiredRequestRawString(body, "expiryMs"),
    strikeRaw: requiredRequestRawString(body, "strikeRaw"),
    direction: requiredRequestDirection(body)
  };
}

function rangePositionInputFromRequest(
  wallet: InternalTradingWallet,
  body: Record<string, unknown>
): Parameters<NonNullable<PredictTradeExecutor["resolveRangePosition"]>>[0] {
  return {
    wallet,
    managerId: requiredString(body, "managerId"),
    oracleId: requiredString(body, "oracleId"),
    expiryMs: requiredRequestRawString(body, "expiryMs"),
    lowerStrikeRaw: requiredRequestRawString(body, "lowerStrikeRaw"),
    higherStrikeRaw: requiredRequestRawString(body, "higherStrikeRaw")
  };
}

function directionalPositionInputFromPlan(
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Parameters<NonNullable<PredictTradeExecutor["resolveDirectionalPosition"]>>[0] {
  return {
    wallet,
    managerId: requiredPlanObjectId(operationPlan, "managerId"),
    oracleId: requiredPlanObjectId(operationPlan, "oracleId"),
    expiryMs: requiredPlanKeyInput(operationPlan, "expiryMs"),
    strikeRaw: requiredPlanKeyInput(operationPlan, "strikeRaw"),
    direction: requiredPlanKeyInput(operationPlan, "direction") as DirectionalMarketSide
  };
}

function rangePositionInputFromPlan(
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Parameters<NonNullable<PredictTradeExecutor["resolveRangePosition"]>>[0] {
  return {
    wallet,
    managerId: requiredPlanObjectId(operationPlan, "managerId"),
    oracleId: requiredPlanObjectId(operationPlan, "oracleId"),
    expiryMs: requiredPlanKeyInput(operationPlan, "expiryMs"),
    lowerStrikeRaw: requiredPlanKeyInput(operationPlan, "lowerStrikeRaw"),
    higherStrikeRaw: requiredPlanKeyInput(operationPlan, "higherStrikeRaw")
  };
}

function managerWithdrawalExecutorInput(
  wallet: InternalTradingWallet,
  operationPlan: PredictOperationPlan
): Parameters<NonNullable<PredictTradeExecutor["dryRunWithdrawManagerDusdc"]>>[0] {
  return {
    wallet,
    operation: "withdraw_manager_dusdc",
    managerId: requiredPlanObjectId(operationPlan, "managerId"),
    amountRaw: requiredPlanValue(operationPlan.quantityRaw, "amountRaw"),
    recipientAddress: requiredPlanObjectId(operationPlan, "recipientAddress")
  };
}

async function recordTradeSigningAudit(
  executionStore: MemoryExecutionStore,
  wallet: InternalTradingWallet,
  executionId: string,
  operation: PredictOperation,
  transaction: PredictTradeTransactionSummary
): Promise<void> {
  await executionStore.recordSigningAudit({
    walletId: wallet.id,
    agentId: wallet.agentId,
    executionId,
    operation,
    transactionKind: tradeTransactionKind(operation, transaction.mode),
    txDigest: transaction.txDigest,
    status: transaction.mode === "dry_run" ? "confirmed" : "submitted",
    errorCode: transaction.errorCode,
    amountRaw: transaction.amountRaw,
    recipientAddress: transaction.recipientAddress
  });
}

function tradeTransactionKind(operation: PredictOperation, mode: "dry_run" | "submit"): string {
  if (operation === "withdraw_manager_dusdc") {
    return `predict_manager_withdraw_${mode}`;
  }

  const action = operation === "mint_directional" || operation === "mint_range" ? "mint" : "redeem";
  return `predict_${action}_${mode}`;
}

function isDirectionalTradeOperation(operation: PredictOperation): boolean {
  return operation === "mint_directional" ||
    operation === "redeem_directional" ||
    operation === "close_directional" ||
    operation === "claim_settled_directional";
}

function isRangeTradeOperation(operation: PredictOperation): boolean {
  return operation === "mint_range" ||
    operation === "redeem_range" ||
    operation === "close_range" ||
    operation === "claim_settled_range";
}

function isMintTradeOperation(operation: PredictOperation): boolean {
  return operation === "mint_directional" || operation === "mint_range";
}

function requiresBackendResolvedPosition(operation: PredictOperation): boolean {
  return operation === "close_directional" ||
    operation === "close_range" ||
    operation === "claim_settled_directional" ||
    operation === "claim_settled_range";
}

function compareRawStrings(left: string, right: string): -1 | 0 | 1 {
  const leftValue = BigInt(assertRawIntegerString(left, "left"));
  const rightValue = BigInt(assertRawIntegerString(right, "right"));
  if (leftValue > rightValue) {
    return 1;
  }
  if (leftValue < rightValue) {
    return -1;
  }
  return 0;
}

function requiredRequestRawString(body: Record<string, unknown>, fieldName: string): string {
  const value = optionalRawString(body, fieldName);
  if (value === undefined) {
    throw new InternalApiError(400, "INVALID_INPUT", `Missing ${fieldName}`);
  }
  return assertRawIntegerString(value, fieldName);
}

function requiredRequestDirection(body: Record<string, unknown>): DirectionalMarketSide {
  const direction = directionFromRequest(body);
  if (!direction) {
    throw new InternalApiError(400, "INVALID_MARKET_DIRECTION", "Missing or invalid direction");
  }
  return direction;
}

async function failedExecutionResponse(
  error: unknown,
  executionStore: MemoryExecutionStore,
  wallet: InternalTradingWallet,
  executionId: string,
  operation: PredictOperation,
  transactionKind: string,
  auditMetadata: { amountRaw?: string; recipientAddress?: string } = {}
): Promise<Response> {
  const message = error instanceof Error ? error.message : "Predict transaction execution failed";
  const failedExecution = await executionStore.updateExecution(executionId, {
    status: "failed",
    errorCode: "PREDICT_TRANSACTION_FAILED",
    errorMessage: message
  });
  await executionStore.recordSigningAudit({
    walletId: wallet.id,
    agentId: wallet.agentId,
    executionId,
    operation,
    transactionKind,
    status: "failed",
    errorCode: "PREDICT_TRANSACTION_FAILED",
    amountRaw: auditMetadata.amountRaw,
    recipientAddress: auditMetadata.recipientAddress
  });

  return errorResponseWithDetails(
    502,
    "PREDICT_TRANSACTION_FAILED",
    message,
    { execution: failedExecution }
  );
}

function requiredPlanObjectId(plan: PredictOperationPlan, key: string): string {
  return requiredPlanValue(plan.objectIds[key], key);
}

function requiredPlanKeyInput<Key extends keyof PredictOperationPlan["keyInputs"]>(
  plan: PredictOperationPlan,
  key: Key
): NonNullable<PredictOperationPlan["keyInputs"][Key]> {
  return requiredPlanValue(plan.keyInputs[key], String(key)) as NonNullable<PredictOperationPlan["keyInputs"][Key]>;
}

function requiredPlanValue(value: string | undefined, fieldName: string): string {
  if (value === undefined || value.trim() === "") {
    throw new InternalApiError(400, "INVALID_INPUT", `Missing ${fieldName}`);
  }

  return value;
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

  if (error instanceof PredictOracleError) {
    const status = error.code === "ORACLE_NOT_FOUND" ? 404 : 409;
    return errorResponse(status, error.code, error.message);
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
  operation: PredictOperation,
  wallet?: InternalTradingWallet
): PredictOperationPlan {
  assertNoCallerTargets(body);

  return buildPredictOperationPlan({
    operation,
    direction: directionFromRequest(body),
    strikeRaw: optionalRawString(body, "strikeRaw"),
    lowerStrikeRaw: optionalRawString(body, "lowerStrikeRaw"),
    higherStrikeRaw: optionalRawString(body, "higherStrikeRaw"),
    expiryMs: optionalRawString(body, "expiryMs"),
    quantityRaw: operation === "withdraw_manager_dusdc"
      ? optionalRawString(body, "amountRaw")
      : optionalRawString(body, "quantityRaw"),
    resolvedQuantityRaw: optionalRawString(body, "resolvedQuantityRaw"),
    maxCostRaw: optionalRawString(body, "maxCostRaw"),
    minProceedsRaw: optionalRawString(body, "minProceedsRaw"),
    predictObjectId: optionalString(body, "predictObjectId"),
    managerId: optionalString(body, "managerId"),
    oracleId: optionalString(body, "oracleId"),
    marketId: optionalString(body, "marketId"),
    positionId: optionalString(body, "positionId"),
    quoteCoinObjectId: optionalString(body, "quoteCoinObjectId"),
    clockObjectId: optionalString(body, "clockObjectId"),
    recipientAddress: operation === "withdraw_manager_dusdc"
      ? optionalString(body, "recipientAddress") ?? wallet?.address
      : optionalString(body, "recipientAddress")
  } satisfies BuildPredictOperationPlanInput);
}

async function confirmOracleForPlan(
  confirmOracleForExecution: ((request: ConfirmOracleExecutionRequest) => Promise<void>) | undefined,
  operationPlan: PredictOperationPlan
): Promise<void> {
  if (!confirmOracleForExecution) {
    return;
  }

  const oracleId = operationPlan.objectIds.oracleId;
  if (!oracleId || operationPlan.expiryMs === undefined) {
    return;
  }

  const expiryMs = Number(operationPlan.expiryMs);
  if (!Number.isSafeInteger(expiryMs)) {
    throw new InternalApiError(400, "INVALID_RAW_AMOUNT", "Invalid expiryMs");
  }

  await confirmOracleForExecution({
    operation: operationPlan.operation,
    oracleId,
    expiryMs,
    strikeRaw: operationPlan.keyInputs.strikeRaw,
    lowerStrikeRaw: operationPlan.keyInputs.lowerStrikeRaw,
    higherStrikeRaw: operationPlan.keyInputs.higherStrikeRaw
  });
}

function previewOperationFor(operation: PredictOperation): PredictOperation {
  if (
    operation === "mint_range" ||
    operation === "redeem_range" ||
    operation === "close_range" ||
    operation === "preview_range"
  ) {
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
    operation === "claim_settled_directional" ||
    operation === "mint_range" ||
    operation === "redeem_range" ||
    operation === "close_range" ||
    operation === "claim_settled_range" ||
    operation === "deposit_dusdc" ||
    operation === "withdraw_manager_dusdc" ||
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
