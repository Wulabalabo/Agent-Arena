import { describe, expect, it } from "bun:test";
import {
  AutoRangeSmokeError,
  deriveAutoRangeFromPrice,
  selectAutoRangeMarket
} from "./auto-range-smoke";

const config = {
  predictObjectId: "0xpredict",
  priceDecimals: 9 as const
};

describe("auto range smoke market selection", () => {
  it("selects nearest future active BTC oracle and prefers forward price", async () => {
    const selected = await selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xlater",
            underlying_asset: "BTC",
            expiry: "1781623800000",
            status: "active"
          },
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "1781622900000",
            status: "active"
          },
          {
            oracle_id: "0xeth",
            underlying_asset: "ETH",
            expiry: "1781622500000",
            status: "active"
          }
        ],
        getOracleState: async () => ({
          latest_price: {
            spot: "65611517258518",
            forward: "65611186326705",
            onchain_timestamp: "1781622054893"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    });

    expect(selected).toMatchObject({
      oracleId: "0xnearest",
      expiryMs: "1781622900000",
      priceSource: "forward",
      referencePriceRaw: "65611186326705",
      referencePrice: "65611.186326705",
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    });
    expect(BigInt(selected.lowerStrikeRaw)).toBeLessThan(BigInt(selected.higherStrikeRaw));
  });

  it("falls back to spot when forward is unavailable", () => {
    const range = deriveAutoRangeFromPrice({
      priceRaw: "65611517258518",
      priceSource: "spot",
      priceDecimals: 9,
      bandBps: 50
    });

    expect(range.priceSource).toBe("spot");
    expect(range.referencePrice).toBe("65611.517258518");
    expect(range.lowerStrikeRaw).toBe("65283000000000");
    expect(range.higherStrikeRaw).toBe("65940000000000");
  });

  it("throws NO_ACTIVE_BTC_ORACLE when no future active BTC oracle is available", async () => {
    await expect(selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xpast",
            underlying_asset: "BTC",
            expiry: "1781621000000",
            status: "active"
          },
          {
            oracle_id: "0xinactive",
            underlying_asset: "BTC",
            expiry: "1781623000000",
            status: "inactive"
          }
        ],
        getOracleState: async () => ({})
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    })).rejects.toMatchObject({
      name: "AutoRangeSmokeError",
      code: "NO_ACTIVE_BTC_ORACLE"
    });
  });

  it("throws ORACLE_PRICE_UNAVAILABLE when forward and spot are unavailable", async () => {
    await expect(selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "1781622900000",
            status: "active"
          }
        ],
        getOracleState: async () => ({ latest_price: {} })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    })).rejects.toMatchObject({
      name: "AutoRangeSmokeError",
      code: "ORACLE_PRICE_UNAVAILABLE"
    });
  });

  it("throws SERVER_TIME_UNAVAILABLE when current_time_ms is missing", async () => {
    await expect(selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({}),
        getPredictOracles: async () => [
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "9999999999999",
            status: "active"
          }
        ],
        getOracleState: async () => ({
          latest_price: {
            forward: "65611186326705"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    })).rejects.toMatchObject({
      name: "AutoRangeSmokeError",
      code: "SERVER_TIME_UNAVAILABLE"
    });
  });

  it("throws SERVER_TIME_UNAVAILABLE when current_time_ms is unsafe or invalid", async () => {
    await expect(selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: "9007199254740992" }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "9999999999999",
            status: "active"
          }
        ],
        getOracleState: async () => ({
          latest_price: {
            forward: "65611186326705"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    })).rejects.toMatchObject({
      name: "AutoRangeSmokeError",
      code: "SERVER_TIME_UNAVAILABLE"
    });
  });

  it("throws RANGE_SELECTION_INVALID for invalid quantityRaw", async () => {
    await expect(selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "1781622900000",
            status: "active"
          }
        ],
        getOracleState: async () => ({
          latest_price: {
            forward: "65611186326705"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "",
      maxCostRaw: "1000000"
    })).rejects.toMatchObject({
      name: "AutoRangeSmokeError",
      code: "RANGE_SELECTION_INVALID"
    });
  });

  it("throws RANGE_SELECTION_INVALID for invalid maxCostRaw", async () => {
    await expect(selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "1781622900000",
            status: "active"
          }
        ],
        getOracleState: async () => ({
          latest_price: {
            forward: "65611186326705"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1.0"
    })).rejects.toMatchObject({
      name: "AutoRangeSmokeError",
      code: "RANGE_SELECTION_INVALID"
    });
  });

  it("throws RANGE_SELECTION_INVALID for invalid bandBps", () => {
    expect(() => deriveAutoRangeFromPrice({
      priceRaw: "65611517258518",
      priceSource: "spot",
      priceDecimals: 9,
      bandBps: 0
    })).toThrow(new AutoRangeSmokeError("RANGE_SELECTION_INVALID"));
  });

  it("throws RANGE_SELECTION_INVALID for invalid raw price values", () => {
    expect(() => deriveAutoRangeFromPrice({
      priceRaw: "65.611",
      priceSource: "spot",
      priceDecimals: 9,
      bandBps: 50
    })).toThrow(new AutoRangeSmokeError("RANGE_SELECTION_INVALID"));
  });

  it("snaps derived strikes to the oracle strike grid", async () => {
    const selected = await selectAutoRangeMarket({
      config,
      client: {
        getStatus: async () => ({ current_time_ms: 1781622000000 }),
        getPredictOracles: async () => [
          {
            oracle_id: "0xnearest",
            underlying_asset: "BTC",
            expiry: "1781622900000",
            status: "active",
            strikeGrid: {
              minStrikeRaw: "65000000000000",
              maxStrikeRaw: "67000000000000",
              strikeStepRaw: "250000000000"
            }
          }
        ],
        getOracleState: async () => ({
          latest_price: {
            forward: "65611186326705"
          }
        })
      },
      bandBps: 50,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    });

    expect(selected.lowerStrikeRaw).toBe("65250000000000");
    expect(selected.higherStrikeRaw).toBe("66000000000000");
  });

  it("snaps derived strikes to explicit oracle strikes", () => {
    const range = deriveAutoRangeFromPrice({
      priceRaw: "65611186326705",
      priceSource: "forward",
      priceDecimals: 9,
      bandBps: 50,
      strikeGrid: {
        strikesRaw: [
          "65000000000000",
          "65250000000000",
          "66000000000000",
          "66500000000000"
        ]
      }
    });

    expect(range.lowerStrikeRaw).toBe("65250000000000");
    expect(range.higherStrikeRaw).toBe("66000000000000");
  });

  it("throws RANGE_SELECTION_INVALID when explicit strikes cannot fit the band", () => {
    expect(() => deriveAutoRangeFromPrice({
      priceRaw: "65611186326705",
      priceSource: "forward",
      priceDecimals: 9,
      bandBps: 50,
      strikeGrid: {
        strikesRaw: [
          "65250000000000",
          "65750000000000"
        ]
      }
    })).toThrow(new AutoRangeSmokeError("RANGE_SELECTION_INVALID"));
  });

  it("throws RANGE_SELECTION_INVALID when min max step grid cannot fit the band", () => {
    expect(() => deriveAutoRangeFromPrice({
      priceRaw: "65611186326705",
      priceSource: "forward",
      priceDecimals: 9,
      bandBps: 50,
      strikeGrid: {
        minStrikeRaw: "65300000000000",
        maxStrikeRaw: "65800000000000",
        strikeStepRaw: "250000000000"
      }
    })).toThrow(new AutoRangeSmokeError("RANGE_SELECTION_INVALID"));
  });
});
