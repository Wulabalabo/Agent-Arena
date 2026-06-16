import { describe, expect, it } from "bun:test";
import { createInternalPredictFetchHandler } from "./internal-api";
import { createMemoryExecutionStore } from "./execution-store";
import { createMemoryWalletStore } from "./wallet-store";
import type { CoinBalanceReader } from "./types";

const internalToken = "secret";
const authHeaders = {
  "content-type": "application/json",
  "x-agent-arena-internal-token": internalToken
};
const quoteAssetType = "0xquote::dusdc::DUSDC";
const envQuoteAssetType = "0xenvquote::dusdc::DUSDC";
const validPredictEnv = {
  AGENT_ARENA_NETWORK: "testnet",
  AGENT_ARENA_SUI_RPC_URL: "https://fullnode.testnet.sui.io:443",
  AGENT_ARENA_PREDICT_SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
  AGENT_ARENA_PREDICT_PACKAGE_ID: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  AGENT_ARENA_PREDICT_OBJECT_ID: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  AGENT_ARENA_SUI_CLOCK_OBJECT_ID: "0x6",
  AGENT_ARENA_QUOTE_ASSET_TYPE: envQuoteAssetType,
  AGENT_ARENA_QUOTE_DECIMALS: "6",
  AGENT_ARENA_PRICE_DECIMALS: "9",
  AGENT_ARENA_INTERNAL_TOKEN: internalToken,
  AGENT_ARENA_WALLET_SECRET: "env-wallet-secret"
};

async function createWallet(fetch: ReturnType<typeof createInternalPredictFetchHandler>) {
  const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe",
      label: "first-probe"
    })
  }));

  expect(response.status).toBe(201);
  return await response.json();
}

describe("createInternalPredictFetchHandler", () => {
  it("rejects unauthenticated internal OPTIONS requests", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "OPTIONS"
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("reports disabled internal API for OPTIONS when the expected token is blank", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken: "   " });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "OPTIONS"
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INTERNAL_API_DISABLED"
      }
    });
  });

  it("allows authenticated internal OPTIONS requests", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "OPTIONS",
      headers: { "x-agent-arena-internal-token": internalToken }
    }));

    expect(response.status).toBe(204);
  });

  it("rejects unauthenticated internal wallet creation", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent_internal_001",
        bindingMode: "internal_probe"
      })
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("fails closed when wallet creation has no injected store or Predict config", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken, env: {} });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      headers: authHeaders,
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

  it("fails closed when only a wallet secret is provided without full Predict config", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletSecret: "wallet-secret",
      env: {}
    } as never);
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      headers: authHeaders,
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

  it("creates an internal wallet from valid env-backed Predict config and funding uses configured quote asset", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      env: validPredictEnv
    });

    const body = await createWallet(fetch);

    expect(body.wallet).toMatchObject({
      id: "wallet_internal_001",
      agentId: "agent_internal_001"
    });
    expect(body.funding.requiredAssets[1]).toMatchObject({
      symbol: "DUSDC",
      type: envQuoteAssetType
    });
    expect(JSON.stringify(body)).not.toContain("privateKey");
    expect(JSON.stringify(body)).not.toContain("encryptedPrivateKey");
  });

  it("creates an internal wallet without returning private key material", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });

    const body = await createWallet(fetch);

    expect(body.wallet).toMatchObject({
      id: "wallet_internal_001",
      agentId: "agent_internal_001",
      bindingMode: "internal_probe",
      keyScheme: "ed25519",
      testnetOnly: true
    });
    expect(body.wallet.address).toMatch(/^0x/);
    expect(body.funding).toMatchObject({
      network: "testnet",
      requiredAssets: [
        {
          symbol: "SUI",
          purpose: "gas"
        },
        {
          symbol: "DUSDC",
          type: quoteAssetType,
          decimals: 6,
          purpose: "Predict quote asset"
        }
      ]
    });
    expect(JSON.stringify(body)).not.toContain("privateKey");
    expect(JSON.stringify(body)).not.toContain("encryptedPrivateKey");
  });

  it("uses an injected balance reader and formats raw SUI and DUSDC values", async () => {
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "1234567890";
      },
      async getCoinBalance() {
        return "42000000";
      }
    };
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({
        walletSecret: "wallet-secret",
        quoteAssetType,
        balanceReader
      }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request(
      `http://localhost/api/arena/internal/wallets/${created.wallet.id}/balances`,
      { headers: authHeaders }
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      walletId: created.wallet.id,
      address: created.wallet.address,
      balances: {
        suiMist: "1234567890",
        sui: "1.234567890",
        dusdcRaw: "42000000",
        dusdc: "42.000000"
      },
      fundingStatus: "funded"
    });
  });

  it("returns a clear balance-reader error when balances are not configured", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request(
      `http://localhost/api/arena/internal/wallets/${created.wallet.id}/balances`,
      { headers: authHeaders }
    ));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "BALANCE_READER_NOT_CONFIGURED"
      }
    });
  });

  it("reports missing-manager dry-run setup as create-only with deposit blocked", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/setup", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        depositDusdcRaw: "5000000",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      walletId: created.wallet.id,
      address: created.wallet.address,
      setupPhases: {
        managerDiscovery: "missing",
        createManager: "dry_run_only",
        depositStatus: "blocked_until_manager_exists"
      },
      transactions: []
    });
  });

  it("previews a directional operation with a typed operation plan and no private material", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/preview", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_directional",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        isUp: true,
        quantityRaw: "100000",
        estimatedCostRaw: "8006",
        estimatedProceedsRaw: "0"
      })
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      operation: "mint_directional",
      quote: {
        previewSource: "request_estimate",
        estimatedCostRaw: "8006",
        estimatedCost: "0.008006",
        estimatedProceedsRaw: "0",
        estimatedProceeds: "0.000000"
      },
      operationPlan: {
        operation: "preview_directional",
        moveTargets: ["predict::get_trade_amounts"],
        keyInputs: {
          direction: "up",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000"
        }
      }
    });
    expect(JSON.stringify(body)).not.toContain("privateKey");
    expect(JSON.stringify(body)).not.toContain("encryptedPrivateKey");
  });

  it("rejects numeric raw quantity values instead of stringifying them", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/preview", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_directional",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        isUp: true,
        quantityRaw: 100000
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_RAW_AMOUNT"
      }
    });
  });

  it("rejects preview invalid range bounds with a stable planner code", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/preview", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_range",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "66000000000000",
        higherStrikeRaw: "65000000000000",
        quantityRaw: "100000"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_RANGE_BOUNDS"
      }
    });
  });

  it("rejects preview for deposit operations with a stable unsupported-operation code", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/preview", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "deposit_dusdc",
        quantityRaw: "100000"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREVIEW_UNSUPPORTED_OPERATION"
      }
    });
  });

  it("rejects preview for manager creation with a stable unsupported-operation code", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/preview", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "create_manager"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREVIEW_UNSUPPORTED_OPERATION"
      }
    });
  });

  it("records a disabled execution after validating guardrails and refusing real submit", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_directional",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        isUp: true,
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        estimatedCostRaw: "8006"
      })
    }));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREDICT_SUBMIT_DISABLED"
      },
      execution: {
        id: "exec_internal_001",
        walletId: created.wallet.id,
        agentId: "agent_internal_001",
        status: "failed",
        errorCode: "PREDICT_SUBMIT_DISABLED",
        policyDrift: "unknown",
        previewCostRaw: "8006",
        maxCostRaw: "1000000"
      }
    });

    await expect(executionStore.listExecutions({ walletId: created.wallet.id })).resolves.toMatchObject([
      {
        id: "exec_internal_001",
        errorCode: "PREDICT_SUBMIT_DISABLED"
      }
    ]);
  });

  it("rejects close_directional execute with caller quantity before creating an execution", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "close_directional",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        isUp: true,
        quantityRaw: "100000",
        minProceedsRaw: "1"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "CLOSE_QUANTITY_MUST_BE_BACKEND_RESOLVED"
      }
    });
    await expect(executionStore.listExecutions({ walletId: created.wallet.id })).resolves.toEqual([]);
  });

  it("rejects numeric guardrail estimates instead of skipping or stringifying them", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_directional",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        isUp: true,
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        estimatedCostRaw: 8006
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_RAW_AMOUNT"
      },
      execution: {
        id: "exec_internal_001",
        status: "failed",
        errorCode: "INVALID_RAW_AMOUNT"
      }
    });
  });

  it("fails execute before submit when request estimates violate guardrails", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_directional",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        isUp: true,
        quantityRaw: "100000",
        maxCostRaw: "1000",
        estimatedCostRaw: "1001"
      })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "MAX_COST_EXCEEDED"
      },
      execution: {
        id: "exec_internal_001",
        status: "failed",
        errorCode: "MAX_COST_EXCEEDED"
      }
    });
  });

  it("lists executions filtered by wallet id", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType
    });
    const first = await createWallet(fetch);
    const secondWalletResponse = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        agentId: "agent_internal_002",
        bindingMode: "internal_probe"
      })
    }));
    const second = await secondWalletResponse.json();

    await executionStore.createExecution({
      walletId: first.wallet.id,
      agentId: first.wallet.agentId,
      operation: "mint_directional",
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      operationPlan: {
        operation: "mint_directional",
        moveTargets: ["market_key::up", "predict::mint"],
        keyInputs: {
          direction: "up",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000"
        },
        objectIds: {},
        expiryMs: "1780000000000",
        quantityRaw: "100000",
        maxCostRaw: "1000000"
      }
    });
    await executionStore.createExecution({
      walletId: second.wallet.id,
      agentId: second.wallet.agentId,
      operation: "redeem_directional",
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      operationPlan: {
        operation: "redeem_directional",
        moveTargets: ["market_key::new", "predict::redeem"],
        keyInputs: {
          direction: "down",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000"
        },
        objectIds: {},
        expiryMs: "1780000000000",
        quantityRaw: "50000",
        minProceedsRaw: "1"
      }
    });

    const response = await fetch(new Request(
      `http://localhost/api/arena/internal/predict/executions?walletId=${first.wallet.id}`,
      { headers: authHeaders }
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      executions: [
        {
          id: "exec_internal_001",
          walletId: first.wallet.id,
          operation: "mint_directional"
        }
      ]
    });
  });

  it("keeps public platform introspection free of internal endpoints", async () => {
    const { createAgentArenaFetchHandler } = await import("../server");
    const fetch = createAgentArenaFetchHandler({ internalToken });
    const response = await fetch(new Request("http://localhost/api/arena/__introspection"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("x-agent-arena-internal-token");
    expect(JSON.stringify(body)).not.toContain("/api/arena/internal");
  });
});
