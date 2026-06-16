import { describe, expect, it } from "bun:test";
import {
  assertInternalRequest,
  isInternalArenaPath
} from "./internal-auth";

describe("assertInternalRequest", () => {
  it("rejects missing internal token", () => {
    expect(() => assertInternalRequest(
      new Request("http://localhost/api/arena/internal/wallets"),
      "secret"
    )).toThrow("UNAUTHORIZED");
  });

  it("rejects invalid internal token", () => {
    const request = new Request("http://localhost/api/arena/internal/wallets", {
      headers: { "x-agent-arena-internal-token": "bad" }
    });

    expect(() => assertInternalRequest(request, "secret")).toThrow("UNAUTHORIZED");
  });

  it("accepts exact internal token", () => {
    const request = new Request("http://localhost/api/arena/internal/wallets", {
      headers: { "x-agent-arena-internal-token": "secret" }
    });

    expect(assertInternalRequest(request, "secret")).toBeUndefined();
  });

  it("disables internal API when expected token is blank", () => {
    const request = new Request("http://localhost/api/arena/internal/wallets", {
      headers: { "x-agent-arena-internal-token": "secret" }
    });

    expect(() => assertInternalRequest(request, "   ")).toThrow("INTERNAL_API_DISABLED");
  });
});

describe("isInternalArenaPath", () => {
  it("matches only the internal arena route and children", () => {
    expect(isInternalArenaPath("/api/arena/internal")).toBe(true);
    expect(isInternalArenaPath("/api/arena/internal/wallets")).toBe(true);
    expect(isInternalArenaPath("/api/arena/internalized")).toBe(false);
    expect(isInternalArenaPath("/api/arena/agent/me")).toBe(false);
    expect(isInternalArenaPath("/api/arena")).toBe(false);
  });
});
