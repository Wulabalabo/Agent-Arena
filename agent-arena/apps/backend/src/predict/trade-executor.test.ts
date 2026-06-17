import { describe, expect, it } from "bun:test";
import {
  createPredictTradeExecutor,
  extractFirstU64ReturnValue,
  extractMintActualCostRaw,
  extractRangeMintActualCostRaw,
  extractRangeRedeemActualProceedsRaw,
  extractRedeemActualProceedsRaw
} from "./trade-executor";
import { createMemoryWalletStore } from "./wallet-store";

const predictPackageId = "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";
const walletAddress = "0x00000000000000000000000000000000000000000000000000000000000000aa";
const managerId = "0x00000000000000000000000000000000000000000000000000000000000000bb";
const oracleId = "0x00000000000000000000000000000000000000000000000000000000000000dd";

describe("extractMintActualCostRaw", () => {
  it("extracts the paid cost from a PositionMinted event", () => {
    expect(extractMintActualCostRaw({
      events: [
        {
          type: `${predictPackageId}::predict::PositionMinted`,
          parsedJson: {
            cost: "8006",
            quantity: "100000"
          }
        }
      ]
    } as never, predictPackageId)).toBe("8006");
  });

  it("ignores non-mint events", () => {
    expect(extractMintActualCostRaw({
      events: [
        {
          type: `${predictPackageId}::predict::TradingPauseUpdated`,
          parsedJson: {
            cost: "8006"
          }
        }
      ]
    } as never, predictPackageId)).toBeUndefined();
  });
});

describe("extractRedeemActualProceedsRaw", () => {
  it("extracts payout from a PositionRedeemed event", () => {
    expect(extractRedeemActualProceedsRaw({
      events: [
        {
          type: `${predictPackageId}::predict::PositionRedeemed`,
          parsedJson: {
            payout: "45500",
            quantity: "50000"
          }
        }
      ]
    } as never, predictPackageId)).toBe("45500");
  });
});

describe("range event parsers", () => {
  it("extracts cost from a RangeMinted event", () => {
    expect(extractRangeMintActualCostRaw({
      events: [
        {
          type: `${predictPackageId}::predict::RangeMinted`,
          parsedJson: {
            cost: "12000",
            quantity: "100000"
          }
        }
      ]
    } as never, predictPackageId)).toBe("12000");
  });

  it("extracts payout from a RangeRedeemed event", () => {
    expect(extractRangeRedeemActualProceedsRaw({
      events: [
        {
          type: `${predictPackageId}::predict::RangeRedeemed`,
          parsedJson: {
            payout: "9000",
            quantity: "50000"
          }
        }
      ]
    } as never, predictPackageId)).toBe("9000");
  });
});

describe("range position resolution", () => {
  it("reads range position quantity through predict_manager::range_position", async () => {
    const inspectedCommands: unknown[] = [];
    const executor = createPredictTradeExecutor({
      config: {
        network: "testnet",
        suiRpcUrl: "https://fullnode.testnet.sui.io:443",
        predictServerUrl: "https://predict-server.testnet.mystenlabs.com",
        predictPackageId,
        predictObjectId: "0xpredict",
        suiClockObjectId: "0x6",
        quoteAssetType: "0xquote::dusdc::DUSDC",
        quoteDecimals: 6,
        priceDecimals: 9,
        internalToken: "secret",
        walletSecret: "wallet-secret",
        enablePredictSubmit: false
      },
      walletStore: createMemoryWalletStore({
        walletSecret: "wallet-secret",
        quoteAssetType: "0xquote::dusdc::DUSDC"
      }),
      client: {
        async devInspectTransactionBlock({ transactionBlock }: { transactionBlock: { getData: () => { commands: unknown[] } } }) {
          inspectedCommands.push(...transactionBlock.getData().commands);
          return {
            effects: {
              status: {
                status: "success"
              }
            },
            results: [
              {
                returnValues: [
                  [[160, 134, 1, 0, 0, 0, 0, 0], "u64"]
                ]
              }
            ]
          };
        }
      } as never
    });

    const resolution = await executor.resolveRangePosition!({
      wallet: {
        id: "wallet_1",
        agentId: "agent_1",
        bindingMode: "internal_probe",
        address: walletAddress,
        publicKey: "0xpublic",
        keyScheme: "ed25519",
        status: "active",
        testnetOnly: true,
        createdAt: "2026-06-17T00:00:00.000Z"
      },
      managerId,
      oracleId,
      expiryMs: "1780000000000",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000"
    });

    expect(resolution.quantityRaw).toBe("100000");
    expect(JSON.stringify(inspectedCommands)).toContain("range_position");
  });
});

describe("extractFirstU64ReturnValue", () => {
  it("reads the first little-endian u64 return value from devInspect results", () => {
    expect(extractFirstU64ReturnValue({
      results: [
        {
          returnValues: [
            [[160, 134, 1, 0, 0, 0, 0, 0], "u64"]
          ]
        }
      ]
    })).toBe("100000");
  });
});
