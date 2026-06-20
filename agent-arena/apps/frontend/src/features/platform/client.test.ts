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
          },
          registry: {
            status: "submitted",
            txDigest: "0xregistrydigest"
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
      id: "wallet_internal_001",
      status: "active",
      address: "0xagentwallet_agent_1"
    });
    expect(result.runtimeCredential).toEqual({
      token: "agent_runtime_test_token",
      shownOnce: true,
      scopes: ["agent:read", "agent:intent:write"]
    });
    expect(result.registry).toEqual({
      status: "submitted",
      txDigest: "0xregistrydigest"
    });
    expect(fetcher).toHaveBeenCalledWith("https://platform.test/api/arena/owner/agents/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
  });

  it("creates a runtime credential rotation challenge", async () => {
    const challenge = {
      agentId: "agent_1",
      ownerAddress: "0xowner",
      reason: "lost browser session",
      domain: "agent-arena-runtime-credential-rotation:v1",
      chainId: "sui:testnet",
      currentCredentialVersion: 1,
      nextCredentialVersion: 2,
      nonce: "nonce-1",
      expiresAt: "2026-06-18T02:10:00.000Z",
      message: "rotation message"
    };
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ challenge }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await expect(client.createRuntimeCredentialRotationChallenge("agent_1", {
      ownerAddress: "0xowner",
      reason: "lost browser session"
    })).resolves.toEqual(challenge);
    expect(fetcher).toHaveBeenCalledWith(
      "https://platform.test/api/arena/owner/agents/agent_1/runtime-credential/rotation-challenge",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerAddress: "0xowner",
          reason: "lost browser session"
        })
      }
    );
  });

  it("rotates a runtime credential with owner signature material", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({
        runtimeCredential: {
          token: "agent_runtime_rotated",
          shownOnce: true,
          credentialVersion: 2,
          scopes: ["agent:read"]
        },
        registry: {
          status: "disabled",
          txDigest: null
        }
      }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });
    const input = {
      ownerAddress: "0xowner",
      signature: "0xsig",
      nonce: "nonce-1",
      expiresAt: "2026-06-18T02:10:00.000Z",
      reason: "lost browser session",
      message: "rotation message",
      domain: "agent-arena-runtime-credential-rotation:v1",
      currentCredentialVersion: 1
    };

    await expect(client.rotateRuntimeCredential("agent_1", input)).resolves.toMatchObject({
      runtimeCredential: {
        token: "agent_runtime_rotated",
        credentialVersion: 2
      },
      registry: {
        status: "disabled"
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://platform.test/api/arena/owner/agents/agent_1/runtime-credential/rotate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }
    );
  });

  it("loads a claimed owner Agent profile by owner wallet address", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          agent: mockPlatformSnapshot.agents[0],
          tradingWallet: mockPlatformSnapshot.tradingWallet,
          positions: mockPlatformSnapshot.positions,
          intents: mockPlatformSnapshot.intents,
          executions: mockPlatformSnapshot.executions,
          leaderboard: mockPlatformSnapshot.leaderboard
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena/", fetcher });

    const result = await client.getOwnerAgentProfile("0xOwner ABC");

    expect(result.agent?.id).toBe("agent_1");
    expect(result.tradingWallet?.address).toBe("0xagentwallet_agent_1");
    expect(result.positions).toHaveLength(mockPlatformSnapshot.positions.length);
    expect(fetcher).toHaveBeenCalledWith(
      "https://platform.test/api/arena/owner/agent?ownerAddress=0xOwner%20ABC"
    );
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

    const expectedIntentBody = {
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      idempotencyKey: "trend-ranger-btc-15m-001-1",
      action: "open_directional",
      confidence: 0.72,
      reason: "Momentum remains above VWAP with rising oracle forward.",
      createdAt: "2026-06-16T10:03:12.000Z",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "1781701200000",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "10",
      maxCost: "5.00"
    };

    expect(fetcher).toHaveBeenNthCalledWith(1, "https://platform.test/api/arena/agent/me", {
      headers: { "x-agent-arena-agent-token": "agent_runtime_test_token" }
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://platform.test/api/arena/intents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-arena-agent-token": "agent_runtime_test_token"
      },
      body: JSON.stringify(expectedIntentBody)
    });
  });

  it("preserves budgetRaw when submitting Agent open intents", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ ...mockPlatformSnapshot.latestIntent, budgetRaw: "5000000" }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await client.submitIntent("agent_runtime_test_token", {
      competitionId: "btc-15m-001",
      agentId: "agent_1",
      idempotencyKey: "budget-client-open",
      action: "open_directional",
      confidence: 0.72,
      reason: "Budget controlled open.",
      createdAt: "2026-06-16T10:03:12.000Z",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "1781701200000",
        strike: "65000000000000",
        isUp: true
      },
      budgetRaw: "5000000"
    } as Parameters<typeof client.submitIntent>[1]);

    expect(fetcher).toHaveBeenCalledWith("https://platform.test/api/arena/intents", expect.objectContaining({
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: "agent_1",
        idempotencyKey: "budget-client-open",
        action: "open_directional",
        confidence: 0.72,
        reason: "Budget controlled open.",
        createdAt: "2026-06-16T10:03:12.000Z",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "1781701200000",
          strike: "65000000000000",
          isUp: true
        },
        budgetRaw: "5000000"
      })
    }));
  });

  it("reads positions and execution records with the runtime credential header", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("/agent/positions")) {
        return new Response(JSON.stringify({ positions: mockPlatformSnapshot.positions }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ execution: mockPlatformSnapshot.executions[0] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    const positions = await client.listAgentPositions("agent_runtime_test_token", "btc-15m-001");
    const execution = await client.getExecution("agent_runtime_test_token", "exec_1");

    expect(positions[0]?.positionRef.marketKey).toBe("btc-up-65000000000000-1781701200000");
    expect(execution.id).toBe("exec_1");
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://platform.test/api/arena/agent/positions?competitionId=btc-15m-001",
      {
        headers: { "x-agent-arena-agent-token": "agent_runtime_test_token" }
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://platform.test/api/arena/executions/exec_1", {
      headers: { "x-agent-arena-agent-token": "agent_runtime_test_token" }
    });
  });

  it("reads the executable competition market state", async () => {
    const marketState = {
      allowedActions: ["hold", "open_directional"],
      allowedOperations: {
        canClose: true,
        canHold: true,
        canOpen: true,
        canReduce: true
      },
      competitionId: "btc-15m-001",
      executableMarkets: {
        directional: {
          expiry: "1781622900000",
          oracleId: "0xfuture-nearest",
          strike: "65700000000000"
        }
      },
      expiryMs: "1781622900000",
      fetchedAt: "2026-06-16T15:00:55.000Z",
      forwardPriceRaw: "65611186326705",
      lateWindow: {
        isFinalMinute: false,
        openAllowedByPlatform: true,
        openMayFailOnPredictQuote: true
      },
      oracleId: "0xfuture-nearest",
      oracleStatus: "active",
      priceDecimals: 9,
      serverTimeMs: "1781622000000",
      spotPriceRaw: "65611517258518",
      status: "live",
      strikeGrid: {
        maxStrikeRaw: "80000000000000",
        minStrikeRaw: "50000000000000",
        strikeStepRaw: "1000000000"
      },
      timeToExpiryMs: "900000",
      underlyingAsset: "BTC"
    };
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ marketState }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await expect(client.getCompetitionMarketState("btc-15m-001")).resolves.toEqual(marketState);
    expect(fetcher).toHaveBeenCalledWith("https://platform.test/api/arena/competition/btc-15m-001/market-state");
  });

  it("reads public competition activity for the action feed", async () => {
    const publicActivity = {
      agents: [
        {
          id: "agent_1",
          displayName: "Trend Ranger",
          twitterHandle: "Sui_Agent",
          twitterVerified: false
        }
      ],
      intents: [mockPlatformSnapshot.intents[0]],
      executions: [mockPlatformSnapshot.executions[0]],
      leaderboard: [mockPlatformSnapshot.leaderboard[0]],
      ownerAgentIds: ["agent_1"]
    };
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(publicActivity), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await expect(client.listCompetitionPublicActivity("btc-15m-001", "0xOwner ABC")).resolves.toEqual(publicActivity);
    expect(fetcher).toHaveBeenCalledWith(
      "https://platform.test/api/arena/competition/btc-15m-001/public-feed?ownerAddress=0xOwner%20ABC"
    );
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

  it("maps non-JSON error responses to PlatformClientError", async () => {
    const fetcher = vi.fn(async () =>
      new Response("<html>Server Error</html>", {
        status: 500,
        headers: { "content-type": "text/html" }
      })
    );
    const client = createPlatformClient({ baseUrl: "https://platform.test/api/arena", fetcher });

    await expect(client.listCompetitions()).rejects.toMatchObject({
      name: "PlatformClientError",
      code: "REQUEST_FAILED",
      message: "Platform request failed: 500"
    });
    await expect(client.listCompetitions()).rejects.toBeInstanceOf(PlatformClientError);
  });
});
