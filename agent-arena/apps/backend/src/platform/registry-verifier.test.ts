import { describe, expect, it } from "bun:test";
import {
  createRegistryTransactionVerifier,
  type RegistryTransactionVerifierClient
} from "./registry-verifier";
import type {
  RegisterAgentRegistryProof,
  RuntimeCredentialRotationRegistryProof
} from "./registry";

const packageId = "0xpackage";
const registryObjectId = "0xregistry";
const ownerAddress = "0xowner";
const tradingWalletAddress = "0xwallet";

const registerProof: RegisterAgentRegistryProof = {
  kind: "register_agent",
  packageId,
  registryObjectId,
  agentId: "agent_1",
  ownerAddress,
  tradingWalletAddress,
  metadataHash: "sha256:metadata",
  nonceBase64: "bm9uY2U=",
  signatureBase64: "c2lnbmF0dXJl"
};

const rotationProof: RuntimeCredentialRotationRegistryProof = {
  kind: "record_runtime_credential_rotation",
  packageId,
  registryObjectId,
  agentId: "agent_1",
  ownerAddress,
  previousCredentialVersion: 1,
  nextCredentialVersion: 2,
  rotationHash: "sha256:rotation",
  nonceBase64: "bm9uY2U=",
  signatureBase64: "c2lnbmF0dXJl"
};

describe("Agent Arena registry transaction verifier", () => {
  it("verifies successful register transactions by sender, call target, and events", async () => {
    const requests: unknown[] = [];
    const verifier = createRegistryTransactionVerifier({
      client: createClient({
        "0xok": registerTx()
      }, requests)
    });

    await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xok", proof: registerProof })).resolves.toBeUndefined();
    expect(requests).toEqual([{
      digest: "0xok",
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true
      }
    }]);
  });

  it("rejects failed register transactions", async () => {
    const verifier = createRegistryTransactionVerifier({
      client: createClient({
        "0xfailed": registerTx({ effects: { status: { status: "failure", error: "abort" } } })
      })
    });

    await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xfailed", proof: registerProof }))
      .rejects.toThrow("REGISTRY_TX_FAILED");
  });

  it("rejects register transactions from a different sender", async () => {
    const verifier = createRegistryTransactionVerifier({
      client: createClient({
        "0xwrong-sender": registerTx({ sender: "0xother" })
      })
    });

    await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xwrong-sender", proof: registerProof }))
      .rejects.toThrow("REGISTRY_TX_SENDER_MISMATCH");
  });

  it("rejects register transactions without the registry register call target", async () => {
    const verifier = createRegistryTransactionVerifier({
      client: createClient({
        "0xwrong-target": registerTx({ functionName: "record_runtime_credential_rotation" })
      })
    });

    await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xwrong-target", proof: registerProof }))
      .rejects.toThrow("REGISTRY_TX_CALL_MISMATCH");
  });

  it("rejects register transactions without matching registry events", async () => {
    const verifier = createRegistryTransactionVerifier({
      client: createClient({
        "0xwrong-event": registerTx({
          events: [
            event("AgentRegistered", {
              agent_id: "agent_1",
              owner: ownerAddress,
              metadata_hash: "sha256:different"
            })
          ]
        })
      })
    });

    await expect(verifier.verifyRegisterAgentTx({ txDigest: "0xwrong-event", proof: registerProof }))
      .rejects.toThrow("REGISTRY_TX_EVENT_MISMATCH");
  });

  it("verifies successful runtime credential rotation transactions", async () => {
    const verifier = createRegistryTransactionVerifier({
      client: createClient({
        "0xrotation": rotationTx()
      })
    });

    await expect(verifier.verifyRuntimeCredentialRotationTx({
      txDigest: "0xrotation",
      proof: rotationProof
    })).resolves.toBeUndefined();
  });
});

function createClient(
  responses: Record<string, unknown>,
  requests: unknown[] = []
): RegistryTransactionVerifierClient {
  return {
    async getTransactionBlock(input) {
      requests.push(input);
      return responses[input.digest];
    }
  };
}

function registerTx(overrides: {
  effects?: unknown;
  sender?: string;
  functionName?: string;
  events?: unknown[];
} = {}) {
  return {
    effects: overrides.effects ?? { status: { status: "success" } },
    transaction: {
      data: {
        sender: overrides.sender ?? ownerAddress,
        transaction: {
          kind: "ProgrammableTransaction",
          transactions: [
            moveCall(overrides.functionName ?? "register_agent")
          ]
        }
      }
    },
    events: overrides.events ?? [
      event("AgentRegistered", {
        agent_id: "agent_1",
        owner: ownerAddress,
        metadata_hash: "sha256:metadata"
      }),
      event("TradingWalletBound", {
        agent_id: "agent_1",
        owner: ownerAddress,
        wallet: tradingWalletAddress
      })
    ]
  };
}

function rotationTx() {
  return {
    effects: { status: { status: "success" } },
    transaction: {
      data: {
        sender: ownerAddress,
        transaction: {
          kind: "ProgrammableTransaction",
          transactions: [
            moveCall("record_runtime_credential_rotation")
          ]
        }
      }
    },
    events: [
      event("RuntimeCredentialRotated", {
        agent_id: "agent_1",
        owner: ownerAddress,
        previous_version: 1,
        next_version: 2,
        rotation_hash: "sha256:rotation"
      })
    ]
  };
}

function moveCall(functionName: string) {
  return {
    MoveCall: {
      package: packageId,
      module: "registry",
      function: functionName
    }
  };
}

function event(typeName: string, parsedJson: Record<string, unknown>) {
  return {
    packageId,
    transactionModule: "registry",
    type: `${packageId}::registry::${typeName}`,
    parsedJson
  };
}
