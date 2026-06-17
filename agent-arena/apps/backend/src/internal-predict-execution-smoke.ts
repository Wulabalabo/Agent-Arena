import { createMemoryExecutionStore } from "./predict/execution-store";
import { createPredictConfig } from "./predict/config";
import { internalTokenHeader } from "./predict/internal-auth";
import { createInternalPredictFetchHandler } from "./predict/internal-api";
import { createPredictSetupExecutor } from "./predict/setup-executor";
import { createPredictTradeExecutor } from "./predict/trade-executor";
import type { CoinBalanceReader, PredictConfig } from "./predict/types";
import { createJsonWalletStore } from "./predict/wallet-store";

type CliMode =
  | "create-wallet"
  | "check-balances"
  | "setup"
  | "preview-up"
  | "mint-up"
  | "redeem-last"
  | "close-last"
  | "mint-range"
  | "redeem-range-last"
  | "close-range-last";

interface ParsedArgs {
  mode: CliMode;
  values: Map<string, string | true>;
}

const privateMaterialKeys = new Set([
  "privateKey",
  "encryptedPrivateKey",
  "secretKey",
  "walletSecret",
  "x-agent-arena-internal-token"
]);

export function redactSmokeOutput<T>(value: T): T {
  return redactValue(value) as T;
}

export function createJsonRpcBalanceReader(config: PredictConfig): CoinBalanceReader {
  return {
    async getSuiBalance(address) {
      return await getBalanceRaw(config.suiRpcUrl, [address]);
    },
    async getCoinBalance(address, coinType) {
      return await getBalanceRaw(config.suiRpcUrl, [address, coinType]);
    }
  };
}

export function buildDirectionalRedeemExecuteBody(input: {
  operation: "redeem_directional" | "close_directional";
  walletId: string;
  managerId: string;
  oracleId: string;
  direction: "up" | "down";
  expiryMs: string;
  strikeRaw: string;
  quantityRaw?: string;
  minProceedsRaw: string;
  dryRunOnly: boolean;
}): Record<string, unknown> {
  return {
    walletId: input.walletId,
    operation: input.operation,
    managerId: input.managerId,
    oracleId: input.oracleId,
    direction: input.direction,
    ...(input.quantityRaw ? { quantityRaw: input.quantityRaw } : {}),
    minProceedsRaw: input.minProceedsRaw,
    estimatedProceedsRaw: input.minProceedsRaw,
    expiryMs: input.expiryMs,
    strikeRaw: input.strikeRaw,
    dryRunOnly: input.dryRunOnly
  };
}

export function buildRangeRedeemExecuteBody(input: {
  operation: "redeem_range" | "close_range";
  walletId: string;
  managerId: string;
  oracleId: string;
  expiryMs: string;
  lowerStrikeRaw: string;
  higherStrikeRaw: string;
  quantityRaw?: string;
  minProceedsRaw: string;
  dryRunOnly: boolean;
}): Record<string, unknown> {
  return {
    walletId: input.walletId,
    operation: input.operation,
    managerId: input.managerId,
    oracleId: input.oracleId,
    ...(input.quantityRaw ? { quantityRaw: input.quantityRaw } : {}),
    minProceedsRaw: input.minProceedsRaw,
    estimatedProceedsRaw: input.minProceedsRaw,
    expiryMs: input.expiryMs,
    lowerStrikeRaw: input.lowerStrikeRaw,
    higherStrikeRaw: input.higherStrikeRaw,
    dryRunOnly: input.dryRunOnly
  };
}

export async function runInternalPredictExecutionSmoke(argv: string[] = Bun.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const config = createPredictConfig(Bun.env);
    const walletStorePath = resolveStorePath(
      Bun.env.AGENT_ARENA_WALLET_STORE_PATH,
      "data/internal-wallets.json"
    );
    const walletStore = createJsonWalletStore({
      walletSecret: config.walletSecret,
      balanceReader: createJsonRpcBalanceReader(config),
      quoteAssetType: config.quoteAssetType,
      storePath: walletStorePath
    });
    const explicitManagerId = optionalArg(parsed, "manager-id");
    const fetchInternal = createInternalPredictFetchHandler({
      internalToken: config.internalToken,
      walletStore,
      executionStore: createMemoryExecutionStore(),
      quoteAssetType: config.quoteAssetType,
      enablePredictSubmit: config.enablePredictSubmit,
      setupExecutor: createPredictSetupExecutor({ config, walletStore }),
      tradeExecutor: createPredictTradeExecutor({ config, walletStore }),
      resolveManager: explicitManagerId
        ? async (wallet) => ({
          managerId: explicitManagerId,
          ownerAddress: wallet.address,
          address: wallet.address,
          source: "local"
        })
        : undefined,
      env: Bun.env
    });

    const result = await executeMode(parsed, fetchInternal, config);
    printJson({
      ok: true,
      network: config.network,
      mode: parsed.mode,
      walletStorePath,
      ...result
    });
    return 0;
  } catch (error) {
    printJson({
      ok: false,
      error: error instanceof Error
        ? { code: error.message, message: error.message }
        : { code: "UNKNOWN_ERROR", message: "Unknown error" }
    });
    return 1;
  }
}

async function executeMode(
  parsed: ParsedArgs,
  fetchInternal: (request: Request) => Promise<Response>,
  config: PredictConfig
): Promise<Record<string, unknown>> {
  switch (parsed.mode) {
    case "create-wallet":
      return await callInternal(fetchInternal, "/api/arena/internal/wallets", {
        agentId: valueOrDefault(parsed, "agent-id", "agent_internal_smoke"),
        bindingMode: "internal_probe",
        label: valueOrDefault(parsed, "label", "internal-predict-smoke")
      }, "POST", config.internalToken);

    case "check-balances": {
      const walletId = requiredArg(parsed, "wallet-id");
      return await callInternal(
        fetchInternal,
        `/api/arena/internal/wallets/${encodeURIComponent(walletId)}/balances`,
        undefined,
        "GET",
        config.internalToken
      );
    }

    case "setup":
      return await callInternal(fetchInternal, "/api/arena/internal/predict/setup", {
        walletId: requiredArg(parsed, "wallet-id"),
        depositDusdcRaw: requiredArg(parsed, "deposit-dusdc-raw"),
        dryRunOnly: !hasFlag(parsed, "submit")
      }, "POST", config.internalToken);

    case "preview-up":
      return await callInternal(fetchInternal, "/api/arena/internal/predict/preview", {
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "mint_directional",
        direction: "up",
        quantityRaw: requiredArg(parsed, "quantity-raw"),
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        strikeRaw: requiredArgOrEnv(parsed, "strike-raw", "AGENT_ARENA_SMOKE_STRIKE_RAW")
      }, "POST", config.internalToken);

    case "mint-up": {
      const maxCostRaw = requiredArg(parsed, "max-cost-raw");
      const submit = hasFlag(parsed, "submit");
      return await executePredict(fetchInternal, config.internalToken, submit, {
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "mint_directional",
        managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
        oracleId: requiredArgOrEnv(parsed, "oracle-id", "AGENT_ARENA_SMOKE_ORACLE_ID"),
        direction: directionArgOrDefault(parsed),
        quantityRaw: requiredArg(parsed, "quantity-raw"),
        maxCostRaw,
        estimatedCostRaw: maxCostRaw,
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        strikeRaw: requiredArgOrEnv(parsed, "strike-raw", "AGENT_ARENA_SMOKE_STRIKE_RAW"),
        dryRunOnly: !submit
      });
    }

    case "redeem-last": {
      const minProceedsRaw = requiredArg(parsed, "min-proceeds-raw");
      const submit = hasFlag(parsed, "submit");
      return await executePredict(fetchInternal, config.internalToken, submit, buildDirectionalRedeemExecuteBody({
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "redeem_directional",
        managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
        oracleId: requiredArgOrEnv(parsed, "oracle-id", "AGENT_ARENA_SMOKE_ORACLE_ID"),
        direction: directionArgOrDefault(parsed),
        quantityRaw: requiredArg(parsed, "quantity-raw"),
        minProceedsRaw,
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        strikeRaw: requiredArgOrEnv(parsed, "strike-raw", "AGENT_ARENA_SMOKE_STRIKE_RAW"),
        dryRunOnly: !submit
      }));
    }

    case "close-last": {
      const minProceedsRaw = requiredArg(parsed, "min-proceeds-raw");
      const submit = hasFlag(parsed, "submit");
      return await executePredict(fetchInternal, config.internalToken, submit, buildDirectionalRedeemExecuteBody({
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "close_directional",
        managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
        oracleId: requiredArgOrEnv(parsed, "oracle-id", "AGENT_ARENA_SMOKE_ORACLE_ID"),
        direction: directionArgOrDefault(parsed),
        minProceedsRaw,
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        strikeRaw: requiredArgOrEnv(parsed, "strike-raw", "AGENT_ARENA_SMOKE_STRIKE_RAW"),
        dryRunOnly: !submit
      }));
    }

    case "mint-range": {
      const maxCostRaw = requiredArg(parsed, "max-cost-raw");
      const submit = hasFlag(parsed, "submit");
      return await executePredict(fetchInternal, config.internalToken, submit, {
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "mint_range",
        managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
        oracleId: requiredArgOrEnv(parsed, "oracle-id", "AGENT_ARENA_SMOKE_ORACLE_ID"),
        quantityRaw: requiredArg(parsed, "quantity-raw"),
        maxCostRaw,
        estimatedCostRaw: maxCostRaw,
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        lowerStrikeRaw: requiredArgOrEnv(parsed, "lower-strike-raw", "AGENT_ARENA_SMOKE_LOWER_STRIKE_RAW"),
        higherStrikeRaw: requiredArgOrEnv(parsed, "higher-strike-raw", "AGENT_ARENA_SMOKE_HIGHER_STRIKE_RAW"),
        dryRunOnly: !submit
      });
    }

    case "redeem-range-last": {
      const minProceedsRaw = requiredArg(parsed, "min-proceeds-raw");
      const submit = hasFlag(parsed, "submit");
      return await executePredict(fetchInternal, config.internalToken, submit, buildRangeRedeemExecuteBody({
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "redeem_range",
        managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
        oracleId: requiredArgOrEnv(parsed, "oracle-id", "AGENT_ARENA_SMOKE_ORACLE_ID"),
        quantityRaw: requiredArg(parsed, "quantity-raw"),
        minProceedsRaw,
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        lowerStrikeRaw: requiredArgOrEnv(parsed, "lower-strike-raw", "AGENT_ARENA_SMOKE_LOWER_STRIKE_RAW"),
        higherStrikeRaw: requiredArgOrEnv(parsed, "higher-strike-raw", "AGENT_ARENA_SMOKE_HIGHER_STRIKE_RAW"),
        dryRunOnly: !submit
      }));
    }

    case "close-range-last": {
      const minProceedsRaw = requiredArg(parsed, "min-proceeds-raw");
      const submit = hasFlag(parsed, "submit");
      return await executePredict(fetchInternal, config.internalToken, submit, buildRangeRedeemExecuteBody({
        walletId: requiredArg(parsed, "wallet-id"),
        operation: "close_range",
        managerId: requiredArgOrEnv(parsed, "manager-id", "AGENT_ARENA_SMOKE_MANAGER_ID"),
        oracleId: requiredArgOrEnv(parsed, "oracle-id", "AGENT_ARENA_SMOKE_ORACLE_ID"),
        minProceedsRaw,
        expiryMs: requiredArgOrEnv(parsed, "expiry-ms", "AGENT_ARENA_SMOKE_EXPIRY_MS"),
        lowerStrikeRaw: requiredArgOrEnv(parsed, "lower-strike-raw", "AGENT_ARENA_SMOKE_LOWER_STRIKE_RAW"),
        higherStrikeRaw: requiredArgOrEnv(parsed, "higher-strike-raw", "AGENT_ARENA_SMOKE_HIGHER_STRIKE_RAW"),
        dryRunOnly: !submit
      }));
    }
  }
}

async function executePredict(
  fetchInternal: (request: Request) => Promise<Response>,
  internalToken: string,
  submitAttempted: boolean,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await callInternal(
    fetchInternal,
    "/api/arena/internal/predict/execute",
    body,
    "POST",
    internalToken
  );

  return {
    safetyStatus: submitAttempted ? "SUBMIT_REQUESTED" : "DRY_RUN_ONLY",
    submitAttempted,
    response
  };
}

async function callInternal(
  fetchInternal: (request: Request) => Promise<Response>,
  pathname: string,
  body: Record<string, unknown> | undefined,
  method: "GET" | "POST",
  internalToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchInternal(new Request(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      [internalTokenHeader]: internalToken
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  }));
  const payload = await response.json() as Record<string, unknown>;
  return {
    httpStatus: response.status,
    ...payload
  };
}

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string | true>();
  let mode: CliMode | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) {
      throw new Error(`INVALID_ARG_${arg}`);
    }

    const key = arg.slice(2);
    if (isMode(key)) {
      if (mode) {
        throw new Error("MULTIPLE_MODES");
      }
      mode = key;
      values.set(key, true);
      continue;
    }

    if (isBooleanFlag(key)) {
      values.set(key, true);
      continue;
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`MISSING_VALUE_${key}`);
    }
    values.set(key, next);
    index += 1;
  }

  if (!mode) {
    throw new Error("MISSING_MODE");
  }

  return { mode, values };
}

function isMode(value: string): value is CliMode {
  return value === "create-wallet" ||
    value === "check-balances" ||
    value === "setup" ||
    value === "preview-up" ||
    value === "mint-up" ||
    value === "redeem-last" ||
    value === "close-last" ||
    value === "mint-range" ||
    value === "redeem-range-last" ||
    value === "close-range-last";
}

function isBooleanFlag(value: string): boolean {
  return value === "submit";
}

function requiredArg(parsed: ParsedArgs, key: string): string {
  const value = parsed.values.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`MISSING_${key.toUpperCase().replaceAll("-", "_")}`);
  }
  return value;
}

function valueOrDefault(parsed: ParsedArgs, key: string, fallback: string): string {
  const value = parsed.values.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function optionalArg(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.values.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function hasFlag(parsed: ParsedArgs, key: string): boolean {
  return parsed.values.get(key) === true;
}

function directionArgOrDefault(parsed: ParsedArgs): "up" | "down" {
  const direction = valueOrDefault(parsed, "direction", "up");
  if (direction !== "up" && direction !== "down") {
    throw new Error("INVALID_DIRECTION");
  }
  return direction;
}

function requiredArgOrEnv(parsed: ParsedArgs, key: string, envKey: string): string {
  const value = parsed.values.get(key);
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  const envValue = Bun.env[envKey]?.trim();
  if (envValue) {
    return envValue;
  }

  throw new Error(`MISSING_${key.toUpperCase().replaceAll("-", "_")}_OR_${envKey}`);
}

function resolveStorePath(envPath: string | undefined, fallback: string): string {
  const trimmed = envPath?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

async function getBalanceRaw(rpcUrl: string, params: string[]): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getBalance",
      params
    })
  });
  const payload = await response.json() as {
    result?: { totalBalance?: unknown };
    error?: { message?: string };
  };

  if (!response.ok || payload.error) {
    throw new Error(`SUI_BALANCE_RPC_FAILED${payload.error?.message ? `: ${payload.error.message}` : ""}`);
  }

  if (typeof payload.result?.totalBalance !== "string") {
    throw new Error("SUI_BALANCE_RPC_INVALID_RESPONSE");
  }

  return payload.result.totalBalance;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(redactSmokeOutput(value), null, 2));
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (typeof value === "object" && value !== null) {
    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (privateMaterialKeys.has(key)) {
        continue;
      }
      redacted[key] = redactValue(nestedValue);
    }
    return redacted;
  }

  return value;
}

if (import.meta.main) {
  const exitCode = await runInternalPredictExecutionSmoke();
  process.exit(exitCode);
}
