import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { createRegistryAuthorizationProof } from "./registry-submitter";

export type RegistryWriteStatus = "disabled" | "submitted" | "failed";

export interface RegistryWriteResult {
  status: RegistryWriteStatus;
  txDigest: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface RegistryConfig {
  enabled: boolean;
  network: string;
  packageId?: string | null;
  registryObjectId?: string | null;
  authorityPrivateKey?: string | null;
}

export interface RegisterAgentRegistryInput {
  agentId: string;
  agentDraftId: string;
  ownerAddress: string;
  tradingWalletAddress: string;
  metadataHash: string;
  platformCreatedAtMs: number;
}

export interface RuntimeCredentialRotationRegistryInput {
  agentId: string;
  ownerAddress: string;
  previousCredentialVersion: number;
  nextCredentialVersion: number;
  rotationHash: string;
  platformCreatedAtMs: number;
}

export interface RegisterAgentRegistryRequest extends RegisterAgentRegistryInput {
  kind: "register_agent";
  packageId: string;
  registryObjectId: string;
}

export interface RuntimeCredentialRotationRegistryRequest extends RuntimeCredentialRotationRegistryInput {
  kind: "record_runtime_credential_rotation";
  packageId: string;
  registryObjectId: string;
}

export type RegistryWriteRequest = RegisterAgentRegistryRequest | RuntimeCredentialRotationRegistryRequest;

export interface RegistryAuthorizationProof {
  kind: RegistryWriteRequest["kind"];
  packageId: string;
  registryObjectId: string;
  agentId: string;
  ownerAddress: string;
  nonceBase64: string;
  signatureBase64: string;
}

export interface RegisterAgentRegistryProof extends RegistryAuthorizationProof {
  kind: "register_agent";
  tradingWalletAddress: string;
  metadataHash: string;
}

export interface RuntimeCredentialRotationRegistryProof extends RegistryAuthorizationProof {
  kind: "record_runtime_credential_rotation";
  previousCredentialVersion: number;
  nextCredentialVersion: number;
  rotationHash: string;
}

export interface RegistrySubmitterResult {
  txDigest: string;
}

export type RegistrySubmitter = (request: RegistryWriteRequest) => Promise<RegistrySubmitterResult>;

export interface AgentRegistryService {
  registerAgent(input: RegisterAgentRegistryInput): Promise<RegistryWriteResult>;
  recordRuntimeCredentialRotation?(input: RuntimeCredentialRotationRegistryInput): Promise<RegistryWriteResult>;
  createRegisterAgentProof(input: RegisterAgentRegistryInput): Promise<RegisterAgentRegistryProof>;
  createRuntimeCredentialRotationProof(
    input: RuntimeCredentialRotationRegistryInput
  ): Promise<RuntimeCredentialRotationRegistryProof>;
}

export function createRegistryService(
  config: RegistryConfig,
  _submitter: RegistrySubmitter = unsupportedRegistrySubmitter
): AgentRegistryService {
  return {
    registerAgent: async () => legacyRegistryWriteResult(config),
    recordRuntimeCredentialRotation: async () => legacyRegistryWriteResult(config),
    createRegisterAgentProof: async (input) => createRegistryProof(config, createRegisterAgentRegistryRequest(input)),
    createRuntimeCredentialRotationProof: async (input) =>
      createRegistryProof(config, createRuntimeCredentialRotationRegistryRequest(input))
  };
}

export function createRegisterAgentRegistryRequest(
  input: RegisterAgentRegistryInput,
  config: Pick<RegistryConfig, "packageId" | "registryObjectId"> = {}
): RegisterAgentRegistryRequest {
  return {
    kind: "register_agent",
    packageId: requiredConfigValue(config.packageId, "packageId"),
    registryObjectId: requiredConfigValue(config.registryObjectId, "registryObjectId"),
    agentId: input.agentId,
    agentDraftId: input.agentDraftId,
    ownerAddress: input.ownerAddress,
    tradingWalletAddress: input.tradingWalletAddress,
    metadataHash: input.metadataHash,
    platformCreatedAtMs: input.platformCreatedAtMs
  };
}

export function createRuntimeCredentialRotationRegistryRequest(
  input: RuntimeCredentialRotationRegistryInput,
  config: Pick<RegistryConfig, "packageId" | "registryObjectId"> = {}
): RuntimeCredentialRotationRegistryRequest {
  return {
    kind: "record_runtime_credential_rotation",
    packageId: requiredConfigValue(config.packageId, "packageId"),
    registryObjectId: requiredConfigValue(config.registryObjectId, "registryObjectId"),
    agentId: input.agentId,
    ownerAddress: input.ownerAddress,
    previousCredentialVersion: input.previousCredentialVersion,
    nextCredentialVersion: input.nextCredentialVersion,
    rotationHash: input.rotationHash,
    platformCreatedAtMs: input.platformCreatedAtMs
  };
}

export function createRegistryConfigFromEnv(env: Record<string, string | undefined>): RegistryConfig {
  return {
    enabled: env.AGENT_ARENA_ENABLE_REGISTRY_SUBMIT?.trim().toLowerCase() === "true",
    network: env.AGENT_ARENA_NETWORK?.trim().toLowerCase() || "testnet",
    packageId: emptyToNull(env.AGENT_ARENA_REGISTRY_PACKAGE_ID),
    registryObjectId: emptyToNull(env.AGENT_ARENA_REGISTRY_OBJECT_ID),
    authorityPrivateKey: emptyToNull(env.AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY)
  };
}

async function legacyRegistryWriteResult(config: RegistryConfig): Promise<RegistryWriteResult> {
  if (!config.enabled) {
    return { status: "disabled", txDigest: null };
  }

  const incomplete = registryConfigError(config);
  if (incomplete) {
    return incomplete;
  }

  return { status: "disabled", txDigest: null };
}

async function createRegistryProof(
  config: RegistryConfig,
  request: RegisterAgentRegistryRequest
): Promise<RegisterAgentRegistryProof>;
async function createRegistryProof(
  config: RegistryConfig,
  request: RuntimeCredentialRotationRegistryRequest
): Promise<RuntimeCredentialRotationRegistryProof>;
async function createRegistryProof(
  config: RegistryConfig,
  request: RegistryWriteRequest
): Promise<RegisterAgentRegistryProof | RuntimeCredentialRotationRegistryProof> {
  assertRegistryProofConfig(config);
  const authoritySigner = Ed25519Keypair.fromSecretKey(config.authorityPrivateKey!);
  return await createRegistryAuthorizationProof({
    ...request,
    packageId: config.packageId!,
    registryObjectId: config.registryObjectId!
  }, authoritySigner);
}

function assertRegistryProofConfig(config: RegistryConfig): void {
  if (!config.enabled) {
    throw new Error("REGISTRY_DISABLED");
  }

  const error = registryConfigError(config);
  if (error) {
    throw new Error(error.errorCode);
  }
}

function registryConfigError(config: RegistryConfig): RegistryWriteResult | null {
  if (config.network !== "testnet") {
    return {
      status: "failed",
      txDigest: null,
      errorCode: "UNSUPPORTED_NETWORK",
      errorMessage: "Agent Arena registry writes are Testnet-only"
    };
  }

  if (!config.packageId || !config.registryObjectId || !config.authorityPrivateKey) {
    return {
      status: "failed",
      txDigest: null,
      errorCode: "REGISTRY_CONFIG_INCOMPLETE",
      errorMessage: "Registry package, registry object, and authority private key are required"
    };
  }

  return null;
}

function requiredConfigValue(value: string | null | undefined, field: string): string {
  return value?.trim() || `__${field}_configured_at_submit__`;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function unsupportedRegistrySubmitter(): Promise<RegistrySubmitterResult> {
  throw new Error("Registry submitter is not configured");
}
