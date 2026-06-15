import type { AgentCredential } from "./auth";
import type { AgentProfile } from "./types";
import { normalizeTwitterHandle } from "./validation";

export interface CreateAgentInput {
  name: string;
  twitterHandle?: string | null;
}

export class PlatformMockStore {
  private readonly agents = new Map<string, AgentProfile>();
  private readonly credentialsByApiKey = new Map<string, AgentCredential>();
  private nextAgentNumber = 1;

  createAgent(input: CreateAgentInput): AgentProfile {
    const id = `agent_${this.nextAgentNumber}`;
    this.nextAgentNumber += 1;

    const name = input.name.trim();
    const twitter = normalizeTwitterHandle(input.twitterHandle);
    const agent: AgentProfile = {
      id,
      name,
      normalizedName: name.toLowerCase(),
      twitterHandle: twitter.twitterHandle,
      normalizedTwitterHandle: twitter.normalizedTwitterHandle,
      tradingWalletId: null,
      createdAt: "2026-06-15T00:00:00.000Z"
    };

    this.agents.set(agent.id, cloneAgent(agent));
    return cloneAgent(agent);
  }

  getAgent(agentId: string): AgentProfile | undefined {
    const agent = this.agents.get(agentId);
    return agent ? cloneAgent(agent) : undefined;
  }

  saveCredential(credential: AgentCredential): void {
    this.credentialsByApiKey.set(credential.apiKey, cloneCredential(credential));
  }

  findCredentialByApiKey(apiKey: string): AgentCredential | undefined {
    const credential = this.credentialsByApiKey.get(apiKey);
    return credential ? cloneCredential(credential) : undefined;
  }
}

function cloneAgent(agent: AgentProfile): AgentProfile {
  return { ...agent };
}

function cloneCredential(credential: AgentCredential): AgentCredential {
  return { ...credential };
}
