import type { PredictConfig } from "./types";

type Env = Record<string, string | undefined>;

const requiredKeys = [
  "AGENT_ARENA_SUI_RPC_URL",
  "AGENT_ARENA_PREDICT_SERVER_URL",
  "AGENT_ARENA_PREDICT_PACKAGE_ID",
  "AGENT_ARENA_PREDICT_OBJECT_ID",
  "AGENT_ARENA_SUI_CLOCK_OBJECT_ID",
  "AGENT_ARENA_QUOTE_ASSET_TYPE",
  "AGENT_ARENA_QUOTE_DECIMALS",
  "AGENT_ARENA_PRICE_DECIMALS",
  "AGENT_ARENA_INTERNAL_TOKEN",
  "AGENT_ARENA_WALLET_SECRET"
] as const;

export function createPredictConfig(env: Env = Bun.env): PredictConfig {
  if (env.AGENT_ARENA_NETWORK !== "testnet") {
    throw new Error("TESTNET_ONLY");
  }

  for (const key of requiredKeys) {
    required(env, key);
  }

  return {
    network: "testnet",
    suiRpcUrl: required(env, "AGENT_ARENA_SUI_RPC_URL"),
    predictServerUrl: required(env, "AGENT_ARENA_PREDICT_SERVER_URL"),
    predictPackageId: required(env, "AGENT_ARENA_PREDICT_PACKAGE_ID"),
    predictObjectId: required(env, "AGENT_ARENA_PREDICT_OBJECT_ID"),
    suiClockObjectId: required(env, "AGENT_ARENA_SUI_CLOCK_OBJECT_ID"),
    quoteAssetType: required(env, "AGENT_ARENA_QUOTE_ASSET_TYPE"),
    quoteDecimals: parseRequiredDecimals(env, "AGENT_ARENA_QUOTE_DECIMALS", 6),
    priceDecimals: parseRequiredDecimals(env, "AGENT_ARENA_PRICE_DECIMALS", 9),
    internalToken: required(env, "AGENT_ARENA_INTERNAL_TOKEN"),
    walletSecret: required(env, "AGENT_ARENA_WALLET_SECRET"),
    enablePredictSubmit: env.AGENT_ARENA_ENABLE_PREDICT_SUBMIT?.trim().toLowerCase() === "true"
  };
}

function required(env: Env, key: (typeof requiredKeys)[number]): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`MISSING_${key}`);
  }

  return value;
}

function parseRequiredDecimals<Key extends "AGENT_ARENA_QUOTE_DECIMALS" | "AGENT_ARENA_PRICE_DECIMALS">(
  env: Env,
  key: Key,
  expected: Key extends "AGENT_ARENA_QUOTE_DECIMALS" ? 6 : 9
): Key extends "AGENT_ARENA_QUOTE_DECIMALS" ? 6 : 9 {
  const value = Number(required(env, key));
  if (!Number.isSafeInteger(value) || value !== expected) {
    throw new Error(`INVALID_${key}`);
  }

  return expected as Key extends "AGENT_ARENA_QUOTE_DECIMALS" ? 6 : 9;
}
