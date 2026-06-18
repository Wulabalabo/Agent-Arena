import { describe, expect, it } from "bun:test";
import { createPredictMarketDataProvider } from "./market-data-provider";
import type { PredictServerClient } from "./predict-server-client";
import type { PredictConfig } from "./types";

describe("createPredictMarketDataProvider", () => {
  it("publishes executable directional market identifiers from the contract oracle", async () => {
    const provider = createPredictMarketDataProvider({
      config: createTestPredictConfig(),
      predictServerClient: createTestPredictServerClient({
        oracle: {
          predict_id: "0xpredict",
          oracle_id: "0xreal_oracle",
          underlying_asset: "BTC",
          expiry: 1781715600000,
          strike: 65800000000000,
          min_strike: 50000000000000,
          tick_size: 1000000000,
          status: "active"
        }
      })
    });

    await expect(provider()).resolves.toMatchObject({
      marketState: {
        oracleId: "0xreal_oracle",
        expiryMs: "1781715600000",
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

  it("publishes an executable directional strike snapped to the contract strike grid", async () => {
    const provider = createPredictMarketDataProvider({
      config: createTestPredictConfig(),
      predictServerClient: createTestPredictServerClient({
        oracle: {
          predict_id: "0xpredict",
          oracle_id: "0xreal_oracle",
          underlying_asset: "BTC",
          expiry: 1781715600000,
          min_strike: 50000000000000,
          tick_size: 1000000000,
          status: "active"
        },
        latestPrice: {
          spot: 65866527537529,
          forward: 65867070507763
        }
      })
    });

    await expect(provider()).resolves.toMatchObject({
      marketState: {
        executableMarkets: {
          directional: {
            oracleId: "0xreal_oracle",
            expiry: "1781715600000",
            strike: "65867000000000"
          }
        }
      }
    });
  });
});

function createTestPredictConfig(): PredictConfig {
  return {
    network: "testnet",
    suiRpcUrl: "https://fullnode.testnet.sui.io:443",
    predictServerUrl: "https://predict-server.testnet.mystenlabs.com",
    predictPackageId: "0xpackage",
    predictObjectId: "0xpredict",
    suiClockObjectId: "0x6",
    quoteAssetType: "0xquote::dusdc::DUSDC",
    quoteDecimals: 6,
    priceDecimals: 9,
    internalToken: "secret",
    walletSecret: "platform-wallet-secret",
    enablePredictSubmit: false
  };
}

function createTestPredictServerClient(input: {
  oracle: Record<string, unknown>;
  latestPrice?: Record<string, unknown>;
}): PredictServerClient {
  return {
    async getStatus() {
      return { current_time_ms: 1781715000000 };
    },
    async getPredictOracles() {
      return [input.oracle];
    },
    async getOracleState() {
      return {
        ...input.oracle,
        latest_price: input.latestPrice ?? {
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
}
