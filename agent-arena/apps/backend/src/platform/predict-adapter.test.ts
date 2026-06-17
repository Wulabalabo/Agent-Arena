import { describe, expect, it } from "bun:test";
import {
  createPredictExecutionAdapter,
  mapPredictIntentToInternalRequest
} from "./predict-adapter";
import type { PredictIntentExecutionAdapterInput } from "./execution";

describe("Agent-facing Predict adapter", () => {
  it("maps an open directional intent to an internal mint request", () => {
    const request = mapPredictIntentToInternalRequest(openDirectionalInput(), {
      managerId: "0xmanager"
    });

    expect(request).toEqual({
      walletId: "wallet_internal_001",
      operation: "mint_directional",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      expiryMs: "1781701200000",
      strikeRaw: "65000000000000",
      isUp: true,
      quantityRaw: "10",
      maxCostRaw: "500",
      dryRunOnly: false
    });
  });

  it("maps a range close through a backend position resolver and omits caller quantity", () => {
    const request = mapPredictIntentToInternalRequest({
      ...openDirectionalInput(),
      predictOperation: "close_range",
      predictPayload: {
        operation: "close_range",
        positionRef: {
          kind: "range",
          rangeKey: "btc-range-64000-66000-1781701200000",
          openExecutionId: "exec_1"
        },
        minProceeds: "1"
      }
    }, {
      managerId: "0xmanager",
      resolvePosition: () => ({
        kind: "range",
        oracleId: "0xoracle",
        expiryMs: "1781701200000",
        lowerStrikeRaw: "64000000000000",
        higherStrikeRaw: "66000000000000",
        quantityRaw: "10"
      })
    });

    expect(request).toEqual({
      walletId: "wallet_internal_001",
      operation: "close_range",
      managerId: "0xmanager",
      oracleId: "0xoracle",
      expiryMs: "1781701200000",
      lowerStrikeRaw: "64000000000000",
      higherStrikeRaw: "66000000000000",
      minProceedsRaw: "1",
      dryRunOnly: false
    });
    expect(request).not.toHaveProperty("quantityRaw");
  });

  it("invokes the injected internal execution function and returns structured failures", async () => {
    const adapter = createPredictExecutionAdapter({
      managerId: "0xmanager",
      executeInternalPredict: async (request) => ({
        error: {
          code: "PREDICT_TX_FAILED",
          message: "Predict rejected the quote.",
          request
        }
      })
    });

    await expect(adapter(openDirectionalInput())).resolves.toEqual({
      status: "failed",
      predictTxDigest: null,
      errorCode: "PREDICT_TX_FAILED",
      errorMessage: "Predict rejected the quote."
    });
  });
});

function openDirectionalInput(): PredictIntentExecutionAdapterInput {
  return {
    intentId: "intent_1",
    riskDecisionId: "risk_1",
    executionId: "exec_1",
    agentId: "agent_1",
    walletId: "wallet_internal_001",
    predictOperation: "mint_directional",
    predictPayload: {
      operation: "mint_directional",
      market: {
        kind: "directional",
        oracleId: "0xoracle",
        expiry: "1781701200000",
        strike: "65000000000000",
        isUp: true
      },
      quantity: "10",
      maxCost: "500"
    }
  };
}
