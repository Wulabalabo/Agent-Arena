import { Transaction } from "@mysten/sui/transactions";
import type {
  RegisterAgentRegistryProof,
  RegistryAuthorizationProof,
  RuntimeCredentialRotationRegistryProof
} from "./types";

export function buildRegistryTransaction(proof: RegistryAuthorizationProof): Transaction {
  if (proof.kind === "register_agent") {
    return buildRegisterAgentRegistryTransaction(proof);
  }

  return buildRuntimeCredentialRotationRegistryTransaction(proof);
}

export function buildRegisterAgentRegistryTransaction(
  proof: RegisterAgentRegistryProof
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${proof.packageId}::registry::register_agent`,
    arguments: [
      tx.object(proof.registryObjectId),
      tx.pure.vector("u8", utf8Bytes(proof.agentId)),
      tx.pure.address(proof.ownerAddress),
      tx.pure.address(proof.tradingWalletAddress),
      tx.pure.vector("u8", utf8Bytes(proof.metadataHash)),
      tx.pure.vector("u8", base64Bytes(proof.nonceBase64)),
      tx.pure.vector("u8", base64Bytes(proof.signatureBase64))
    ]
  });
  return tx;
}

export function buildRuntimeCredentialRotationRegistryTransaction(
  proof: RuntimeCredentialRotationRegistryProof
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${proof.packageId}::registry::record_runtime_credential_rotation`,
    arguments: [
      tx.object(proof.registryObjectId),
      tx.pure.vector("u8", utf8Bytes(proof.agentId)),
      tx.pure.address(proof.ownerAddress),
      tx.pure.u64(proof.previousCredentialVersion),
      tx.pure.u64(proof.nextCredentialVersion),
      tx.pure.vector("u8", utf8Bytes(proof.rotationHash)),
      tx.pure.vector("u8", base64Bytes(proof.nonceBase64)),
      tx.pure.vector("u8", base64Bytes(proof.signatureBase64))
    ]
  });
  return tx;
}

export function readRegistryTransactionDigest(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }

  if (!isRecord(result)) {
    return null;
  }

  const directDigest = stringField(result, "digest") ?? stringField(result, "txDigest");
  if (directDigest) {
    return directDigest;
  }

  const transaction = isRecord(result.Transaction) ? result.Transaction : null;
  const transactionDigest = transaction ? stringField(transaction, "digest") : null;
  if (transactionDigest) {
    return transactionDigest;
  }

  const effects = isRecord(result.effects) ? result.effects : null;
  return effects ? stringField(effects, "transactionDigest") : null;
}

function utf8Bytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function base64Bytes(value: string): number[] {
  const binary = atob(value);
  return Array.from(binary, (char) => char.charCodeAt(0));
}

function stringField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
