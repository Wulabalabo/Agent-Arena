import type { PolicyDriftClassification } from "./guardrails";
import type { PredictOperation, PredictOperationPlan } from "./transactions";
import type {
  InternalExecutionSource,
  InternalExecutionStatus,
  InternalSigningAuditStatus
} from "./types";

export interface InternalPredictExecution {
  id: string;
  walletId: string;
  agentId: string;
  source: InternalExecutionSource;
  operation: PredictOperation;
  operationPlan: PredictOperationPlan;
  managerId?: string;
  oracleId?: string;
  expiryMs?: string;
  marketKey?: string;
  rangeKey?: string;
  quantityRaw?: string;
  previewCostRaw?: string;
  previewPayoutRaw?: string;
  maxCostRaw?: string;
  minProceedsRaw?: string;
  actualCostRaw?: string;
  actualProceedsRaw?: string;
  policyDrift: PolicyDriftClassification;
  dryRunDigest?: string;
  txDigest?: string;
  status: InternalExecutionStatus;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  submittedAt?: string;
  confirmedAt?: string;
}

export interface InternalSigningAudit {
  id: string;
  walletId: string;
  agentId: string;
  executionId: string;
  operation: PredictOperation;
  transactionKind: string;
  txDigest?: string;
  status: InternalSigningAuditStatus;
  createdAt: string;
  errorCode?: string;
}

export type CreateExecutionInput = Omit<
  InternalPredictExecution,
  "id" | "source" | "createdAt" | "policyDrift"
> & {
  createdAt?: string;
  policyDrift?: PolicyDriftClassification;
};

export type UpdateExecutionInput = Partial<Omit<InternalPredictExecution, "id" | "createdAt">>;

export type CreateSigningAuditInput = Omit<InternalSigningAudit, "id" | "createdAt"> & {
  createdAt?: string;
};

export interface ListExecutionsFilter {
  walletId?: string;
}

export interface ListSigningAuditsFilter {
  walletId?: string;
  executionId?: string;
}

export interface MemoryExecutionStore {
  createExecution(input: CreateExecutionInput): Promise<InternalPredictExecution>;
  updateExecution(id: string, input: UpdateExecutionInput): Promise<InternalPredictExecution>;
  listExecutions(filter?: ListExecutionsFilter): Promise<InternalPredictExecution[]>;
  recordSigningAudit(input: CreateSigningAuditInput): Promise<InternalSigningAudit>;
  listSigningAudits(filter?: ListSigningAuditsFilter): Promise<InternalSigningAudit[]>;
}

export interface CreateMemoryExecutionStoreOptions {
  now?: () => string;
}

export function createMemoryExecutionStore(
  options: CreateMemoryExecutionStoreOptions = {}
): MemoryExecutionStore {
  const executions = new Map<string, InternalPredictExecution>();
  const signingAudits = new Map<string, InternalSigningAudit>();
  const now = options.now ?? (() => new Date().toISOString());
  let nextExecutionNumber = 1;
  let nextSigningAuditNumber = 1;

  return {
    async createExecution(input) {
      const id = `exec_internal_${String(nextExecutionNumber).padStart(3, "0")}`;
      nextExecutionNumber += 1;

      const execution: InternalPredictExecution = sanitizeCopy({
        ...input,
        id,
        source: "internal_probe",
        policyDrift: input.policyDrift ?? "unknown",
        createdAt: input.createdAt ?? now()
      });
      executions.set(id, execution);

      return sanitizeCopy(execution);
    },

    async updateExecution(id, input) {
      const existing = executions.get(id);
      if (!existing) {
        throw new Error("EXECUTION_NOT_FOUND");
      }

      const updated: InternalPredictExecution = sanitizeCopy({
        ...existing,
        ...input,
        id: existing.id,
        source: existing.source,
        createdAt: existing.createdAt
      });
      executions.set(id, updated);

      return sanitizeCopy(updated);
    },

    async listExecutions(filter = {}) {
      const records = Array.from(executions.values()).filter((execution) =>
        filter.walletId ? execution.walletId === filter.walletId : true
      );

      return sanitizeCopy(records);
    },

    async recordSigningAudit(input) {
      const id = `signing_audit_${String(nextSigningAuditNumber).padStart(3, "0")}`;
      nextSigningAuditNumber += 1;

      const audit: InternalSigningAudit = sanitizeCopy({
        ...input,
        id,
        createdAt: input.createdAt ?? now()
      });
      signingAudits.set(id, audit);

      return sanitizeCopy(audit);
    },

    async listSigningAudits(filter = {}) {
      const records = Array.from(signingAudits.values()).filter((audit) => {
        if (filter.walletId && audit.walletId !== filter.walletId) {
          return false;
        }
        if (filter.executionId && audit.executionId !== filter.executionId) {
          return false;
        }
        return true;
      });

      return sanitizeCopy(records);
    }
  };
}

const privateMaterialKeys = new Set([
  "privateKey",
  "encryptedPrivateKey",
  "secretKey",
  "walletSecret"
]);

function sanitizeCopy<T>(value: T): T {
  return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === "object" && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (privateMaterialKeys.has(key)) {
        continue;
      }
      sanitized[key] = sanitizeValue(nestedValue);
    }
    return sanitized;
  }

  return value;
}
