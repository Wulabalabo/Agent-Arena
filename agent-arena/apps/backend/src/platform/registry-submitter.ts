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
  suiRpcUrl?: string;
}

export function createSuiRegistrySubmitter(options: CreateSuiRegistrySubmitterOptions): RegistrySubmitter {
  const client = options.client ?? new SuiJsonRpcClient({
    network: "testnet",
    url: options.suiRpcUrl ?? "https://fullnode.testnet.sui.io:443"
  });

  return async (request): Promise<RegistrySubmitterResult> => {
    const signer = await options.getSigner(request);
    const transaction = buildRegistryWriteTransaction(request);
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

export function buildRegistryWriteTransaction(request: RegistryWriteRequest): Transaction {
  const tx = new Transaction();
  if (request.kind === "register_agent") {
    tx.moveCall({
      target: `${request.packageId}::registry::register_agent`,
      arguments: [
        tx.object(request.adminCapId),
        tx.object(request.registryObjectId),
        tx.pure.vector("u8", utf8Bytes(request.agentId)),
        tx.pure.address(request.ownerAddress),
        tx.pure.vector("u8", utf8Bytes(request.metadataHash))
      ]
    });
    tx.moveCall({
      target: `${request.packageId}::registry::bind_trading_wallet`,
      arguments: [
        tx.object(request.adminCapId),
        tx.object(request.registryObjectId),
        tx.pure.vector("u8", utf8Bytes(request.agentId)),
        tx.pure.address(request.ownerAddress),
        tx.pure.address(request.tradingWalletAddress)
      ]
    });

    return tx;
  }

  tx.moveCall({
    target: `${request.packageId}::registry::record_runtime_credential_rotation`,
    arguments: [
      tx.object(request.adminCapId),
      tx.object(request.registryObjectId),
      tx.pure.vector("u8", utf8Bytes(request.agentId)),
      tx.pure.address(request.ownerAddress),
      tx.pure.u64(request.previousCredentialVersion),
      tx.pure.u64(request.nextCredentialVersion),
      tx.pure.vector("u8", utf8Bytes(request.rotationHash))
    ]
  });

  return tx;
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
