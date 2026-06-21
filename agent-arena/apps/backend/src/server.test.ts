import { afterEach, describe, expect, it } from "bun:test";
import {
  createAgentArenaFetchHandler,
  createAttributionFetchHandler,
  getDefaultAttributionDbPath,
  getDefaultServerHostname
} from "./server";
import { AttributionStore, type CreateAttributionInput } from "./attribution";
import type { CoinBalanceReader } from "./predict/types";
import type { PredictServerClient } from "./predict/predict-server-client";
import type { PredictSetupExecutor } from "./predict/setup-executor";
import type { PredictTradeExecutor } from "./predict/trade-executor";
import { createMemoryWalletStore } from "./predict/wallet-store";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlatformMockStore } from "./platform/mock-store";
import { SQLitePlatformStore } from "./platform/sqlite-store";
import { Database } from "bun:sqlite";

const input: CreateAttributionInput = {
  userAddress: "0xuser",
  managerId: "0xmanager",
  roundId: "round-btc-15m",
  agentId: "volatility-sniper",
  oracleId: "0xoracle",
  digest: "0xdigest",
  predictPositionType: "directional",
  marketKey: "BTC_UP_60000",
  rangeKey: null,
  amount: 100,
  strategySnapshot: "Breakout after spread compression"
};
const tempPlatformDirs: string[] = [];

afterEach(() => {
  while (tempPlatformDirs.length > 0) {
    const dir = tempPlatformDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function restoreOptionalEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete Bun.env[key];
    return;
  }

  Bun.env[key] = value;
}

describe("createAttributionFetchHandler", () => {
  it("keeps attribution records in one backend instance", async () => {
    const fetch = createAttributionFetchHandler(new AttributionStore());

    await fetch(
      new Request("http://localhost/attributions", {
        method: "POST",
        body: JSON.stringify(input)
      })
    );

    const response = await fetch(new Request("http://localhost/attributions?userAddress=0xuser"));

    await expect(response.json()).resolves.toMatchObject({
      records: [
        {
          digest: "0xdigest",
          agentId: "volatility-sniper"
        }
      ]
    });
  });
});

describe("getDefaultAttributionDbPath", () => {
  it("defaults attribution persistence to a local SQLite data file", () => {
    expect(getDefaultAttributionDbPath()).toMatch(/data[/\\]agent-arena\.sqlite$/);
  });
});

describe("getDefaultServerHostname", () => {
  it("prefers Agent Arena backend host and falls back to HOST while ignoring blanks", () => {
    const originalArenaHost = Bun.env.AGENT_ARENA_BACKEND_HOST;
    const originalHost = Bun.env.HOST;

    try {
      Bun.env.AGENT_ARENA_BACKEND_HOST = "0.0.0.0";
      Bun.env.HOST = "127.0.0.1";
      expect(getDefaultServerHostname()).toBe("0.0.0.0");

      Bun.env.AGENT_ARENA_BACKEND_HOST = "   ";
      expect(getDefaultServerHostname()).toBe("127.0.0.1");

      delete Bun.env.AGENT_ARENA_BACKEND_HOST;
      delete Bun.env.HOST;
      expect(getDefaultServerHostname()).toBeUndefined();
    } finally {
      restoreOptionalEnv("AGENT_ARENA_BACKEND_HOST", originalArenaHost);
      restoreOptionalEnv("HOST", originalHost);
    }
  });
});

describe("createAgentArenaFetchHandler", () => {
  it("serves whitelisted Skill docs from the same backend", async () => {
    const fetch = createAgentArenaFetchHandler({ runtimeMode: "mock" });

    const response = await fetch(new Request("http://localhost/skills/agent-arena.md"));
    const blocked = await fetch(new Request("http://localhost/skills/../README.md"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(response.text()).resolves.toContain("# Agent Arena");
    expect(blocked.status).toBe(404);
  });

  it("serves Skill docs with the configured public Agent Arena URL", async () => {
    const fetch = createAgentArenaFetchHandler({
      predictEnv: {
        AGENT_ARENA_FRONTEND_BASE_URL: "https://arena.mindfrog.xyz"
      },
      runtimeMode: "mock"
    });

    const response = await fetch(new Request("https://arena.mindfrog.xyz/skills/agent-arena.md"));
    const markdown = await response.text();

    expect(response.status).toBe(200);
    expect(markdown).toContain("Read https://arena.mindfrog.xyz/skills/agent-arena.md");
    expect(markdown).toContain('"baseUrl": "https://arena.mindfrog.xyz/api/arena"');
    expect(markdown).not.toContain("http://127.0.0.1:8787");
  });

  it("exposes a Skill manifest under the platform API", async () => {
    const fetch = createAgentArenaFetchHandler({ runtimeMode: "mock" });
    const response = await fetch(new Request("http://localhost/api/arena/skills"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      skills: expect.arrayContaining([
        {
          id: "agent-arena",
          title: "Agent Arena",
          url: "/skills/agent-arena.md"
        },
        {
          id: "deepbook-predict-btc-15m",
          title: "DeepBook Predict BTC 15m",
          url: "/skills/deepbook-predict-btc-15m.md"
        }
      ])
    });
  });

  it("rejects internal routes without the internal token", async () => {
    const fetch = createAgentArenaFetchHandler({ internalToken: "secret", runtimeMode: "mock" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("fails closed for authenticated internal wallet creation when Predict config is missing", async () => {
    const fetch = createAgentArenaFetchHandler({ internalToken: "secret", predictEnv: {}, runtimeMode: "mock" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      headers: { "x-agent-arena-internal-token": "secret" },
      body: JSON.stringify({
        agentId: "agent_internal_001",
        bindingMode: "internal_probe"
      })
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREDICT_CONFIG_REQUIRED"
      }
    });
  });

  it("can wire a claimed-Agent platform wallet store into owner claim without exposing private material", async () => {
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "mock",
      predictEnv: {
        AGENT_ARENA_ENABLE_REGISTRY_SUBMIT: "false"
      },
      platformWalletStore: createMemoryWalletStore({
        walletSecret: "platform-wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC"
      })
    });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Server Wallet Agent" })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.tradingWallet).toMatchObject({
      id: "wallet_internal_001",
      agentId: body.agent.id,
      predictManagerStatus: "missing"
    });
    expect(body.tradingWallet.address).toMatch(/^0x/);
    expect(JSON.stringify(body)).not.toContain("privateKey");
    expect(JSON.stringify(body)).not.toContain("encryptedPrivateKey");
  });

  it("rejects legacy owner claim when registry is enabled even if Sui RPC verifier is missing", async () => {
    const store = new PlatformMockStore();
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "mock",
      platformStore: store,
      predictEnv: {
        AGENT_ARENA_ENABLE_REGISTRY_SUBMIT: "true",
        AGENT_ARENA_NETWORK: "testnet",
        AGENT_ARENA_REGISTRY_PACKAGE_ID: "0xpackage",
        AGENT_ARENA_REGISTRY_OBJECT_ID: "0xregistry",
        AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY: "suiprivkey1example"
      }
    });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Registry Guard Agent" })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "CLAIM_FINALIZE_REQUIRED"
      }
    });
    expect(store.listAgents()).toEqual([]);
  });

  it("persists claimed Agents, wallet binding, and runtime credentials across handler restarts", async () => {
    const dbPath = createTempPlatformDbPath();
    const firstStore = new SQLitePlatformStore(dbPath);
    const firstFetch = createAgentArenaFetchHandler({
      runtimeMode: "mock",
      predictEnv: {
        AGENT_ARENA_ENABLE_REGISTRY_SUBMIT: "false"
      },
      platformStore: firstStore
    });
    let claimed: any;
    try {
      const draft = await (await firstFetch(new Request("http://localhost/api/arena/agent/init", {
        method: "POST",
        body: JSON.stringify({ displayName: "Persistent Agent" })
      }))).json();
      claimed = await (await firstFetch(new Request("http://localhost/api/arena/owner/agents/claim", {
        method: "POST",
        body: JSON.stringify({
          registrationCode: draft.registrationCode,
          ownerAddress: "0xpersistent_owner",
          signature: "0xsignedClaimMessage",
          twitterHandle: "@persist_ai"
        })
      }))).json();
    } finally {
      firstStore.close();
    }
    const persistedState = readPersistedPlatformState(dbPath);
    expect(persistedState).not.toContain(claimed.runtimeCredential.token);
    expect(persistedState).toContain("sha256:");

    const secondStore = new SQLitePlatformStore(dbPath);
    const secondFetch = createAgentArenaFetchHandler({
      runtimeMode: "mock",
      predictEnv: {
        AGENT_ARENA_ENABLE_REGISTRY_SUBMIT: "false"
      },
      platformStore: secondStore
    });
    try {
      const headers = { "x-agent-arena-agent-token": claimed.runtimeCredential.token };
      const meResponse = await secondFetch(new Request("http://localhost/api/arena/agent/me", { headers }));
      const walletResponse = await secondFetch(new Request("http://localhost/api/arena/agent/wallet", { headers }));

      expect(meResponse.status).toBe(200);
      await expect(meResponse.json()).resolves.toMatchObject({
        id: claimed.agent.id,
        displayName: "Persistent Agent",
        ownerAddress: "0xpersistent_owner",
        twitterHandle: "persist_ai",
        tradingWalletAddress: claimed.tradingWallet.address
      });
      expect(walletResponse.status).toBe(200);
      await expect(walletResponse.json()).resolves.toMatchObject({
        wallet: {
          id: claimed.tradingWallet.id,
          agentId: claimed.agent.id,
          address: claimed.tradingWallet.address,
          status: "active"
        }
      });
    } finally {
      secondStore.close();
    }
  });

  it("recovers a persisted claimed-Agent wallet binding after a duplicate wallet id overwrote the platform index", async () => {
    const dbPath = createTempPlatformDbPath();
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "1500000000";
      },
      async getCoinBalance() {
        return "10000000";
      }
    };
    const persistentWalletStore = createMemoryWalletStore({
      walletSecret: "platform-wallet-secret",
      quoteAssetType: "0xquote::dusdc::DUSDC",
      balanceReader
    });
    const firstStore = new SQLitePlatformStore(dbPath);
    const firstFetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: firstStore,
      platformWalletStore: persistentWalletStore,
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_PLATFORM_DB_PATH: dbPath,
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "false"
      }),
      balanceReader,
      predictServerClient: createRealRuntimePredictClient(() => [])
    });
    let claimed: any;
    try {
      const draft = await (await firstFetch(new Request("http://localhost/api/arena/agent/init", {
        method: "POST",
        body: JSON.stringify({ displayName: "Recoverable Agent" })
      }))).json();
      claimed = await (await firstFetch(new Request("http://localhost/api/arena/owner/agents/claim", {
        method: "POST",
        body: JSON.stringify({
          registrationCode: draft.registrationCode,
          ownerAddress: "0xrecoverable_owner",
          signature: "0xsignedClaimMessage"
        })
      }))).json();
      const staleAgent = firstStore.createClaimedAgent({
        displayName: "Stale Duplicate",
        ownerAddress: "0xstale_owner"
      });
      firstStore.bindTradingWallet(staleAgent.id, "0xstale_duplicate_wallet", {
        id: claimed.tradingWallet.id
      });
    } finally {
      firstStore.close();
    }

    const secondStore = new SQLitePlatformStore(dbPath);
    const secondFetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: secondStore,
      platformWalletStore: persistentWalletStore,
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_PLATFORM_DB_PATH: dbPath,
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "false"
      }),
      balanceReader,
      predictServerClient: createRealRuntimePredictClient(() => [])
    });
    try {
      const headers = { "x-agent-arena-agent-token": claimed.runtimeCredential.token };
      const meResponse = await secondFetch(new Request("http://localhost/api/arena/agent/me", { headers }));
      const walletResponse = await secondFetch(new Request("http://localhost/api/arena/agent/wallet", { headers }));

      expect(meResponse.status).toBe(200);
      await expect(meResponse.json()).resolves.toMatchObject({
        id: claimed.agent.id,
        tradingWalletId: claimed.tradingWallet.id,
        tradingWalletAddress: claimed.tradingWallet.address
      });
      expect(walletResponse.status).toBe(200);
      await expect(walletResponse.json()).resolves.toMatchObject({
        wallet: {
          id: claimed.tradingWallet.id,
          agentId: claimed.agent.id,
          address: claimed.tradingWallet.address,
          status: "active",
          quoteBalance: "10000000"
        }
      });
    } finally {
      secondStore.close();
    }
  });

  it("wires real runtime mode through shared wallet, balance, and Predict market data dependencies", async () => {
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "715524060";
      },
      async getCoinBalance() {
        return "3000602";
      }
    };
    const predictServerClient: PredictServerClient = {
      async getStatus() {
        return { current_time_ms: 1781715000000 };
      },
      async getPredictOracles() {
        return [{
          predict_id: "0xpredict",
          oracle_id: "0xreal_oracle",
          underlying_asset: "BTC",
          expiry: 1781715600000,
          strike: 65800000000000,
          min_strike: 50000000000000,
          tick_size: 1000000000,
          status: "active"
        }];
      },
      async getOracleState() {
        return {
          latest_price: {
            spot: 65866527537529,
            forward: 65867070507763
          }
        };
      },
      async getManagers() {
        return [];
      },
      async getMintedPositions() {
        return [];
      },
      async getRedeemedPositions() {
        return [];
      },
      async getMintedRanges() {
        return [];
      },
      async getRedeemedRanges() {
        return [];
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: new PlatformMockStore(),
      predictEnv: {
        AGENT_ARENA_NETWORK: "testnet",
        AGENT_ARENA_SUI_RPC_URL: "https://fullnode.testnet.sui.io:443",
        AGENT_ARENA_PREDICT_SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
        AGENT_ARENA_PREDICT_PACKAGE_ID: "0xpackage",
        AGENT_ARENA_PREDICT_OBJECT_ID: "0xpredict",
        AGENT_ARENA_SUI_CLOCK_OBJECT_ID: "0x6",
        AGENT_ARENA_QUOTE_ASSET_TYPE: "0xquote::dusdc::DUSDC",
        AGENT_ARENA_QUOTE_DECIMALS: "6",
        AGENT_ARENA_PRICE_DECIMALS: "9",
        AGENT_ARENA_INTERNAL_TOKEN: "secret",
        AGENT_ARENA_WALLET_SECRET: "platform-wallet-secret"
      },
      balanceReader,
      platformWalletStore: createMemoryWalletStore({
        walletSecret: "platform-wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC",
        balanceReader
      }),
      predictServerClient
    });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Real Runtime Agent" })
    }))).json();
    const claimed = await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }))).json();

    const wallet = await fetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));
    const market = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/market-state"));

    await expect(wallet.json()).resolves.toMatchObject({
      wallet: {
        id: "wallet_internal_001",
        testnetSuiBalance: "0.71552406",
        quoteBalance: "3000602",
        predictManagerStatus: "missing"
      }
    });
    await expect(market.json()).resolves.toMatchObject({
      marketState: {
        oracleId: "0xreal_oracle",
        spotPriceRaw: "65866527537529",
        forwardPriceRaw: "65867070507763",
        executableMarkets: {
          directional: {
            oracleId: "0xreal_oracle",
            expiry: "1781715600000",
            strike: "65800000000000"
          }
        }
      }
    });
  });

  it("auto-creates a PredictManager for a funded claimed-Agent wallet in real runtime", async () => {
    const setupCalls: string[] = [];
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "1500000000";
      },
      async getCoinBalance() {
        return "10000000";
      }
    };
    const setupExecutor: PredictSetupExecutor = {
      async submitCreateManager({ wallet }) {
        setupCalls.push(wallet.id);
        return {
          operation: "create_manager",
          mode: "submit",
          status: "submitted",
          txDigest: "0xsetupdigest",
          managerId: "0xmanager_auto"
        };
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: new PlatformMockStore(),
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      balanceReader,
      platformWalletStore: createMemoryWalletStore({
        walletSecret: "platform-wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC",
        balanceReader
      }),
      predictServerClient: createRealRuntimePredictClient(() => (
        setupCalls.length > 0
          ? [{ managerId: "0xmanager_auto", ownerAddress: createdWalletAddress }]
          : []
      )),
      predictSetupExecutor: setupExecutor
    });
    let createdWalletAddress = "";
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Ready Runtime Agent" })
    }))).json();

    const claimResponse = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }));
    const claimed = await claimResponse.json();
    createdWalletAddress = claimed.tradingWallet.address;

    expect(claimResponse.status).toBe(201);
    expect(setupCalls).toEqual(["wallet_internal_001"]);
    expect(claimed.tradingWallet).toMatchObject({
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager_auto"
    });

    const wallet = await fetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));

    await expect(wallet.json()).resolves.toMatchObject({
      wallet: {
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager_auto"
      }
    });
    expect(setupCalls).toEqual(["wallet_internal_001"]);
  });

  it("auto-creates a PredictManager after a claimed-Agent wallet is funded", async () => {
    let suiBalanceRaw = "0";
    let quoteBalanceRaw = "0";
    let createdWalletAddress = "";
    const setupCalls: string[] = [];
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return suiBalanceRaw;
      },
      async getCoinBalance() {
        return quoteBalanceRaw;
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: new PlatformMockStore(),
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      balanceReader,
      platformWalletStore: createMemoryWalletStore({
        walletSecret: "platform-wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC",
        balanceReader
      }),
      predictServerClient: createRealRuntimePredictClient(() => (
        setupCalls.length > 0
          ? [{ managerId: "0xmanager_after_funding", ownerAddress: createdWalletAddress }]
          : []
      )),
      predictSetupExecutor: {
        async submitCreateManager({ wallet }) {
          setupCalls.push(wallet.id);
          return {
            operation: "create_manager",
            mode: "submit",
            status: "submitted",
            txDigest: "0xsetupdigest",
            managerId: "0xmanager_after_funding"
          };
        }
      }
    });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Fund Later Agent" })
    }))).json();
    const claimed = await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }))).json();
    createdWalletAddress = claimed.tradingWallet.address;

    expect(claimed.tradingWallet).toMatchObject({
      predictManagerStatus: "missing",
      predictManagerId: null
    });
    expect(setupCalls).toEqual([]);

    suiBalanceRaw = "1500000000";
    quoteBalanceRaw = "10000000";
    const wallet = await fetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));

    await expect(wallet.json()).resolves.toMatchObject({
      wallet: {
        testnetSuiBalance: "1.5",
        quoteBalance: "10000000",
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager_after_funding"
      }
    });
    expect(setupCalls).toEqual(["wallet_internal_001"]);
  });

  it("auto-deposits funded claimed-Agent DUSDC into a ready PredictManager", async () => {
    let walletDusdcRaw = "10000000";
    let managerBalanceRaw = "0";
    let createdWalletAddress = "";
    const deposits: Array<{ walletId: string; managerId: string; amountRaw: string }> = [];
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "1500000000";
      },
      async getCoinBalance() {
        return walletDusdcRaw;
      }
    };
    const setupExecutor: PredictSetupExecutor = {
      async submitDeposit({ wallet, managerId, amountRaw }) {
        deposits.push({ walletId: wallet.id, managerId, amountRaw });
        managerBalanceRaw = (BigInt(managerBalanceRaw) + BigInt(amountRaw)).toString();
        walletDusdcRaw = "0";
        return {
          operation: "deposit_dusdc",
          mode: "submit",
          status: "submitted",
          txDigest: "0xdepositdigest",
          managerId,
          amountRaw
        };
      }
    };
    const tradeExecutor: PredictTradeExecutor = {
      async resolveManagerBalance(input) {
        return {
          ...input,
          balanceRaw: managerBalanceRaw
        };
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: new PlatformMockStore(),
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      balanceReader,
      platformWalletStore: createMemoryWalletStore({
        walletSecret: "platform-wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC",
        balanceReader
      }),
      predictServerClient: createRealRuntimePredictClient(() => (
        createdWalletAddress
          ? [{ managerId: "0xmanager_ready", ownerAddress: createdWalletAddress }]
          : []
      )),
      predictSetupExecutor: setupExecutor,
      predictTradeExecutor: tradeExecutor
    });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Auto Deposit Agent" })
    }))).json();
    const claimed = await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }))).json();
    createdWalletAddress = claimed.tradingWallet.address;

    const wallet = await fetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));

    await expect(wallet.json()).resolves.toMatchObject({
      wallet: {
        quoteBalance: "10000000",
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager_ready"
      }
    });
    expect(deposits).toEqual([
      {
        walletId: "wallet_internal_001",
        managerId: "0xmanager_ready",
        amountRaw: "10000000"
      }
    ]);
  });

  it("allows PredictManager auto-setup once the claimed-Agent wallet has 0.1 Testnet SUI", async () => {
    const setupCalls: string[] = [];
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "100000000";
      },
      async getCoinBalance() {
        return "10000000";
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore: new PlatformMockStore(),
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      balanceReader,
      platformWalletStore: createMemoryWalletStore({
        walletSecret: "platform-wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC",
        balanceReader
      }),
      predictServerClient: createRealRuntimePredictClient(() => (
        setupCalls.length > 0
          ? [{ managerId: "0xmanager_min_gas", ownerAddress: createdWalletAddress }]
          : []
      )),
      predictSetupExecutor: {
        async submitCreateManager({ wallet }) {
          setupCalls.push(wallet.id);
          return {
            operation: "create_manager",
            mode: "submit",
            status: "submitted",
            txDigest: "0xsetupdigest",
            managerId: "0xmanager_min_gas"
          };
        }
      }
    });
    let createdWalletAddress = "";
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Min Gas Agent" })
    }))).json();

    const claimed = await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }))).json();
    createdWalletAddress = claimed.tradingWallet.address;

    expect(claimed.tradingWallet).toMatchObject({
      testnetSuiBalance: "0.1",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager_min_gas"
    });
    expect(setupCalls).toEqual(["wallet_internal_001"]);
  });

  it("routes real-runtime settlement reconciliation through the internal Predict executor", async () => {
    const platformStore = new PlatformMockStore();
    const walletStore = createMemoryWalletStore({
      walletSecret: "platform-wallet-secret",
      quoteAssetType: "0xquote::dusdc::DUSDC"
    });
    const agent = platformStore.createClaimedAgent({
      displayName: "Settlement Runtime Agent",
      ownerAddress: "0xowner",
      twitterHandle: null
    });
    const internalWallet = await walletStore.createWallet({
      agentId: agent.id,
      bindingMode: "claimed_agent",
      label: "claimed-agent:Settlement Runtime Agent"
    });
    const wallet = platformStore.bindTradingWallet(agent.id, internalWallet.address, {
      id: internalWallet.id,
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
    });
    const expiryMs = "1781700900000";
    const submissions: unknown[] = [];
    const tradeExecutor: PredictTradeExecutor = {
      async resolveDirectionalPosition(input) {
        return {
          ...input,
          quantityRaw: "500000"
        };
      },
      async submitRedeemDirectional(input) {
        submissions.push(input);
        return {
          operation: "claim_settled_directional",
          mode: "submit",
          status: "submitted",
          txDigest: "claim-digest",
          managerId: input.managerId,
          oracleId: input.oracleId,
          expiryMs: input.expiryMs,
          strikeRaw: input.strikeRaw,
          direction: input.direction,
          quantityRaw: input.quantityRaw,
          minProceedsRaw: input.minProceedsRaw,
          actualProceedsRaw: "5500000"
        };
      }
    };

    platformStore.updateAgentExposureStatus(agent.id, "directional");
    platformStore.savePositionSnapshot({
      agentId: agent.id,
      competitionId: "btc-15m-001",
      positionRef: {
        kind: "directional",
        marketKey: "btc-up-62929000000000",
        openExecutionId: "exec_open",
        quantity: "500000"
      },
      oracleId: "0xbtc15m",
      expiryMs,
      strikeRaw: "62929000000000",
      direction: "up",
      quantityRaw: "500000",
      status: "open",
      updatedAt: "2026-06-17T12:50:00.000Z"
    });
    platformStore.recordPerformanceLedger({
      kind: "execution",
      agentDraftId: null,
      registrationCodeHash: null,
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: wallet.predictManagerId,
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      expiryMs,
      intentId: "intent_open",
      riskDecisionId: "risk_open",
      executionId: "exec_open",
      txDigest: "open-digest",
      action: "open_directional",
      positionKind: "directional",
      quantityRaw: "500000",
      costRaw: "5000000",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T12:51:00.000Z",
      serverReceivedAt: "2026-06-17T12:51:00.000Z"
    });

    const predictServerClient = {
      ...createRealRuntimePredictClient(() => [{ managerId: "0xmanager", ownerAddress: wallet.address }]),
      async getOracleState() {
        return {
          oracle_id: "0xbtc15m",
          underlying_asset: "BTC",
          expiry: Number(expiryMs),
          strike: 62929000000000,
          min_strike: 50000000000000,
          tick_size: 1000000000,
          status: "settled"
        };
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore,
      platformWalletStore: walletStore,
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      predictServerClient,
      predictTradeExecutor: tradeExecutor
    });

    const response = await fetch(new Request("http://localhost/api/arena/settlements/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-arena-internal-token": "secret"
      },
      body: JSON.stringify({})
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{
        agentId: agent.id,
        status: "claimed",
        claimStatus: "confirmed",
        txDigest: "claim-digest"
      }]
    });
    expect(submissions).toMatchObject([{
      operation: "claim_settled_directional",
      managerId: "0xmanager",
      oracleId: "0xbtc15m",
      expiryMs,
      strikeRaw: "62929000000000",
      direction: "up",
      minProceedsRaw: "0",
      quantityRaw: "500000"
    }]);
    expect(platformStore.getAgent(agent.id)?.exposureStatus).toBe("flat");
  });

  it("reconciles real-runtime settlement when Predict already redeemed the position", async () => {
    const platformStore = new PlatformMockStore();
    const walletStore = createMemoryWalletStore({
      walletSecret: "platform-wallet-secret",
      quoteAssetType: "0xquote::dusdc::DUSDC"
    });
    const agent = platformStore.createClaimedAgent({
      displayName: "Externally Redeemed Agent",
      ownerAddress: "0xowner",
      twitterHandle: null
    });
    const internalWallet = await walletStore.createWallet({
      agentId: agent.id,
      bindingMode: "claimed_agent",
      label: "claimed-agent:Externally Redeemed Agent"
    });
    const wallet = platformStore.bindTradingWallet(agent.id, internalWallet.address, {
      id: internalWallet.id,
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
    });
    const expiryMs = "1781700900000";
    const submissions: unknown[] = [];
    const tradeExecutor: PredictTradeExecutor = {
      async resolveDirectionalPosition(input) {
        return {
          ...input,
          quantityRaw: "0"
        };
      },
      async submitRedeemDirectional(input) {
        submissions.push(input);
        throw new Error("empty position should not be submitted");
      }
    };

    platformStore.updateAgentExposureStatus(agent.id, "directional");
    platformStore.savePositionSnapshot({
      agentId: agent.id,
      competitionId: "btc-15m-001",
      positionRef: {
        kind: "directional",
        marketKey: "btc-up-62929000000000",
        openExecutionId: "exec_open",
        quantity: "500000"
      },
      oracleId: "0xbtc15m",
      expiryMs,
      strikeRaw: "62929000000000",
      direction: "up",
      quantityRaw: "500000",
      status: "open",
      updatedAt: "2026-06-17T12:50:00.000Z"
    });
    platformStore.recordPerformanceLedger({
      kind: "execution",
      agentDraftId: null,
      registrationCodeHash: null,
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: wallet.predictManagerId,
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      expiryMs,
      intentId: "intent_open",
      riskDecisionId: "risk_open",
      executionId: "exec_open",
      txDigest: "open-digest",
      action: "open_directional",
      positionKind: "directional",
      quantityRaw: "500000",
      costRaw: "245150",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T12:51:00.000Z",
      serverReceivedAt: "2026-06-17T12:51:00.000Z"
    });

    const predictServerClient = {
      ...createRealRuntimePredictClient(() => [{ managerId: "0xmanager", ownerAddress: wallet.address }]),
      async getOracleState() {
        return {
          oracle_id: "0xbtc15m",
          underlying_asset: "BTC",
          expiry: Number(expiryMs),
          strike: 62929000000000,
          min_strike: 50000000000000,
          tick_size: 1000000000,
          status: "settled"
        };
      },
      async getRedeemedPositions() {
        return [{
          digest: "external-redeem-digest",
          manager_id: "0xmanager",
          owner: wallet.address,
          oracle_id: "0xbtc15m",
          expiry: Number(expiryMs),
          strike: 62929000000000,
          is_up: true,
          quantity: 500000,
          payout: 500000,
          is_settled: true
        }];
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore,
      platformWalletStore: walletStore,
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      predictServerClient,
      predictTradeExecutor: tradeExecutor
    });

    const response = await fetch(new Request("http://localhost/api/arena/settlements/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-arena-internal-token": "secret"
      },
      body: JSON.stringify({})
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{
        agentId: agent.id,
        status: "claimed",
        claimStatus: "confirmed",
        txDigest: "external-redeem-digest"
      }]
    });
    expect(submissions).toEqual([]);
    expect(platformStore.getAgent(agent.id)?.exposureStatus).toBe("flat");
    expect(platformStore.listPositionSnapshots({ agentId: agent.id })).toMatchObject([{
      status: "settled"
    }]);
    expect(platformStore.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "position",
      txDigest: "external-redeem-digest",
      costRaw: "245150",
      proceedsRaw: "500000",
      realizedPnlRaw: "254850",
      status: "realized"
    }));
  });

  it("does not reconcile an external redemption without a matching owner wallet", async () => {
    const platformStore = new PlatformMockStore();
    const walletStore = createMemoryWalletStore({
      walletSecret: "platform-wallet-secret",
      quoteAssetType: "0xquote::dusdc::DUSDC"
    });
    const agent = platformStore.createClaimedAgent({
      displayName: "Missing Owner Redemption Agent",
      ownerAddress: "0xowner",
      twitterHandle: null
    });
    const internalWallet = await walletStore.createWallet({
      agentId: agent.id,
      bindingMode: "claimed_agent",
      label: "claimed-agent:Missing Owner Redemption Agent"
    });
    const wallet = platformStore.bindTradingWallet(agent.id, internalWallet.address, {
      id: internalWallet.id,
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
    });
    const expiryMs = "1781700900000";
    const tradeExecutor: PredictTradeExecutor = {
      async resolveDirectionalPosition(input) {
        return {
          ...input,
          quantityRaw: "0"
        };
      }
    };

    platformStore.updateAgentExposureStatus(agent.id, "directional");
    platformStore.savePositionSnapshot({
      agentId: agent.id,
      competitionId: "btc-15m-001",
      positionRef: {
        kind: "directional",
        marketKey: "btc-up-62929000000000",
        openExecutionId: "exec_open",
        quantity: "500000"
      },
      oracleId: "0xbtc15m",
      expiryMs,
      strikeRaw: "62929000000000",
      direction: "up",
      quantityRaw: "500000",
      status: "open",
      updatedAt: "2026-06-17T12:50:00.000Z"
    });
    platformStore.recordPerformanceLedger({
      kind: "execution",
      agentDraftId: null,
      registrationCodeHash: null,
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      tradingWalletId: wallet.id,
      walletAddress: wallet.address,
      predictManagerId: wallet.predictManagerId,
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      expiryMs,
      intentId: "intent_open",
      riskDecisionId: "risk_open",
      executionId: "exec_open",
      txDigest: "open-digest",
      action: "open_directional",
      positionKind: "directional",
      quantityRaw: "500000",
      costRaw: "245150",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-17T12:51:00.000Z",
      serverReceivedAt: "2026-06-17T12:51:00.000Z"
    });

    const predictServerClient = {
      ...createRealRuntimePredictClient(() => [{ managerId: "0xmanager", ownerAddress: wallet.address }]),
      async getOracleState() {
        return {
          oracle_id: "0xbtc15m",
          underlying_asset: "BTC",
          expiry: Number(expiryMs),
          strike: 62929000000000,
          min_strike: 50000000000000,
          tick_size: 1000000000,
          status: "settled"
        };
      },
      async getRedeemedPositions() {
        return [{
          digest: "external-redeem-digest",
          manager_id: "0xmanager",
          oracle_id: "0xbtc15m",
          expiry: Number(expiryMs),
          strike: 62929000000000,
          is_up: true,
          quantity: 500000,
          payout: 500000,
          is_settled: true
        }];
      }
    };
    const fetch = createAgentArenaFetchHandler({
      runtimeMode: "real",
      platformStore,
      platformWalletStore: walletStore,
      predictEnv: createRealRuntimeTestEnv({
        AGENT_ARENA_ENABLE_PREDICT_SUBMIT: "true"
      }),
      predictServerClient,
      predictTradeExecutor: tradeExecutor
    });

    const response = await fetch(new Request("http://localhost/api/arena/settlements/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-arena-internal-token": "secret"
      },
      body: JSON.stringify({})
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{
        agentId: agent.id,
        status: "failed",
        errorCode: "POSITION_NOT_FOUND"
      }]
    });
    expect(platformStore.getAgent(agent.id)?.exposureStatus).toBe("directional");
    expect(platformStore.listPositionSnapshots({ agentId: agent.id })).toMatchObject([{
      status: "open"
    }]);
  });
});

function createTempPlatformDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-arena-platform-"));
  tempPlatformDirs.push(dir);
  return join(dir, "platform.sqlite");
}

function readPersistedPlatformState(dbPath: string): string {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.query("SELECT state_json FROM platform_state WHERE id = 'default'")
      .get() as { state_json: string } | null;
    return row?.state_json ?? "";
  } finally {
    db.close();
  }
}

function createRealRuntimeTestEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    AGENT_ARENA_NETWORK: "testnet",
    AGENT_ARENA_SUI_RPC_URL: "https://fullnode.testnet.sui.io:443",
    AGENT_ARENA_PREDICT_SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
    AGENT_ARENA_PREDICT_PACKAGE_ID: "0xpackage",
    AGENT_ARENA_PREDICT_OBJECT_ID: "0xpredict",
    AGENT_ARENA_SUI_CLOCK_OBJECT_ID: "0x6",
    AGENT_ARENA_QUOTE_ASSET_TYPE: "0xquote::dusdc::DUSDC",
    AGENT_ARENA_QUOTE_DECIMALS: "6",
    AGENT_ARENA_PRICE_DECIMALS: "9",
    AGENT_ARENA_INTERNAL_TOKEN: "secret",
    AGENT_ARENA_WALLET_SECRET: "platform-wallet-secret",
    ...overrides
  };
}

function createRealRuntimePredictClient(
  getManagers: () => unknown[] | Promise<unknown[]>
): PredictServerClient {
  return {
    async getStatus() {
      return { current_time_ms: 1781715000000 };
    },
    async getPredictOracles() {
      return [{
        predict_id: "0xpredict",
        oracle_id: "0xreal_oracle",
        underlying_asset: "BTC",
        expiry: 1781715600000,
        strike: 65800000000000,
        min_strike: 50000000000000,
        tick_size: 1000000000,
        status: "active"
      }];
    },
    async getOracleState() {
      return {
        latest_price: {
          spot: 65866527537529,
          forward: 65867070507763
        }
      };
    },
    getManagers,
    async getMintedPositions() {
      return [];
    },
    async getRedeemedPositions() {
      return [];
    },
    async getMintedRanges() {
      return [];
    },
    async getRedeemedRanges() {
      return [];
    }
  };
}
