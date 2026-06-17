import { describe, expect, it } from "bun:test";
import { extractMintActualCostRaw } from "./trade-executor";

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
