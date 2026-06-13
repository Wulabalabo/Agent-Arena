import type { Agent, ArenaRound } from "../../types/arena";
import type { CreateAttributionInput } from "./client";

export interface BuildCreateAttributionInputOptions {
  round: ArenaRound;
  agent: Agent;
  amount: number;
  digest: string;
  userAddress: string;
  managerId: string;
}

export function buildCreateAttributionInput({
  round,
  agent,
  amount,
  digest,
  userAddress,
  managerId
}: BuildCreateAttributionInputOptions): CreateAttributionInput {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (!digest) {
    throw new Error("digest is required");
  }

  const base = {
    userAddress,
    managerId,
    roundId: round.id,
    agentId: agent.id,
    oracleId: round.predictOracleId,
    digest,
    amount,
    strategySnapshot: `${agent.name} / ${agent.strategyType} / ${round.id} / ${amount}`
  };

  if (agent.supportedPositionTypes.includes("range")) {
    return {
      ...base,
      predictPositionType: "range",
      marketKey: null,
      rangeKey: `${round.marketSymbol}_${round.durationLabel}_LOCAL_RANGE`
    };
  }

  return {
    ...base,
    predictPositionType: "directional",
    marketKey: `${round.marketSymbol}_${round.durationLabel}_LOCAL_DIRECTION`,
    rangeKey: null
  };
}
