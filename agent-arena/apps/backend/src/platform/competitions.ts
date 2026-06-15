import type { RoundStatus } from "./types";

export type OracleState = "Inactive" | "Active" | "PendingSettlement" | "Settled";

export interface RoundStatusInput {
  platformStatus: RoundStatus;
  oracleState: OracleState;
}

export interface AllowedOperations {
  canOpen: boolean;
  canClose: boolean;
}

const allowedOperationsByStatus: Record<RoundStatus, AllowedOperations> = {
  pre_open: {
    canOpen: false,
    canClose: false
  },
  live: {
    canOpen: true,
    canClose: true
  },
  expired: {
    canOpen: false,
    canClose: true
  },
  settled: {
    canOpen: false,
    canClose: false
  }
};

export function resolveRoundStatus({ platformStatus, oracleState }: RoundStatusInput): RoundStatus {
  switch (oracleState) {
    case "Inactive":
      return platformStatus === "live" ? "pre_open" : platformStatus;
    case "Active":
      return platformStatus === "live" ? "live" : platformStatus;
    case "PendingSettlement":
      return platformStatus === "settled" ? "settled" : "expired";
    case "Settled":
      return "settled";
  }
}

export function getAllowedOperations(status: RoundStatus): AllowedOperations {
  return { ...allowedOperationsByStatus[status] };
}
