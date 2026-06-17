import { describe, expect, it } from "bun:test";
import { buildPredictOperationPlan, buildPredictTransactionFromPlan } from "./transactions";

const predictPackageId = "0x00000000000000000000000000000000000000000000000000000000000000f5";
const predictObjectId = "0x00000000000000000000000000000000000000000000000000000000000000aa";
const managerId = "0x00000000000000000000000000000000000000000000000000000000000000bb";
const quoteCoinObjectId = "0x00000000000000000000000000000000000000000000000000000000000000cc";
const quoteAssetType = "0xquote::dusdc::DUSDC";
const clockObjectId = "0x6";

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

  it("uses backend-resolved quantity for close_range", () => {
    const closePlan = buildPredictOperationPlan({
      operation: "close_range",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000",
      resolvedQuantityRaw: "1000000",
      minProceedsRaw: "900000"
    } as never);

    expect(closePlan.moveTargets).toEqual(["range_key::new", "predict::redeem_range"]);
    expect(closePlan.quantityRaw).toBe("1000000");

    expect(() =>
      buildPredictOperationPlan({
        operation: "close_range",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        expiryMs: "1780000000000",
        quantityRaw: "1000000",
        minProceedsRaw: "900000"
      } as never)
    ).toThrow("CLOSE_QUANTITY_MUST_BE_BACKEND_RESOLVED");
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

  it("builds a create_manager PTB against the configured Predict package", () => {
    const plan = buildPredictOperationPlan({
      operation: "create_manager"
    });
    const tx = buildPredictTransactionFromPlan(plan, {
      predictPackageId,
      predictObjectId,
      quoteAssetType,
      clockObjectId
    });
    const data = tx.getData() as { commands: Array<Record<string, any>> };

    expect(data.commands).toHaveLength(1);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "predict",
      function: "create_manager",
      typeArguments: [],
      arguments: []
    });
  });

  it("builds a DUSDC deposit PTB by splitting a funded quote coin and depositing into manager", () => {
    const plan = buildPredictOperationPlan({
      operation: "deposit_dusdc",
      quantityRaw: "5000000",
      managerId,
      quoteCoinObjectId
    });
    const tx = buildPredictTransactionFromPlan(plan, {
      predictPackageId,
      predictObjectId,
      quoteAssetType,
      clockObjectId
    });
    const data = tx.getData() as {
      commands: Array<Record<string, any>>;
      inputs: Array<Record<string, any>>;
    };

    expect(data.commands).toHaveLength(2);
    expect(data.commands[0]!.$kind).toBe("SplitCoins");
    expect(data.commands[1]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "predict_manager",
      function: "deposit",
      typeArguments: [quoteAssetType]
    });
  });

  it("builds a directional mint PTB from market key creation into predict mint", () => {
    const plan = buildPredictOperationPlan({
      operation: "mint_directional",
      direction: "up",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "1000000",
      maxCostRaw: "1100000",
      managerId,
      oracleId: "0x00000000000000000000000000000000000000000000000000000000000000dd"
    });

    const tx = buildPredictTransactionFromPlan(plan, {
      predictPackageId,
      predictObjectId,
      quoteAssetType,
      clockObjectId
    });
    const data = tx.getData() as { commands: Array<Record<string, any>> };

    expect(data.commands).toHaveLength(2);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "market_key",
      function: "up",
      typeArguments: []
    });
    expect(data.commands[1]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "predict",
      function: "mint",
      typeArguments: [quoteAssetType]
    });
    const inputJson = JSON.stringify(data.inputs);
    expect(inputJson).toContain(predictObjectId);
    expect(inputJson).toContain(managerId);
    expect(inputJson).toContain("0x00000000000000000000000000000000000000000000000000000000000000dd");
    expect(inputJson).toContain("0x0000000000000000000000000000000000000000000000000000000000000006");
  });

  it("builds a directional redeem PTB from market key creation into predict redeem", () => {
    const oracleId = "0x00000000000000000000000000000000000000000000000000000000000000dd";
    const plan = buildPredictOperationPlan({
      operation: "redeem_directional",
      direction: "down",
      strikeRaw: "65000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "50000",
      minProceedsRaw: "1",
      managerId,
      oracleId
    });

    const tx = buildPredictTransactionFromPlan(plan, {
      predictPackageId,
      predictObjectId,
      quoteAssetType,
      clockObjectId
    });
    const data = tx.getData() as {
      commands: Array<Record<string, any>>;
      inputs: Array<Record<string, any>>;
    };

    expect(data.commands).toHaveLength(2);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "market_key",
      function: "new",
      typeArguments: []
    });
    expect(data.commands[1]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "predict",
      function: "redeem",
      typeArguments: [quoteAssetType]
    });
    expect(JSON.stringify(data.commands[1])).toContain("\"Result\":0");
    const inputJson = JSON.stringify(data.inputs);
    expect(inputJson).toContain(predictObjectId);
    expect(inputJson).toContain(managerId);
    expect(inputJson).toContain(oracleId);
    expect(inputJson).toContain("0x0000000000000000000000000000000000000000000000000000000000000006");
  });

  it("builds a range mint PTB from range key creation into predict mint_range", () => {
    const oracleId = "0x00000000000000000000000000000000000000000000000000000000000000dd";
    const plan = buildPredictOperationPlan({
      operation: "mint_range",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "50000",
      maxCostRaw: "1000000",
      managerId,
      oracleId
    });

    const tx = buildPredictTransactionFromPlan(plan, {
      predictPackageId,
      predictObjectId,
      quoteAssetType,
      clockObjectId
    });
    const data = tx.getData() as {
      commands: Array<Record<string, any>>;
      inputs: Array<Record<string, any>>;
    };

    expect(data.commands).toHaveLength(2);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "range_key",
      function: "new",
      typeArguments: []
    });
    expect(data.commands[1]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "predict",
      function: "mint_range",
      typeArguments: [quoteAssetType]
    });
    expect(JSON.stringify(data.commands[1])).toContain("\"Result\":0");
    const inputJson = JSON.stringify(data.inputs);
    expect(inputJson).toContain(predictObjectId);
    expect(inputJson).toContain(managerId);
    expect(inputJson).toContain(oracleId);
    expect(inputJson).toContain("0x0000000000000000000000000000000000000000000000000000000000000006");
  });

  it("builds a range redeem PTB from range key creation into predict redeem_range", () => {
    const oracleId = "0x00000000000000000000000000000000000000000000000000000000000000dd";
    const plan = buildPredictOperationPlan({
      operation: "redeem_range",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      expiryMs: "1780000000000",
      quantityRaw: "50000",
      minProceedsRaw: "1",
      managerId,
      oracleId
    });

    const tx = buildPredictTransactionFromPlan(plan, {
      predictPackageId,
      predictObjectId,
      quoteAssetType,
      clockObjectId
    });
    const data = tx.getData() as {
      commands: Array<Record<string, any>>;
      inputs: Array<Record<string, any>>;
    };

    expect(data.commands).toHaveLength(2);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "range_key",
      function: "new",
      typeArguments: []
    });
    expect(data.commands[1]!.MoveCall).toMatchObject({
      package: predictPackageId,
      module: "predict",
      function: "redeem_range",
      typeArguments: [quoteAssetType]
    });
    expect(JSON.stringify(data.commands[1])).toContain("\"Result\":0");
    const inputJson = JSON.stringify(data.inputs);
    expect(inputJson).toContain(predictObjectId);
    expect(inputJson).toContain(managerId);
    expect(inputJson).toContain(oracleId);
    expect(inputJson).toContain("0x0000000000000000000000000000000000000000000000000000000000000006");
  });
});
