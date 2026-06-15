import type { AgentProfile } from "./types";

export interface AgentCredential {
  agentId: string;
  apiKey: string;
  createdAt: string;
}

export interface AgentCredentialStore {
  getAgent(agentId: string): AgentProfile | undefined;
  saveCredential(credential: AgentCredential): void;
  findCredentialByApiKey(apiKey: string): AgentCredential | undefined;
}

export interface AuthenticatedAgentRequest {
  agentId: string;
}

const apiKeyPrefix = "agent_arena_sk_";
const apiKeyHeader = "x-agent-arena-api-key";

export class PlatformAuthError extends Error {
  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "PlatformAuthError";
  }
}

export function createAgentCredential(store: AgentCredentialStore, agentId: string, now: string): AgentCredential {
  if (!store.getAgent(agentId)) {
    throw new PlatformAuthError();
  }

  const apiKey = `${apiKeyPrefix}${randomKeyPart()}${randomKeyPart()}`;
  const credential: AgentCredential = {
    agentId,
    apiKey,
    createdAt: now
  };

  store.saveCredential(credential);
  return credential;
}

export function authenticateAgentRequest(
  request: Request,
  store: Pick<AgentCredentialStore, "findCredentialByApiKey">
): AuthenticatedAgentRequest {
  const apiKey = request.headers.get(apiKeyHeader);
  if (!apiKey) {
    throw new PlatformAuthError();
  }

  const credential = store.findCredentialByApiKey(apiKey);
  if (!credential) {
    throw new PlatformAuthError();
  }

  return { agentId: credential.agentId };
}

function randomKeyPart(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
