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

  it("records performance ledger rows for intent, risk, and execution chains", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Ledger Trader");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet", {
      predictManagerId: "0xmanager"
    });
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-ledger-1",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "1781701200000",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "10",
      maxCost: "500",
      confidence: 0.72,
      reason: "Record this chain.",
      createdAt: "2026-06-15T10:03:12.000Z"
    });

    expect(result).toMatchObject({
      status: "executed",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: "exec_1"
    });
    expect(store.listPerformanceLedger({ agentId: agent.id })).toMatchObject([
      {
        kind: "intent",
        agentId: agent.id,
        tradingWalletId: wallet.id,
        intentId: "intent_1",
        riskDecisionId: null,
        executionId: null,
        action: "open_directional",
        status: "accepted"
      },
      {
        kind: "risk",
        agentId: agent.id,
        tradingWalletId: wallet.id,
        intentId: "intent_1",
        riskDecisionId: "risk_1",
        executionId: null,
        action: "open_directional",
        status: "accepted"
      },
      {
        kind: "execution",
        agentId: agent.id,
        tradingWalletId: wallet.id,
        intentId: "intent_1",
        riskDecisionId: "risk_1",
        executionId: "exec_1",
        txDigest: "0xmock_exec_1",
        action: "open_directional",
        status: "confirmed"
      }
    ]);
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
        predictOperation: "mint_directional",
        predictPayload: {
          operation: "mint_directional",
          market: {
            kind: "directional",
            oracleId: "0xbtc15m",
            expiry: "2026-06-15T10:15:00.000Z",
            strike: "65000",
            isUp: true
          },
          quantity: "10",
          maxCost: "5.00"
        }
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

  it("records actual Predict execution cost and proceeds in the performance ledger", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Actual Cost Agent");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-actual-cost",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "1781701200000",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "10",
      maxCost: "9000",
      confidence: 0.72,
      reason: "Actual cost should come from Predict events.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async () => ({
        status: "confirmed",
        predictTxDigest: "0xdigest_actual_cost",
        actualCostRaw: "8006"
      })
    });

    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "execution",
      tradingWalletId: wallet.id,
      executionId: "exec_1",
      txDigest: "0xdigest_actual_cost",
      action: "open_directional",
      costRaw: "8006",
      proceedsRaw: null,
      status: "confirmed"
    }));
  });

  it("records position-level realized PnL when a close execution returns actual proceeds", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Realized PnL Agent");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-open-for-pnl",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "1781701200000",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "10",
      maxCost: "100",
      confidence: 0.72,
      reason: "Open a position.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async () => ({
        status: "confirmed",
        predictTxDigest: "0xdigest_open",
        actualCostRaw: "100"
      })
    });

    await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-close-for-pnl",
      action: "close",
      positionRef: {
        kind: "directional",
        marketKey: "btc-up-65000000000000-1781701200000",
        openExecutionId: "exec_1"
      },
      minProceeds: "1",
      confidence: 0.64,
      reason: "Close the position.",
      createdAt: "2026-06-15T10:10:12.000Z"
    }, {
      predictExecutionAdapter: async () => ({
        status: "confirmed",
        predictTxDigest: "0xdigest_close",
        actualProceedsRaw: "120"
      })
    });

    expect(store.listPerformanceLedger({ agentId: agent.id })).toContainEqual(expect.objectContaining({
      kind: "position",
      tradingWalletId: wallet.id,
      intentId: "intent_2",
      executionId: "exec_2",
      txDigest: "0xdigest_close",
      action: "close",
      positionKind: "directional",
      quantityRaw: "10",
      costRaw: "100",
      proceedsRaw: "120",
      realizedPnlRaw: "20",
      status: "realized"
    }));
  });

  it("maps accepted range open intents to typed Predict adapter payloads", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Range Adapter");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const adapterCalls: unknown[] = [];

    const result = await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-open-range-adapter",
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
      confidence: 0.62,
      reason: "Range execution path.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async (input: unknown) => {
        adapterCalls.push(input);
        return {
          status: "confirmed",
          predictTxDigest: "0xrange_digest"
        };
      }
    });

    expect(result.status).toBe("executed");
    expect(adapterCalls).toEqual([
      {
        intentId: "intent_1",
        riskDecisionId: "risk_1",
        executionId: "exec_1",
        agentId: agent.id,
        walletId: wallet.id,
        predictOperation: "mint_range",
        predictPayload: {
          operation: "mint_range",
          market: {
            kind: "range",
            oracleId: "0xbtc15m",
            expiry: "2026-06-15T10:15:00.000Z",
            lowerStrike: "64000000000000",
            higherStrike: "66000000000000"
          },
          quantity: "10",
          maxCost: "5.00"
        }
      }
    ]);
  });

  it("maps Agent budgetRaw directional opens to backend-sized Predict adapter payloads", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Budget Directional Adapter");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const adapterCalls: unknown[] = [];

    const result = await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-budget-directional",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      budgetRaw: "5000000",
      confidence: 0.72,
      reason: "Agent supplies a DUSDC budget, not Predict quantity.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async (input: unknown) => {
        adapterCalls.push(input);
        return {
          status: "confirmed",
          predictTxDigest: "0xbudget_directional_digest"
        };
      }
    });

    expect(result.status).toBe("executed");
    expect(adapterCalls).toEqual([
      {
        intentId: "intent_1",
        riskDecisionId: "risk_1",
        executionId: "exec_1",
        agentId: agent.id,
        walletId: wallet.id,
        predictOperation: "mint_directional",
        predictPayload: {
          operation: "mint_directional",
          market: {
            kind: "directional",
            oracleId: "0xbtc15m",
            expiry: "2026-06-15T10:15:00.000Z",
            strike: "65000",
            isUp: true
          },
          quantity: "500000",
          maxCost: "5000000",
          budgetRaw: "5000000"
        }
      }
    ]);
  });

  it("defaults Agent range opens to a 5 DUSDC budget when sizing is omitted", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Default Budget Range Adapter");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const adapterCalls: unknown[] = [];

    const result = await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-default-budget-range",
      action: "open_range",
      market: {
        kind: "range",
        oracleId: "0xbtc15m",
        expiry: "2026-06-15T10:15:00.000Z",
        lowerStrike: "64000000000000",
        higherStrike: "66000000000000"
      },
      confidence: 0.62,
      reason: "Agent leaves sizing to the platform default budget.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async (input: unknown) => {
        adapterCalls.push(input);
        return {
          status: "confirmed",
          predictTxDigest: "0xdefault_budget_range_digest"
        };
      }
    });

    expect(result.status).toBe("executed");
    expect(adapterCalls).toEqual([
      {
        intentId: "intent_1",
        riskDecisionId: "risk_1",
        executionId: "exec_1",
        agentId: agent.id,
        walletId: wallet.id,
        predictOperation: "mint_range",
        predictPayload: {
          operation: "mint_range",
          market: {
            kind: "range",
            oracleId: "0xbtc15m",
            expiry: "2026-06-15T10:15:00.000Z",
            lowerStrike: "64000000000000",
            higherStrike: "66000000000000"
          },
          quantity: "500000",
          maxCost: "5000000",
          budgetRaw: "5000000"
        }
      }
    ]);
  });

  it("records a failed Predict adapter result without marking the intent executed", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Failed Adapter");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    const result = await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-failed-adapter",
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
      confidence: 0.72,
      reason: "Adapter returns failed.",
      createdAt: "2026-06-15T10:03:12.000Z"
    }, {
      predictExecutionAdapter: async () => ({
        status: "failed",
        predictTxDigest: "0xfailed_digest",
        errorCode: "PREDICT_MANAGER_NOT_READY",
        errorMessage: "PredictManager is missing for the Agent trading wallet"
      })
    });

    const [intent] = store.listIntents();
    const [execution] = store.listExecutions();

    expect(result).toMatchObject({
      status: "failed",
      intentId: "intent_1",
      riskDecisionId: "risk_1",
      executionId: "exec_1",
      predictTxDigest: "0xfailed_digest",
      rejectionCode: "PREDICT_MANAGER_NOT_READY"
    });
    expect(intent).toMatchObject({
      status: "failed",
      rejectionCode: "PREDICT_MANAGER_NOT_READY"
    });
    expect(execution).toMatchObject({
      status: "failed",
      predictTxDigest: "0xfailed_digest"
    });
  });

  it("records adapter exceptions as failed executions and makes idempotency replay queryable", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Throwing Adapter");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    let calls = 0;
    const payload = {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-throwing-adapter",
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
      confidence: 0.72,
      reason: "Adapter throws.",
      createdAt: "2026-06-15T10:03:12.000Z"
    };

    const first = await submitIntentWithMockExecution(store, payload, {
      predictExecutionAdapter: async () => {
        calls += 1;
        throw new Error("dry run rejected");
      }
    });
    const second = await submitIntentWithMockExecution(store, payload, {
      predictExecutionAdapter: async () => {
        calls += 1;
        return {
          status: "confirmed",
          predictTxDigest: "0xshould_not_run"
        };
      }
    });

    expect(first).toMatchObject({
      status: "failed",
      executionId: "exec_1",
      rejectionCode: "PREDICT_EXECUTION_FAILED"
    });
    expect(second).toEqual(first);
    expect(calls).toBe(1);
    expect(store.listIntents()[0]).toMatchObject({
      status: "failed",
      rejectionCode: "PREDICT_EXECUTION_FAILED"
    });
    expect(store.listExecutions()[0]).toMatchObject({
      status: "failed",
      predictTxDigest: null
    });
  });

  it("rejects a new trade intent while another trade execution is pending but still accepts hold", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store);
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    store.saveExecution({
      id: "exec_pending",
      intentId: "intent_pending",
      agentId: agent.id,
      competitionId: "btc-15m-001",
      riskDecisionId: "risk_pending",
      status: "queued",
      predictTxDigest: null,
      action: "open_directional",
      createdAt: "2026-06-15T10:03:00.000Z"
    });

    const blocked = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-pending-blocked",
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
      confidence: 0.7,
      reason: "Should wait for pending execution.",
      createdAt: "2026-06-15T10:04:12.000Z"
    });
    const hold = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-pending-hold",
      action: "hold",
      confidence: 0.4,
      reason: "Holding while previous execution settles.",
      createdAt: "2026-06-15T10:04:13.000Z"
    });

    expect(blocked).toMatchObject({
      status: "rejected",
      rejectionCode: "PENDING_EXECUTION_EXISTS"
    });
    expect(hold).toMatchObject({
      status: "accepted"
    });
  });

  it("maps range reduce and close intents to typed Predict adapter payloads", async () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Range Manager");
    const wallet = store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();
    const adapterCalls: unknown[] = [];
    const adapter = async (input: unknown) => {
      adapterCalls.push(input);
      return {
        status: "confirmed" as const,
        predictTxDigest: `0xdigest_${adapterCalls.length}`
      };
    };

    await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-reduce-range-adapter",
      action: "reduce",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000",
        openExecutionId: "exec_open",
        quantity: "10"
      },
      quantity: "4",
      minProceeds: "1",
      confidence: 0.58,
      reason: "Trim range.",
      createdAt: "2026-06-15T10:06:12.000Z"
    }, {
      predictExecutionAdapter: adapter
    });

    await submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-close-range-adapter",
      action: "close",
      positionRef: {
        kind: "range",
        rangeKey: "btc-range-64000-66000",
        openExecutionId: "exec_open"
      },
      minProceeds: "1",
      confidence: 0.52,
      reason: "Close range.",
      createdAt: "2026-06-15T10:07:12.000Z"
    }, {
      predictExecutionAdapter: adapter
    });

    expect(adapterCalls).toEqual([
      {
        intentId: "intent_1",
        riskDecisionId: "risk_1",
        executionId: "exec_1",
        agentId: agent.id,
        walletId: wallet.id,
        predictOperation: "redeem_range",
        predictPayload: {
          operation: "redeem_range",
          positionRef: {
            kind: "range",
            rangeKey: "btc-range-64000-66000",
            openExecutionId: "exec_open",
            quantity: "10"
          },
          quantity: "4",
          minProceeds: "1"
        }
      },
      {
        intentId: "intent_2",
        riskDecisionId: "risk_2",
        executionId: "exec_2",
        agentId: agent.id,
        walletId: wallet.id,
        predictOperation: "close_range",
        predictPayload: {
          operation: "close_range",
          positionRef: {
            kind: "range",
            rangeKey: "btc-range-64000-66000",
            openExecutionId: "exec_open"
          },
          minProceeds: "1"
        }
      }
    ]);
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

  it("accepts skill-sized raw DUSDC amounts under the MVP exposure cap", () => {
    const store = new PlatformMockStore();
    const agent = createClaimedTestAgent(store, "Skill Example Agent");
    store.bindTradingWallet(agent.id, "0xagentwallet");
    store.seedCompetition();

    const result = submitIntentWithMockExecution(store, {
      competitionId: "btc-15m-001",
      agentId: agent.id,
      idempotencyKey: "intent-skill-sized-raw",
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
      reason: "Matches the public skill example sizing.",
      createdAt: "2026-06-15T10:06:30.000Z"
    });

    expect(result.status).toBe("executed");
    expect(store.listExecutions()).toHaveLength(1);
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
