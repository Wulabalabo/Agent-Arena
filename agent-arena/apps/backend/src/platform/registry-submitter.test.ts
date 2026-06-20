import { describe, expect, it } from "bun:test";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  createRegistryAuthorizationProof,
  hashRegistryAuthorization,
  REGISTRY_AUTHORIZATION_DOMAIN
} from "./registry-submitter";
import type { RegistryWriteRequest } from "./registry";

const packageId = "0x0000000000000000000000000000000000000000000000000000000000000abc";
const registryObjectId = "0x0000000000000000000000000000000000000000000000000000000000000def";
const ownerAddress = "0x0000000000000000000000000000000000000000000000000000000000000bad";
const tradingWalletAddress = "0x0000000000000000000000000000000000000000000000000000000000000bee";
const fixedNonce = new Uint8Array(32).fill(7);
const moveTestRegistryObjectId = "0x381dd9078c322a4663c392761a0211b527c127b29583851217f948d62131f409";

const registerRequest: RegistryWriteRequest = {
  kind: "register_agent",
  packageId,
  registryObjectId,
  agentId: "agent_1",
  agentDraftId: "draft_1",
  ownerAddress,
  tradingWalletAddress,
  metadataHash: "sha256:metadata",
  platformCreatedAtMs: 1781715000000
};

describe("Agent Arena registry authorization proofs", () => {
  it("matches the Move authorization golden vectors", () => {
    const nonce = new TextEncoder().encode("register_nonce_1");
    const hash = hashRegistryAuthorization({
      kind: "register_agent",
      packageId,
      registryObjectId: moveTestRegistryObjectId,
      agentId: "agent_1",
      agentDraftId: "draft_1",
      ownerAddress: "0x00000000000000000000000000000000000000000000000000000000000a11ce",
      tradingWalletAddress: "0x0000000000000000000000000000000000000000000000000000000000c0ffee",
      metadataHash: "metadata_hash_1",
      platformCreatedAtMs: 1781715000000
    }, nonce);

    expect(REGISTRY_AUTHORIZATION_DOMAIN).toBe("agent-arena-registry:v1:testnet");
    expect(Array.from(hash)).toEqual([
      33, 1, 140, 66, 227, 48, 51, 70, 192, 45, 67, 93, 101, 181, 8, 228,
      58, 145, 231, 88, 102, 49, 25, 50, 101, 254, 86, 65, 5, 127, 193, 130
    ]);
  });

  it("creates a register proof without building or executing a transaction", async () => {
    const signer = Ed25519Keypair.generate();
    const proof = await createRegistryAuthorizationProof(registerRequest, signer, fixedNonce);

    expect(proof).toMatchObject({
      kind: "register_agent",
      packageId,
      registryObjectId,
      agentId: "agent_1",
      ownerAddress,
      tradingWalletAddress,
      metadataHash: "sha256:metadata"
    });
    expect(proof.nonceBase64).toBe(Buffer.from(fixedNonce).toString("base64"));
    expect(Buffer.from(proof.signatureBase64, "base64")).toHaveLength(64);
  });

  it("creates a runtime credential rotation proof", async () => {
    const signer = Ed25519Keypair.generate();
    const proof = await createRegistryAuthorizationProof({
      kind: "record_runtime_credential_rotation",
      packageId,
      registryObjectId,
      agentId: "agent_1",
      ownerAddress,
      previousCredentialVersion: 1,
      nextCredentialVersion: 2,
      rotationHash: "sha256:rotation",
      platformCreatedAtMs: 1781715000000
    }, signer, fixedNonce);

    expect(proof).toMatchObject({
      kind: "record_runtime_credential_rotation",
      packageId,
      registryObjectId,
      agentId: "agent_1",
      ownerAddress,
      previousCredentialVersion: 1,
      nextCredentialVersion: 2,
      rotationHash: "sha256:rotation"
    });
    expect(proof.nonceBase64).toBe(Buffer.from(fixedNonce).toString("base64"));
    expect(Buffer.from(proof.signatureBase64, "base64")).toHaveLength(64);
  });
});
