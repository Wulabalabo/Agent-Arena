import { keccak_256 } from "@noble/hashes/sha3.js";
import { bcs } from "@mysten/sui/bcs";
import { SuiJsonRpcClient, type SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type {
  RegistrySubmitter,
  RegistrySubmitterResult,
  RegistryWriteRequest
} from "./registry";

export interface CreateSuiRegistrySubmitterOptions {
  client?: Pick<SuiJsonRpcClient, "signAndExecuteTransaction">;
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
  const client = options.client ?? new SuiJsonRpcClient({
    network: "testnet",
    url: options.suiRpcUrl ?? "https://fullnode.testnet.sui.io:443"
  });

  return async (request): Promise<RegistrySubmitterResult> => {
    const signer = await options.getSigner(request);
    const transaction = await buildRegistryWriteTransaction(request, signer, options.createNonce?.());
    transaction.setSenderIfNotSet(signer.toSuiAddress());
    const response = await client.signAndExecuteTransaction({
      transaction,
      signer,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    });
    assertSubmitted(response);

    return { txDigest: response.digest };
  };
}

export async function buildRegistryWriteTransaction(
  request: RegistryWriteRequest,
  authoritySigner: Ed25519Keypair,
  nonce = createRegistryAuthorizationNonce()
): Promise<Transaction> {
  const tx = new Transaction();
  const authorization = await signRegistryAuthorization(request, authoritySigner, nonce);
  if (request.kind === "register_agent") {
    tx.moveCall({
      target: `${request.packageId}::registry::register_agent`,
      arguments: [
        tx.object(request.registryObjectId),
        tx.pure.vector("u8", utf8Bytes(request.agentId)),
        tx.pure.address(request.ownerAddress),
        tx.pure.address(request.tradingWalletAddress),
        tx.pure.vector("u8", utf8Bytes(request.metadataHash)),
        tx.pure.vector("u8", bytesToVector(authorization.nonce)),
        tx.pure.vector("u8", bytesToVector(authorization.signature))
      ]
    });

    return tx;
  }

  tx.moveCall({
    target: `${request.packageId}::registry::record_runtime_credential_rotation`,
    arguments: [
      tx.object(request.registryObjectId),
      tx.pure.vector("u8", utf8Bytes(request.agentId)),
      tx.pure.address(request.ownerAddress),
      tx.pure.u64(request.previousCredentialVersion),
      tx.pure.u64(request.nextCredentialVersion),
      tx.pure.vector("u8", utf8Bytes(request.rotationHash)),
      tx.pure.vector("u8", bytesToVector(authorization.nonce)),
      tx.pure.vector("u8", bytesToVector(authorization.signature))
    ]
  });

  return tx;
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

function assertSubmitted(response: SuiTransactionBlockResponse): void {
  const status = response.effects?.status;
  if (status?.status !== "success") {
    throw new Error(status?.error ?? "Registry transaction failed");
  }
}

function utf8Bytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function bytesToVector(value: Uint8Array): number[] {
  return Array.from(value);
}
