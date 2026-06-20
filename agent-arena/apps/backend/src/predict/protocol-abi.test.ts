import { describe, expect, it } from "bun:test";
import {
  predictEventFields,
  predictMoveFunctions,
  predictProtocolAbi
} from "./protocol-abi";

describe("DeepBook Predict protocol ABI metadata", () => {
  it("records the verified Testnet source branch and source files", () => {
    expect(predictProtocolAbi.network).toBe("testnet");
    expect(predictProtocolAbi.sourceBranch).toBe("predict-testnet-4-16");
    expect(predictProtocolAbi.sourceFiles).toEqual(expect.arrayContaining([
      "packages/predict/sources/predict.move",
      "packages/predict/sources/predict_manager.move",
      "packages/predict/sources/market_key/range_key.move"
    ]));
  });

  it("records range and settled Predict entry points before executors use them", () => {
    expect(predictMoveFunctions.predict.mintRange).toMatchObject({
      module: "predict",
      function: "mint_range",
      targetSuffix: "::predict::mint_range",
      typeArguments: ["quoteAssetType"],
      arguments: ["predict", "manager", "oracle", "rangeKey", "quantity", "clock"]
    });

    expect(predictMoveFunctions.predict.redeemRange).toMatchObject({
      module: "predict",
      function: "redeem_range",
      targetSuffix: "::predict::redeem_range",
      typeArguments: ["quoteAssetType"],
      arguments: ["predict", "manager", "oracle", "rangeKey", "quantity", "clock"]
    });

    expect(predictMoveFunctions.predict.redeemPermissionless).toMatchObject({
      module: "predict",
      function: "redeem_permissionless",
      targetSuffix: "::predict::redeem_permissionless",
      typeArguments: ["quoteAssetType"],
      arguments: ["predict", "manager", "oracle", "marketKey", "quantity", "clock"]
    });
  });

  it("records PredictManager read and withdrawal entry points", () => {
    expect(predictMoveFunctions.predictManager.rangePosition).toMatchObject({
      module: "predict_manager",
      function: "range_position",
      targetSuffix: "::predict_manager::range_position",
      typeArguments: [],
      arguments: ["manager", "rangeKey"],
      returns: "u64"
    });

    expect(predictMoveFunctions.predictManager.balance).toMatchObject({
      module: "predict_manager",
      function: "balance",
      targetSuffix: "::predict_manager::balance",
      typeArguments: ["quoteAssetType"],
      arguments: ["manager"],
      returns: "u64"
    });

    expect(predictMoveFunctions.predictManager.withdraw).toMatchObject({
      module: "predict_manager",
      function: "withdraw",
      targetSuffix: "::predict_manager::withdraw",
      typeArguments: ["quoteAssetType"],
      arguments: ["manager", "amount"],
      returns: "coin"
    });
  });

  it("records range event fields used for post-submit audit", () => {
    expect(predictEventFields.RangeMinted).toEqual(expect.arrayContaining([
      "predict_id",
      "manager_id",
      "trader",
      "oracle_id",
      "expiry",
      "lower_strike",
      "higher_strike",
      "quantity",
      "cost",
      "ask_price"
    ]));

    expect(predictEventFields.RangeRedeemed).toEqual(expect.arrayContaining([
      "predict_id",
      "manager_id",
      "trader",
      "oracle_id",
      "expiry",
      "lower_strike",
      "higher_strike",
      "quantity",
      "payout",
      "bid_price",
      "is_settled"
    ]));
  });
});
