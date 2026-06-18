import { describe, expect, it } from "vitest";
import { createArenaApiBaseUrl } from "./config";

describe("platform config", () => {
  it("derives the Arena API base URL from a backend origin", () => {
    expect(createArenaApiBaseUrl("https://arena.example")).toBe("https://arena.example/api/arena");
  });

  it("preserves an explicit Arena API base URL", () => {
    expect(createArenaApiBaseUrl("https://arena.example/api/arena/")).toBe("https://arena.example/api/arena");
  });
});
