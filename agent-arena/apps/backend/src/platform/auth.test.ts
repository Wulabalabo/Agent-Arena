import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  authenticateAgentRuntimeRequest,
  createAgentRuntimeCredential,
  runtimeTokenHeader
} from "./auth";
import { PlatformMockStore } from "./mock-store";
import { SQLitePlatformStore } from "./sqlite-store";

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
    expect(credential.credentialVersion).toBe(1);
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

  it("rotates runtime credentials, increments version, and rejects the revoked old token", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store);
    const credential = createAgentRuntimeCredential(store, agent.id, "2026-06-15T10:00:00.000Z");
    const challenge = createStoredRotationChallenge(store, {
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      currentCredentialVersion: 1,
      nextCredentialVersion: 2
    });

    const rotated = store.rotateRuntimeCredentialForAgent({
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      nonce: challenge.nonce,
      reason: challenge.reason,
      domain: challenge.domain,
      chainId: challenge.chainId,
      currentCredentialVersion: challenge.currentCredentialVersion,
      now: "2026-06-15T10:01:00.000Z",
      revocationReason: "owner_rotation"
    });

    expect(rotated.previousCredential.revokedAt).toBe("2026-06-15T10:01:00.000Z");
    expect(rotated.credential.credentialVersion).toBe(2);
    expect(rotated.credential.token).toStartWith("agent_runtime_");
    expect(rotated.credential.token).not.toBe(credential.token);
    expect(store.findRuntimeCredentialByToken(credential.token)).toBeUndefined();
    expect(store.findRuntimeCredentialByToken(rotated.credential.token)?.agentId).toBe(agent.id);

    const oldRequest = new Request("http://localhost/api/arena/agent/me", {
      headers: { [runtimeTokenHeader]: credential.token }
    });
    const newRequest = new Request("http://localhost/api/arena/agent/me", {
      headers: { [runtimeTokenHeader]: rotated.credential.token }
    });
    expect(() => authenticateAgentRuntimeRequest(oldRequest, store)).toThrow("UNAUTHORIZED");
    expect(authenticateAgentRuntimeRequest(newRequest, store).agentId).toBe(agent.id);
  });

  it("rejects runtime credential rotation when the challenge version is stale", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store);
    createAgentRuntimeCredential(store, agent.id, "2026-06-15T10:00:00.000Z");
    const challenge = createStoredRotationChallenge(store, {
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      currentCredentialVersion: 0,
      nextCredentialVersion: 1
    });

    expect(() => store.rotateRuntimeCredentialForAgent({
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      nonce: challenge.nonce,
      reason: challenge.reason,
      domain: challenge.domain,
      chainId: challenge.chainId,
      currentCredentialVersion: challenge.currentCredentialVersion,
      now: "2026-06-15T10:01:00.000Z",
      revocationReason: "owner_rotation"
    })).toThrow("CREDENTIAL_VERSION_CONFLICT");
  });

  it("rejects runtime credential rotation when the nonce was consumed", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store);
    createAgentRuntimeCredential(store, agent.id, "2026-06-15T10:00:00.000Z");
    const challenge = createStoredRotationChallenge(store, {
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      currentCredentialVersion: 1,
      nextCredentialVersion: 2
    });
    const input = {
      agentId: agent.id,
      ownerAddress: agent.ownerAddress,
      nonce: challenge.nonce,
      reason: challenge.reason,
      domain: challenge.domain,
      chainId: challenge.chainId,
      currentCredentialVersion: challenge.currentCredentialVersion,
      now: "2026-06-15T10:01:00.000Z",
      revocationReason: "owner_rotation"
    };

    store.rotateRuntimeCredentialForAgent(input);

    expect(() => store.rotateRuntimeCredentialForAgent(input)).toThrow("ROTATION_NONCE_CONSUMED");
  });

  it("persists rotated SQLite credentials as hashes and keeps raw tokens out of storage", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agent-arena-rotation-"));
    const dbPath = join(tempDir, "platform.sqlite");
    try {
      const store = new SQLitePlatformStore(dbPath);
      const agent = createClaimedTestAgent(store);
      const credential = createAgentRuntimeCredential(store, agent.id, "2026-06-15T10:00:00.000Z");
      const challenge = createStoredRotationChallenge(store, {
        agentId: agent.id,
        ownerAddress: agent.ownerAddress,
        currentCredentialVersion: 1,
        nextCredentialVersion: 2
      });

      const rotated = store.rotateRuntimeCredentialForAgent({
        agentId: agent.id,
        ownerAddress: agent.ownerAddress,
        nonce: challenge.nonce,
        reason: challenge.reason,
        domain: challenge.domain,
        chainId: challenge.chainId,
        currentCredentialVersion: challenge.currentCredentialVersion,
        now: "2026-06-15T10:01:00.000Z",
        revocationReason: "owner_rotation"
      });
      store.close();

      const db = new Database(dbPath, { readonly: true });
      const row = db.query("SELECT state_json FROM platform_state WHERE id = 'default'")
        .get() as { state_json: string };
      db.close();

      expect(row.state_json).not.toContain(credential.token);
      expect(row.state_json).not.toContain(rotated.credential.token);
      expect(row.state_json).toContain("sha256:");

      const reloaded = new SQLitePlatformStore(dbPath);
      expect(reloaded.findRuntimeCredentialByToken(credential.token)).toBeUndefined();
      expect(reloaded.findRuntimeCredentialByToken(rotated.credential.token)?.credentialVersion).toBe(2);
      reloaded.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function createStoredRotationChallenge(
  store: PlatformMockStore,
  overrides: {
    agentId: string;
    ownerAddress: string;
    currentCredentialVersion: number;
    nextCredentialVersion: number;
  }
) {
  const challenge = {
    agentId: overrides.agentId,
    ownerAddress: overrides.ownerAddress,
    reason: "lost browser session",
    domain: "agent-arena-runtime-credential-rotation:v1",
    chainId: "sui:testnet",
    currentCredentialVersion: overrides.currentCredentialVersion,
    nextCredentialVersion: overrides.nextCredentialVersion,
    nonce: `nonce-${overrides.currentCredentialVersion}-${overrides.nextCredentialVersion}`,
    expiresAt: "2026-06-15T10:10:00.000Z",
    message: "Agent Arena runtime credential rotation test message",
    consumedAt: null
  };
  return store.saveRuntimeCredentialRotationChallenge(challenge);
}
