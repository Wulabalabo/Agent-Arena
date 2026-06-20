import { describe, expect, it } from "vitest";
import { createArenaApiBaseUrl, createArenaPublicBaseUrl } from "./config";

describe("platform config", () => {
  it("derives the Arena API base URL from a backend origin", () => {
    expect(createArenaApiBaseUrl("https://arena.example")).toBe("https://arena.example/api/arena");
  });

  it("preserves an explicit Arena API base URL", () => {
    expect(createArenaApiBaseUrl("https://arena.example/api/arena/")).toBe("https://arena.example/api/arena");
  });

  it("derives the public base URL from a same-origin API path and browser origin", () => {
    expect(createArenaPublicBaseUrl("/api/arena", "https://arena.mindfrog.xyz")).toBe("https://arena.mindfrog.xyz");
  });

  it("strips the API path from an absolute backend URL for public skill links", () => {
    expect(createArenaPublicBaseUrl("https://arena.mindfrog.xyz/api/arena")).toBe("https://arena.mindfrog.xyz");
  });
});
