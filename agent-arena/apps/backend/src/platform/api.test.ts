import { describe, expect, it } from "bun:test";
import { createAgentArenaFetchHandler } from "../server";
import { createPlatformFetchHandler } from "./api";

describe("Agent Arena platform API", () => {
  it("registers an Agent and returns the API key once", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Trend Ranger", twitterHandle: "@Sui_Agent" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.apiKey).toStartWith("agent_arena_sk_");
    expect(body.agent.twitterHandle).toBe("Sui_Agent");
  });

  it("submits an authenticated intent", async () => {
    const fetch = createPlatformFetchHandler();
    const registered = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Trend Ranger" })
    }))).json();

    const walletResponse = await fetch(new Request(`http://localhost/api/arena/owner/agents/${registered.agent.id}/wallet`, {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey }
    }));
    expect(walletResponse.status).toBe(201);

    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: registered.agent.id,
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

  it("rejects wallet binding without the matching Agent API key", async () => {
    const fetch = createPlatformFetchHandler();
    const first = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "First Agent" })
    }))).json();
    const second = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Second Agent" })
    }))).json();

    const missingKey = await fetch(new Request(`http://localhost/api/arena/owner/agents/${first.agent.id}/wallet`, {
      method: "POST"
    }));
    const mismatch = await fetch(new Request(`http://localhost/api/arena/owner/agents/${first.agent.id}/wallet`, {
      method: "POST",
      headers: { "x-agent-arena-api-key": second.apiKey }
    }));

    expect(missingKey.status).toBe(401);
    expect(mismatch.status).toBe(403);
    await expect(mismatch.json()).resolves.toMatchObject({
      error: {
        code: "AGENT_MISMATCH"
      }
    });
  });

  it("rejects authenticated intents for a different agent", async () => {
    const fetch = createPlatformFetchHandler();
    const first = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "First Agent" })
    }))).json();
    const second = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Second Agent" })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-api-key": first.apiKey },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: second.agent.id,
        idempotencyKey: "intent-mismatch",
        action: "hold",
        confidence: 0.5,
        reason: "Wrong key.",
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
    const registered = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "No Wallet Agent" })
    }))).json();

    const malformed = await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: "{"
    }));
    const rejected = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: registered.agent.id,
        idempotencyKey: "intent-no-wallet",
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
        reason: "Valid idea without wallet.",
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
        code: "WALLET_NOT_BOUND",
        details: {
          status: "rejected"
        }
      }
    });
  });

  it("serves competition, market-state, and leaderboard routes", async () => {
    const fetch = createPlatformFetchHandler();
    const registered = await (await fetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Directional Agent" })
    }))).json();
    await fetch(new Request(`http://localhost/api/arena/owner/agents/${registered.agent.id}/wallet`, {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey }
    }));
    await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: registered.agent.id,
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
      entries: [{ agentId: registered.agent.id }]
    });
  });

  it("rejects missing API keys on authenticated Agent endpoints", async () => {
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
    expect(response.headers.get("access-control-allow-headers")).toContain("x-agent-arena-api-key");
  });

  it("does not reset a caller-provided store when handlers are recreated", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const firstFetch = createPlatformFetchHandler(store);
    const registered = await (await firstFetch(new Request("http://localhost/api/arena/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Persistent Agent" })
    }))).json();
    await firstFetch(new Request(`http://localhost/api/arena/owner/agents/${registered.agent.id}/wallet`, {
      method: "POST",
      headers: { "x-agent-arena-api-key": registered.apiKey }
    }));

    const secondFetch = createPlatformFetchHandler(store);
    const response = await secondFetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-api-key": registered.apiKey }
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wallet: {
        agentId: registered.agent.id
      }
    });
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
      seededCompetitionId: "btc-15m-001"
    });
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      ok: true
    });
  });
});
