import type { AgentProfile } from "./types";

export interface AgentRuntimeCredential {
  agentId: string;
  token: string;
  createdAt: string;
  scopes: string[];
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
    token: `${runtimeTokenPrefix}${randomKeyPart()}${randomKeyPart()}`,
    createdAt: now,
    scopes: ["agent:read", "agent:intent:write", "competition:read", "execution:read"]
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
  if (!credential) {
    throw new PlatformAuthError();
  }

  return { agentId: credential.agentId };
}

function randomKeyPart(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
