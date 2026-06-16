import { describe, expect, it } from "bun:test";
import { createMemoryExecutionStore } from "./execution-store";

const createdAt = "2026-06-17T00:00:00.000Z";

describe("memory internal execution store", () => {
  it("creates internal execution records with stable ids and defensive copies", async () => {
    const store = createMemoryExecutionStore({ now: () => createdAt });

    const execution = await store.createExecution({
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      operation: "mint_directional",
      status: "planned",
      operationPlan: {
        operation: "mint_directional",
        moveTargets: ["market_key::up", "predict::mint"],
        keyInputs: {
          direction: "up",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000"
        },
        objectIds: {
          oracleId: "0xoracle"
        },
        expiryMs: "1780000000000",
        quantityRaw: "100000",
        maxCostRaw: "1000000"
      }
    });

    expect(execution).toMatchObject({
      id: "exec_internal_001",
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      source: "internal_probe",
      status: "planned",
      createdAt
    });
    expect(JSON.stringify(execution)).not.toContain("privateKey");
    expect(JSON.stringify(execution)).not.toContain("encryptedPrivateKey");

    execution.operationPlan.moveTargets.push("mutated::target");
    const listed = await store.listExecutions();

    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toBe(execution);
    expect(listed[0]!.operationPlan.moveTargets).toEqual(["market_key::up", "predict::mint"]);
  });

  it("updates execution records without mutating stored state through caller references", async () => {
    const store = createMemoryExecutionStore({ now: () => createdAt });
    const execution = await store.createExecution({
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      operation: "mint_directional",
      status: "planned",
      operationPlan: {
        operation: "mint_directional",
        moveTargets: ["market_key::up", "predict::mint"],
        keyInputs: {
          direction: "up",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000"
        },
        objectIds: {},
        expiryMs: "1780000000000",
        quantityRaw: "100000",
        maxCostRaw: "1000000"
      }
    });

    const updated = await store.updateExecution(execution.id, {
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      errorMessage: "Real Predict submit is disabled for this task."
    });
    updated.errorMessage = "mutated";

    await expect(store.listExecutions()).resolves.toMatchObject([
      {
        id: "exec_internal_001",
        status: "failed",
        errorCode: "PREDICT_SUBMIT_DISABLED",
        errorMessage: "Real Predict submit is disabled for this task."
      }
    ]);
  });

  it("filters executions by wallet id", async () => {
    const store = createMemoryExecutionStore({ now: () => createdAt });

    await store.createExecution({
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      operation: "mint_directional",
      status: "planned",
      operationPlan: {
        operation: "mint_directional",
        moveTargets: ["market_key::up", "predict::mint"],
        keyInputs: {
          direction: "up",
          strikeRaw: "65000000000000",
          expiryMs: "1780000000000"
        },
        objectIds: {},
        expiryMs: "1780000000000",
        quantityRaw: "100000",
        maxCostRaw: "1000000"
      }
    });
    await store.createExecution({
      walletId: "wallet_internal_002",
      agentId: "agent_internal_002",
      operation: "redeem_directional",
      status: "planned",
      operationPlan: {
        operation: "redeem_directional",
        moveTargets: ["market_key::new", "predict::redeem"],
        keyInputs: {
          direction: "down",
          strikeRaw: "64000000000000",
          expiryMs: "1780000000000"
        },
        objectIds: {},
        expiryMs: "1780000000000",
        quantityRaw: "50000",
        minProceedsRaw: "1"
      }
    });

    await expect(store.listExecutions({ walletId: "wallet_internal_001" })).resolves.toMatchObject([
      {
        id: "exec_internal_001",
        walletId: "wallet_internal_001"
      }
    ]);
  });

  it("records signing audit entries with stable ids and no key material", async () => {
    const store = createMemoryExecutionStore({ now: () => createdAt });

    const audit = await store.recordSigningAudit({
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      executionId: "exec_internal_001",
      operation: "mint_directional",
      transactionKind: "predict_submit_disabled",
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED"
    });

    expect(audit).toEqual({
      id: "signing_audit_001",
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      executionId: "exec_internal_001",
      operation: "mint_directional",
      transactionKind: "predict_submit_disabled",
      status: "failed",
      errorCode: "PREDICT_SUBMIT_DISABLED",
      createdAt
    });
    expect(JSON.stringify(audit)).not.toContain("privateKey");
    expect(JSON.stringify(audit)).not.toContain("encryptedPrivateKey");
  });
});
