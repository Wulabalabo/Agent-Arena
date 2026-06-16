import { describe, expect, it } from "bun:test";
import { buildPredictOperationPlan } from "./transactions";

describe("buildPredictOperationPlan", () => {
  it("builds a directional preview with the whitelisted trade amount target", () => {
    const plan = buildPredictOperationPlan({
      operation: "preview_directional",
      direction: "up",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000"
    });

    expect(plan).toMatchObject({
      operation: "preview_directional",
      moveTargets: ["predict::get_trade_amounts"],
      expiryMs: "1780000000000",
      keyInputs: {
        direction: "up",
        strikeRaw: "65000000000000",
        expiryMs: "1780000000000"
      },
      quantityRaw: "1000000"
    });
    expect(plan.moveTargets.join(" ")).not.toContain("evil");
  });

  it("builds a range preview with range bounds and the whitelisted range quote target", () => {
    const plan = buildPredictOperationPlan({
      operation: "preview_range",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000"
    });

    expect(plan.moveTargets).toContain("predict::get_range_trade_amounts");
    expect(plan.expiryMs).toBe("1780000000000");
    expect(plan.keyInputs).toMatchObject({
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000"
    });
  });

  it("rejects missing or invalid expiryMs for market key plans", () => {
    expect(() =>
      buildPredictOperationPlan({
        operation: "preview_directional",
        direction: "up",
        strikeRaw: "65000000000000",
        quantityRaw: "1000000"
      })
    ).toThrow("INVALID_RAW_AMOUNT");

    expect(() =>
      buildPredictOperationPlan({
        operation: "preview_range",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        expiryMs: "1780000000000.5",
        quantityRaw: "1000000"
      })
    ).toThrow("INVALID_RAW_AMOUNT");
  });

  it("rejects invalid range bounds before building range keys", () => {
    expect(() =>
      buildPredictOperationPlan({
        operation: "mint_range",
        lowerStrikeRaw: "66000000000000",
        higherStrikeRaw: "64000000000000",
        expiryMs: "1780000000000",
        quantityRaw: "1000000",
        maxCostRaw: "1000000"
      })
    ).toThrow("INVALID_RANGE_BOUNDS");
  });

  it("rejects unknown operations", () => {
    expect(() =>
      buildPredictOperationPlan({
        operation: "transfer",
        quantityRaw: "1000000"
      } as never)
    ).toThrow("UNKNOWN_PREDICT_OPERATION");
  });

  it("uses only whitelisted market key and predict mint targets for directional mint", () => {
    const upPlan = buildPredictOperationPlan({
      operation: "mint_directional",
      direction: "up",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000",
      maxCostRaw: "1100000",
      managerId: "0xmanager",
      oracleId: "0xoracle"
    });
    const downPlan = buildPredictOperationPlan({
      operation: "mint_directional",
      direction: "down",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000",
      maxCostRaw: "1100000"
    });

    expect(upPlan.moveTargets).toEqual(["market_key::up", "predict::mint"]);
    expect(downPlan.moveTargets).toEqual(["market_key::down", "predict::mint"]);
    expect(upPlan.objectIds).toMatchObject({
      managerId: "0xmanager",
      oracleId: "0xoracle"
    });
    expect(upPlan.maxCostRaw).toBe("1100000");
  });

  it("uses the whitelisted predict redeem target for redeem and close directional operations", () => {
    const redeemPlan = buildPredictOperationPlan({
      operation: "redeem_directional",
      direction: "up",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000",
      minProceedsRaw: "900000"
    });
    const closePlan = buildPredictOperationPlan({
      operation: "close_directional",
      direction: "down",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      resolvedQuantityRaw: "1000000",
      minProceedsRaw: "900000"
    } as never);

    expect(redeemPlan.moveTargets).toEqual(["market_key::new", "predict::redeem"]);
    expect(closePlan.moveTargets).toEqual(["market_key::new", "predict::redeem"]);
    expect(closePlan.quantityRaw).toBe("1000000");
  });

  it("rejects caller quantityRaw for close_directional", () => {
    expect(() =>
      buildPredictOperationPlan({
        operation: "close_directional",
        direction: "down",
        strikeRaw: "65000000000000",
        expiryMs: "1780000000000",
        quantityRaw: "1000000",
        minProceedsRaw: "900000"
      })
    ).toThrow("CLOSE_QUANTITY_MUST_BE_BACKEND_RESOLVED");
  });

  it("uses whitelisted range key and predict targets for range mint and redeem", () => {
    const mintPlan = buildPredictOperationPlan({
      operation: "mint_range",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000",
      maxCostRaw: "1100000"
    });
    const redeemPlan = buildPredictOperationPlan({
      operation: "redeem_range",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000",
      minProceedsRaw: "900000"
    });

    expect(mintPlan.moveTargets).toEqual(["range_key::new", "predict::mint_range"]);
    expect(redeemPlan.moveTargets).toEqual(["range_key::new", "predict::redeem_range"]);
  });

  it("builds deposit and manager creation plans without accepting caller targets", () => {
    expect(buildPredictOperationPlan({
      operation: "deposit_dusdc",
      quantityRaw: "1000000",
      quoteCoinObjectId: "0xcoin",
      managerId: "0xmanager"
    })).toMatchObject({
      operation: "deposit_dusdc",
      moveTargets: ["predict_manager::deposit"],
      quantityRaw: "1000000",
      objectIds: {
        quoteCoinObjectId: "0xcoin",
        managerId: "0xmanager"
      }
    });

    expect(buildPredictOperationPlan({
      operation: "create_manager"
    }).moveTargets).toEqual(["predict::create_manager"]);

    expect(() =>
      buildPredictOperationPlan({
        operation: "preview_directional",
        direction: "up",
        strikeRaw: "65000000000000",
        expiryMs: "1780000000000",
        quantityRaw: "1000000",
        moveTarget: "0xevil::predict::drain"
      } as never)
    ).toThrow("ARBITRARY_MOVE_TARGET_NOT_ALLOWED");
  });

  it("rejects all caller-provided arbitrary target aliases", () => {
    for (const targetAlias of ["moveTarget", "moveTargets", "target", "targets", "functionTarget"]) {
      expect(() =>
        buildPredictOperationPlan({
          operation: "preview_directional",
          direction: "up",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000",
          quantityRaw: "1000000",
          [targetAlias]: "0xevil::predict::drain"
        } as never)
      ).toThrow("ARBITRARY_MOVE_TARGET_NOT_ALLOWED");
    }
  });
});
