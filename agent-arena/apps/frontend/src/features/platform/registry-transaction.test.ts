import { describe, expect, it } from "vitest";
import {
  buildRegistryTransaction,
  buildRuntimeCredentialRotationRegistryTransaction,
  readRegistryTransactionDigest
} from "./registry-transaction";
import type { RegisterAgentRegistryProof, RuntimeCredentialRotationRegistryProof } from "./types";

const rotationProof: RuntimeCredentialRotationRegistryProof = {
  kind: "record_runtime_credential_rotation",
  packageId: "0x0000000000000000000000000000000000000000000000000000000000000abc",
  registryObjectId: "0x0000000000000000000000000000000000000000000000000000000000000def",
  agentId: "agent_1",
  ownerAddress: "0x0000000000000000000000000000000000000000000000000000000000000bad",
  previousCredentialVersion: 1,
  nextCredentialVersion: 2,
  rotationHash: "sha256:rotation",
  nonceBase64: "bm9uY2U=",
  signatureBase64: "c2lnbmF0dXJl"
};

const registerProof: RegisterAgentRegistryProof = {
  kind: "register_agent",
  packageId: "0x0000000000000000000000000000000000000000000000000000000000000abc",
  registryObjectId: "0x0000000000000000000000000000000000000000000000000000000000000def",
  agentId: "agent_1",
  ownerAddress: "0x0000000000000000000000000000000000000000000000000000000000000bad",
  tradingWalletAddress: "0x0000000000000000000000000000000000000000000000000000000000000bee",
  metadataHash: "sha256:metadata",
  nonceBase64: "bm9uY2U=",
  signatureBase64: "c2lnbmF0dXJl"
};

describe("registry transaction helpers", () => {
  it("builds a register Agent registry transaction with register_agent argument order", () => {
    const transaction = buildRegistryTransaction(registerProof);
    const data = transaction.getData();
    const command = data.commands[0];

    expect(command?.MoveCall).toMatchObject({
      package: registerProof.packageId,
      module: "registry",
      function: "register_agent"
    });
    expect(command?.MoveCall?.arguments).toEqual([
      { Input: 0, type: "object", $kind: "Input" },
      { Input: 1, type: "pure", $kind: "Input" },
      { Input: 2, type: "pure", $kind: "Input" },
      { Input: 3, type: "pure", $kind: "Input" },
      { Input: 4, type: "pure", $kind: "Input" },
      { Input: 5, type: "pure", $kind: "Input" },
      { Input: 6, type: "pure", $kind: "Input" }
    ]);
    expect(data.inputs[0]).toMatchObject({
      UnresolvedObject: { objectId: registerProof.registryObjectId }
    });
    expect(readPureInputBase64(data.inputs[1])).toBe("B2FnZW50XzE=");
    expect(readPureInputBase64(data.inputs[4])).toBe("D3NoYTI1NjptZXRhZGF0YQ==");
    expect(readPureInputBase64(data.inputs[5])).toBe("BW5vbmNl");
    expect(readPureInputBase64(data.inputs[6])).toBe("CXNpZ25hdHVyZQ==");
  });

  it("builds a runtime credential rotation registry transaction", () => {
    const transaction = buildRuntimeCredentialRotationRegistryTransaction(rotationProof);
    const data = transaction.getData();
    const command = data.commands[0];

    expect(command?.MoveCall).toMatchObject({
      module: "registry",
      function: "record_runtime_credential_rotation"
    });
  });

  it("delegates rotation proofs through the generic registry transaction builder", () => {
    const transaction = buildRegistryTransaction(rotationProof);
    const command = transaction.getData().commands[0];

    expect(command?.MoveCall).toMatchObject({
      package: rotationProof.packageId,
      module: "registry",
      function: "record_runtime_credential_rotation"
    });
  });

  it("reads dAppKit transaction digests from known result shapes", () => {
    expect(readRegistryTransactionDigest({ Transaction: { digest: "0xdigest" } })).toBe("0xdigest");
    expect(readRegistryTransactionDigest({ digest: "0xdirect" })).toBe("0xdirect");
    expect(readRegistryTransactionDigest({ effects: { transactionDigest: "0xeffects" } })).toBe("0xeffects");
    expect(readRegistryTransactionDigest({ FailedTransaction: {} })).toBeNull();
  });
});

function readPureInputBase64(input: unknown): string | null {
  if (!isRecord(input) || !isRecord(input.Pure)) {
    return null;
  }

  return typeof input.Pure.bytes === "string" ? input.Pure.bytes : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
