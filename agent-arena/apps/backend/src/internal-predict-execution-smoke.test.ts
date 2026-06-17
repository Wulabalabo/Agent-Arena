import { describe, expect, it } from "bun:test";
import {
  buildDirectionalRedeemExecuteBody,
  buildRangeRedeemExecuteBody,
  redactSmokeOutput
} from "./internal-predict-execution-smoke";

describe("internal Predict smoke helpers", () => {
  it("redacts private material and internal tokens from JSON output", () => {
    const redacted = redactSmokeOutput({
      wallet: {
        id: "wallet_internal_001",
        address: "0xabc",
        privateKey: "must-not-print",
        encryptedPrivateKey: "must-not-print"
      },
      nested: {
        secretKey: "must-not-print",
        walletSecret: "must-not-print",
        "x-agent-arena-internal-token": "must-not-print"
      }
    });

    const serialized = JSON.stringify(redacted);
    expect(serialized).toContain("wallet_internal_001");
    expect(serialized).toContain("0xabc");
    expect(serialized).not.toContain("must-not-print");
    expect(serialized).not.toContain("privateKey");
    expect(serialized).not.toContain("encryptedPrivateKey");
    expect(serialized).not.toContain("secretKey");
    expect(serialized).not.toContain("walletSecret");
    expect(serialized).not.toContain("x-agent-arena-internal-token");
  });

  it("builds close-last without caller quantity so the backend resolves the full position", () => {
    expect(buildDirectionalRedeemExecuteBody({
      operation: "close_directional",
      walletId: "wallet_internal_001",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      direction: "up",
      expiryMs: "1780000000000",
      strikeRaw: "65000000000000",
      minProceedsRaw: "1",
      dryRunOnly: true
    })).toEqual({
      walletId: "wallet_internal_001",
      operation: "close_directional",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      direction: "up",
      minProceedsRaw: "1",
      estimatedProceedsRaw: "1",
      expiryMs: "1780000000000",
      strikeRaw: "65000000000000",
      dryRunOnly: true
    });
  });

  it("builds close-range-last without caller quantity so the backend resolves the full range position", () => {
    expect(buildRangeRedeemExecuteBody({
      operation: "close_range",
      walletId: "wallet_internal_001",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      expiryMs: "1780000000000",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      minProceedsRaw: "1",
      dryRunOnly: true
    })).toEqual({
      walletId: "wallet_internal_001",
      operation: "close_range",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      minProceedsRaw: "1",
      estimatedProceedsRaw: "1",
      expiryMs: "1780000000000",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      dryRunOnly: true
    });
  });
});
