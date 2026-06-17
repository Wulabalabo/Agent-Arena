import { describe, expect, it } from "bun:test";
import {
  assertRawIntegerString,
  classifyPolicyDrift,
  compareRawIntegers,
  evaluatePreSubmitGuardrails
} from "./guardrails";

describe("predict pre-submit guardrails", () => {
  it("rejects invalid raw integer strings", () => {
    expect(() => assertRawIntegerString("1.5", "quantityRaw")).toThrow("INVALID_RAW_AMOUNT");
    expect(() => assertRawIntegerString("-1", "quantityRaw")).toThrow("INVALID_RAW_AMOUNT");
    expect(() => assertRawIntegerString("   ", "quantityRaw")).toThrow("INVALID_RAW_AMOUNT");
    expect(() => assertRawIntegerString(1, "quantityRaw")).toThrow("INVALID_RAW_AMOUNT");
  });

  it("compares valid raw integers with BigInt semantics", () => {
    expect(compareRawIntegers("100000000000000000000", "9")).toBe(1);
    expect(compareRawIntegers("9", "100000000000000000000")).toBe(-1);
    expect(compareRawIntegers("00042", "42")).toBe(0);
  });

  it("rejects mint cost estimates above the pre-submit max cost", () => {
    expect(() =>
      evaluatePreSubmitGuardrails({
        operation: "mint_directional",
        estimatedCostRaw: "101",
        maxCostRaw: "100"
      })
    ).toThrow("MAX_COST_EXCEEDED");
  });

  it("rejects redeem proceeds estimates below the pre-submit minimum proceeds", () => {
    expect(() =>
      evaluatePreSubmitGuardrails({
        operation: "redeem_directional",
        estimatedProceedsRaw: "99",
        minProceedsRaw: "100"
      })
    ).toThrow("MIN_PROCEEDS_NOT_MET");

    expect(() =>
      evaluatePreSubmitGuardrails({
        operation: "close_range",
        estimatedProceedsRaw: "99",
        minProceedsRaw: "100"
      })
    ).toThrow("MIN_PROCEEDS_NOT_MET");
  });

  it("fails closed when pre-submit guard values are missing", () => {
    expect(() =>
      evaluatePreSubmitGuardrails({
        operation: "mint_directional",
        estimatedCostRaw: "100"
      })
    ).toThrow("INVALID_RAW_AMOUNT");

    expect(() =>
      evaluatePreSubmitGuardrails({
        operation: "redeem_directional",
        minProceedsRaw: "100"
      })
    ).toThrow("INVALID_RAW_AMOUNT");
  });

  it("classifies policy drift for cost and proceeds checks", () => {
    expect(classifyPolicyDrift({
      operation: "mint_range",
      actualCostRaw: "101",
      maxCostRaw: "100"
    })).toBe("cost_above_pre_submit_guard");

    expect(classifyPolicyDrift({
      operation: "close_directional",
      actualProceedsRaw: "99",
      minProceedsRaw: "100"
    })).toBe("proceeds_below_pre_submit_guard");

    expect(classifyPolicyDrift({
      operation: "close_range",
      actualProceedsRaw: "99",
      minProceedsRaw: "100"
    })).toBe("proceeds_below_pre_submit_guard");

    expect(classifyPolicyDrift({
      operation: "mint_directional",
      actualCostRaw: "100",
      maxCostRaw: "100"
    })).toBe("none");

    expect(classifyPolicyDrift({
      operation: "mint_directional",
      actualProceedsRaw: "100",
      minProceedsRaw: "100"
    })).toBe("unknown");
  });
});
