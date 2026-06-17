import { describe, expect, it } from "bun:test";
import {
  buildDirectionalRedeemExecuteBody,
  buildManagerWithdrawExecuteBody,
  buildRangeRedeemExecuteBody,
  parseArgs,
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

  it("parses auto-range-smoke mode and withdraw-after-close flag", () => {
    const parsed = parseArgs([
      "--auto-range-smoke",
      "--wallet-id",
      "wallet_internal_001",
      "--min-time-to-expiry-ms",
      "300000",
      "--withdraw-after-close"
    ]);

    expect(parsed.mode).toBe("auto-range-smoke");
    expect(parsed.values.get("auto-range-smoke")).toBe(true);
    expect(parsed.values.get("min-time-to-expiry-ms")).toBe("300000");
    expect(parsed.values.get("withdraw-after-close")).toBe(true);
  });

  it("redacts private material from auto-range shaped output", () => {
    const redacted = redactSmokeOutput({
      ok: true,
      mode: "submit",
      selectedMarket: {
        oracleId: "0xoracle",
        privateKey: "must-not-print"
      },
      steps: [
        {
          name: "mint_range",
          request: {
            walletSecret: "must-not-print",
            quantityRaw: "100000"
          },
          response: {
            httpStatus: 200,
            secretKey: "must-not-print",
            headers: {
              "x-agent-arena-internal-token": "must-not-print"
            }
          }
        },
        {
          name: "withdraw_manager_dusdc",
          response: {
            wallet: {
              walletSecret: "must-not-print",
              address: "0xrecipient"
            }
          }
        }
      ]
    });

    const serialized = JSON.stringify(redacted);
    expect(serialized).toContain("mint_range");
    expect(serialized).toContain("withdraw_manager_dusdc");
    expect(serialized).toContain("0xrecipient");
    expect(serialized).not.toContain("must-not-print");
    expect(serialized).not.toContain("privateKey");
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

  it("builds claim-settled-directional without caller quantity so the backend resolves the full position", () => {
    expect(buildDirectionalRedeemExecuteBody({
      operation: "claim_settled_directional",
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
      operation: "claim_settled_directional",
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

  it("builds claim-settled-range without caller quantity so the backend resolves the full range position", () => {
    expect(buildRangeRedeemExecuteBody({
      operation: "claim_settled_range",
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
      operation: "claim_settled_range",
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

  it("builds manager DUSDC withdrawal with amountRaw and optional recipient", () => {
    expect(buildManagerWithdrawExecuteBody({
      walletId: "wallet_internal_001",
      managerId: "0xmanager",
      amountRaw: "1000",
      recipientAddress: "0xrecipient",
      dryRunOnly: true
    })).toEqual({
      walletId: "wallet_internal_001",
      operation: "withdraw_manager_dusdc",
      managerId: "0xmanager",
      amountRaw: "1000",
      recipientAddress: "0xrecipient",
      dryRunOnly: true
    });
  });
});
