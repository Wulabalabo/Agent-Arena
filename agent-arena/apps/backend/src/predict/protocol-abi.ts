export interface PredictMoveFunctionMetadata {
  module: string;
  function: string;
  targetSuffix: string;
  typeArguments: string[];
  arguments: string[];
  returns?: "coin" | "u64" | "void";
}

export const predictProtocolAbi = {
  network: "testnet",
  sourceBranch: "predict-testnet-4-16",
  sourceFiles: [
    "packages/predict/sources/predict.move",
    "packages/predict/sources/predict_manager.move",
    "packages/predict/sources/market_key/range_key.move"
  ]
} as const;

export const predictMoveFunctions = {
  predict: {
    mintRange: {
      module: "predict",
      function: "mint_range",
      targetSuffix: "::predict::mint_range",
      typeArguments: ["quoteAssetType"],
      arguments: ["predict", "manager", "oracle", "rangeKey", "quantity", "clock"],
      returns: "void"
    },
    redeemRange: {
      module: "predict",
      function: "redeem_range",
      targetSuffix: "::predict::redeem_range",
      typeArguments: ["quoteAssetType"],
      arguments: ["predict", "manager", "oracle", "rangeKey", "quantity", "clock"],
      returns: "void"
    },
    redeemPermissionless: {
      module: "predict",
      function: "redeem_permissionless",
      targetSuffix: "::predict::redeem_permissionless",
      typeArguments: ["quoteAssetType"],
      arguments: ["predict", "manager", "oracle", "marketKey", "quantity", "clock"],
      returns: "void"
    }
  },
  predictManager: {
    rangePosition: {
      module: "predict_manager",
      function: "range_position",
      targetSuffix: "::predict_manager::range_position",
      typeArguments: [],
      arguments: ["manager", "rangeKey"],
      returns: "u64"
    },
    balance: {
      module: "predict_manager",
      function: "balance",
      targetSuffix: "::predict_manager::balance",
      typeArguments: ["quoteAssetType"],
      arguments: ["manager"],
      returns: "u64"
    },
    withdraw: {
      module: "predict_manager",
      function: "withdraw",
      targetSuffix: "::predict_manager::withdraw",
      typeArguments: ["quoteAssetType"],
      arguments: ["manager", "amount"],
      returns: "coin"
    }
  }
} as const satisfies {
  predict: Record<string, PredictMoveFunctionMetadata>;
  predictManager: Record<string, PredictMoveFunctionMetadata>;
};

export const predictEventFields = {
  RangeMinted: [
    "predict_id",
    "manager_id",
    "trader",
    "quote_asset",
    "oracle_id",
    "expiry",
    "lower_strike",
    "higher_strike",
    "quantity",
    "cost",
    "ask_price"
  ],
  RangeRedeemed: [
    "predict_id",
    "manager_id",
    "trader",
    "quote_asset",
    "oracle_id",
    "expiry",
    "lower_strike",
    "higher_strike",
    "quantity",
    "payout",
    "bid_price",
    "is_settled"
  ]
} as const;
