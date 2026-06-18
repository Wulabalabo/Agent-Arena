import { describe, expect, it } from "bun:test";
import { createInternalPredictFetchHandler } from "./internal-api";
import { createMemoryExecutionStore } from "./execution-store";
import { PredictOracleError } from "./oracle";
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

  it("rejects real setup submit when Predict submit is not explicitly enabled", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType,
      enablePredictSubmit: false
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/setup", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        depositDusdcRaw: "5000000",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREDICT_SUBMIT_DISABLED"
      },
      setupPhases: {
        managerDiscovery: "missing",
        createManager: "submit_required",
        depositStatus: "blocked_until_manager_exists"
      }
    });
  });

  it("submits create_manager through the setup executor when real submit is enabled", async () => {
    const submittedWallets: string[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType,
      enablePredictSubmit: true,
      setupExecutor: {
        async submitCreateManager(input) {
          submittedWallets.push(input.wallet.id);
          return {
            operation: "create_manager",
            mode: "submit",
            status: "submitted",
            txDigest: "digest-create",
            managerId: "0xmanager"
          };
        },
        async submitDeposit(input) {
          return {
            operation: "deposit_dusdc",
            mode: "submit",
            status: "submitted",
            txDigest: "digest-deposit",
            managerId: input.managerId,
            amountRaw: input.amountRaw
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/setup", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        depositDusdcRaw: "5000000",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      manager: {
        id: "0xmanager",
        status: "ready",
        source: "submitted"
      },
      setupPhases: {
        createManager: "submitted",
        depositStatus: "submitted"
      },
      transactions: [
        {
          operation: "create_manager",
          status: "submitted",
          txDigest: "digest-create",
          managerId: "0xmanager"
        },
        {
          operation: "deposit_dusdc",
          status: "submitted",
          txDigest: "digest-deposit",
          managerId: "0xmanager",
          amountRaw: "5000000"
        }
      ]
    });
    expect(submittedWallets).toEqual([created.wallet.id]);
  });

  it("reports deposit as not_requested when only create_manager is submitted", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType,
      enablePredictSubmit: true,
      setupExecutor: {
        async submitCreateManager() {
          return {
            operation: "create_manager",
            mode: "submit",
            status: "submitted",
            txDigest: "digest-create",
            managerId: "0xmanager"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/setup", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        depositDusdcRaw: "0",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      setupPhases: {
        createManager: "submitted",
        depositStatus: "not_requested"
      },
      transactions: [
        {
          operation: "create_manager",
          status: "submitted"
        }
      ]
    });
  });

  it("submits DUSDC deposit only when a verified manager already exists", async () => {
    const deposits: Array<{ managerId: string; amountRaw: string }> = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType,
      enablePredictSubmit: true,
      resolveManager: async (wallet) => ({
        managerId: "0xmanager",
        ownerAddress: wallet.address,
        address: wallet.address,
        source: "local"
      }),
      setupExecutor: {
        async submitDeposit(input) {
          deposits.push({
            managerId: input.managerId,
            amountRaw: input.amountRaw
          });
          return {
            operation: "deposit_dusdc",
            mode: "submit",
            status: "submitted",
            txDigest: "digest-deposit",
            managerId: input.managerId,
            quoteCoinObjectId: "0xcoin",
            amountRaw: input.amountRaw
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/setup", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        depositDusdcRaw: "5000000",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      manager: {
        id: "0xmanager",
        status: "ready",
        source: "local"
      },
      setupPhases: {
        createManager: "skip",
        depositStatus: "submitted"
      },
      transactions: [
        {
          operation: "deposit_dusdc",
          status: "submitted",
          txDigest: "digest-deposit",
          managerId: "0xmanager",
          amountRaw: "5000000"
        }
      ]
    });
    expect(deposits).toEqual([{ managerId: "0xmanager", amountRaw: "5000000" }]);
  });

  it("previews a directional operation with a typed operation plan and no private material", async () => {
    const confirmations: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType,
      confirmOracleForExecution: async (request: unknown) => {
        confirmations.push(request);
      }
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
    expect(confirmations).toEqual([
      expect.objectContaining({
        operation: "preview_directional",
        oracleId: "0xoracle",
        expiryMs: 1780000000000,
        strikeRaw: "65000000000000"
      })
    ]);
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

  it("dry-runs a directional mint execution without requiring submit enablement", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const dryRuns: unknown[] = [];
    const confirmations: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      confirmOracleForExecution: async (request: unknown) => {
        confirmations.push(request);
      },
      tradeExecutor: {
        async dryRunMintDirectional(input) {
          dryRuns.push(input);
          return {
            operation: "mint_directional",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            strikeRaw: input.strikeRaw,
            direction: input.direction,
            quantityRaw: input.quantityRaw,
            maxCostRaw: input.maxCostRaw,
            actualCostRaw: "8006"
          };
        }
      }
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
        direction: "down",
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        status: "dry_run_ok",
        dryRunDigest: "dry-run-digest",
        actualCostRaw: "8006",
        policyDrift: "none"
      },
      transaction: {
        operation: "mint_directional",
        mode: "dry_run",
        status: "dry_run_ok",
        direction: "down"
      }
    });
    expect(dryRuns).toHaveLength(1);
    expect(confirmations).toEqual([
      expect.objectContaining({
        operation: "mint_directional",
        oracleId: "0xoracle",
        expiryMs: 1780000000000,
        strikeRaw: "65000000000000"
      })
    ]);
    await expect(executionStore.listSigningAudits({
      executionId: "exec_internal_001"
    })).resolves.toMatchObject([
      {
        transactionKind: "predict_mint_dry_run",
        status: "confirmed",
        txDigest: "dry-run-digest"
      }
    ]);
  });

  it("rejects directional mint before dry-run when manager DUSDC balance is below max cost", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const dryRuns: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveManagerBalance(input) {
          return {
            ...input,
            balanceRaw: "0"
          };
        },
        async dryRunMintDirectional(input) {
          dryRuns.push(input);
          return {
            operation: "mint_directional",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "dry-run-digest",
            managerId: input.managerId
          };
        }
      }
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
        direction: "up",
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INSUFFICIENT_MANAGER_BALANCE"
      },
      execution: {
        id: "exec_internal_001",
        status: "failed",
        errorCode: "INSUFFICIENT_MANAGER_BALANCE"
      }
    });
    expect(dryRuns).toEqual([]);
  });

  it("submits a directional mint execution only when Predict submit is enabled", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const submissions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      enablePredictSubmit: true,
      tradeExecutor: {
        async submitMintDirectional(input) {
          submissions.push(input);
          return {
            operation: "mint_directional",
            mode: "submit",
            status: "submitted",
            txDigest: "submit-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            strikeRaw: input.strikeRaw,
            direction: input.direction,
            quantityRaw: input.quantityRaw,
            maxCostRaw: input.maxCostRaw,
            actualCostRaw: "8006"
          };
        }
      }
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
        direction: "up",
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        estimatedCostRaw: "8006",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        status: "submitted",
        txDigest: "submit-digest",
        actualCostRaw: "8006",
        policyDrift: "none"
      },
      transaction: {
        operation: "mint_directional",
        mode: "submit",
        status: "submitted",
        txDigest: "submit-digest"
      }
    });
    expect(submissions).toHaveLength(1);
    await expect(executionStore.listSigningAudits({
      executionId: "exec_internal_001"
    })).resolves.toMatchObject([
      {
        transactionKind: "predict_mint_submit",
        status: "submitted",
        txDigest: "submit-digest"
      }
    ]);
  });

  it("dry-runs a partial directional redeem after verifying manager position", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const resolutions: unknown[] = [];
    const redemptions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveDirectionalPosition(input) {
          resolutions.push(input);
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async dryRunRedeemDirectional(input) {
          redemptions.push(input);
          return {
            operation: "redeem_directional",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "redeem-dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            strikeRaw: input.strikeRaw,
            direction: input.direction,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "44000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "redeem_directional",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        direction: "up",
        quantityRaw: "50000",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        status: "dry_run_ok",
        dryRunDigest: "redeem-dry-run-digest",
        quantityRaw: "50000",
        actualProceedsRaw: "44000",
        policyDrift: "none"
      },
      transaction: {
        operation: "redeem_directional",
        mode: "dry_run",
        status: "dry_run_ok",
        actualProceedsRaw: "44000"
      }
    });
    expect(resolutions).toHaveLength(1);
    expect(redemptions).toHaveLength(1);
    await expect(executionStore.listSigningAudits({
      executionId: "exec_internal_001"
    })).resolves.toMatchObject([
      {
        transactionKind: "predict_redeem_dry_run",
        status: "confirmed",
        txDigest: "redeem-dry-run-digest"
      }
    ]);
  });

  it("dry-runs close_directional by resolving the full backend-confirmed position quantity", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const redemptions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveDirectionalPosition(input) {
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async dryRunRedeemDirectional(input) {
          redemptions.push(input);
          return {
            operation: "close_directional",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "close-dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            strikeRaw: input.strikeRaw,
            direction: input.direction,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "88000"
          };
        }
      }
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
        direction: "up",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "close_directional",
        status: "dry_run_ok",
        quantityRaw: "100000",
        actualProceedsRaw: "88000"
      }
    });
    expect(redemptions).toMatchObject([
      {
        operation: "close_directional",
        quantityRaw: "100000"
      }
    ]);
  });

  it("submits claim_settled_directional by resolving the full backend-confirmed position quantity", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const confirmations: unknown[] = [];
    const submissions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      enablePredictSubmit: true,
      confirmOracleForExecution: async (request) => {
        confirmations.push(request);
      },
      tradeExecutor: {
        async resolveDirectionalPosition(input) {
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async submitRedeemDirectional(input) {
          submissions.push(input);
          return {
            operation: "claim_settled_directional",
            mode: "submit",
            status: "submitted",
            txDigest: "claim-directional-submit-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            strikeRaw: input.strikeRaw,
            direction: input.direction,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "88000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "claim_settled_directional",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        strikeRaw: "65000000000000",
        direction: "up",
        minProceedsRaw: "1",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "claim_settled_directional",
        status: "submitted",
        txDigest: "claim-directional-submit-digest",
        quantityRaw: "100000",
        actualProceedsRaw: "88000"
      },
      transaction: {
        operation: "claim_settled_directional",
        mode: "submit",
        status: "submitted"
      }
    });
    expect(submissions).toMatchObject([
      {
        operation: "claim_settled_directional",
        quantityRaw: "100000"
      }
    ]);
    expect(confirmations).toMatchObject([
      {
        operation: "claim_settled_directional",
        oracleId: "0xoracle",
        expiryMs: 1780000000000,
        strikeRaw: "65000000000000"
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

  it("dry-runs a range mint execution", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const rangeMints: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async dryRunMintRange(input) {
          rangeMints.push(input);
          return {
            operation: "mint_range",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "range-mint-dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            lowerStrikeRaw: input.lowerStrikeRaw,
            higherStrikeRaw: input.higherStrikeRaw,
            quantityRaw: input.quantityRaw,
            maxCostRaw: input.maxCostRaw,
            actualCostRaw: "12000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "mint_range",
        status: "dry_run_ok",
        actualCostRaw: "12000",
        policyDrift: "none"
      },
      transaction: {
        operation: "mint_range",
        mode: "dry_run",
        status: "dry_run_ok"
      }
    });
    expect(rangeMints).toMatchObject([
      {
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        quantityRaw: "100000"
      }
    ]);
  });

  it("rejects range mint submit when Predict submit is not explicitly enabled", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const submissions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async submitMintRange(input) {
          submissions.push(input);
          return {
            operation: "mint_range",
            mode: "submit",
            status: "submitted",
            txDigest: "range-submit-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            lowerStrikeRaw: input.lowerStrikeRaw,
            higherStrikeRaw: input.higherStrikeRaw,
            quantityRaw: input.quantityRaw,
            maxCostRaw: input.maxCostRaw
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "mint_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        quantityRaw: "100000",
        maxCostRaw: "1000000",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREDICT_SUBMIT_DISABLED"
      },
      execution: {
        id: "exec_internal_001",
        operation: "mint_range",
        status: "failed",
        errorCode: "PREDICT_SUBMIT_DISABLED"
      }
    });
    expect(submissions).toHaveLength(0);
  });

  it("dry-runs a partial range redeem after verifying manager position", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const resolutions: unknown[] = [];
    const rangeRedemptions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveRangePosition(input) {
          resolutions.push(input);
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async dryRunRedeemRange(input) {
          rangeRedemptions.push(input);
          return {
            operation: "redeem_range",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "range-redeem-dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            lowerStrikeRaw: input.lowerStrikeRaw,
            higherStrikeRaw: input.higherStrikeRaw,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "44000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "redeem_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        quantityRaw: "50000",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "redeem_range",
        status: "dry_run_ok",
        dryRunDigest: "range-redeem-dry-run-digest",
        quantityRaw: "50000",
        actualProceedsRaw: "44000",
        policyDrift: "none"
      },
      transaction: {
        operation: "redeem_range",
        mode: "dry_run",
        status: "dry_run_ok",
        actualProceedsRaw: "44000"
      }
    });
    expect(resolutions).toHaveLength(1);
    expect(rangeRedemptions).toHaveLength(1);
  });

  it("dry-runs close_range by resolving the full backend-confirmed range quantity", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const rangeRedemptions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveRangePosition(input) {
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async dryRunRedeemRange(input) {
          rangeRedemptions.push(input);
          return {
            operation: "close_range",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "close-range-dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            lowerStrikeRaw: input.lowerStrikeRaw,
            higherStrikeRaw: input.higherStrikeRaw,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "88000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "close_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "close_range",
        status: "dry_run_ok",
        quantityRaw: "100000",
        actualProceedsRaw: "88000"
      }
    });
    expect(rangeRedemptions).toMatchObject([
      {
        operation: "close_range",
        quantityRaw: "100000"
      }
    ]);
  });

  it("rejects close_range execute with caller quantity before creating an execution", async () => {
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
        operation: "close_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
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

  it("rejects close_range when the backend-confirmed range quantity is zero", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveRangePosition(input) {
          return {
            ...input,
            quantityRaw: "0"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "close_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "RANGE_POSITION_NOT_FOUND"
      }
    });
    await expect(executionStore.listExecutions({ walletId: created.wallet.id })).resolves.toEqual([]);
  });

  it("dry-runs claim_settled_range by resolving the full backend-confirmed range quantity", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const confirmedOracles: unknown[] = [];
    const rangeRedemptions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      confirmOracleForExecution: async (request) => {
        confirmedOracles.push(request);
      },
      tradeExecutor: {
        async resolveRangePosition(input) {
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async dryRunRedeemRange(input) {
          rangeRedemptions.push(input);
          return {
            operation: "claim_settled_range",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "claim-range-dry-run-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            lowerStrikeRaw: input.lowerStrikeRaw,
            higherStrikeRaw: input.higherStrikeRaw,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "88000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "claim_settled_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "claim_settled_range",
        status: "dry_run_ok",
        quantityRaw: "100000",
        actualProceedsRaw: "88000"
      },
      transaction: {
        operation: "claim_settled_range",
        mode: "dry_run",
        status: "dry_run_ok"
      }
    });
    expect(rangeRedemptions).toMatchObject([
      {
        operation: "claim_settled_range",
        quantityRaw: "100000"
      }
    ]);
    expect(confirmedOracles).toMatchObject([
      {
        operation: "claim_settled_range",
        oracleId: "0xoracle",
        expiryMs: 1780000000000
      }
    ]);
  });

  it("submits claim_settled_range by resolving the full backend-confirmed range quantity", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const rangeSubmissions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      enablePredictSubmit: true,
      confirmOracleForExecution: async () => {},
      tradeExecutor: {
        async resolveRangePosition(input) {
          return {
            ...input,
            quantityRaw: "100000"
          };
        },
        async submitRedeemRange(input) {
          rangeSubmissions.push(input);
          return {
            operation: "claim_settled_range",
            mode: "submit",
            status: "submitted",
            txDigest: "claim-range-submit-digest",
            managerId: input.managerId,
            oracleId: input.oracleId,
            expiryMs: input.expiryMs,
            lowerStrikeRaw: input.lowerStrikeRaw,
            higherStrikeRaw: input.higherStrikeRaw,
            quantityRaw: input.quantityRaw,
            minProceedsRaw: input.minProceedsRaw,
            actualProceedsRaw: "88000"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "claim_settled_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        minProceedsRaw: "1",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "claim_settled_range",
        status: "submitted",
        txDigest: "claim-range-submit-digest",
        quantityRaw: "100000",
        actualProceedsRaw: "88000"
      },
      transaction: {
        operation: "claim_settled_range",
        mode: "submit",
        status: "submitted"
      }
    });
    expect(rangeSubmissions).toMatchObject([
      {
        operation: "claim_settled_range",
        quantityRaw: "100000"
      }
    ]);
  });

  it("rejects claim_settled_range when the backend-confirmed range quantity is zero", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveRangePosition(input) {
          return {
            ...input,
            quantityRaw: "0"
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "claim_settled_range",
        managerId: "0xmanager",
        oracleId: "0xoracle",
        expiryMs: "1780000000000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        minProceedsRaw: "1",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "RANGE_POSITION_NOT_FOUND"
      }
    });
    await expect(executionStore.listExecutions({ walletId: created.wallet.id })).resolves.toEqual([]);
  });

  it("rejects manager DUSDC withdrawal without an explicit amountRaw", async () => {
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
        operation: "withdraw_manager_dusdc",
        managerId: "0xmanager",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_RAW_AMOUNT"
      }
    });
    await expect(executionStore.listExecutions({ walletId: created.wallet.id })).resolves.toEqual([]);
  });

  it("rejects manager DUSDC withdrawal when the manager balance is insufficient", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const dryRuns: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveManagerBalance(input) {
          return {
            ...input,
            balanceRaw: "999"
          };
        },
        async dryRunWithdrawManagerDusdc(input) {
          dryRuns.push(input);
          return {
            operation: "withdraw_manager_dusdc",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "withdraw-dry-run-digest",
            managerId: input.managerId,
            amountRaw: input.amountRaw,
            recipientAddress: input.recipientAddress
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "withdraw_manager_dusdc",
        managerId: "0xmanager",
        amountRaw: "1000",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INSUFFICIENT_MANAGER_BALANCE"
      },
      execution: {
        id: "exec_internal_001",
        operation: "withdraw_manager_dusdc",
        status: "failed",
        errorCode: "INSUFFICIENT_MANAGER_BALANCE",
        quantityRaw: "1000"
      }
    });
    expect(dryRuns).toHaveLength(0);
  });

  it("dry-runs manager DUSDC withdrawal and records amount and recipient in the signing audit", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const withdrawals: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveManagerBalance(input) {
          return {
            ...input,
            balanceRaw: "2000"
          };
        },
        async dryRunWithdrawManagerDusdc(input) {
          withdrawals.push(input);
          return {
            operation: "withdraw_manager_dusdc",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "withdraw-dry-run-digest",
            managerId: input.managerId,
            amountRaw: input.amountRaw,
            recipientAddress: input.recipientAddress
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "withdraw_manager_dusdc",
        managerId: "0xmanager",
        amountRaw: "1000",
        recipientAddress: "0xrecipient",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        id: "exec_internal_001",
        operation: "withdraw_manager_dusdc",
        status: "dry_run_ok",
        quantityRaw: "1000"
      },
      transaction: {
        operation: "withdraw_manager_dusdc",
        mode: "dry_run",
        status: "dry_run_ok",
        txDigest: "withdraw-dry-run-digest",
        amountRaw: "1000",
        recipientAddress: "0xrecipient"
      }
    });
    expect(withdrawals).toMatchObject([
      {
        managerId: "0xmanager",
        amountRaw: "1000",
        recipientAddress: "0xrecipient"
      }
    ]);
    await expect(executionStore.listSigningAudits({
      executionId: "exec_internal_001"
    })).resolves.toMatchObject([
      {
        transactionKind: "predict_manager_withdraw_dry_run",
        status: "confirmed",
        txDigest: "withdraw-dry-run-digest",
        amountRaw: "1000",
        recipientAddress: "0xrecipient"
      }
    ]);
  });

  it("defaults manager DUSDC withdrawal recipient to the internal wallet address", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const withdrawals: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveManagerBalance(input) {
          return {
            ...input,
            balanceRaw: "2000"
          };
        },
        async dryRunWithdrawManagerDusdc(input) {
          withdrawals.push(input);
          return {
            operation: "withdraw_manager_dusdc",
            mode: "dry_run",
            status: "dry_run_ok",
            txDigest: "withdraw-dry-run-digest",
            managerId: input.managerId,
            amountRaw: input.amountRaw,
            recipientAddress: input.recipientAddress
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "withdraw_manager_dusdc",
        managerId: "0xmanager",
        amountRaw: "1000",
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      execution: {
        recipientAddress: created.wallet.address
      },
      transaction: {
        recipientAddress: created.wallet.address
      }
    });
    expect(withdrawals).toMatchObject([
      {
        managerId: "0xmanager",
        amountRaw: "1000",
        recipientAddress: created.wallet.address
      }
    ]);
  });

  it("rejects manager DUSDC withdrawal submit when Predict submit is not explicitly enabled", async () => {
    const executionStore = createMemoryExecutionStore({
      now: () => "2026-06-17T00:00:00.000Z"
    });
    const submissions: unknown[] = [];
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      executionStore,
      quoteAssetType,
      tradeExecutor: {
        async resolveManagerBalance(input) {
          return {
            ...input,
            balanceRaw: "2000"
          };
        },
        async submitWithdrawManagerDusdc(input) {
          submissions.push(input);
          return {
            operation: "withdraw_manager_dusdc",
            mode: "submit",
            status: "submitted",
            txDigest: "withdraw-submit-digest",
            managerId: input.managerId,
            amountRaw: input.amountRaw
          };
        }
      }
    });
    const created = await createWallet(fetch);

    const response = await fetch(new Request("http://localhost/api/arena/internal/predict/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        walletId: created.wallet.id,
        operation: "withdraw_manager_dusdc",
        managerId: "0xmanager",
        amountRaw: "1000",
        dryRunOnly: false
      })
    }));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREDICT_SUBMIT_DISABLED"
      },
      execution: {
        id: "exec_internal_001",
        operation: "withdraw_manager_dusdc",
        status: "failed",
        errorCode: "PREDICT_SUBMIT_DISABLED"
      }
    });
    expect(submissions).toHaveLength(0);
    await expect(executionStore.listSigningAudits({
      executionId: "exec_internal_001"
    })).resolves.toMatchObject([
      {
        transactionKind: "predict_manager_withdraw_submit",
        status: "failed",
        errorCode: "PREDICT_SUBMIT_DISABLED",
        amountRaw: "1000"
      }
    ]);
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

  it("returns stable oracle errors from execute confirmation instead of generic internal errors", async () => {
    const fetch = createInternalPredictFetchHandler({
      internalToken,
      walletStore: createMemoryWalletStore({ walletSecret: "wallet-secret", quoteAssetType }),
      quoteAssetType,
      confirmOracleForExecution: async () => {
        throw new PredictOracleError("ORACLE_NOT_TRADEABLE");
      }
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
        dryRunOnly: true
      })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ORACLE_NOT_TRADEABLE",
        message: "ORACLE_NOT_TRADEABLE"
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
    const fetch = createAgentArenaFetchHandler({ internalToken, runtimeMode: "mock" });
    const response = await fetch(new Request("http://localhost/api/arena/__introspection"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("x-agent-arena-internal-token");
    expect(JSON.stringify(body)).not.toContain("/api/arena/internal");
  });

  it("does not let an Agent runtime token proxy manager withdrawals through public intent routes", async () => {
    const { createAgentArenaFetchHandler } = await import("../server");
    const fetch = createAgentArenaFetchHandler({ internalToken, runtimeMode: "mock" });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Withdrawal Proxy Probe" })
    }))).json();
    const claimed = await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage"
      })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "withdraw-proxy-attempt",
        action: "withdraw_manager_dusdc",
        managerId: "0xmanager",
        amountRaw: "1000",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT"
      }
    });
  });
});
