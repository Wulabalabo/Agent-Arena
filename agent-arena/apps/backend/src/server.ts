import { isAbsolute, join } from "node:path";
import { handleAttributionRequest, type AttributionStoreLike } from "./attribution";
import { createPlatformFetchHandler } from "./platform/api";
import { PlatformMockStore } from "./platform/mock-store";
import { createPredictExecutionAdapter } from "./platform/predict-adapter";
import {
  createRegistryConfigFromEnv,
  createRegistryService,
  type AgentRegistryService
} from "./platform/registry";
import type {
  SettlementClaimExecutionRequest,
  SettlementClaimExecutionResult,
  SettlementRedemptionLookupRequest,
  SettlementRedemptionRecord
} from "./platform/settlement-reconciler";
import { SQLitePlatformStore } from "./platform/sqlite-store";
import { createInternalPredictFetchHandler } from "./predict/internal-api";
import { internalTokenHeader, isInternalArenaPath } from "./predict/internal-auth";
import { createJsonRpcBalanceReader } from "./predict/balance-reader";
import { createPredictConfig } from "./predict/config";
import { discoverPredictManager, type DiscoveredPredictManager } from "./predict/manager";
import { createPredictMarketDataProvider } from "./predict/market-data-provider";
import { confirmOracleForExecution } from "./predict/oracle";
import {
  createPredictServerClient,
  type PredictServerClient
} from "./predict/predict-server-client";
import { createPredictSetupExecutor, type PredictSetupExecutor } from "./predict/setup-executor";
import { createPredictTradeExecutor, type PredictTradeExecutor } from "./predict/trade-executor";
import type { CoinBalanceReader, InternalTradingWallet, InternalWalletBalances } from "./predict/types";
import type { MemoryWalletStore } from "./predict/wallet-store";
import { createSqliteWalletStore } from "./predict/wallet-store";
import { handleSkillDocRequest } from "./skill-docs";
import { SQLiteAttributionStore } from "./sqlite-attribution-store";

export type AgentArenaRuntimeMode = "mock" | "real";

export function createAttributionFetchHandler(store: AttributionStoreLike = createDefaultAttributionStore()) {
  return (request: Request) => handleAttributionRequest(request, store);
}

export function createAgentArenaFetchHandler(options: {
  attributionStore?: AttributionStoreLike;
  internalToken?: string;
  platformStore?: PlatformMockStore;
  platformWalletStore?: MemoryWalletStore;
  predictEnv?: Record<string, string | undefined>;
  runtimeMode?: AgentArenaRuntimeMode;
  balanceReader?: CoinBalanceReader;
  predictServerClient?: PredictServerClient;
  predictSetupExecutor?: PredictSetupExecutor;
  predictTradeExecutor?: PredictTradeExecutor;
  registryService?: AgentRegistryService;
} = {}) {
  const predictEnv = options.predictEnv;
  const env = predictEnv ?? Bun.env;
  const runtimeMode = options.runtimeMode ?? runtimeModeFromEnv(env);
  const platformStore = options.platformStore ?? createDefaultPlatformStore(env, runtimeMode);
  const runtime = runtimeMode === "real"
    ? createRealRuntime({
      env: predictEnv,
      internalToken: options.internalToken ?? Bun.env.AGENT_ARENA_INTERNAL_TOKEN,
      platformStore,
      platformWalletStore: options.platformWalletStore,
      balanceReader: options.balanceReader,
      predictServerClient: options.predictServerClient,
      predictSetupExecutor: options.predictSetupExecutor,
      predictTradeExecutor: options.predictTradeExecutor
    })
    : createMockRuntime({
      internalToken: options.internalToken ?? Bun.env.AGENT_ARENA_INTERNAL_TOKEN,
      platformWalletStore: options.platformWalletStore,
      predictEnv
    });
  const internalPredictFetch = runtime.internalPredictFetch;
  const registryService = options.registryService ?? createRegistryService(createRegistryConfigFromEnv(env));
  const platformFetch = createPlatformFetchHandler(platformStore, {
    ...runtime.platformOptions,
    ownerSignatureMode: runtimeMode === "mock" ? "mock" : "strict",
    registryService
  });
  const attributionFetch = createAttributionFetchHandler(options.attributionStore ?? createDefaultAttributionStore());
  const runtimeReady = runtime.ready ?? Promise.resolve();

  return async (request: Request) => {
    const url = new URL(request.url);
    const skillDocResponse = await handleSkillDocRequest(request, {
      publicBaseUrl: env.AGENT_ARENA_FRONTEND_BASE_URL
    });
    if (skillDocResponse) {
      return skillDocResponse;
    }

    if (isInternalArenaPath(url.pathname)) {
      return internalPredictFetch(request);
    }

    if (url.pathname === "/api/arena" || url.pathname.startsWith("/api/arena/")) {
      await runtimeReady;
      return platformFetch(request);
    }

    return attributionFetch(request);
  };
}

function createMockRuntime({
  internalToken,
  platformWalletStore,
  predictEnv
}: {
  internalToken?: string;
  platformWalletStore?: MemoryWalletStore;
  predictEnv?: Record<string, string | undefined>;
}): {
  internalPredictFetch: ReturnType<typeof createInternalPredictFetchHandler>;
  platformOptions: Parameters<typeof createPlatformFetchHandler>[1];
  ready?: Promise<void>;
} {
  return {
    internalPredictFetch: createInternalPredictFetchHandler({ internalToken, env: predictEnv }),
    platformOptions: {
      settlementInternalToken: internalToken,
      agentWalletService: platformWalletStore
        ? async ({ agentId, displayName }) => {
          const wallet = await platformWalletStore.createWallet({
            agentId,
            bindingMode: "claimed_agent",
            label: `claimed-agent:${displayName}`
          });

          return {
            id: wallet.id,
            address: wallet.address,
            testnetSuiBalance: "0",
            quoteBalance: "0",
            predictManagerStatus: "missing",
            predictManagerId: null
          };
        }
        : undefined
    }
  };
}

function createRealRuntime({
  env,
  internalToken,
  platformStore,
  platformWalletStore,
  balanceReader,
  predictServerClient,
  predictSetupExecutor,
  predictTradeExecutor
}: {
  env?: Record<string, string | undefined>;
  internalToken?: string;
  platformStore: PlatformMockStore;
  platformWalletStore?: MemoryWalletStore;
  balanceReader?: CoinBalanceReader;
  predictServerClient?: PredictServerClient;
  predictSetupExecutor?: PredictSetupExecutor;
  predictTradeExecutor?: PredictTradeExecutor;
}): {
  internalPredictFetch: ReturnType<typeof createInternalPredictFetchHandler>;
  platformOptions: Parameters<typeof createPlatformFetchHandler>[1];
  ready?: Promise<void>;
} {
  const config = createPredictConfig(env);
  const resolvedBalanceReader = balanceReader ?? createJsonRpcBalanceReader(config);
  const walletStore = platformWalletStore ?? createSqliteWalletStore({
    walletSecret: config.walletSecret,
    dbPath: getDefaultPlatformDbPath(env),
    quoteAssetType: config.quoteAssetType,
    balanceReader: resolvedBalanceReader
  });
  const client = predictServerClient ?? createPredictServerClient({ baseUrl: config.predictServerUrl });
  const resolveManager = async (wallet: InternalTradingWallet) =>
    await discoverPredictManager({
      walletAddress: wallet.address,
      listServerManagers: client.getManagers,
      verifyManagerOwner: async () => true
  });
  const setupExecutor = predictSetupExecutor ?? createPredictSetupExecutor({ config, walletStore });
  const tradeExecutor = predictTradeExecutor ?? createPredictTradeExecutor({ config, walletStore });
  const ready = reconcileClaimedAgentWalletBindings({
    platformStore,
    walletStore
  });
  const internalPredictFetch = createInternalPredictFetchHandler({
    internalToken: config.internalToken,
    walletStore,
    balanceReader: resolvedBalanceReader,
    quoteAssetType: config.quoteAssetType,
    resolveManager,
    confirmOracleForExecution: async (request) => {
      await confirmOracleForExecution({
        request,
        readOracle: client.getOracleState
      });
    },
    setupExecutor,
    tradeExecutor,
    enablePredictSubmit: config.enablePredictSubmit,
    env
  });
  const readWallet = async (walletId: string) => {
    const [wallet, balances] = await Promise.all([
      walletStore.getWallet(walletId),
      walletStore.getBalances(walletId)
    ]);
    if (!wallet) {
      throw new Error("WALLET_NOT_FOUND");
    }
    const manager = await ensurePredictManager({
      wallet,
      balances,
      resolveManager,
      setupExecutor,
      enablePredictSubmit: config.enablePredictSubmit
    });
    const managerBalanceRaw = manager
      ? await ensureManagerDeposit({
        wallet,
        manager,
        balances,
        setupExecutor,
        tradeExecutor,
        enablePredictSubmit: config.enablePredictSubmit
      })
      : null;

    return {
      testnetSuiBalance: formatRawUnits(balances.suiBalanceRaw, 9),
      quoteBalance: manager ? managerBalanceRaw ?? balances.dusdcBalanceRaw : balances.dusdcBalanceRaw,
      predictManagerStatus: manager ? "ready" as const : "missing" as const,
      predictManagerId: manager?.managerId ?? null
    };
  };

  return {
    internalPredictFetch,
    ready,
    platformOptions: {
      agentWalletService: async ({ agentId, displayName }) => {
        const wallet = await walletStore.createWallet({
          agentId,
          bindingMode: "claimed_agent",
          label: `claimed-agent:${displayName}`
        });
        const walletStatus = await readWallet(wallet.id);

        return {
          id: wallet.id,
          address: wallet.address,
          ...walletStatus
        };
      },
      agentWalletReader: async (wallet) => await readWallet(wallet.id),
      marketDataProvider: createPredictMarketDataProvider({
        config,
        predictServerClient: client
      }),
      settlementInternalToken: config.internalToken,
      settlementClaimExecutor: async (request) => await executeSettlementClaimViaInternalPredict({
        request,
        internalPredictFetch,
        internalToken: config.internalToken
      }),
      settlementRedemptionReader: async (request) => await readSettlementRedemptionFromPredictServer({
        request,
        predictServerClient: client
      }),
      predictExecutionAdapter: async (input) => {
        const wallet = platformStore.getTradingWalletById(input.walletId);
        if (!wallet?.predictManagerId) {
          return {
            status: "failed",
            predictTxDigest: null,
            errorCode: "PREDICT_MANAGER_NOT_READY",
            errorMessage: "PredictManager is missing for the Agent trading wallet"
          };
        }

        const adapter = createPredictExecutionAdapter({
          managerId: wallet.predictManagerId,
          resolvePosition: (positionRef, expectedKind) => {
            const snapshot = platformStore.listPositionSnapshots()
              .find((candidate) => candidate.positionRef.openExecutionId === positionRef.openExecutionId);
            if (!snapshot || snapshot.positionRef.kind !== expectedKind) {
              throw new Error("POSITION_NOT_FOUND");
            }

            if (snapshot.positionRef.kind === "range") {
              return {
                kind: "range",
                oracleId: snapshot.oracleId,
                expiryMs: snapshot.expiryMs,
                lowerStrikeRaw: snapshot.lowerStrikeRaw ?? "",
                higherStrikeRaw: snapshot.higherStrikeRaw ?? "",
                quantityRaw: snapshot.quantityRaw
              };
            }

            return {
              kind: "directional",
              oracleId: snapshot.oracleId,
              expiryMs: snapshot.expiryMs,
              strikeRaw: snapshot.strikeRaw ?? "",
              isUp: snapshot.direction === "up",
              quantityRaw: snapshot.quantityRaw
            };
          },
          executeInternalPredict: async (request) => {
            const response = await internalPredictFetch(new Request("http://localhost/api/arena/internal/predict/execute", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-agent-arena-internal-token": config.internalToken
              },
              body: JSON.stringify(request)
            }));
            return await response.json();
          }
        });

        return await adapter(input);
      }
    }
  };
}

async function readSettlementRedemptionFromPredictServer(input: {
  request: SettlementRedemptionLookupRequest;
  predictServerClient: PredictServerClient;
}): Promise<SettlementRedemptionRecord | null> {
  const { position } = input.request;
  const rawRedemptions = position.positionRef.kind === "directional"
    ? await input.predictServerClient.getRedeemedPositions()
    : await input.predictServerClient.getRedeemedRanges();

  for (const redemption of arrayFromContainer(rawRedemptions)) {
    if (!isRecord(redemption) || isExplicitlyUnsettled(redemption)) {
      continue;
    }

    if (position.positionRef.kind === "directional") {
      const matched = matchDirectionalRedemption(redemption, input.request);
      if (matched) {
        return matched;
      }
      continue;
    }

    const matched = matchRangeRedemption(redemption, input.request);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function matchDirectionalRedemption(
  redemption: Record<string, unknown>,
  request: SettlementRedemptionLookupRequest
): SettlementRedemptionRecord | null {
  const { position, wallet, claimRequest } = request;
  if (claimRequest.operation !== "claim_settled_directional") {
    return null;
  }

  const isUp = booleanValue(readAny(redemption, "is_up", "isUp"));
  if (
    !matchesAddress(readAny(redemption, "manager_id", "managerId"), claimRequest.managerId) ||
    !matchesAddress(readAny(redemption, "owner", "trader"), wallet.address) ||
    stringValue(readAny(redemption, "oracle_id", "oracleId")) !== claimRequest.oracleId ||
    rawString(readAny(redemption, "expiry", "expiry_ms", "expiryMs")) !== claimRequest.expiryMs ||
    rawString(readAny(redemption, "strike", "strike_raw", "strikeRaw")) !== claimRequest.strikeRaw ||
    rawString(readAny(redemption, "quantity", "quantity_raw", "quantityRaw")) !== position.quantityRaw ||
    isUp !== (claimRequest.direction === "up")
  ) {
    return null;
  }

  return redemptionRecordFromEvent(redemption, position.quantityRaw);
}

function matchRangeRedemption(
  redemption: Record<string, unknown>,
  request: SettlementRedemptionLookupRequest
): SettlementRedemptionRecord | null {
  const { position, wallet, claimRequest } = request;
  if (claimRequest.operation !== "claim_settled_range") {
    return null;
  }

  if (
    !matchesAddress(readAny(redemption, "manager_id", "managerId"), claimRequest.managerId) ||
    !matchesAddress(readAny(redemption, "owner", "trader"), wallet.address) ||
    stringValue(readAny(redemption, "oracle_id", "oracleId")) !== claimRequest.oracleId ||
    rawString(readAny(redemption, "expiry", "expiry_ms", "expiryMs")) !== claimRequest.expiryMs ||
    rawString(readAny(redemption, "lower_strike", "lowerStrike", "lower_strike_raw", "lowerStrikeRaw")) !== claimRequest.lowerStrikeRaw ||
    rawString(readAny(redemption, "higher_strike", "higherStrike", "upper_strike", "upperStrike", "higher_strike_raw", "higherStrikeRaw")) !== claimRequest.higherStrikeRaw ||
    rawString(readAny(redemption, "quantity", "quantity_raw", "quantityRaw")) !== position.quantityRaw
  ) {
    return null;
  }

  return redemptionRecordFromEvent(redemption, position.quantityRaw);
}

function redemptionRecordFromEvent(
  redemption: Record<string, unknown>,
  quantityRaw: string
): SettlementRedemptionRecord {
  return {
    txDigest: stringValue(readAny(redemption, "digest", "txDigest", "tx_digest")) ?? null,
    proceedsRaw: rawString(readAny(redemption, "payout", "proceeds", "proceeds_raw", "proceedsRaw")) ?? null,
    quantityRaw
  };
}

async function executeSettlementClaimViaInternalPredict(input: {
  request: SettlementClaimExecutionRequest;
  internalPredictFetch: ReturnType<typeof createInternalPredictFetchHandler>;
  internalToken: string;
}): Promise<SettlementClaimExecutionResult> {
  const response = await input.internalPredictFetch(new Request("http://localhost/api/arena/internal/predict/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [internalTokenHeader]: input.internalToken
    },
    body: JSON.stringify(input.request)
  }));
  const body = await response.json().catch(() => null) as unknown;
  const parsed = parseInternalPredictSettlementResult(body);
  if (parsed) {
    return parsed;
  }

  return {
    status: "failed",
    txDigest: null,
    errorCode: response.ok ? "PREDICT_SETTLEMENT_RESPONSE_INVALID" : "PREDICT_SETTLEMENT_REQUEST_FAILED",
    errorMessage: "Internal Predict settlement response was invalid"
  };
}

function parseInternalPredictSettlementResult(body: unknown): SettlementClaimExecutionResult | null {
  if (!isRecord(body)) {
    return null;
  }

  if (isRecord(body.error)) {
    return {
      status: "failed",
      txDigest: null,
      errorCode: stringValue(body.error.code) ?? "PREDICT_SETTLEMENT_FAILED",
      errorMessage: stringValue(body.error.message) ?? "Predict settlement failed"
    };
  }

  if (!isRecord(body.execution)) {
    return null;
  }

  return {
    status: settlementExecutionStatusFromInternal(stringValue(body.execution.status)),
    txDigest: stringValue(body.execution.predictTxDigest) ?? stringValue(body.execution.txDigest) ?? null,
    actualProceedsRaw: stringValue(body.execution.actualProceedsRaw) ?? null,
    errorCode: stringValue(body.execution.errorCode) ?? null,
    errorMessage: stringValue(body.execution.errorMessage) ?? null
  };
}

function settlementExecutionStatusFromInternal(
  status: string | null
): SettlementClaimExecutionResult["status"] {
  if (status === "failed") {
    return "failed";
  }

  if (status === "partial") {
    return "partial";
  }

  if (status === "queued") {
    return "queued";
  }

  if (status === "confirmed") {
    return "confirmed";
  }

  return "submitted";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayFromContainer(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.data)) {
    return value.data;
  }

  if (Array.isArray(value.redemptions)) {
    return value.redemptions;
  }

  return [];
}

function readAny(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function rawString(value: unknown): string | null {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function matchesAddress(value: unknown, expected: string): boolean {
  return typeof value === "string" && value.toLowerCase() === expected.toLowerCase();
}

function isExplicitlyUnsettled(record: Record<string, unknown>): boolean {
  const isSettled = booleanValue(readAny(record, "is_settled", "isSettled"));
  return isSettled === false;
}

async function reconcileClaimedAgentWalletBindings({
  platformStore,
  walletStore
}: {
  platformStore: PlatformMockStore;
  walletStore: MemoryWalletStore;
}): Promise<void> {
  const wallets = await walletStore.listWallets();
  for (const wallet of wallets) {
    if (wallet.bindingMode !== "claimed_agent" || wallet.status !== "active") {
      continue;
    }

    const agent = platformStore.getAgent(wallet.agentId);
    if (!agent) {
      continue;
    }

    const current = platformStore.getTradingWalletByAgentId(wallet.agentId);
    if (current?.id === wallet.id && current.address.toLowerCase() === wallet.address.toLowerCase()) {
      continue;
    }

    platformStore.bindTradingWallet(wallet.agentId, wallet.address, {
      id: wallet.id,
      testnetSuiBalance: current?.testnetSuiBalance ?? "0",
      quoteBalance: current?.quoteBalance ?? "0",
      predictManagerStatus: current?.predictManagerStatus ?? "missing",
      predictManagerId: current?.predictManagerId ?? null
    });
  }
}

const minPredictSetupSuiMist = 100_000_000n;

async function ensurePredictManager({
  wallet,
  balances,
  resolveManager,
  setupExecutor,
  enablePredictSubmit
}: {
  wallet: InternalTradingWallet;
  balances: InternalWalletBalances;
  resolveManager: (wallet: InternalTradingWallet) => Promise<DiscoveredPredictManager | null>;
  setupExecutor: PredictSetupExecutor;
  enablePredictSubmit: boolean;
}): Promise<DiscoveredPredictManager | null> {
  const manager = await resolveManager(wallet);
  if (manager) {
    return manager;
  }

  if (
    !enablePredictSubmit ||
    !setupExecutor.submitCreateManager ||
    !rawAmountAtLeast(balances.suiBalanceRaw, minPredictSetupSuiMist)
  ) {
    return null;
  }

  try {
    const transaction = await setupExecutor.submitCreateManager({ wallet });
    if (!transaction.managerId) {
      return null;
    }

    return {
      managerId: transaction.managerId,
      ownerAddress: wallet.address,
      address: wallet.address,
      source: "event"
    };
  } catch {
    return null;
  }
}

async function ensureManagerDeposit({
  wallet,
  manager,
  balances,
  setupExecutor,
  tradeExecutor,
  enablePredictSubmit
}: {
  wallet: InternalTradingWallet;
  manager: DiscoveredPredictManager;
  balances: InternalWalletBalances;
  setupExecutor: PredictSetupExecutor;
  tradeExecutor: PredictTradeExecutor;
  enablePredictSubmit: boolean;
}): Promise<string | null> {
  const managerBalanceRaw = await readManagerBalanceRaw(tradeExecutor, wallet, manager.managerId);
  const walletDusdcRaw = balances.dusdcBalanceRaw;
  if (
    !enablePredictSubmit ||
    !setupExecutor.submitDeposit ||
    !rawAmountAtLeast(walletDusdcRaw, 1n)
  ) {
    return managerBalanceRaw;
  }

  try {
    await setupExecutor.submitDeposit({
      wallet,
      managerId: manager.managerId,
      amountRaw: walletDusdcRaw
    });
    return addRawAmounts(managerBalanceRaw ?? "0", walletDusdcRaw);
  } catch {
    return managerBalanceRaw;
  }
}

async function readManagerBalanceRaw(
  tradeExecutor: PredictTradeExecutor,
  wallet: InternalTradingWallet,
  managerId: string
): Promise<string | null> {
  if (!tradeExecutor.resolveManagerBalance) {
    return null;
  }

  try {
    const balance = await tradeExecutor.resolveManagerBalance({
      wallet,
      managerId
    });
    return balance.balanceRaw;
  } catch {
    return null;
  }
}

function runtimeModeFromEnv(env: Record<string, string | undefined>): AgentArenaRuntimeMode {
  const value = env.AGENT_ARENA_RUNTIME_MODE?.trim().toLowerCase();
  if (value === "real") {
    return "real";
  }

  return "mock";
}

function createDefaultPlatformStore(
  env: Record<string, string | undefined>,
  runtimeMode: AgentArenaRuntimeMode
): PlatformMockStore {
  const dbPath = getConfiguredPlatformDbPath(env);
  if (dbPath || runtimeMode === "real") {
    return new SQLitePlatformStore(dbPath ?? getDefaultPlatformDbPath(env));
  }

  return new PlatformMockStore();
}

function getConfiguredPlatformDbPath(env: Record<string, string | undefined>): string | null {
  const configured = env.AGENT_ARENA_PLATFORM_DB_PATH?.trim() || Bun.env.AGENT_ARENA_PLATFORM_DB_PATH?.trim();
  return configured ? resolveBackendPath(configured) : null;
}

export function getDefaultPlatformDbPath(env: Record<string, string | undefined> | undefined = Bun.env): string {
  const configured = env?.AGENT_ARENA_PLATFORM_DB_PATH?.trim()
    || Bun.env.AGENT_ARENA_PLATFORM_DB_PATH?.trim()
    || env?.AGENT_ARENA_DB_PATH?.trim()
    || Bun.env.AGENT_ARENA_DB_PATH?.trim();
  return configured ? resolveBackendPath(configured) : join(import.meta.dir, "..", "data", "agent-arena.sqlite");
}

function resolveBackendPath(path: string): string {
  return isAbsolute(path) ? path : join(import.meta.dir, "..", path);
}

function formatRawUnits(raw: string, decimals: number): string {
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    return "0";
  }

  const padded = normalized.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+(?=\d)/, "");
  const fractional = padded.slice(-decimals).replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}

function rawAmountAtLeast(raw: string, minimum: bigint): boolean {
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    return false;
  }

  return BigInt(normalized) >= minimum;
}

function addRawAmounts(left: string, right: string): string {
  return (BigInt(left) + BigInt(right)).toString();
}

export function createDefaultAttributionStore(): SQLiteAttributionStore {
  return new SQLiteAttributionStore(getDefaultAttributionDbPath());
}

export function getDefaultAttributionDbPath(): string {
  return Bun.env.AGENT_ARENA_DB_PATH ?? join(import.meta.dir, "..", "data", "agent-arena.sqlite");
}

export function getDefaultServerHostname(env: Record<string, string | undefined> = Bun.env): string | undefined {
  return env.AGENT_ARENA_BACKEND_HOST?.trim() || env.HOST?.trim() || undefined;
}

export function startAttributionServer(port = Number(Bun.env.PORT ?? 8787), hostname = getDefaultServerHostname()) {
  return Bun.serve({
    hostname,
    port,
    fetch: createAgentArenaFetchHandler()
  });
}

if (import.meta.main) {
  const server = startAttributionServer();
  console.log(`Agent Arena attribution backend listening on http://${server.hostname ?? "localhost"}:${server.port}`);
}
