import { describe, expect, it } from "bun:test";
import {
  createAgentArenaFetchHandler,
  createAttributionFetchHandler,
  getDefaultAttributionDbPath
} from "./server";
import { AttributionStore, type CreateAttributionInput } from "./attribution";
import { createMemoryWalletStore } from "./predict/wallet-store";

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

describe("createAgentArenaFetchHandler", () => {
  it("rejects internal routes without the internal token", async () => {
    const fetch = createAgentArenaFetchHandler({ internalToken: "secret" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("fails closed for authenticated internal wallet creation when Predict config is missing", async () => {
    const fetch = createAgentArenaFetchHandler({ internalToken: "secret", predictEnv: {} });
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
});
