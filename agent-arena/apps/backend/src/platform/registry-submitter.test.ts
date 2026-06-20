import { describe, expect, it } from "bun:test";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  buildRegistryWriteTransaction,
  createSuiRegistrySubmitter,
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

describe("Agent Arena Sui registry submitter", () => {
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

  it("builds a signature-authorized register call for deployed registry writes", async () => {
    const signer = Ed25519Keypair.generate();
    const tx = await buildRegistryWriteTransaction(registerRequest, signer, fixedNonce);
    const data = tx.getData() as { commands: Array<Record<string, any>>; inputs: Array<Record<string, any>> };

    expect(data.commands).toHaveLength(1);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: packageId,
      module: "registry",
      function: "register_agent",
      typeArguments: []
    });
    expect(JSON.stringify(data.inputs)).toContain(registryObjectId);
    expect(JSON.stringify(data.inputs)).not.toContain("0x0000000000000000000000000000000000000000000000000000000000000ace");
    expect(data.inputs).toHaveLength(7);
  });

  it("submits runtime credential rotations and returns the transaction digest", async () => {
    const signer = Ed25519Keypair.generate();
    const submitted: unknown[] = [];
    const submitter = createSuiRegistrySubmitter({
      getSigner: async () => signer,
      createNonce: () => fixedNonce,
      client: {
        async signAndExecuteTransaction(input: unknown) {
          submitted.push(input);
          return {
            digest: "0xregistrydigest",
            effects: { status: { status: "success" } }
          };
        }
      }
    });

    const result = await submitter({
      kind: "record_runtime_credential_rotation",
      packageId,
      registryObjectId,
      agentId: "agent_1",
      ownerAddress,
      previousCredentialVersion: 1,
      nextCredentialVersion: 2,
      rotationHash: "sha256:rotation",
      platformCreatedAtMs: 1781715000000
    });

    expect(result).toEqual({ txDigest: "0xregistrydigest" });
    expect(submitted).toHaveLength(1);
    const transaction = (submitted[0] as { transaction: { getData: () => { commands: Array<Record<string, any>> } } }).transaction;
    expect(transaction.getData().commands[0]!.MoveCall).toMatchObject({
      package: packageId,
      module: "registry",
      function: "record_runtime_credential_rotation",
      typeArguments: []
    });
  });
});
