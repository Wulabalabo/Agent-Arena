import { keccak_256 } from "@noble/hashes/sha3.js";
import { bcs } from "@mysten/sui/bcs";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type {
  RegisterAgentRegistryProof,
  RegisterAgentRegistryRequest,
  RegistrySubmitter,
  RegistryWriteRequest,
  RuntimeCredentialRotationRegistryProof,
  RuntimeCredentialRotationRegistryRequest
} from "./registry";

export interface CreateSuiRegistrySubmitterOptions {
  getSigner: (request: RegistryWriteRequest) => Promise<Ed25519Keypair>;
  createNonce?: () => Uint8Array;
  suiRpcUrl?: string;
}

const registerAgentAuthorization = bcs.struct("RegisterAgentAuthorization", {
  domain: bcs.vector(bcs.u8()),
  registry: bcs.Address,
  agent_id: bcs.vector(bcs.u8()),
  owner: bcs.Address,
  wallet: bcs.Address,
  metadata_hash: bcs.vector(bcs.u8()),
  nonce: bcs.vector(bcs.u8())
});

const runtimeCredentialRotationAuthorization = bcs.struct("RuntimeCredentialRotationAuthorization", {
  domain: bcs.vector(bcs.u8()),
  registry: bcs.Address,
  agent_id: bcs.vector(bcs.u8()),
  owner: bcs.Address,
  previous_version: bcs.u64(),
  next_version: bcs.u64(),
  rotation_hash: bcs.vector(bcs.u8()),
  nonce: bcs.vector(bcs.u8())
});

export function createSuiRegistrySubmitter(options: CreateSuiRegistrySubmitterOptions): RegistrySubmitter {
  return async (request) => {
    const signer = await options.getSigner(request);
    await createRegistryAuthorizationProof(request, signer, options.createNonce?.());
    throw new Error("REGISTRY_BACKEND_TX_SUBMISSION_DISABLED");
  };
}

export async function createRegistryAuthorizationProof(
  request: RegisterAgentRegistryRequest,
  authoritySigner: Ed25519Keypair,
  nonce = createRegistryAuthorizationNonce()
): Promise<RegisterAgentRegistryProof>;
export async function createRegistryAuthorizationProof(
  request: RuntimeCredentialRotationRegistryRequest,
  authoritySigner: Ed25519Keypair,
  nonce?: Uint8Array
): Promise<RuntimeCredentialRotationRegistryProof>;
export async function createRegistryAuthorizationProof(
  request: RegistryWriteRequest,
  authoritySigner: Ed25519Keypair,
  nonce?: Uint8Array
): Promise<RegisterAgentRegistryProof | RuntimeCredentialRotationRegistryProof>;
export async function createRegistryAuthorizationProof(
  request: RegistryWriteRequest,
  authoritySigner: Ed25519Keypair,
  nonce = createRegistryAuthorizationNonce()
): Promise<RegisterAgentRegistryProof | RuntimeCredentialRotationRegistryProof> {
  const authorization = await signRegistryAuthorization(request, authoritySigner, nonce);
  const base = {
    kind: request.kind,
    packageId: request.packageId,
    registryObjectId: request.registryObjectId,
    agentId: request.agentId,
    ownerAddress: request.ownerAddress,
    nonceBase64: Buffer.from(authorization.nonce).toString("base64"),
    signatureBase64: Buffer.from(authorization.signature).toString("base64")
  };

  if (request.kind === "register_agent") {
    return {
      ...base,
      kind: "register_agent",
      tradingWalletAddress: request.tradingWalletAddress,
      metadataHash: request.metadataHash
    };
  }

  return {
    ...base,
    kind: "record_runtime_credential_rotation",
    previousCredentialVersion: request.previousCredentialVersion,
    nextCredentialVersion: request.nextCredentialVersion,
    rotationHash: request.rotationHash
  };
}

export const REGISTRY_AUTHORIZATION_DOMAIN = "agent-arena-registry:v1:testnet";

export function createRegistryAuthorizationNonce(): Uint8Array {
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  return nonce;
}

export async function signRegistryAuthorization(
  request: RegistryWriteRequest,
  authoritySigner: Ed25519Keypair,
  nonce: Uint8Array
): Promise<{ nonce: Uint8Array; signature: Uint8Array; hash: Uint8Array }> {
  const hash = hashRegistryAuthorization(request, nonce);
  const signature = await authoritySigner.sign(hash);
  return { nonce, signature, hash };
}

export function hashRegistryAuthorization(request: RegistryWriteRequest, nonce: Uint8Array): Uint8Array {
  return keccak_256(serializeRegistryAuthorization(request, nonce));
}

export function serializeRegistryAuthorization(request: RegistryWriteRequest, nonce: Uint8Array): Uint8Array {
  if (request.kind === "register_agent") {
    return registerAgentAuthorization.serialize({
      domain: utf8Bytes(REGISTRY_AUTHORIZATION_DOMAIN),
      registry: request.registryObjectId,
      agent_id: utf8Bytes(request.agentId),
      owner: request.ownerAddress,
      wallet: request.tradingWalletAddress,
      metadata_hash: utf8Bytes(request.metadataHash),
      nonce: bytesToVector(nonce)
    }).toBytes();
  }

  return runtimeCredentialRotationAuthorization.serialize({
    domain: utf8Bytes(REGISTRY_AUTHORIZATION_DOMAIN),
    registry: request.registryObjectId,
    agent_id: utf8Bytes(request.agentId),
    owner: request.ownerAddress,
    previous_version: request.previousCredentialVersion,
    next_version: request.nextCredentialVersion,
    rotation_hash: utf8Bytes(request.rotationHash),
    nonce: bytesToVector(nonce)
  }).toBytes();
}

function utf8Bytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function bytesToVector(value: Uint8Array): number[] {
  return Array.from(value);
}
