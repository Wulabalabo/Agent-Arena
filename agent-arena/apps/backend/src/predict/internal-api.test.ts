import { describe, expect, it } from "bun:test";
import { createInternalPredictFetchHandler } from "./internal-api";

describe("createInternalPredictFetchHandler", () => {
  it("rejects unauthenticated internal OPTIONS requests", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken: "secret" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "OPTIONS"
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("reports disabled internal API for OPTIONS when the expected token is blank", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken: "   " });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "OPTIONS"
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INTERNAL_API_DISABLED"
      }
    });
  });

  it("allows authenticated internal OPTIONS requests", async () => {
    const fetch = createInternalPredictFetchHandler({ internalToken: "secret" });
    const response = await fetch(new Request("http://localhost/api/arena/internal/wallets", {
      method: "OPTIONS",
      headers: { "x-agent-arena-internal-token": "secret" }
    }));

    expect(response.status).toBe(204);
  });
});
