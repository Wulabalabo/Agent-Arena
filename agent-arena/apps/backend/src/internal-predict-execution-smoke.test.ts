import { describe, expect, it } from "bun:test";
import {
  buildUnresolvedCloseLastResponse,
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

  it("reports close-last as disabled when backend position quantity is not resolved", () => {
    expect(buildUnresolvedCloseLastResponse({
      walletId: "wallet_internal_001",
      minProceedsRaw: "1"
    })).toEqual({
      safetyStatus: "PREDICT_SUBMIT_DISABLED",
      submitAttempted: false,
      walletId: "wallet_internal_001",
      minProceedsRaw: "1",
      positionResolution: {
        status: "not_wired",
        code: "POSITION_RESOLUTION_NOT_WIRED",
        message: "Live close-last needs backend-resolved position quantity before a transaction can be built."
      },
      error: {
        code: "POSITION_RESOLUTION_NOT_WIRED",
        message: "Live close-last needs backend-resolved position quantity before a transaction can be built."
      }
    });
  });
});
