import { describe, expect, it } from "bun:test";
import { createAgentArenaFetchHandler } from "../server";
import { createPlatformFetchHandler } from "./api";
import { PlatformMockStore } from "./mock-store";
import { createPerformanceLedgerRecord, createRegistrationCodeHash } from "./performance-ledger";
import { createMockCompetition } from "./types";

async function claimTestAgent(
  fetch: ReturnType<typeof createPlatformFetchHandler>,
  input: {
    displayName?: string;
    ownerAddress?: string;
    signature?: string;
    twitterHandle?: string | null;
  } = {}
) {
  const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
    method: "POST",
    body: JSON.stringify({ displayName: input.displayName ?? "Trend Ranger" })
  }))).json();

  return await (await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: input.ownerAddress ?? "0xowner",
      signature: input.signature ?? "0xsignedClaimMessage",
      ...(input.twitterHandle === undefined ? {} : { twitterHandle: input.twitterHandle })
    })
  }))).json();
}

function seedExpiredDirectionalPosition(store: PlatformMockStore) {
  const agent = store.createClaimedAgent({
    displayName: "Settlement API Agent",
    ownerAddress: "0xowner",
    twitterHandle: null
  });
  const wallet = store.bindTradingWallet(agent.id, "0xwallet", {
    predictManagerStatus: "ready",
    predictManagerId: "0xmanager"
  });
  const expiryMs = "1781700900000";
  store.updateAgentExposureStatus(agent.id, "directional");
  store.savePositionSnapshot({
    agentId: agent.id,
    competitionId: "btc-15m-001",
    positionRef: {
      kind: "directional",
      marketKey: "btc-up-62929000000000",
      openExecutionId: "exec_open",
      quantity: "500000"
    },
    oracleId: "0xbtc15m",
    expiryMs,
    strikeRaw: "62929000000000",
    direction: "up",
    quantityRaw: "500000",
    status: "open",
    updatedAt: "2026-06-17T12:50:00.000Z"
  });
  store.recordPerformanceLedger({
    kind: "execution",
    agentDraftId: null,
    registrationCodeHash: null,
    agentId: agent.id,
    ownerAddress: agent.ownerAddress,
    tradingWalletId: wallet.id,
    walletAddress: wallet.address,
    predictManagerId: wallet.predictManagerId,
    competitionId: "btc-15m-001",
    oracleId: "0xbtc15m",
    expiryMs,
    intentId: "intent_open",
    riskDecisionId: "risk_open",
    executionId: "exec_open",
    txDigest: "open-digest",
    action: "open_directional",
    positionKind: "directional",
    quantityRaw: "500000",
    costRaw: "5000000",
    proceedsRaw: null,
    status: "confirmed",
    errorCode: null,
    policyDrift: "none",
    createdAt: "2026-06-17T12:51:00.000Z",
    serverReceivedAt: "2026-06-17T12:51:00.000Z"
  });

  return { agent, expiryMs, wallet };
}

describe("Agent Arena platform API", () => {
  it("initializes an Agent pairing without issuing runtime credentials", async () => {
    const fetch = createPlatformFetchHandler();
    const beforeMs = Date.now();
    const response = await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Trend Ranger" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      displayName: "Trend Ranger"
    });
    expect(body.agentDraftId).toStartWith("draft_");
    expect(body.registrationCode).toMatch(/^PAIR-/);
    expect(body.claimUrl).toBe(`http://127.0.0.1:5173/agent-arena/claim/${body.registrationCode}`);
    expect(Date.parse(body.expiresAt)).toBeGreaterThanOrEqual(beforeMs + 15 * 60 * 1000);
    expect(Date.parse(body.expiresAt)).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    expect(body).not.toHaveProperty("apiKey");
    expect(body).not.toHaveProperty("runtimeCredential");
  });

  it("uses a configured owner frontend URL and clock for pairing links", async () => {
    const fetch = createPlatformFetchHandler(undefined, {
      frontendBaseUrl: "https://arena.test",
      now: () => Date.parse("2026-06-18T02:00:00.000Z")
    });
    const response = await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Clock Agent" })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.claimUrl).toBe(`https://arena.test/agent-arena/claim/${body.registrationCode}`);
    expect(body.expiresAt).toBe("2026-06-18T02:15:00.000Z");
  });

  it("reconciles expired settlements behind an internal platform route", async () => {
    const store = new PlatformMockStore();
    const seeded = seedExpiredDirectionalPosition(store);
    const claimRequests: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      now: () => 1781700960000,
      settlementInternalToken: "settlement-secret",
      settlementClaimExecutor: async (request) => {
        claimRequests.push(request);
        return {
          status: "submitted",
          txDigest: "claim-digest",
          actualProceedsRaw: "5500000"
        };
      }
    });

    const unauthorized = await fetch(new Request("http://localhost/api/arena/settlements/reconcile", {
      method: "POST",
      body: JSON.stringify({})
    }));
    expect(unauthorized.status).toBe(401);

    const response = await fetch(new Request("http://localhost/api/arena/settlements/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-arena-internal-token": "settlement-secret"
      },
      body: JSON.stringify({})
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{
        agentId: seeded.agent.id,
        status: "claimed",
        claimStatus: "confirmed",
        txDigest: "claim-digest"
      }]
    });
    expect(claimRequests).toEqual([{
      walletId: seeded.wallet.id,
      operation: "claim_settled_directional",
      managerId: "0xmanager",
      oracleId: "0xbtc15m",
      expiryMs: seeded.expiryMs,
      strikeRaw: "62929000000000",
      direction: "up",
      minProceedsRaw: "0",
      dryRunOnly: false
    }]);
    expect(store.getAgent(seeded.agent.id)?.exposureStatus).toBe("flat");
  });

  it("opportunistically reconciles expired owner Agent positions before serving the profile", async () => {
    const store = new PlatformMockStore();
    const seeded = seedExpiredDirectionalPosition(store);
    const claimRequests: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      now: () => 1781700960000,
      settlementClaimExecutor: async (request) => {
        claimRequests.push(request);
        return {
          status: "submitted",
          txDigest: "claim-digest",
          actualProceedsRaw: "5500000"
        };
      }
    });

    const response = await fetch(new Request("http://localhost/api/arena/owner/agent?ownerAddress=0xowner"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      agent: {
        id: seeded.agent.id,
        exposureStatus: "flat"
      },
      positions: [{
        status: "settled"
      }]
    });
    expect(claimRequests).toHaveLength(1);
  });

  it("claims a pairing code and returns the runtime credential once", async () => {
    const fetch = createPlatformFetchHandler();
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Trend Ranger" })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage",
        twitterHandle: "@Sui_Agent"
      })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.agent).toMatchObject({
      displayName: "Trend Ranger",
      twitterHandle: "Sui_Agent",
      twitterVerified: false,
      ownerAddress: "0xowner",
      runtimeStatus: "active",
      exposureStatus: "flat"
    });
    expect(body.tradingWallet).toMatchObject({
      agentId: body.agent.id,
      status: "active",
      testnetSuiBalance: "0",
      quoteBalance: "0",
      predictManagerStatus: "missing"
    });
    expect(body.runtimeCredential.token).toStartWith("agent_runtime_");
    expect(body.runtimeCredential.shownOnce).toBe(true);
    expect(body.runtimeCredential.scopes).toEqual([
      "agent:read",
      "agent:intent:write",
      "competition:read",
      "execution:read"
    ]);
    expect(body.registry).toEqual({
      status: "disabled",
      txDigest: null
    });
    expect(body).not.toHaveProperty("apiKey");
  });

  it("includes a successful registry tx digest when claim anchoring is configured", async () => {
    const store = new PlatformMockStore();
    const registerCalls: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      registryService: {
        registerAgent: async (input) => {
          registerCalls.push(input);
          return {
            status: "submitted",
            txDigest: "0xregistrydigest"
          };
        }
      }
    });

    const body = await claimTestAgent(fetch);

    expect(body.registry).toEqual({
      status: "submitted",
      txDigest: "0xregistrydigest"
    });
    expect(registerCalls).toHaveLength(1);
    expect(registerCalls[0]).toMatchObject({
      agentId: body.agent.id,
      agentDraftId: "draft_1",
      ownerAddress: "0xowner",
      tradingWalletAddress: body.tradingWallet.address
    });
    expect(JSON.stringify(registerCalls[0])).not.toContain("registrationCode");
    expect(JSON.stringify(registerCalls[0])).not.toContain(createRegistrationCodeHash("PAIR-2049"));
  });

  it("keeps claim successful when registry anchoring fails", async () => {
    const fetch = createPlatformFetchHandler(new PlatformMockStore(), {
      registryService: {
        registerAgent: async () => ({
          status: "failed",
          txDigest: null,
          errorCode: "REGISTRY_SUBMIT_FAILED",
          errorMessage: "mock registry failure"
        })
      }
    });

    const response = await claimTestAgent(fetch);

    expect(response.agent.id).toBe("agent_1");
    expect(response.runtimeCredential.token).toStartWith("agent_runtime_");
    expect(response.registry).toMatchObject({
      status: "failed",
      txDigest: null,
      errorCode: "REGISTRY_SUBMIT_FAILED"
    });
  });

  it("claims a pairing code through an injected claimed-Agent wallet service and stores identity ledger rows", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const walletServiceCalls: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      agentWalletService: async (input) => {
        walletServiceCalls.push(input);
        return {
          id: "wallet_internal_001",
          address: "0xclaimedwallet",
          testnetSuiBalance: "0",
          quoteBalance: "0",
          predictManagerStatus: "ready",
          predictManagerId: "0xmanager"
        };
      }
    });
    const draft = await (await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: JSON.stringify({ displayName: "Ledger Agent" })
    }))).json();

    const response = await fetch(new Request("http://localhost/api/arena/owner/agents/claim", {
      method: "POST",
      body: JSON.stringify({
        registrationCode: draft.registrationCode,
        ownerAddress: "0xowner",
        signature: "0xsignedClaimMessage",
        twitterHandle: "@Ledger_Agent"
      })
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(walletServiceCalls).toEqual([{
      agentId: body.agent.id,
      displayName: "Ledger Agent"
    }]);
    expect(body.tradingWallet).toMatchObject({
      id: "wallet_internal_001",
      agentId: body.agent.id,
      address: "0xclaimedwallet",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager"
    });
    expect(body.tradingWallet).not.toHaveProperty("privateKey");
    expect(body.tradingWallet).not.toHaveProperty("encryptedPrivateKey");

    const registrationCodeHash = createRegistrationCodeHash(draft.registrationCode);
    expect(store.getIdentityBindingByAgentId(body.agent.id)).toMatchObject({
      agentDraftId: draft.agentDraftId,
      registrationCodeHash,
      agentId: body.agent.id,
      ownerAddress: "0xowner",
      twitterHandle: "Ledger_Agent",
      tradingWalletId: "wallet_internal_001",
      walletAddress: "0xclaimedwallet",
      predictManagerId: "0xmanager"
    });
    expect(store.listPerformanceLedger({ agentId: body.agent.id })).toMatchObject([
      { kind: "pairing", registrationCodeHash },
      { kind: "wallet_binding", tradingWalletId: "wallet_internal_001" }
    ]);
    expect(JSON.stringify(store.listPerformanceLedger({ agentId: body.agent.id }))).not.toContain(draft.registrationCode);
  });

  it("serves the claimed owner Agent profile by owner wallet address", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch, {
      displayName: "Owner Linked Agent",
      ownerAddress: "0xOwnerABC",
      twitterHandle: "@linked_agent"
    });

    const response = await fetch(new Request("http://localhost/api/arena/owner/agent?ownerAddress=0xownerabc"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent).toMatchObject({
      id: claimed.agent.id,
      displayName: "Owner Linked Agent",
      ownerAddress: "0xOwnerABC",
      twitterHandle: "linked_agent",
      tradingWalletAddress: claimed.tradingWallet.address
    });
    expect(body.tradingWallet).toMatchObject({
      agentId: claimed.agent.id,
      address: claimed.tradingWallet.address,
      status: "active"
    });
    expect(body.positions).toEqual([]);
    expect(body.intents).toEqual([]);
    expect(body.executions).toEqual([]);
    expect(body.leaderboard).toEqual([]);
    expect(JSON.stringify(body)).not.toContain(claimed.runtimeCredential.token);
  });

  it("serves the current owner Agent when an owner has duplicate claimed Agents", async () => {
    const store = new PlatformMockStore();
    let nowMs = Date.parse("2026-06-18T13:00:00.000Z");
    const fetch = createPlatformFetchHandler(store, {
      now: () => nowMs
    });
    await claimTestAgent(fetch, {
      displayName: "Old Owner Agent",
      ownerAddress: "0xOwnerABC"
    });

    nowMs = Date.parse("2026-06-19T17:26:25.451Z");
    const current = await claimTestAgent(fetch, {
      displayName: "Current Owner Agent",
      ownerAddress: "0xOwnerABC"
    });
    const currentWallet = store.updateTradingWallet(current.tradingWallet.id, {
      testnetSuiBalance: "0.976797716",
      quoteBalance: "10254850",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager_current"
    });

    const response = await fetch(new Request("http://localhost/api/arena/owner/agent?ownerAddress=0xownerabc"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent).toMatchObject({
      id: current.agent.id,
      displayName: "Current Owner Agent",
      ownerAddress: "0xOwnerABC",
      tradingWalletAddress: currentWallet.address
    });
    expect(body.tradingWallet).toMatchObject({
      id: currentWallet.id,
      agentId: current.agent.id,
      testnetSuiBalance: "0.976797716",
      quoteBalance: "10254850",
      predictManagerStatus: "ready",
      predictManagerId: "0xmanager_current"
    });
    expect(store.getIdentityBindingByAgentId(current.agent.id)).toMatchObject({
      tradingWalletId: currentWallet.id,
      walletAddress: currentWallet.address,
      predictManagerId: "0xmanager_current"
    });
  });

  it("returns owner Agent ids in the public feed for owner wallet scoping", async () => {
    const store = new PlatformMockStore();
    const fetch = createPlatformFetchHandler(store);
    const first = await claimTestAgent(fetch, {
      displayName: "First Owner Agent",
      ownerAddress: "0xowner"
    });
    const second = await claimTestAgent(fetch, {
      displayName: "Second Owner Agent",
      ownerAddress: "0xowner"
    });
    const other = await claimTestAgent(fetch, {
      displayName: "Other Agent",
      ownerAddress: "0xother"
    });

    store.saveIntent({
      id: "intent_owner_first",
      competitionId: "btc-15m-001",
      agentId: first.agent.id,
      idempotencyKey: "owner-first",
      action: "hold",
      status: "accepted",
      confidence: 0.5,
      reason: "Owner first wallet activity.",
      rejectionCode: null,
      createdAt: "2026-06-19T17:30:00.000Z"
    });
    store.saveIntent({
      id: "intent_owner_second",
      competitionId: "btc-15m-001",
      agentId: second.agent.id,
      idempotencyKey: "owner-second",
      action: "hold",
      status: "accepted",
      confidence: 0.5,
      reason: "Owner second wallet activity.",
      rejectionCode: null,
      createdAt: "2026-06-19T17:31:00.000Z"
    });
    store.saveIntent({
      id: "intent_other",
      competitionId: "btc-15m-001",
      agentId: other.agent.id,
      idempotencyKey: "other",
      action: "hold",
      status: "accepted",
      confidence: 0.5,
      reason: "Other wallet activity.",
      rejectionCode: null,
      createdAt: "2026-06-19T17:32:00.000Z"
    });

    const response = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/public-feed?ownerAddress=0xowner"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ownerAgentIds).toEqual([first.agent.id, second.agent.id]);
    expect(body.agents.map((agent: { id: string }) => agent.id).sort()).toEqual(
      [first.agent.id, second.agent.id, other.agent.id].sort()
    );
  });

  it("returns an empty owner Agent profile for an unbound owner wallet", async () => {
    const fetch = createPlatformFetchHandler();

    const response = await fetch(new Request("http://localhost/api/arena/owner/agent?ownerAddress=0xunbound"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      agent: null,
      tradingWallet: null,
      positions: [],
      intents: [],
      executions: [],
      leaderboard: []
    });
  });

  it("rejects owner wallet withdrawal when only an Agent runtime token is supplied", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch);

    const response = await fetch(new Request(
      `http://localhost/api/arena/owner/trading-wallets/${claimed.tradingWallet.id}/withdraw`,
      {
        method: "POST",
        headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
        body: JSON.stringify({
          managerId: "0xmanager",
          amountRaw: "1000"
        })
      }
    ));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "OWNER_AUTH_REQUIRED"
      }
    });
  });

  it("records owner wallet withdrawal requests through an owner-authorized service", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const serviceCalls: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      ownerWithdrawalService: async (input) => {
        serviceCalls.push(input);
        return {
          status: "submitted",
          txDigest: "0xwithdrawdigest"
        };
      }
    });
    const claimed = await claimTestAgent(fetch);

    const response = await fetch(new Request(
      `http://localhost/api/arena/owner/trading-wallets/${claimed.tradingWallet.id}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify({
          ownerAddress: "0xowner",
          signature: "0xsignedOwnerRequest",
          managerId: "0xmanager",
          amountRaw: "1000",
          recipientAddress: "0x00000000000000000000000000000000000000000000000000000000000000ef"
        })
      }
    ));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      withdrawal: {
        id: "owner_withdrawal_1",
        ownerAddress: "0xowner",
        walletId: claimed.tradingWallet.id,
        managerId: "0xmanager",
        amountRaw: "1000",
        recipientAddress: "0x00000000000000000000000000000000000000000000000000000000000000ef",
        txDigest: "0xwithdrawdigest",
        status: "submitted"
      }
    });
    expect(serviceCalls).toMatchObject([
      {
        walletId: claimed.tradingWallet.id,
        agentId: claimed.agent.id,
        managerId: "0xmanager",
        amountRaw: "1000"
      }
    ]);
    expect(store.listOwnerWithdrawals()).toMatchObject([
      {
        id: "owner_withdrawal_1",
        txDigest: "0xwithdrawdigest"
      }
    ]);
  });

  it("rejects owner wallet withdrawal while exposure is live unless closeFirst is explicit", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const fetch = createPlatformFetchHandler(store, {
      ownerWithdrawalService: async () => ({
        status: "submitted",
        txDigest: "0xwithdrawdigest"
      })
    });
    const claimed = await claimTestAgent(fetch);
    store.updateAgentExposureStatus(claimed.agent.id, "directional");

    const blocked = await fetch(new Request(
      `http://localhost/api/arena/owner/trading-wallets/${claimed.tradingWallet.id}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify({
          ownerAddress: "0xowner",
          signature: "0xsignedOwnerRequest",
          managerId: "0xmanager",
          amountRaw: "1000"
        })
      }
    ));

    expect(blocked.status).toBe(409);
    await expect(blocked.json()).resolves.toMatchObject({
      error: {
        code: "OPEN_EXPOSURE_EXISTS"
      }
    });
  });

  it("rejects owner wallet withdrawal with an invalid recipient address", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch);

    const response = await fetch(new Request(
      `http://localhost/api/arena/owner/trading-wallets/${claimed.tradingWallet.id}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify({
          ownerAddress: "0xowner",
          signature: "0xsignedOwnerRequest",
          managerId: "0xmanager",
          amountRaw: "1000",
          recipientAddress: "0xbad"
        })
      }
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT"
      }
    });
  });

  it("submits an authenticated intent with the runtime token", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch);

    const meResponse = await fetch(new Request("http://localhost/api/arena/agent/me", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      id: claimed.agent.id,
      displayName: "Trend Ranger"
    });

    const walletResponse = await fetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));
    expect(walletResponse.status).toBe(200);
    await expect(walletResponse.json()).resolves.toMatchObject({
      wallet: {
        agentId: claimed.agent.id,
        status: "active"
      }
    });

    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-api-1",
        action: "hold",
        confidence: 0.5,
        reason: "Waiting for cleaner signal.",
        createdAt: "2026-06-15T10:03:12.000Z"
      })
    }));

    expect(intentResponse.status).toBe(201);
    const body = await intentResponse.json();
    expect(body.status).toBe("accepted");
  });

  it("refreshes Agent wallet state before wallet reads and exposure intents", async () => {
    const fetch = createPlatformFetchHandler(undefined, {
      agentWalletReader: async (wallet) => ({
        id: wallet.id,
        address: wallet.address,
        testnetSuiBalance: "0.715524060",
        quoteBalance: "3000602",
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager_real"
      }),
      predictExecutionAdapter: async () => ({
        status: "confirmed",
        predictTxDigest: "0xreal_digest"
      })
    });
    const claimed = await claimTestAgent(fetch);
    const headers = { "x-agent-arena-agent-token": claimed.runtimeCredential.token };

    const walletResponse = await fetch(new Request("http://localhost/api/arena/agent/wallet", { headers }));
    expect(walletResponse.status).toBe(200);
    await expect(walletResponse.json()).resolves.toMatchObject({
      wallet: {
        testnetSuiBalance: "0.715524060",
        quoteBalance: "3000602",
        predictManagerStatus: "ready",
        predictManagerId: "0xmanager_real"
      }
    });

    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers,
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-real-wallet-refresh",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "1781701200000",
          strike: "65000000000000",
          isUp: true
        },
        quantity: "200000",
        maxCost: "20000000",
        confidence: 0.71,
        reason: "Uses refreshed wallet before execution.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(intentResponse.status).toBe(201);
    await expect(intentResponse.json()).resolves.toMatchObject({
      status: "executed",
      predictTxDigest: "0xreal_digest"
    });
  });

  it("serves authenticated Agent positions and execution details without cross-Agent access", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const fetch = createPlatformFetchHandler(store);
    const first = await claimTestAgent(fetch, { displayName: "Position Agent" });
    const second = await claimTestAgent(fetch, { displayName: "Other Agent", ownerAddress: "0xowner2" });

    store.savePositionSnapshot({
      agentId: first.agent.id,
      competitionId: "btc-15m-001",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000-1781701200000",
        openExecutionId: "exec_1"
      },
      oracleId: "0xbtc15m",
      expiryMs: "1781701200000",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      quantityRaw: "10",
      status: "open",
      updatedAt: "2026-06-15T10:05:00.000Z"
    });
    store.saveExecution({
      id: "exec_1",
      intentId: "intent_1",
      agentId: first.agent.id,
      competitionId: "btc-15m-001",
      riskDecisionId: "risk_1",
      status: "confirmed",
      predictTxDigest: "0xpredictdigest",
      action: "open_range",
      createdAt: "2026-06-15T10:05:00.000Z"
    });
    store.saveIntent({
      id: "intent_1",
      competitionId: "btc-15m-001",
      agentId: first.agent.id,
      idempotencyKey: "position-agent-intent",
      action: "open_range",
      market: {
        kind: "range",
        oracleId: "0xbtc15m",
        expiry: "1781701200000",
        lowerStrike: "64000000000000",
        higherStrike: "66000000000000"
      },
      quantity: "10",
      maxCost: "1000000",
      confidence: 0.64,
      reason: "Position Agent opens a test range.",
      createdAt: "2026-06-15T10:05:00.000Z",
      status: "executed",
      rejectionCode: null
    });

    const positions = await fetch(new Request(
      "http://localhost/api/arena/agent/positions?competitionId=btc-15m-001",
      { headers: { "x-agent-arena-agent-token": first.runtimeCredential.token } }
    ));
    const intent = await fetch(new Request(
      "http://localhost/api/arena/intents/intent_1",
      { headers: { "x-agent-arena-agent-token": first.runtimeCredential.token } }
    ));
    const intentForbidden = await fetch(new Request(
      "http://localhost/api/arena/intents/intent_1",
      { headers: { "x-agent-arena-agent-token": second.runtimeCredential.token } }
    ));
    const execution = await fetch(new Request(
      "http://localhost/api/arena/executions/exec_1",
      { headers: { "x-agent-arena-agent-token": first.runtimeCredential.token } }
    ));
    const forbidden = await fetch(new Request(
      "http://localhost/api/arena/executions/exec_1",
      { headers: { "x-agent-arena-agent-token": second.runtimeCredential.token } }
    ));

    expect(positions.status).toBe(200);
    await expect(positions.json()).resolves.toMatchObject({
      positions: [{
        agentId: first.agent.id,
        competitionId: "btc-15m-001",
        positionRef: {
          kind: "range",
          rangeKey: "btc-range-64000-66000-1781701200000"
        },
        quantityRaw: "10",
        status: "open"
      }]
    });
    expect(intent.status).toBe(200);
    await expect(intent.json()).resolves.toMatchObject({
      intent: {
        id: "intent_1",
        agentId: first.agent.id,
        status: "executed"
      }
    });
    expect(intentForbidden.status).toBe(404);
    await expect(intentForbidden.json()).resolves.toMatchObject({
      error: {
        code: "INTENT_NOT_FOUND"
      }
    });
    expect(execution.status).toBe(200);
    await expect(execution.json()).resolves.toMatchObject({
      execution: {
        id: "exec_1",
        agentId: first.agent.id,
        predictTxDigest: "0xpredictdigest",
        status: "confirmed"
      }
    });
    expect(forbidden.status).toBe(404);
    await expect(forbidden.json()).resolves.toMatchObject({
      error: {
        code: "EXECUTION_NOT_FOUND"
      }
    });
  });

  it("submits authenticated range intents through the configured Predict adapter", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const adapterCalls: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      predictExecutionAdapter: async (input) => {
        adapterCalls.push(input);
        return {
          status: "confirmed",
          predictTxDigest: "0xrange_intent_digest"
        };
      }
    });
    const claimed = await claimTestAgent(fetch, { displayName: "Range API Agent" });

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-api-range",
        action: "open_range",
        market: {
          kind: "range",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          lowerStrike: "64000000000000",
          higherStrike: "66000000000000"
        },
        quantity: "10",
        maxCost: "5.00",
        confidence: 0.64,
        reason: "Range API execution.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: "executed",
      predictTxDigest: "0xrange_intent_digest"
    });
    expect(adapterCalls).toMatchObject([
      {
        agentId: claimed.agent.id,
        walletId: claimed.tradingWallet.id,
        predictOperation: "mint_range",
        predictPayload: {
          operation: "mint_range",
          market: {
            kind: "range",
            lowerStrike: "64000000000000",
            higherStrike: "66000000000000"
          },
          quantity: "10",
          maxCost: "5.00"
        }
      }
    ]);
  });

  it("submits Agent budgetRaw open intents through the public API without caller quantity", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const adapterCalls: unknown[] = [];
    const fetch = createPlatformFetchHandler(store, {
      predictExecutionAdapter: async (input) => {
        adapterCalls.push(input);
        return {
          status: "confirmed",
          predictTxDigest: "0xbudget_intent_digest"
        };
      }
    });
    const claimed = await claimTestAgent(fetch, { displayName: "Budget API Agent" });

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-api-budget",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          strike: "65000000000000",
          isUp: true
        },
        budgetRaw: "5000000",
        confidence: 0.64,
        reason: "Budget API execution.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: "executed",
      predictTxDigest: "0xbudget_intent_digest",
      predictTxUrl: "https://testnet.suivision.xyz/txblock/0xbudget_intent_digest"
    });
    expect(adapterCalls).toMatchObject([
      {
        agentId: claimed.agent.id,
        walletId: claimed.tradingWallet.id,
        predictOperation: "mint_directional",
        predictPayload: {
          operation: "mint_directional",
          quantity: "5000000",
          maxCost: "5000000",
          budgetRaw: "5000000"
        }
      }
    ]);

    const positions = await fetch(new Request(
      "http://localhost/api/arena/agent/positions?competitionId=btc-15m-001",
      { headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token } }
    ));
    await expect(positions.json()).resolves.toMatchObject({
      positions: [{
        agentId: claimed.agent.id,
        competitionId: "btc-15m-001",
        positionRef: {
          kind: "directional",
          openExecutionId: "exec_1"
        },
        quantityRaw: "5000000",
        status: "open"
      }]
    });

    const execution = await fetch(new Request(
      "http://localhost/api/arena/executions/exec_1",
      { headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token } }
    ));
    await expect(execution.json()).resolves.toMatchObject({
      execution: {
        id: "exec_1",
        predictTxDigest: "0xbudget_intent_digest",
        predictTxUrl: "https://testnet.suivision.xyz/txblock/0xbudget_intent_digest"
      }
    });
  });

  it("returns a Predict execution error when the configured adapter fails", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const fetch = createPlatformFetchHandler(store, {
      predictExecutionAdapter: async () => ({
        status: "failed",
        predictTxDigest: "0xfailed_digest",
        errorCode: "PREDICT_MANAGER_NOT_READY",
        errorMessage: "PredictManager is missing for the Agent trading wallet"
      })
    });
    const claimed = await claimTestAgent(fetch, { displayName: "Failed API Agent" });

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-api-failed",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          strike: "65000000000000",
          isUp: true
        },
        quantity: "10",
        maxCost: "5.00",
        confidence: 0.64,
        reason: "Adapter failure.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PREDICT_MANAGER_NOT_READY",
        details: {
          status: "failed",
          intentId: "intent_1",
          riskDecisionId: "risk_1",
          executionId: "exec_1",
          predictTxDigest: "0xfailed_digest"
        }
      }
    });
    expect(store.findIntentById("intent_1")).toMatchObject({
      status: "failed",
      rejectionCode: "PREDICT_MANAGER_NOT_READY"
    });

    const leaderboard = await fetch(new Request("http://localhost/api/arena/leaderboard?competitionId=btc-15m-001"));
    expect(leaderboard.status).toBe(200);
    await expect(leaderboard.json()).resolves.toMatchObject({
      entries: [{
        agentId: claimed.agent.id,
        executionCount: 0,
        invalidIntentCount: 1
      }]
    });
  });

  it("rejects authenticated intents for a different agent", async () => {
    const fetch = createPlatformFetchHandler();
    const first = await claimTestAgent(fetch, { displayName: "First Agent" });
    const second = await claimTestAgent(fetch, { displayName: "Second Agent", ownerAddress: "0xowner2" });

    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": first.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: second.agent.id,
        idempotencyKey: "intent-mismatch",
        action: "hold",
        confidence: 0.5,
        reason: "Wrong token.",
        createdAt: "2026-06-15T10:03:12.000Z"
      })
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AGENT_MISMATCH"
      }
    });
  });

  it("returns common error bodies for malformed JSON and rejected intents", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch, { displayName: "Risk Agent" });

    const malformed = await fetch(new Request("http://localhost/api/arena/agent/init", {
      method: "POST",
      body: "{"
    }));
    const rejected = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-invalid",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          strike: "65000",
          isUp: true
        },
        quantity: "10",
        maxCost: "0",
        confidence: 0.7,
        reason: "Invalid max cost.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT"
      }
    });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_INPUT"
      }
    });
  });

  it("serves competition, market-state, and leaderboard routes", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch, { displayName: "Directional Agent" });
    await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-leaderboard",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          strike: "65000",
          isUp: true
        },
        quantity: "10",
        maxCost: "5.00",
        confidence: 0.7,
        reason: "Creates an execution for leaderboard.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    const active = await fetch(new Request("http://localhost/api/arena/competition/list-active"));
    const competition = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001"));
    const marketState = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/market-state"));
    const leaderboard = await fetch(new Request("http://localhost/api/arena/leaderboard?competitionId=btc-15m-001"));

    expect(active.status).toBe(200);
    await expect(active.json()).resolves.toMatchObject({
      competitions: [{ id: "btc-15m-001" }]
    });
    expect(competition.status).toBe(200);
    await expect(competition.json()).resolves.toMatchObject({
      competition: { id: "btc-15m-001" }
    });
    expect(marketState.status).toBe(200);
    await expect(marketState.json()).resolves.toMatchObject({
      marketState: {
        competitionId: "btc-15m-001",
        allowedOperations: { canOpen: true }
      }
    });
    expect(leaderboard.status).toBe(200);
    await expect(leaderboard.json()).resolves.toMatchObject({
      competitionId: "btc-15m-001",
      entries: [{
        rank: 1,
        agentId: claimed.agent.id,
        displayName: "Directional Agent",
        twitterVerified: false,
        executionCount: 1,
        invalidIntentCount: 0
      }]
    });

    const intent = await fetch(new Request("http://localhost/api/arena/intents/intent_1", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));
    expect(intent.status).toBe(200);
    await expect(intent.json()).resolves.toMatchObject({
      intent: {
        id: "intent_1",
        agentId: claimed.agent.id,
        status: "executed"
      }
    });

    const replay = await fetch(new Request(`http://localhost/api/arena/owner/agents/${claimed.agent.id}/replay`));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({
      events: [
        { label: "Intent submitted" },
        { label: "Risk accepted" },
        {
          label: "Predict transaction confirmed",
          txDigest: "0xmock_exec_1"
        }
      ]
    });
  });

  it("serves public competition feed data without owner wallet fields", async () => {
    const fetch = createPlatformFetchHandler();
    const claimed = await claimTestAgent(fetch, { displayName: "Directional Agent" });
    await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token },
      body: JSON.stringify({
        competitionId: "btc-15m-001",
        agentId: claimed.agent.id,
        idempotencyKey: "intent-public-feed",
        action: "open_directional",
        market: {
          kind: "directional",
          oracleId: "0xbtc15m",
          expiry: "2026-06-15T10:15:00.000Z",
          strike: "65000",
          isUp: false
        },
        quantity: "7",
        maxCost: "3.50",
        confidence: 0.7,
        reason: "Creates a public feed event.",
        createdAt: "2026-06-15T10:04:12.000Z"
      })
    }));

    const response = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/public-feed"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      agents: [{
        id: claimed.agent.id,
        displayName: "Directional Agent",
        twitterVerified: false
      }],
      intents: [{
        action: "open_directional",
        quantity: "7",
        maxCost: "3.50"
      }],
      executions: [{
        status: "confirmed",
        predictTxDigest: "0xmock_exec_1"
      }],
      leaderboard: [{
        agentId: claimed.agent.id,
        displayName: "Directional Agent"
      }]
    });
    expect(JSON.stringify(body)).not.toContain("ownerAddress");
    expect(JSON.stringify(body)).not.toContain("tradingWalletAddress");
  });

  it("serves a current rolling BTC 15m market window for Agent runtime data", async () => {
    const beforeMs = Date.now();
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/market-state"));
    const afterMs = Date.now();

    expect(response.status).toBe(200);
    const body = await response.json();
    const serverTimeMs = Number.parseInt(body.marketState.serverTimeMs, 10);
    const expiryMs = Number.parseInt(body.marketState.expiryMs, 10);
    const timeToExpiryMs = Number.parseInt(body.marketState.timeToExpiryMs, 10);

    expect(serverTimeMs).toBeGreaterThanOrEqual(beforeMs);
    expect(serverTimeMs).toBeLessThanOrEqual(afterMs);
    expect(expiryMs).toBeGreaterThan(afterMs);
    expect(timeToExpiryMs).toBeGreaterThan(0);
    expect(timeToExpiryMs).toBeLessThanOrEqual(900_000);
  });

  it("uses a configured market data provider instead of mock market fixtures", async () => {
    const competition = {
      ...createMockCompetition("btc-15m-001"),
      oracleId: "0xreal_oracle",
      startsAt: "2026-06-18T00:00:00.000Z",
      expiresAt: "2026-06-18T00:15:00.000Z",
      expiry: "2026-06-18T00:15:00.000Z"
    };
    const fetch = createPlatformFetchHandler(undefined, {
      marketDataProvider: async () => ({
        competition,
        marketState: {
          competitionId: "btc-15m-001",
          status: "live",
          serverTimeMs: "1781715000000",
          oracleId: "0xreal_oracle",
          oracleStatus: "active",
          expiryMs: "1781715600000",
          timeToExpiryMs: "600000",
          underlyingAsset: "BTC",
          spotPriceRaw: "65866527537529",
          forwardPriceRaw: "65867070507763",
          priceDecimals: 9,
          strikeGrid: {
            minStrikeRaw: "50000000000000",
            maxStrikeRaw: null,
            strikeStepRaw: "1000000000"
          },
          allowedActions: ["hold", "open_directional", "open_range", "reduce", "close"],
          allowedOperations: {
            canHold: true,
            canOpen: true,
            canReduce: true,
            canClose: true
          },
          lateWindow: {
            isFinalMinute: false,
            openAllowedByPlatform: true,
            openMayFailOnPredictQuote: true
          },
          fetchedAt: "2026-06-18T00:00:00.000Z"
        }
      })
    });

    const active = await fetch(new Request("http://localhost/api/arena/competition/list-active"));
    const marketState = await fetch(new Request("http://localhost/api/arena/competition/btc-15m-001/market-state"));

    await expect(active.json()).resolves.toMatchObject({
      competitions: [{ oracleId: "0xreal_oracle" }]
    });
    await expect(marketState.json()).resolves.toMatchObject({
      marketState: {
        oracleId: "0xreal_oracle",
        spotPriceRaw: "65866527537529",
        strikeGrid: {
          maxStrikeRaw: null
        }
      }
    });
  });

  it("serves leaderboard entries aggregated from the performance ledger by Agent identity", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const fetch = createPlatformFetchHandler(store);
    const agent = store.createClaimedAgent({
      displayName: "Ledger Ranker",
      ownerAddress: "0xowner",
      twitterHandle: "@Ledger_Ranker"
    });

    store.recordPerformanceLedger(createPerformanceLedgerRecord({
      kind: "execution",
      agentDraftId: "draft_1",
      registrationCodeHash: "sha256:abc",
      agentId: agent.id,
      ownerAddress: "0xowner",
      tradingWalletId: "wallet_1",
      walletAddress: "0xwallet1",
      predictManagerId: "0xmanager1",
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      expiryMs: "1781701200000",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: "exec_1",
      txDigest: "0xdigest1",
      action: "open_directional",
      positionKind: "directional",
      quantityRaw: "10",
      costRaw: "100",
      proceedsRaw: null,
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-15T10:04:00.000Z",
      serverReceivedAt: "2026-06-15T10:04:00.100Z"
    }));
    store.recordPerformanceLedger(createPerformanceLedgerRecord({
      kind: "execution",
      agentDraftId: "draft_1",
      registrationCodeHash: "sha256:abc",
      agentId: agent.id,
      ownerAddress: "0xowner",
      tradingWalletId: "wallet_2",
      walletAddress: "0xwallet2",
      predictManagerId: "0xmanager2",
      competitionId: "btc-15m-001",
      oracleId: "0xbtc15m",
      expiryMs: "1781701200000",
      intentId: "intent_2",
      riskDecisionId: "risk_2",
      executionId: "exec_2",
      txDigest: "0xdigest2",
      action: "close",
      positionKind: "directional",
      quantityRaw: "10",
      costRaw: null,
      proceedsRaw: "120",
      status: "confirmed",
      errorCode: null,
      policyDrift: "none",
      createdAt: "2026-06-15T10:10:00.000Z",
      serverReceivedAt: "2026-06-15T10:10:00.100Z"
    }));

    const response = await fetch(new Request("http://localhost/api/arena/leaderboard?competitionId=btc-15m-001"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entries: [{
        rank: 1,
        agentId: agent.id,
        displayName: "Ledger Ranker",
        twitterHandle: "Ledger_Ranker",
        executionCount: 2
      }]
    });
  });

  it("rejects missing runtime tokens on authenticated Agent endpoints", async () => {
    const fetch = createPlatformFetchHandler();
    const meResponse = await fetch(new Request("http://localhost/api/arena/agent/me"));
    const intentResponse = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "POST",
      body: JSON.stringify({})
    }));

    expect(meResponse.status).toBe(401);
    await expect(meResponse.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
    expect(intentResponse.status).toBe(401);
  });

  it("handles CORS preflight for platform routes", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/intents", {
      method: "OPTIONS"
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-agent-arena-agent-token");
  });

  it("does not reset a caller-provided store when handlers are recreated", async () => {
    const store = new (await import("./mock-store")).PlatformMockStore();
    const firstFetch = createPlatformFetchHandler(store);
    const claimed = await claimTestAgent(firstFetch, { displayName: "Persistent Agent" });

    const secondFetch = createPlatformFetchHandler(store);
    const response = await secondFetch(new Request("http://localhost/api/arena/agent/wallet", {
      headers: { "x-agent-arena-agent-token": claimed.runtimeCredential.token }
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wallet: {
        agentId: claimed.agent.id
      }
    });
  });

  it("does not expose deprecated API-key registration in introspection", async () => {
    const fetch = createPlatformFetchHandler();
    const response = await fetch(new Request("http://localhost/api/arena/__introspection"));
    const body = await response.json();

    expect(body.authHeader).toBe("x-agent-arena-agent-token");
    expect(JSON.stringify(body)).not.toContain("x-agent-arena-api-key");
    expect(JSON.stringify(body)).not.toContain("/api/arena/auth/register");
    expect(JSON.stringify(body)).not.toContain("x-agent-arena-internal-token");
    expect(JSON.stringify(body)).not.toContain("/api/arena/internal");
  });
});

describe("Agent Arena combined backend handler", () => {
  it("routes platform introspection and legacy health checks", async () => {
    const fetch = createAgentArenaFetchHandler();
    const platformResponse = await fetch(new Request("http://localhost/api/arena/__introspection"));
    const healthResponse = await fetch(new Request("http://localhost/health"));

    expect(platformResponse.status).toBe(200);
    await expect(platformResponse.json()).resolves.toMatchObject({
      service: "agent-arena-platform",
      seededCompetitionId: "btc-15m-001",
      authHeader: "x-agent-arena-agent-token"
    });
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      ok: true
    });
  });
});
