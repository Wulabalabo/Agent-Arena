import type {
  RegisterAgentRegistryProof,
  RuntimeCredentialRotationRegistryProof
} from "./registry";

export interface RegistryTransactionVerifier {
  verifyRegisterAgentTx(input: {
    txDigest: string;
    proof: RegisterAgentRegistryProof;
  }): Promise<void>;
  verifyRuntimeCredentialRotationTx(input: {
    txDigest: string;
    proof: RuntimeCredentialRotationRegistryProof;
  }): Promise<void>;
}

export interface RegistryTransactionVerifierClient {
  getTransactionBlock(input: {
    digest: string;
    options: {
      showEffects: true;
      showEvents: true;
      showInput: true;
    };
  }): Promise<unknown>;
}

export function createRegistryTransactionVerifier(options: {
  client: RegistryTransactionVerifierClient;
}): RegistryTransactionVerifier {
  return {
    verifyRegisterAgentTx: async (input) => {
      const tx = await readRegistryTransaction(options.client, input.txDigest);
      assertSuccessfulTransaction(tx);
      assertSender(tx, input.proof.ownerAddress);
      assertMoveCall(tx, `${input.proof.packageId}::registry::register_agent`);
      assertEventMatches(tx, input.proof, "AgentRegistered", {
        agentId: input.proof.agentId,
        ownerAddress: input.proof.ownerAddress,
        metadataHash: input.proof.metadataHash
      });
      assertEventMatches(tx, input.proof, "TradingWalletBound", {
        agentId: input.proof.agentId,
        ownerAddress: input.proof.ownerAddress,
        tradingWalletAddress: input.proof.tradingWalletAddress
      });
    },
    verifyRuntimeCredentialRotationTx: async (input) => {
      const tx = await readRegistryTransaction(options.client, input.txDigest);
      assertSuccessfulTransaction(tx);
      assertSender(tx, input.proof.ownerAddress);
      assertMoveCall(tx, `${input.proof.packageId}::registry::record_runtime_credential_rotation`);
      assertEventMatches(tx, input.proof, "RuntimeCredentialRotated", {
        agentId: input.proof.agentId,
        ownerAddress: input.proof.ownerAddress,
        previousCredentialVersion: input.proof.previousCredentialVersion,
        nextCredentialVersion: input.proof.nextCredentialVersion,
        rotationHash: input.proof.rotationHash
      });
    }
  };
}

async function readRegistryTransaction(client: RegistryTransactionVerifierClient, txDigest: string): Promise<unknown> {
  return await client.getTransactionBlock({
    digest: txDigest,
    options: {
      showEffects: true,
      showEvents: true,
      showInput: true
    }
  });
}

function assertSuccessfulTransaction(tx: unknown): void {
  const status = recordValue(recordValue(recordValue(tx)?.effects)?.status)?.status;
  if (status !== "success") {
    throw new Error("REGISTRY_TX_FAILED");
  }
}

function assertSender(tx: unknown, expectedOwnerAddress: string): void {
  const sender = stringValue(recordValue(recordValue(recordValue(tx)?.transaction)?.data)?.sender);
  if (!addressesEqual(sender, expectedOwnerAddress)) {
    throw new Error("REGISTRY_TX_SENDER_MISMATCH");
  }
}

function assertMoveCall(tx: unknown, expectedTarget: string): void {
  if (!getMoveCallTargets(tx).some((target) => targetsEqual(target, expectedTarget))) {
    throw new Error("REGISTRY_TX_CALL_MISMATCH");
  }
}

function assertEventMatches(
  tx: unknown,
  proof: RegisterAgentRegistryProof | RuntimeCredentialRotationRegistryProof,
  eventName: string,
  expected: {
    agentId: string;
    ownerAddress: string;
    tradingWalletAddress?: string;
    metadataHash?: string;
    previousCredentialVersion?: number;
    nextCredentialVersion?: number;
    rotationHash?: string;
  }
): void {
  const event = getEvents(tx).find((candidate) => {
    if (!eventTypeMatches(candidate, proof.packageId, "registry", eventName)) {
      return false;
    }

    const parsedJson = recordValue(candidate.parsedJson);
    if (!parsedJson) {
      return false;
    }

    if (stringValueFromFields(parsedJson, ["agent_id", "agentId"]) !== expected.agentId) {
      return false;
    }
    if (!addressesEqual(stringValueFromFields(parsedJson, ["owner", "ownerAddress"]), expected.ownerAddress)) {
      return false;
    }
    if (
      expected.tradingWalletAddress !== undefined &&
      !addressesEqual(stringValueFromFields(parsedJson, ["wallet", "tradingWalletAddress"]), expected.tradingWalletAddress)
    ) {
      return false;
    }
    if (
      expected.metadataHash !== undefined &&
      stringValueFromFields(parsedJson, ["metadata_hash", "metadataHash"]) !== expected.metadataHash
    ) {
      return false;
    }
    if (
      expected.previousCredentialVersion !== undefined &&
      numberValueFromFields(parsedJson, ["previous_version", "previousCredentialVersion"]) !== expected.previousCredentialVersion
    ) {
      return false;
    }
    if (
      expected.nextCredentialVersion !== undefined &&
      numberValueFromFields(parsedJson, ["next_version", "nextCredentialVersion"]) !== expected.nextCredentialVersion
    ) {
      return false;
    }
    if (
      expected.rotationHash !== undefined &&
      stringValueFromFields(parsedJson, ["rotation_hash", "rotationHash"]) !== expected.rotationHash
    ) {
      return false;
    }

    return true;
  });

  if (!event) {
    throw new Error("REGISTRY_TX_EVENT_MISMATCH");
  }
}

function getMoveCallTargets(tx: unknown): string[] {
  const data = recordValue(recordValue(tx)?.transaction)?.data;
  const transaction = recordValue(recordValue(data)?.transaction);
  const commands = arrayValue(transaction?.transactions) ?? arrayValue(transaction?.commands) ?? [];
  return commands.flatMap((command) => {
    const moveCall = recordValue(recordValue(command)?.MoveCall);
    if (!moveCall) {
      return [];
    }

    const target = stringValue(moveCall.target);
    if (target) {
      return [target];
    }

    const packageId = stringValue(moveCall.package);
    const moduleName = stringValue(moveCall.module);
    const functionName = stringValue(moveCall.function);
    return packageId && moduleName && functionName ? [`${packageId}::${moduleName}::${functionName}`] : [];
  });
}

function getEvents(tx: unknown): Array<Record<string, unknown>> {
  return (arrayValue(recordValue(tx)?.events) ?? []).flatMap((event) => {
    const record = recordValue(event);
    return record ? [record] : [];
  });
}

function eventTypeMatches(
  event: Record<string, unknown>,
  packageId: string,
  moduleName: string,
  eventName: string
): boolean {
  const eventPackage = stringValue(event.packageId);
  const eventModule = stringValue(event.transactionModule);
  const type = stringValue(event.type)?.split("<", 1)[0];
  const expectedType = `${packageId}::${moduleName}::${eventName}`;
  return addressesEqual(eventPackage, packageId) &&
    eventModule === moduleName &&
    targetsEqual(type, expectedType);
}

function stringValueFromFields(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = stringValue(record[field]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function numberValueFromFields(record: Record<string, unknown>, fields: string[]): number | null {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      return Number(value);
    }
  }

  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return new TextDecoder().decode(new Uint8Array(value));
  }

  return null;
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function addressesEqual(left: string | null, right: string): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}

function targetsEqual(left: string | null | undefined, right: string): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}
