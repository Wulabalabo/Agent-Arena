import { describe, expect, it } from "bun:test";
import {
  normalizeTwitterHandle,
  validateOwnerWithdrawalPayload,
  validateDecimalString,
  validateDisplayName,
  validateIntentPayload
} from "./validation";

describe("platform validation", () => {
  it("normalizes optional Twitter handles as display and lookup values", () => {
    expect(normalizeTwitterHandle("@Sui_Agent42")).toEqual({
      twitterHandle: "Sui_Agent42",
      normalizedTwitterHandle: "sui_agent42"
    });
    expect(normalizeTwitterHandle("")).toEqual({
      twitterHandle: null,
      normalizedTwitterHandle: null
    });
  });

  it("rejects invalid Twitter handles", () => {
    expect(() => normalizeTwitterHandle("@this_handle_is_too_long")).toThrow("twitterHandle must be 1 to 15 characters");
    expect(() => normalizeTwitterHandle("@bad-name")).toThrow("twitterHandle can contain only letters, numbers, and underscores");
  });

  it("validates decimal strings without raw integer assumptions", () => {
    expect(validateDecimalString("5.00", "maxCost")).toBe("5.00");
    expect(() => validateDecimalString("-1", "maxCost")).toThrow("maxCost must be a positive decimal string");
  });

  it("validates display names for pairing drafts", () => {
    expect(validateDisplayName("  Trend Ranger  ")).toBe("Trend Ranger");
    expect(() => validateDisplayName("")).toThrow("displayName must be a non-empty string");
    expect(() => validateDisplayName("x".repeat(81))).toThrow("displayName must be at most 80 characters");
  });

  it("validates owner withdrawal payloads and Sui recipient addresses", () => {
    expect(validateOwnerWithdrawalPayload({
      ownerAddress: "0xowner",
      signature: "0xsignedOwnerRequest",
      managerId: "0xmanager",
      amountRaw: "1000",
      recipientAddress: "0x00000000000000000000000000000000000000000000000000000000000000ef",
      closeFirst: true
    })).toEqual({
      ownerAddress: "0xowner",
      signature: "0xsignedOwnerRequest",
      managerId: "0xmanager",
      amountRaw: "1000",
      recipientAddress: "0x00000000000000000000000000000000000000000000000000000000000000ef",
      closeFirst: true
    });

    expect(() => validateOwnerWithdrawalPayload({
      ownerAddress: "0xowner",
      signature: "0xsignedOwnerRequest",
      managerId: "0xmanager",
      amountRaw: "1000",
      recipientAddress: "0xbad"
    })).toThrow("recipientAddress must be a 32-byte Sui address");
  });

  it("validates open_directional intent requirements", () => {
    const payload = validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-1",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z"
    });

    expect(payload.action).toBe("open_directional");

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-fractional-quantity",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "1.5",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Fractional Predict quantity is invalid.",
      createdAt: "2026-06-15T10:03:12.000Z"
    })).toThrow("quantity must be a positive raw integer string");
  });

  it("validates open_range bounds and raw strike fields", () => {
    const payload = validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "range-ranger",
      idempotencyKey: "range-ranger-1",
      action: "open_range",
      market: {
        kind: "range",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        lowerStrike: "64000000000000",
        higherStrike: "66000000000000"
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.62,
      reason: "Expect price to remain inside the band.",
      createdAt: "2026-06-15T10:03:12.000Z"
    });

    expect(payload.market).toEqual({
      kind: "range",
      oracleId: "0xbtc15m",
      expiry: "2026-06-15T10:15:00.000Z",
      lowerStrike: "64000000000000",
      higherStrike: "66000000000000"
    });

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "range-ranger",
      idempotencyKey: "range-ranger-invalid-bounds",
      action: "open_range",
      market: {
        kind: "range",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        lowerStrike: "66000000000000",
        higherStrike: "64000000000000"
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.62,
      reason: "Invalid range bounds.",
      createdAt: "2026-06-15T10:03:12.000Z"
    })).toThrow("market.lowerStrike must be less than market.higherStrike");

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "range-ranger",
      idempotencyKey: "range-ranger-decimal-strike",
      action: "open_range",
      market: {
        kind: "range",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        lowerStrike: "64000.5",
        higherStrike: "66000"
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.62,
      reason: "Invalid raw strike.",
      createdAt: "2026-06-15T10:03:12.000Z"
    })).toThrow("market.lowerStrike must be a positive raw integer string");
  });

  it("requires a typed positionRef for reduce and close actions", () => {
    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-reduce-1",
      action: "reduce",
      positionRef: {},
      quantity: "1",
      confidence: 0.6,
      reason: "Trim exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    })).toThrow("positionRef.kind must be directional or range");

    expect(validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-reduce-range",
      action: "reduce",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000",
        openExecutionId: "exec_1",
        quantity: "5"
      },
      quantity: "1",
      minProceeds: "0.5",
      confidence: 0.6,
      reason: "Trim range exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    }).positionRef).toMatchObject({
      kind: "range",
      rangeKey: "btc-range-64000-66000"
    });

    expect(validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-reduce-range-without-position-quantity",
      action: "reduce",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000",
        openExecutionId: "exec_1"
      },
      quantity: "1",
      minProceeds: "0.5",
      confidence: 0.6,
      reason: "Trim range exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    }).positionRef).toMatchObject({
      kind: "range",
      rangeKey: "btc-range-64000-66000",
      openExecutionId: "exec_1"
    });

    expect(validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-close-range",
      action: "close",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000",
      },
      minProceeds: "0.5",
      confidence: 0.6,
      reason: "Close range exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    }).positionRef).toMatchObject({
      kind: "range",
      rangeKey: "btc-range-64000-66000"
    });

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-close-range-with-position-quantity",
      action: "close",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000",
        quantity: "5"
      },
      minProceeds: "0.5",
      confidence: 0.6,
      reason: "Close range exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    })).toThrow("positionRef does not allow quantity");
  });

  it("rejects Agent-facing claim and withdrawal operations", () => {
    for (const action of ["claim_settled_directional", "claim_settled_range", "withdraw_manager_dusdc"]) {
      expect(() => validateIntentPayload({
        competitionId: "btc-15m-001",
        agentId: "trend-ranger",
        idempotencyKey: `trend-ranger-${action}`,
        action,
        confidence: 0.6,
        reason: "Not an Agent runtime action.",
        createdAt: "2026-06-15T10:05:12.000Z"
      })).toThrow("action must be a supported agent action");
    }
  });

  it("rejects planned composite actions that are not in the MVP action catalog", () => {
    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-add-1",
      action: "add",
      confidence: 0.6,
      reason: "Add exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    })).toThrow("action must be a supported agent action");
  });

  it("rejects irrelevant fields for implemented action schemas", () => {
    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-hold-1",
      action: "hold",
      minProceeds: "1",
      confidence: 0.6,
      reason: "Wait.",
      createdAt: "2026-06-15T10:05:12.000Z"
    })).toThrow("hold does not allow minProceeds");

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-open-2",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      minProceeds: "1",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z"
    })).toThrow("open_directional does not allow minProceeds");

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-close-1",
      action: "close",
      positionRef: {
        kind: "directional",
        marketKey: "btc-up-65000",
        quantity: "2"
      },
      quantity: "1",
      confidence: 0.6,
      reason: "Close exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    })).toThrow("close does not allow quantity");
  });

  it("rejects unknown top-level and nested fields", () => {
    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-open-unknown",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z",
      foo: "bar"
    })).toThrow("payload does not allow foo");

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-open-market-unknown",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true,
        lowerStrike: "64000"
      },
      quantity: "10",
      maxCost: "5.00",
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z"
    })).toThrow("market does not allow lowerStrike");

    expect(() => validateIntentPayload({
      competitionId: "btc-15m-001",
      agentId: "trend-ranger",
      idempotencyKey: "trend-ranger-close-unknown",
      action: "close",
      positionRef: {
        kind: "directional",
        marketKey: "btc-up-65000",
        rangeKey: "btc-range-64000-66000"
      },
      confidence: 0.6,
      reason: "Close exposure.",
      createdAt: "2026-06-15T10:05:12.000Z"
    })).toThrow("positionRef does not allow rangeKey");
  });
});
