import { describe, expect, it } from "vitest";
import {
  buildRuntimeCredentialRotationRegistryTransaction,
  readRegistryTransactionDigest
} from "./registry-transaction";
import type { RuntimeCredentialRotationRegistryProof } from "./types";

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

describe("registry transaction helpers", () => {
  it("builds a runtime credential rotation registry transaction", () => {
    const transaction = buildRuntimeCredentialRotationRegistryTransaction(rotationProof);
    const data = transaction.getData();
    const command = data.commands[0];

    expect(command?.MoveCall).toMatchObject({
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
