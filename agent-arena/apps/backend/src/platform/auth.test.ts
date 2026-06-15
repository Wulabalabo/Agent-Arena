import { describe, expect, it } from "bun:test";
import { authenticateAgentRequest, createAgentCredential } from "./auth";
import { PlatformMockStore } from "./mock-store";

describe("Agent API auth", () => {
  it("creates one visible API key and authenticates by header", () => {
    const store = new PlatformMockStore();
    const agent = store.createAgent({ name: "Trend Ranger", twitterHandle: "Sui_Agent" });
    const credential = createAgentCredential(store, agent.id, "2026-06-15T10:00:00.000Z");

    expect(credential.apiKey).toStartWith("agent_arena_sk_");

    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { "x-agent-arena-api-key": credential.apiKey }
    });

    expect(authenticateAgentRequest(request, store).agentId).toBe(agent.id);
  });

  it("rejects missing credentials", () => {
    const store = new PlatformMockStore();
    const request = new Request("http://localhost/api/arena/agent/me");

    expect(() => authenticateAgentRequest(request, store)).toThrow("UNAUTHORIZED");
  });

  it("rejects unknown credentials", () => {
    const store = new PlatformMockStore();
    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { "x-agent-arena-api-key": "agent_arena_sk_unknown" }
    });

    expect(() => authenticateAgentRequest(request, store)).toThrow("UNAUTHORIZED");
  });

  it("rejects credential creation for unknown agents", () => {
    const store = new PlatformMockStore();

    expect(() => createAgentCredential(store, "agent_missing", "2026-06-15T10:00:00.000Z")).toThrow(
      "UNAUTHORIZED"
    );
  });

  it("does not expose mutable store records", () => {
    const store = new PlatformMockStore();
    const agent = store.createAgent({ name: "Trend Ranger", twitterHandle: "Sui_Agent" });
    const credential = createAgentCredential(store, agent.id, "2026-06-15T10:00:00.000Z");
    const apiKey = credential.apiKey;

    agent.name = "Mutated";
    credential.agentId = "agent_mutated";

    expect(store.getAgent(agent.id)?.name).toBe("Trend Ranger");

    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { "x-agent-arena-api-key": apiKey }
    });

    expect(authenticateAgentRequest(request, store).agentId).toBe(agent.id);
  });
});
