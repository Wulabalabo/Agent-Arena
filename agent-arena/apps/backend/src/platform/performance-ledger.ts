import { createHash } from "node:crypto";
import type { PerformanceLedgerRecord } from "./types";

export function createRegistrationCodeHash(registrationCode: string): string {
  const normalizedCode = registrationCode.trim();
  if (!normalizedCode) {
    throw new Error("REGISTRATION_CODE_REQUIRED");
  }

  return `sha256:${createHash("sha256").update(normalizedCode, "utf8").digest("hex")}`;
}

export function createPerformanceLedgerRecord(record: PerformanceLedgerRecord): PerformanceLedgerRecord {
  return { ...record };
}
