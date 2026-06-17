import { describe, expect, it } from "bun:test";
import {
  AutoRangeSmokeError,
  deriveAutoRangeFromPrice,
  runAutoRangeSmoke,
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

describe("auto range smoke orchestration", () => {
  const selectedMarket = {
    oracleId: "0xoracle",
    expiryMs: "1781622900000",
    priceSource: "forward" as const,
    referencePriceRaw: "65611186326705",
    referencePrice: "65611.186326705",
    lowerStrikeRaw: "65250000000000",
    higherStrikeRaw: "66000000000000",
    quantityRaw: "100000",
    maxCostRaw: "1000000"
  };

  function successResponse(status: "dry_run_ok" | "confirmed" | "submitted" = "confirmed") {
    return {
      ok: true,
      execution: {
        status,
        digest: "0xdigest"
      }
    };
  }

  function smokeInput(overrides: Partial<Parameters<typeof runAutoRangeSmoke>[0]> = {}) {
    return {
      walletId: "wallet-1",
      managerId: "0xmanager",
      selectedMarket,
      minProceedsRaw: "1",
      withdrawAmountRaw: "500",
      submit: false,
      withdrawAfterClose: false,
      execute: async () => successResponse("dry_run_ok"),
      ...overrides
    };
  }

  it("dry-run mode only calls mint_range with dryRunOnly true", async () => {
    const calls: unknown[] = [];
    const result = await runAutoRangeSmoke(smokeInput({
      execute: async (body) => {
        calls.push(body);
        return successResponse("dry_run_ok");
      }
    }));

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("dry_run");
    expect(result.steps.map((step) => step.operation)).toEqual(["mint_range"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      operation: "mint_range",
      dryRunOnly: true,
      quantityRaw: "100000",
      maxCostRaw: "1000000"
    });
  });

  it("submit mode calls mint_range then close_range and omits quantityRaw from close body", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await runAutoRangeSmoke(smokeInput({
      submit: true,
      execute: async (body) => {
        calls.push(body);
        return successResponse("confirmed");
      }
    }));

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("submit");
    expect(result.steps.map((step) => step.operation)).toEqual(["mint_range", "close_range"]);
    expect(result.steps.map((step) => step.name)).toEqual(["mint_range", "close_range_last"]);
    expect(result.steps[1]).toMatchObject({
      name: "close_range_last",
      operation: "close_range",
      status: "confirmed"
    });
    expect(calls.map((body) => body.operation)).toEqual(["mint_range", "close_range"]);
    expect(calls[0]).toMatchObject({ dryRunOnly: false, quantityRaw: "100000" });
    expect(calls[1]).toMatchObject({ dryRunOnly: false, operation: "close_range" });
    expect(calls[1]).not.toHaveProperty("quantityRaw");
  });

  it("does not call close when mint fails and returns AUTO_RANGE_MINT_FAILED", async () => {
    const calls: unknown[] = [];
    const result = await runAutoRangeSmoke(smokeInput({
      submit: true,
      execute: async (body) => {
        calls.push(body);
        return { ok: false, execution: { status: "failed" } };
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.mode).toBe("submit");
    expect(result.errors).toEqual(["AUTO_RANGE_MINT_FAILED"]);
    expect(result.steps.map((step) => step.operation)).toEqual(["mint_range"]);
    expect(calls).toHaveLength(1);
  });

  it("calls withdraw_manager_dusdc after a successful close when withdrawAfterClose is true", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await runAutoRangeSmoke(smokeInput({
      submit: true,
      withdrawAfterClose: true,
      recipientAddress: "0xrecipient",
      execute: async (body) => {
        calls.push(body);
        return successResponse("confirmed");
      }
    }));

    expect(result.ok).toBe(true);
    expect(result.steps.map((step) => step.operation)).toEqual([
      "mint_range",
      "close_range",
      "withdraw_manager_dusdc"
    ]);
    expect(calls[2]).toMatchObject({
      operation: "withdraw_manager_dusdc",
      dryRunOnly: false,
      amountRaw: "500",
      recipientAddress: "0xrecipient"
    });
  });

  it("does not call withdraw when close fails and returns AUTO_RANGE_CLOSE_FAILED", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await runAutoRangeSmoke(smokeInput({
      submit: true,
      withdrawAfterClose: true,
      execute: async (body) => {
        calls.push(body);
        return body.operation === "close_range"
          ? { ok: true, execution: { status: "failed" } }
          : successResponse("confirmed");
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["AUTO_RANGE_CLOSE_FAILED"]);
    expect(result.steps.map((step) => step.operation)).toEqual(["mint_range", "close_range"]);
    expect(calls.map((body) => body.operation)).toEqual(["mint_range", "close_range"]);
  });

  it("returns AUTO_RANGE_WITHDRAW_FAILED when withdraw fails", async () => {
    const result = await runAutoRangeSmoke(smokeInput({
      submit: true,
      withdrawAfterClose: true,
      execute: async (body) => body.operation === "withdraw_manager_dusdc"
        ? { ok: true, execution: { status: "failed" } }
        : successResponse("confirmed")
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["AUTO_RANGE_WITHDRAW_FAILED"]);
    expect(result.steps.map((step) => step.operation)).toEqual([
      "mint_range",
      "close_range",
      "withdraw_manager_dusdc"
    ]);
  });

  it("returns selectedMarket, steps, errors, mode and sanitizes secret-shaped fields", async () => {
    const result = await runAutoRangeSmoke(smokeInput({
      execute: async (body) => ({
        ...successResponse("dry_run_ok"),
        requestEcho: {
          ...body,
          privateKey: "private",
          encryptedPrivateKey: "encrypted",
          secretKey: "secret",
          walletSecret: "wallet-secret",
          "x-agent-arena-internal-token": "token"
        }
      })
    }));

    expect(result).toMatchObject({
      ok: true,
      mode: "dry_run",
      selectedMarket,
      errors: []
    });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.request).toMatchObject({ operation: "mint_range" });
    expect(JSON.stringify(result.steps)).not.toContain("privateKey");
    expect(JSON.stringify(result.steps)).not.toContain("encryptedPrivateKey");
    expect(JSON.stringify(result.steps)).not.toContain("secretKey");
    expect(JSON.stringify(result.steps)).not.toContain("walletSecret");
    expect(JSON.stringify(result.steps)).not.toContain("x-agent-arena-internal-token");
    expect(JSON.stringify(result.steps)).not.toContain("private");
    expect(JSON.stringify(result.steps)).not.toContain("token");
  });
});
