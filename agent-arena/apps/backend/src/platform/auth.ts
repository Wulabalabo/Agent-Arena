import type { AgentProfile } from "./types";

export interface AgentRuntimeCredential {
  agentId: string;
  token: string;
  createdAt: string;
  credentialVersion: number;
  scopes: string[];
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export interface RuntimeCredentialRotationChallenge {
  agentId: string;
  ownerAddress: string;
  reason: string;
  domain: string;
  chainId: string;
  currentCredentialVersion: number;
  nextCredentialVersion: number;
  nonce: string;
  expiresAt: string;
  message: string;
  consumedAt?: string | null;
}

export interface RuntimeCredentialRotationInput {
  agentId: string;
  ownerAddress: string;
  nonce: string;
  reason: string;
  domain: string;
  chainId: string;
  currentCredentialVersion: number;
  now: string;
  revocationReason: string;
}

export interface RuntimeCredentialRotationResult {
  credential: AgentRuntimeCredential;
  previousCredential: AgentRuntimeCredential;
}

export interface AgentCredentialStore {
  getAgent(agentId: string): AgentProfile | undefined;
  saveRuntimeCredential(credential: AgentRuntimeCredential): void;
  findRuntimeCredentialByToken(token: string): AgentRuntimeCredential | undefined;
}

export interface AuthenticatedAgentRequest {
  agentId: string;
}

const runtimeTokenPrefix = "agent_runtime_";
export const runtimeCredentialScopes = Object.freeze([
  "agent:read",
  "agent:intent:write",
  "competition:read",
  "execution:read"
]);
export const runtimeTokenHeader = "x-agent-arena-agent-token";

export class PlatformAuthError extends Error {
  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "PlatformAuthError";
  }
}

export function createAgentRuntimeCredential(
  store: AgentCredentialStore,
  agentId: string,
  now: string
): AgentRuntimeCredential {
  if (!store.getAgent(agentId)) {
    throw new PlatformAuthError();
  }

  const credential: AgentRuntimeCredential = {
    agentId,
    token: createRuntimeCredentialToken(),
    createdAt: now,
    credentialVersion: 1,
    scopes: [...runtimeCredentialScopes],
    revokedAt: null,
    revocationReason: null
  };

  store.saveRuntimeCredential(credential);
  return credential;
}

export function authenticateAgentRuntimeRequest(
  request: Request,
  store: Pick<AgentCredentialStore, "findRuntimeCredentialByToken">
): AuthenticatedAgentRequest {
  const token = request.headers.get(runtimeTokenHeader);
  if (!token) {
    throw new PlatformAuthError();
  }

  const credential = store.findRuntimeCredentialByToken(token);
  if (!credential || credential.revokedAt) {
    throw new PlatformAuthError();
  }

  return { agentId: credential.agentId };
}

export function createRuntimeCredentialToken(): string {
  return `${runtimeTokenPrefix}${randomKeyPart()}${randomKeyPart()}`;
}

function randomKeyPart(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
