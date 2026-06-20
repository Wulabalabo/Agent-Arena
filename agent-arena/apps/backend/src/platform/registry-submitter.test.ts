import { describe, expect, it } from "bun:test";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  buildRegistryWriteTransaction,
  createSuiRegistrySubmitter
} from "./registry-submitter";
import type { RegistryWriteRequest } from "./registry";

const packageId = "0x03aa029e3754556b242bcf3e8411e5e84ecfc2a29ac3e99c207ffbca1bf63825";
const registryObjectId = "0x300380af141c34a730dbb7b1ec2476d0afe5dd2e459a694fc0bf6e2dac9685ff";
const adminCapId = "0x0000000000000000000000000000000000000000000000000000000000000ace";
const ownerAddress = "0x0000000000000000000000000000000000000000000000000000000000000bad";
const tradingWalletAddress = "0x0000000000000000000000000000000000000000000000000000000000000bee";

const registerRequest: RegistryWriteRequest = {
  kind: "register_agent",
  packageId,
  registryObjectId,
  adminCapId,
  agentId: "agent_1",
  agentDraftId: "draft_1",
  ownerAddress,
  tradingWalletAddress,
  metadataHash: "sha256:metadata",
  platformCreatedAtMs: 1781715000000
};

describe("Agent Arena Sui registry submitter", () => {
  it("builds register and wallet binding calls for deployed registry writes", () => {
    const tx = buildRegistryWriteTransaction(registerRequest);
    const data = tx.getData() as { commands: Array<Record<string, any>>; inputs: Array<Record<string, any>> };

    expect(data.commands).toHaveLength(2);
    expect(data.commands[0]!.MoveCall).toMatchObject({
      package: packageId,
      module: "registry",
      function: "register_agent",
      typeArguments: []
    });
    expect(data.commands[1]!.MoveCall).toMatchObject({
      package: packageId,
      module: "registry",
      function: "bind_trading_wallet",
      typeArguments: []
    });
    expect(JSON.stringify(data.inputs)).toContain(registryObjectId);
    expect(JSON.stringify(data.inputs)).toContain(adminCapId);
    expect(data.inputs).toHaveLength(8);
  });

  it("submits runtime credential rotations and returns the transaction digest", async () => {
    const signer = Ed25519Keypair.generate();
    const submitted: unknown[] = [];
    const submitter = createSuiRegistrySubmitter({
      getSigner: async () => signer,
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
      adminCapId,
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
