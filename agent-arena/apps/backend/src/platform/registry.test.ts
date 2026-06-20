import { describe, expect, it } from "bun:test";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  createRegisterAgentRegistryRequest,
  createRegistryService
} from "./registry";

const TEST_AUTHORITY_PRIVATE_KEY = Ed25519Keypair.generate().getSecretKey();
const packageId = "0x0000000000000000000000000000000000000000000000000000000000000abc";
const registryObjectId = "0x0000000000000000000000000000000000000000000000000000000000000def";
const ownerAddress = "0x0000000000000000000000000000000000000000000000000000000000000bad";
const tradingWalletAddress = "0x0000000000000000000000000000000000000000000000000000000000000bee";

const registerInput = {
  agentId: "agent_1",
  agentDraftId: "draft_1",
  ownerAddress,
  tradingWalletAddress,
  metadataHash: "sha256:metadata",
  platformCreatedAtMs: 1781715000000
};

describe("Agent Arena registry adapter", () => {
  it("returns disabled when registry submit is not enabled", async () => {
    const service = createRegistryService({
      enabled: false,
      network: "testnet"
    });

    await expect(service.registerAgent(registerInput)).resolves.toEqual({
      status: "disabled",
      txDigest: null
    });
  });

  it("fails closed when submit is enabled outside Testnet", async () => {
    const submitterCalls: unknown[] = [];
    const service = createRegistryService({
      enabled: true,
      network: "mainnet",
      packageId: "0xpackage",
      registryObjectId: "0xregistry",
      authorityPrivateKey: "configured"
    }, async (request) => {
      submitterCalls.push(request);
      return { txDigest: "0xregistrydigest" };
    });

    await expect(service.registerAgent(registerInput)).resolves.toMatchObject({
      status: "failed",
      txDigest: null,
      errorCode: "UNSUPPORTED_NETWORK"
    });
    expect(submitterCalls).toEqual([]);
  });

  it("fails closed when the registry authority key is missing", async () => {
    const submitterCalls: unknown[] = [];
    const service = createRegistryService({
      enabled: true,
      network: "testnet",
      packageId: "0xpackage",
      registryObjectId: "0xregistry"
    }, async (request) => {
      submitterCalls.push(request);
      return { txDigest: "0xregistrydigest" };
    });

    await expect(service.registerAgent(registerInput)).resolves.toMatchObject({
      status: "failed",
      txDigest: null,
      errorCode: "REGISTRY_CONFIG_INCOMPLETE"
    });
    expect(submitterCalls).toEqual([]);
  });

  it("issues a register proof without submitting a backend transaction", async () => {
    const service = createRegistryService({
      enabled: true,
      network: "testnet",
      packageId,
      registryObjectId,
      authorityPrivateKey: TEST_AUTHORITY_PRIVATE_KEY
    });

    const proof = await service.createRegisterAgentProof(registerInput);

    expect(proof).toMatchObject({
      kind: "register_agent",
      packageId,
      registryObjectId,
      agentId: "agent_1",
      ownerAddress,
      tradingWalletAddress,
      metadataHash: "sha256:metadata"
    });
    expect(proof.nonceBase64).toEqual(expect.any(String));
    expect(proof.signatureBase64).toEqual(expect.any(String));
    expect(JSON.stringify(proof)).not.toContain(TEST_AUTHORITY_PRIVATE_KEY);
  });

  it("fails closed when proof issuance is enabled without authority key", async () => {
    const service = createRegistryService({
      enabled: true,
      network: "testnet",
      packageId,
      registryObjectId
    });

    await expect(service.createRegisterAgentProof(registerInput)).rejects.toThrow("REGISTRY_CONFIG_INCOMPLETE");
  });

  it("creates register requests without registration-code-derived material", () => {
    const request = createRegisterAgentRegistryRequest({
      ...registerInput,
      registrationCode: "PAIR-2049",
      registrationCodeHash: "sha256:registration-code"
    } as typeof registerInput & { registrationCode: string; registrationCodeHash: string });

    expect(request).toMatchObject({
      kind: "register_agent",
      agentId: "agent_1",
      ownerAddress,
      tradingWalletAddress,
      metadataHash: "sha256:metadata"
    });
    expect(JSON.stringify(request)).not.toContain("PAIR-2049");
    expect(JSON.stringify(request)).not.toContain("registration-code");
  });

  it("keeps the legacy register path disabled instead of submitting backend transactions", async () => {
    const submitterCalls: unknown[] = [];
    const service = createRegistryService({
      enabled: true,
      network: "testnet",
      packageId,
      registryObjectId,
      authorityPrivateKey: TEST_AUTHORITY_PRIVATE_KEY
    }, async (request) => {
      submitterCalls.push(request);
      return { txDigest: "0xregistrydigest" };
    });

    await expect(service.registerAgent(registerInput)).resolves.toEqual({
      status: "disabled",
      txDigest: null
    });
    expect(submitterCalls).toEqual([]);
  });
});
