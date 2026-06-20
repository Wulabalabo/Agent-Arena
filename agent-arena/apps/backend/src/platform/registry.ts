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
  adminCapId?: string | null;
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
  adminCapId: string;
}

export interface RuntimeCredentialRotationRegistryRequest extends RuntimeCredentialRotationRegistryInput {
  kind: "record_runtime_credential_rotation";
  packageId: string;
  registryObjectId: string;
  adminCapId: string;
}

export type RegistryWriteRequest = RegisterAgentRegistryRequest | RuntimeCredentialRotationRegistryRequest;

export interface RegistrySubmitterResult {
  txDigest: string;
}

export type RegistrySubmitter = (request: RegistryWriteRequest) => Promise<RegistrySubmitterResult>;

export interface AgentRegistryService {
  registerAgent(input: RegisterAgentRegistryInput): Promise<RegistryWriteResult>;
  recordRuntimeCredentialRotation?(input: RuntimeCredentialRotationRegistryInput): Promise<RegistryWriteResult>;
}

export function createRegistryService(
  config: RegistryConfig,
  submitter: RegistrySubmitter = unsupportedRegistrySubmitter
): AgentRegistryService {
  return {
    registerAgent: async (input) => submitRegistryWrite(config, createRegisterAgentRegistryRequest(input), submitter),
    recordRuntimeCredentialRotation: async (input) =>
      submitRegistryWrite(config, createRuntimeCredentialRotationRegistryRequest(input), submitter)
  };
}

export function createRegisterAgentRegistryRequest(
  input: RegisterAgentRegistryInput,
  config: Pick<RegistryConfig, "packageId" | "registryObjectId" | "adminCapId"> = {}
): RegisterAgentRegistryRequest {
  return {
    kind: "register_agent",
    packageId: requiredConfigValue(config.packageId, "packageId"),
    registryObjectId: requiredConfigValue(config.registryObjectId, "registryObjectId"),
    adminCapId: requiredConfigValue(config.adminCapId, "adminCapId"),
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
  config: Pick<RegistryConfig, "packageId" | "registryObjectId" | "adminCapId"> = {}
): RuntimeCredentialRotationRegistryRequest {
  return {
    kind: "record_runtime_credential_rotation",
    packageId: requiredConfigValue(config.packageId, "packageId"),
    registryObjectId: requiredConfigValue(config.registryObjectId, "registryObjectId"),
    adminCapId: requiredConfigValue(config.adminCapId, "adminCapId"),
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
    adminCapId: emptyToNull(env.AGENT_ARENA_REGISTRY_ADMIN_CAP_ID)
  };
}

async function submitRegistryWrite(
  config: RegistryConfig,
  request: RegistryWriteRequest,
  submitter: RegistrySubmitter
): Promise<RegistryWriteResult> {
  if (!config.enabled) {
    return { status: "disabled", txDigest: null };
  }

  if (config.network !== "testnet") {
    return {
      status: "failed",
      txDigest: null,
      errorCode: "UNSUPPORTED_NETWORK",
      errorMessage: "Agent Arena registry writes are Testnet-only"
    };
  }

  if (!config.packageId || !config.registryObjectId || !config.adminCapId) {
    return {
      status: "failed",
      txDigest: null,
      errorCode: "REGISTRY_CONFIG_INCOMPLETE",
      errorMessage: "Registry package, registry object, and admin cap ids are required"
    };
  }

  try {
    const result = await submitter({
      ...request,
      packageId: config.packageId,
      registryObjectId: config.registryObjectId,
      adminCapId: config.adminCapId
    });
    return {
      status: "submitted",
      txDigest: result.txDigest
    };
  } catch (error) {
    return {
      status: "failed",
      txDigest: null,
      errorCode: "REGISTRY_SUBMIT_FAILED",
      errorMessage: error instanceof Error ? error.message : "Registry submit failed"
    };
  }
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
