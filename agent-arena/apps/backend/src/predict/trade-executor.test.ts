import { describe, expect, it } from "bun:test";
import {
  extractFirstU64ReturnValue,
  extractMintActualCostRaw,
  extractRedeemActualProceedsRaw
} from "./trade-executor";

const predictPackageId = "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";

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
