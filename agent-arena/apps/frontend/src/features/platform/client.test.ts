import { describe, expect, it, vi } from "vitest";
import { createPlatformClient, PlatformClientError } from "./client";
import { mockPlatformSnapshot } from "./mock";

describe("createPlatformClient", () => {
  it("initializes agent pairing without returning runtime credentials", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          agentDraftId: "draft_1",
          displayName: "Trend Ranger",
          registrationCode: "PAIR-2048",
          claimUrl: "https://platform.test/claim/PAIR-2048",
          expiresAt: "2026-06-16T12:00:00.000Z"
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      )
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena/", fetcher });

    const result = await client.initAgentPairing({ displayName: "Trend Ranger" });

    expect(result.registrationCode).toBe("PAIR-2048");
    expect(result).toMatchObject({
      agentDraftId: "draft_1",
      claimUrl: "https://platform.test/claim/PAIR-2048",
      expiresAt: "2026-06-16T12:00:00.000Z"
    });
    expect(result).not.toHaveProperty("runtimeCredential");
    expect(fetcher).toHaveBeenCalledWith("https://platform.test/api/arena/agent/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Trend Ranger" })
    });
  });

  it("claims an agent for an owner and returns the runtime credential", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          agent: mockPlatformSnapshot.agents[0],
          tradingWallet: mockPlatformSnapshot.tradingWallet,
          runtimeCredential: {
            token: "agent_runtime_test_token",
            shownOnce: true,
            scopes: ["agent:read", "agent:intent:write"]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });
    const input = {
      registrationCode: "PAIR-2048",
      ownerAddress: "0xowner",
      signature: "0xsig",
      twitterHandle: "@Sui_Agent"
    };

    const result = await client.claimAgent(input);

    expect(result.agent).toMatchObject({
      twitterHandle: "Sui_Agent",
      twitterVerified: false
    });
    expect(result.tradingWallet).toMatchObject({
      id: "wallet_1",
      status: "active",
      address: "0xagentwallet_agent_1"
    });
    expect(result.runtimeCredential).toEqual({
      token: "agent_runtime_test_token",
      shownOnce: true,
      scopes: ["agent:read", "agent:intent:write"]
    });
    expect(fetcher).toHaveBeenCalledWith("https://platform.test/api/arena/owner/agents/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
  });

  it("uses the runtime credential header for agent runtime methods", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/agent/me")) {
        return new Response(JSON.stringify(mockPlatformSnapshot.agents[0]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify(mockPlatformSnapshot.latestIntent), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    });
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await client.getAgentMe("agent_runtime_test_token");
    await client.submitIntent("agent_runtime_test_token", mockPlatformSnapshot.latestIntent);

    expect(fetcher).toHaveBeenNthCalledWith(1, "https://platform.test/api/arena/agent/me", {
      headers: { "x-agent-arena-agent-token": "agent_runtime_test_token" }
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://platform.test/api/arena/intents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-arena-agent-token": "agent_runtime_test_token"
      },
      body: JSON.stringify(mockPlatformSnapshot.latestIntent)
    });
  });

  it("maps structured API errors to PlatformClientError", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "ROUND_NOT_LIVE",
            message: "The selected competition is not accepting new exposure."
          }
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await expect(client.submitIntent("agent_runtime_test_token", mockPlatformSnapshot.latestIntent)).rejects.toMatchObject({
      name: "PlatformClientError",
      code: "ROUND_NOT_LIVE",
      message: "The selected competition is not accepting new exposure."
    });
    await expect(client.submitIntent("agent_runtime_test_token", mockPlatformSnapshot.latestIntent)).rejects.toBeInstanceOf(
      PlatformClientError
    );
  });
});
