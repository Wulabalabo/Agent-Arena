import { describe, expect, it } from "bun:test";
import { PlatformMockStore } from "./mock-store";
import { submitIntentWithMockExecution } from "./execution";
import { createMockCompetition } from "./types";

function createClaimedTestAgent(store: PlatformMockStore, displayName = "Trend Ranger") {
  return store.createClaimedAgent({
    displayName,
    ownerAddress: "0xowner",
    twitterHandle: null
  });
}

describe("mock intent execution", () => {
  it("executes an accepted directional intent and records risk first", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Trend Ranger");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-1",
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
      confidence: 0.72,
      reason: "Momentum remains above VWAP.",
      createdAt: "2026-06-15T10:03:12.000Z"
    });

    const [intent] = store.listIntents();
    const [riskDecision] = store.listRiskDecisions();
    const [execution] = store.listExecutions();

    expect(result.status).toBe("executed");
    expect(result.executionId).toStartWith("exec_");
    expect(result.predictTxDigest).toBe(`0xmock_${result.executionId}`);
    expect(store.listRiskDecisions()).toHaveLength(1);
    expect(riskDecision.intentId).toBe(intent.id);
    expect(execution.riskDecisionId).toBe(riskDecision.id);
  });

  it("calls a live Predict adapter only with stored intent, risk, execution, and wallet identity", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Live Adapter");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const adapterCalls: unknown[] = [];

    const result = await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-live-adapter",
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
      confidence: 0.72,
      reason: "Live execution path.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async (input: unknown) => {
        adapterCalls.push(input);
        return {
          status: "confirmed",
          predictTxDigest: "0xlive_digest"
        };
      }
    });

    const [intent] = store.listIntents();
    const [riskDecision] = store.listRiskDecisions();
    const [execution] = store.listExecutions();

    expect(result.status).toBe("executed");
    expect(result.predictTxDigest).toBe("0xlive_digest");
    expect(adapterCalls).toEqual([
      {
        intentId: intent.id,
        riskDecisionId: riskDecision.id,
        executionId: execution.id,
        agentId: agent.id,
        walletId: wallet.id,
        predictOperation: "mint_directional"
      }
    ]);
    expect(execution).toMatchObject({
      id: result.executionId,
      intentId: intent.id,
      riskDecisionId: riskDecision.id,
      agentId: agent.id,
      predictTxDigest: "0xlive_digest",
      status: "confirmed"
    });
  });

  it("rejects exposure when no wallet is bound", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "No Wallet");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-2",
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
      reason: "Valid idea without a wallet.",
      createdAt: "2026-06-15T10:04:12.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("WALLET_NOT_BOUND");
    expect(store.listIntents()).toHaveLength(1);
    expect(store.listRiskDecisions()).toHaveLength(1);
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("accepts hold without wallet signing or execution", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Patient Agent");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-hold",
      action: "hold",
      confidence: 0.55,
      reason: "No edge while spread is wide.",
      createdAt: "2026-06-15T10:05:12.000Z"
    });

    expect(result.status).toBe("accepted");
    expect(result.executionId).toBeUndefined();
    expect(result.predictTxDigest).toBeUndefined();
    expect(store.listRiskDecisions()[0]?.accepted).toBe(true);
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("rejects exposure in non-live rounds", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Early Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition({ ...createMockCompetition("btc-15m-001"), status: "pre_open" });

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-pre-open",
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
      confidence: 0.65,
      reason: "Trying before the round opens.",
      createdAt: "2026-06-15T09:59:12.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("ROUND_NOT_LIVE");
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("rejects hold in non-live rounds while still not requiring a wallet", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Too Early Holder");
    store.seedCompetition({ ...createMockCompetition("btc-15m-001"), status: "pre_open" });

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-hold-pre-open",
      action: "hold",
      confidence: 0.55,
      reason: "Waiting before the round opens.",
      createdAt: "2026-06-15T09:58:12.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("ROUND_NOT_LIVE");
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("rejects actions disallowed by the competition", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Disallowed Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition({
      ...createMockCompetition("btc-15m-001"),
      allowedActions: ["hold"]
    });

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-action-disallowed",
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
      confidence: 0.65,
      reason: "Trying an action not in this competition.",
      createdAt: "2026-06-15T10:02:12.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("ACTION_NOT_ALLOWED");
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("rejects intents above the MVP exposure cap", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Whale Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-too-large",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "10",
      maxCost: "1000.01",
      confidence: 0.8,
      reason: "Oversized but otherwise valid.",
      createdAt: "2026-06-15T10:06:12.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("RISK_LIMIT_EXCEEDED");
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("returns the existing result for identical idempotency replays", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Retry Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const payload = {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-retry",
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
      confidence: 0.72,
      reason: "Retrying the same valid idea.",
      createdAt: "2026-06-15T10:08:12.000Z"
    };

    const first = submitIntentWithMockExecution(store, payload);
    const second = submitIntentWithMockExecution(store, payload);

    expect(second).toEqual(first);
    expect(store.listIntents()).toHaveLength(1);
    expect(store.listRiskDecisions()).toHaveLength(1);
    expect(store.listExecutions()).toHaveLength(1);
  });

  it("rejects idempotency replays with a different payload", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Conflict Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const payload = {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-conflict",
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
      confidence: 0.72,
      reason: "Original valid idea.",
      createdAt: "2026-06-15T10:09:12.000Z"
    };

    submitIntentWithMockExecution(store, payload);

    expect(() => submitIntentWithMockExecution(store, {
      ...payload,
      maxCost: "6.00"
    })).toThrow("IDEMPOTENCY_CONFLICT");
    expect(store.listIntents()).toHaveLength(1);
    expect(store.listRiskDecisions()).toHaveLength(1);
    expect(store.listExecutions()).toHaveLength(1);
  });

  it("validates malformed intents before persistence", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Malformed Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    expect(() => submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-invalid",
      action: "hold",
      quantity: "10",
      confidence: 0.5,
      reason: "Hold cannot include quantity.",
      createdAt: "2026-06-15T10:07:12.000Z"
    })).toThrow("hold does not allow quantity");

    expect(store.listIntents()).toHaveLength(0);
    expect(store.listRiskDecisions()).toHaveLength(0);
    expect(store.listExecutions()).toHaveLength(0);
  });

  it("does not expose mutable store records", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Clone Agent");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    const competition = store.seedCompetition();

    wallet.address = "0xmutated";
    competition.status = "settled";

    expect(store.getTradingWalletByAgentId(agent.id)?.address).toBe("0xagentwallet");
    expect(store.getCompetition("btc-15m-001")?.status).toBe("live");
  });

  it("does not expose mutable intent, risk, or execution records", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Nested Clone Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-clone",
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
      confidence: 0.72,
      reason: "Valid idea for clone checks.",
      createdAt: "2026-06-15T10:10:12.000Z"
    });
    const [intent] = store.listIntents();
    const [riskDecision] = store.listRiskDecisions();
    const [execution] = store.listExecutions();

    if (intent.market?.kind === "directional") {
      intent.market.strike = "1";
    }
    riskDecision.rejectionCode = "MUTATED";
    execution.predictTxDigest = "0xmutated";

    const storedIntent = store.findIntentById(result.intentId);
    expect(storedIntent?.market).toMatchObject({ strike: "65000" });
    expect(store.findRiskDecisionByIntentId(result.intentId)?.rejectionCode).toBeNull();
    expect(store.findExecutionByIntentId(result.intentId)?.predictTxDigest).toBe(result.predictTxDigest);
  });
});
