import { describe, expect, it } from "bun:test";
import { createPredictConfig } from "./config";

const validEnv = {
  AGENT_ARENA_NETWORK: "testnet",
  AGENT_ARENA_SUI_RPC_URL: "https://fullnode.testnet.sui.io:443",
  AGENT_ARENA_PREDICT_SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
  AGENT_ARENA_PREDICT_PACKAGE_ID: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  AGENT_ARENA_PREDICT_OBJECT_ID: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  AGENT_ARENA_SUI_CLOCK_OBJECT_ID: "0x6",
  AGENT_ARENA_QUOTE_ASSET_TYPE: "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
  AGENT_ARENA_QUOTE_DECIMALS: "6",
  AGENT_ARENA_PRICE_DECIMALS: "9",
  AGENT_ARENA_INTERNAL_TOKEN: "internal-token",
  AGENT_ARENA_WALLET_SECRET: "local-wallet-secret"
};

describe("createPredictConfig", () => {
  it("loads Testnet Predict config with DUSDC decimals and price decimals", () => {
    const config = createPredictConfig(validEnv);

    expect(config).toEqual({
      network: "testnet",
      suiRpcUrl: validEnv.AGENT_ARENA_SUI_RPC_URL,
      predictServerUrl: validEnv.AGENT_ARENA_PREDICT_SERVER_URL,
      predictPackageId: validEnv.AGENT_ARENA_PREDICT_PACKAGE_ID,
      predictObjectId: validEnv.AGENT_ARENA_PREDICT_OBJECT_ID,
      suiClockObjectId: validEnv.AGENT_ARENA_SUI_CLOCK_OBJECT_ID,
      quoteAssetType: validEnv.AGENT_ARENA_QUOTE_ASSET_TYPE,
      quoteDecimals: 6,
      priceDecimals: 9,
      internalToken: validEnv.AGENT_ARENA_INTERNAL_TOKEN,
      walletSecret: validEnv.AGENT_ARENA_WALLET_SECRET
    });
  });

  it("rejects non-Testnet network values", () => {
    expect(() =>
      createPredictConfig({
        ...validEnv,
        AGENT_ARENA_NETWORK: "mainnet"
      })
    ).toThrow("TESTNET_ONLY");
  });

  it("rejects missing required env vars with a useful code", () => {
    const { AGENT_ARENA_PREDICT_OBJECT_ID: _missing, ...env } = validEnv;

    expect(() => createPredictConfig(env)).toThrow("MISSING_AGENT_ARENA_PREDICT_OBJECT_ID");
  });

  it("rejects blank required env vars after trimming", () => {
    expect(() =>
      createPredictConfig({
        ...validEnv,
        AGENT_ARENA_INTERNAL_TOKEN: "   "
      })
    ).toThrow("MISSING_AGENT_ARENA_INTERNAL_TOKEN");
  });

  it("requires DUSDC quote decimals to be 6", () => {
    expect(() =>
      createPredictConfig({
        ...validEnv,
        AGENT_ARENA_QUOTE_DECIMALS: "9"
      })
    ).toThrow("INVALID_AGENT_ARENA_QUOTE_DECIMALS");
  });

  it("requires price decimals to be 9", () => {
    expect(() =>
      createPredictConfig({
        ...validEnv,
        AGENT_ARENA_PRICE_DECIMALS: "6"
      })
    ).toThrow("INVALID_AGENT_ARENA_PRICE_DECIMALS");
  });

  it("keeps backend .env.example aligned with required Predict config", async () => {
    const exampleText = await Bun.file(new URL("../../.env.example", import.meta.url)).text();
    const exampleEnv = parseDotEnvExample(exampleText);

    const config = createPredictConfig(exampleEnv);

    expect(config.network).toBe("testnet");
    expect(config.quoteDecimals).toBe(6);
    expect(config.priceDecimals).toBe(9);
  });
});

function parseDotEnvExample(text: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value.replace(/^"|"$/g, "");
  }

  return env;
}
