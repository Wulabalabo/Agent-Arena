import { describe, expect, it } from "bun:test";
import { getAllowedOperations, resolveRoundStatus } from "./competitions";

describe("competition lifecycle", () => {
  it("uses the more restrictive status between platform time and oracle state", () => {
    expect(resolveRoundStatus({
      platformStatus: "live",
      oracleState: "PendingSettlement"
    })).toBe("expired");
  });

  it("rejects new exposure after expiry but can allow close", () => {
    const operations = getAllowedOperations("expired");

    expect(operations.canOpen).toBe(false);
    expect(operations.canClose).toBe(true);
  });

  it("does not let oracle activity advance a platform round before live", () => {
    expect(resolveRoundStatus({
      platformStatus: "pre_open",
      oracleState: "Active"
    })).toBe("pre_open");
  });

  it("does not let an inactive oracle keep a platform round live", () => {
    expect(resolveRoundStatus({
      platformStatus: "live",
      oracleState: "Inactive"
    })).toBe("pre_open");
  });

  it("lets oracle expiry win over a stale pre-open platform status", () => {
    expect(resolveRoundStatus({
      platformStatus: "pre_open",
      oracleState: "PendingSettlement"
    })).toBe("expired");
  });

  it("does not reopen an expired platform round when the oracle is active", () => {
    expect(resolveRoundStatus({
      platformStatus: "expired",
      oracleState: "Active"
    })).toBe("expired");
  });

  it("keeps settled as the most restrictive lifecycle status", () => {
    expect(resolveRoundStatus({
      platformStatus: "live",
      oracleState: "Settled"
    })).toBe("settled");

    expect(resolveRoundStatus({
      platformStatus: "settled",
      oracleState: "Active"
    })).toBe("settled");
  });

  it("allows opening only while live", () => {
    expect(getAllowedOperations("pre_open")).toEqual({
      canOpen: false,
      canClose: false
    });
    expect(getAllowedOperations("live")).toEqual({
      canOpen: true,
      canClose: true
    });
    expect(getAllowedOperations("settled")).toEqual({
      canOpen: false,
      canClose: false
    });
  });

  it("returns defensive copies for allowed operations", () => {
    const operations = getAllowedOperations("live");
    operations.canOpen = false;

    expect(getAllowedOperations("live")).toEqual({
      canOpen: true,
      canClose: true
    });
  });
});
