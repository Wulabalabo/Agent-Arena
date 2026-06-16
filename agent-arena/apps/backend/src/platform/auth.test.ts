import { describe, expect, it } from "bun:test";
import {
  authenticateAgentRuntimeRequest,
  createAgentRuntimeCredential,
  runtimeTokenHeader
} from "./auth";
import { PlatformMockStore } from "./mock-store";

function createClaimedTestAgent(store: PlatformMockStore, displayName = "Trend Ranger") {
  return store.createClaimedAgent({
    displayName,
    ownerAddress: "0xowner",
    twitterHandle: "Sui_Agent"
  });
}

describe("Agent runtime token auth", () => {
  it("creates one visible runtime token and authenticates by header", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store);
    const credential = createAgentRuntimeCredential(store, agent.id, "2026-06-15T10:00:00.000Z");

    expect(credential.token).toStartWith("agent_runtime_");
    expect(credential.scopes).toEqual([
      "agent:read",
      "agent:intent:write",
      "competition:read",
      "execution:read"
    ]);

    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { [runtimeTokenHeader]: credential.token }
    });

    expect(authenticateAgentRuntimeRequest(request, store).agentId).toBe(agent.id);
  });

  it("rejects missing runtime tokens", () => {
    const store = new PlatformMockStore();
    const request = new Request("http://localhost/api/arena/agent/me");

    expect(() => authenticateAgentRuntimeRequest(request, store)).toThrow("UNAUTHORIZED");
  });

  it("rejects unknown runtime tokens", () => {
    const store = new PlatformMockStore();
    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { [runtimeTokenHeader]: "agent_runtime_unknown" }
    });

    expect(() => authenticateAgentRuntimeRequest(request, store)).toThrow("UNAUTHORIZED");
  });

  it("rejects runtime credential creation for unknown agents", () => {
    const store = new PlatformMockStore();

    expect(() => createAgentRuntimeCredential(store, "agent_missing", "2026-06-15T10:00:00.000Z")).toThrow(
      "UNAUTHORIZED"
    );
  });

  it("does not expose mutable store records", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store);
    const credential = createAgentRuntimeCredential(store, agent.id, "2026-06-15T10:00:00.000Z");
    const token = credential.token;

    agent.displayName = "Mutated";
    credential.agentId = "agent_mutated";
    credential.scopes.push("admin");

    expect(store.getAgent(agent.id)?.displayName).toBe("Trend Ranger");
    expect(store.findRuntimeCredentialByToken(token)?.agentId).toBe(agent.id);
    expect(store.findRuntimeCredentialByToken(token)?.scopes).toEqual([
      "agent:read",
      "agent:intent:write",
      "competition:read",
      "execution:read"
    ]);

    const request = new Request("http://localhost/api/arena/agent/me", {
      headers: { [runtimeTokenHeader]: token }
    });

    expect(authenticateAgentRuntimeRequest(request, store).agentId).toBe(agent.id);
  });
});
