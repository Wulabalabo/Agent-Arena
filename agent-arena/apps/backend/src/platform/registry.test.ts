import { describe, expect, it } from "bun:test";
import {
  createRegisterAgentRegistryRequest,
  createRegistryService
} from "./registry";

const registerInput = {
  agentId: "agent_1",
  agentDraftId: "draft_1",
  ownerAddress: "0xowner",
  tradingWalletAddress: "0xwallet",
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

  it("creates register requests without registration-code-derived material", () => {
    const request = createRegisterAgentRegistryRequest({
      ...registerInput,
      registrationCode: "PAIR-2049",
      registrationCodeHash: "sha256:registration-code"
    } as typeof registerInput & { registrationCode: string; registrationCodeHash: string });

    expect(request).toMatchObject({
      kind: "register_agent",
      agentId: "agent_1",
      ownerAddress: "0xowner",
      tradingWalletAddress: "0xwallet",
      metadataHash: "sha256:metadata"
    });
    expect(JSON.stringify(request)).not.toContain("PAIR-2049");
    expect(JSON.stringify(request)).not.toContain("registration-code");
  });

  it("returns submitted and txDigest from a mock Testnet submitter", async () => {
    const submitterCalls: unknown[] = [];
    const service = createRegistryService({
      enabled: true,
      network: "testnet",
      packageId: "0xpackage",
      registryObjectId: "0xregistry",
      authorityPrivateKey: "configured"
    }, async (request) => {
      submitterCalls.push(request);
      return { txDigest: "0xregistrydigest" };
    });

    await expect(service.registerAgent(registerInput)).resolves.toEqual({
      status: "submitted",
      txDigest: "0xregistrydigest"
    });
    expect(submitterCalls).toHaveLength(1);
    expect(submitterCalls[0]).toMatchObject({
      kind: "register_agent",
      packageId: "0xpackage",
      registryObjectId: "0xregistry"
    });
    expect(JSON.stringify(submitterCalls[0])).not.toContain("adminCap");
  });
});
