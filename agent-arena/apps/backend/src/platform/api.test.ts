import { describe, expect, it } from "bun:test";
import { createAgentArenaFetchHandler } from "../server";
import { createPlatformFetchHandler } from "./api";

async function claimTestAgent(
  fetch: ReturnType<typeof createPlatformFetchHandler>,
  input: {
    displayName?: string;
    ownerAddress?: string;
    signature?: string;
    twitterHandle?: string | null;
  } = {}
) {
  const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
    method: "POST",
    body: JSON.stringify({ displayName: input.displayName ?? "Trend Ranger" })
  }))).json();

  return await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: input.ownerAddress ?? "0xowner",
      signature: input.signature ?? "0xsignedClaimMessage",
      ...(input.twitterHandle === undefined ? {} : { twitterHandle: input.twitterHandle })
    })
  }))).json();
}

describe("Agent Arena platform API", () => {
  it("initializes an Agent pairing without issuing runtime credentials", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Trend Ranger" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      displayName: "Trend Ranger"
    });
    expect(body.agentDraftId).toStartWith("draft_");
    expect(body.registrationCode).toMatch(/^PAIR-/);
    expect(body.claimUrl).toContain(body.registrationCode);
    expect(body.expiresAt).toBe("2026-06-15T00:15:00.000Z");
    expect(body).not.toHaveProperty("apiKey");
    expect(body).not.toHaveProperty("runtimeCredential");
  });

  it("claims a pairing code and returns the runtime credential once", async () => {
    const fetch = createPlatformFetchHandler();
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Trend Ranger" })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage",
        twitterHandle: "@Sui_Agent"
      })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.agent).toMatchObject({
      displayName: "Trend Ranger",
      twitterHandle: "Sui_Agent",
      twitterVerified: false,
      ownerAddress: "0xowner",
      runtimeStatus: "active",
      exposureStatus: "flat"
    });
    expect(body.tradingWallet).toMatchObject({
      agentId: body.agent.id,
      status: "active",
      testnetSuiBalance: "0",
      quoteBalance: "0",
      predictManagerStatus: "missing"
    });
    expect(body.runtimeCredential.token).toStartWith("agent_runtime_");
    expect(body.runtimeCredential.shownOnce).toBe(true);
    expect(body.runtimeCredential.scopes).toEqual([
      "agent:read",
      "agent:intent:write",
      "competition:read",
      "execution:read"
    ]);
    expect(body).not.toHaveProperty("apiKey");
  });

  it("submits an authenticated intent with the runtime token", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch);

    const meResponse = await fetch(new Request("http://localhost/api/arena/agent/me", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      id: claimed.agent.id,
      displayName: "Trend Ranger"
    });

    const walletResponse = await fetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));
    expect(walletResponse.status).toBe(200);
    await expect(walletResponse.json()).resolves.toMatchObject({
      wallet: {
        agentId: claimed.agent.id,
        status: "active"
      }
    });

    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-api-1",
        action: "hold",
        confidence: 0.5,
        reason: "Waiting for cleaner signal.",
        createdAt: "2026-06-15T10:03:12.000Z"
      })
    }));

    expect(intentResponse.status).toBe(201);
    const body = await intentResponse.json();
    expect(body.status).toBe("accepted");
  });

  it("rejects authenticated intents for a different agent", async () => {
    const fetch = createPlatformFetchHandler();
    const first = await claimTestAgent(fetch, { displayName: "First Agent" });
    const second = await claimTestAgent(fetch, { displayName: "Second Agent", ownerAddress: "0xowner2" });

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": first.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: second.agent.id,
        idempotencyKey: "intent-mismatch",
        action: "hold",
        confidence: 0.5,
        reason: "Wrong token.",
        createdAt: "2026-06-15T10:03:12.000Z"
      })
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AGENT_MISMATCH"
      }
    });
  });

  it("returns common error bodies for malformed JSON and rejected intents", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch, { displayName: "Risk Agent" });

    const malformed = await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: "{"
    }));
    const rejected = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-invalid",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          strike: "65000",
          isUp: true
        },
        quantity: "10",
        maxCost: "0",
        confidence: 0.7,
        reason: "Invalid max cost.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT"
      }
    });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT"
      }
    });
  });

  it("serves competition, market-state, and leaderboard routes", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch, { displayName: "Directional Agent" });
    await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-leaderboard",
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
        confidence: 0.7,
        reason: "Creates an execution for leaderboard.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    const active = await fetch(new Request("http://localhost/api/arena/competition/list-active"));
    const competition = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001"));
    const marketState = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/market-state"));
    const leaderboard = await fetch(new Request("http://localhost/api/arena/leaderboard?competitionId=btc-15m-001"));

    expect(active.status).toBe(200);
    await expect(active.json()).resolves.toMatchObject({
      competitions: [{ id: "btc-15m-001" }]
    });
    expect(competition.status).toBe(200);
    await expect(competition.json()).resolves.toMatchObject({
      competition: { id: "btc-15m-001" }
    });
    expect(marketState.status).toBe(200);
    await expect(marketState.json()).resolves.toMatchObject({
      marketState: {
        competitionId: "btc-15m-001",
        allowedOperations: { canOpen: true }
      }
    });
    expect(leaderboard.status).toBe(200);
    await expect(leaderboard.json()).resolves.toMatchObject({
      competitionId: "btc-15m-001",
      entries: [{
        rank: 1,
        agentId: claimed.agent.id,
        displayName: "Directional Agent",
        twitterVerified: false,
        executionCount: 1,
        invalidIntentCount: 0
      }]
    });
  });

  it("rejects missing runtime tokens on authenticated Agent endpoints", async () => {
    const fetch = createPlatformFetchHandler();
    const meResponse = await fetch(new Request("http://localhost/api/arena/agent/me"));
    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      body: JSON.stringify({})
    }));

    expect(meResponse.status).toBe(401);
    await expect(meResponse.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
    expect(intentResponse.status).toBe(401);
  });

  it("handles CORS preflight for platform routes", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "OPTIONS"
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-agent-arena-agent-token");
  });

  it("does not reset a caller-provided store when handlers are recreated", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const firstFetch = createPlatformFetchHandler(store);
    const claimed = await claimTestAgent(firstFetch, { displayName: "Persistent Agent" });

    const secondFetch = createPlatformFetchHandler(store);
    const response = await secondFetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wallet: {
        agentId: claimed.agent.id
      }
    });
  });

  it("does not expose deprecated API-key registration in introspection", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/__introspection"));
    const body = await response.json();

    expect(body.authHeader).toBe("x-agent-arena-agent-token");
    expect(JSON.stringify(body)).not.toContain("x-agent-arena-api-key");
    expect(JSON.stringify(body)).not.toContain("/api/arena/auth/register");
  });
});

describe("Agent Arena combined backend handler", () => {
  it("routes platform introspection and legacy health checks", async () => {
    const fetch = createAgentArenaFetchHandler();
    const platformResponse = await fetch(new Request("http://localhost/api/arena/__introspection"));
    const healthResponse = await fetch(new Request("http://localhost/health"));

    expect(platformResponse.status).toBe(200);
    await expect(platformResponse.json()).resolves.toMatchObject({
      service: "agent-arena-platform",
      seededCompetitionId: "btc-15m-001",
      authHeader: "x-agent-arena-agent-token"
    });
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      ok: true
    });
  });
});
