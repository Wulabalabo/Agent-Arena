import { describe, expect, it } from "vitest";
import { mockAgents, mockArenaRounds, mockUserBackings } from "../mock/arena";
import {
  cancelBacking,
  closeMintedBacking,
  createInitialArenaState,
  createOrUpdateDraft,
  getSelectedAgent,
  getSelectedRound,
  isRoundLocked,
  recordBackedPosition,
  selectAgent,
  selectRound,
  setAgentSort
} from "./arena";

describe("arena state", () => {
  it("createInitialArenaState selects first round and first agent", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    expect(getSelectedRound(state).id).toBe("round-btc-15m");
    expect(getSelectedAgent(state).id).toBe("volatility-sniper");
  });

  it("createInitialArenaState copies the top-level arrays by reference", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    expect(state.rounds).not.toBe(mockArenaRounds);
    expect(state.agents).not.toBe(mockAgents);
    expect(state.userBackings).not.toBe(mockUserBackings);
    expect(state.rounds).toEqual(mockArenaRounds);
    expect(state.agents).toEqual(mockAgents);
    expect(state.userBackings).toEqual(mockUserBackings);
  });

  it("selectRound selects the requested round and resets the selected agent to that round's first agent", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = selectRound(state, "round-eth-30m");

    expect(getSelectedRound(next).id).toBe("round-eth-30m");
    expect(getSelectedAgent(next).id).toBe("volatility-sniper");
  });

  it("selectRound returns the same state object when the round id is unchanged", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    expect(selectRound(state, state.selectedRoundId)).toBe(state);
  });

  it("selectAgent changes the selected agent", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = selectAgent(state, "mean-reversion-monk");

    expect(getSelectedAgent(next).id).toBe("mean-reversion-monk");
  });

  it("selectAgent returns the same state object when the agent id is unchanged", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    expect(selectAgent(state, state.selectedAgentId)).toBe(state);
  });

  it("setAgentSort returns the same state object when the sort mode is unchanged", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    expect(state.activeSort).toBe("leaderboard");
    expect(setAgentSort(state, "leaderboard")).toBe(state);
  });

  it("createOrUpdateDraft creates and updates a draft for an unlocked upcoming round", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    const created = createOrUpdateDraft(state, {
      roundId: "round-eth-30m",
      agentId: "mean-reversion-monk",
      amount: 125
    });

    expect(created.backingDraft).toEqual({
      roundId: "round-eth-30m",
      agentId: "mean-reversion-monk",
      amount: 125
    });

    const updated = createOrUpdateDraft(created, {
      roundId: "round-eth-30m",
      agentId: "mean-reversion-monk",
      amount: 175
    });

    expect(updated.backingDraft).toEqual({
      roundId: "round-eth-30m",
      agentId: "mean-reversion-monk",
      amount: 175
    });
  });

  it("createOrUpdateDraft refuses locking live settling and settled rounds", () => {
    const baseState = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const liveState = {
      ...baseState,
      selectedRoundId: mockArenaRounds[0].id
    };
    const settledState = {
      ...baseState,
      selectedRoundId: mockArenaRounds[2].id
    };
    const lockingRound = { ...mockArenaRounds[1], id: "round-eth-30m-locking", status: "locking" as const };
    const settlingRound = { ...mockArenaRounds[2], id: "round-sui-1h-settling", status: "settling" as const };
    const lockedState = {
      ...baseState,
      rounds: [mockArenaRounds[0], lockingRound, settlingRound],
      selectedRoundId: lockingRound.id
    };

    expect(
      createOrUpdateDraft(lockedState, {
        roundId: lockingRound.id,
        agentId: "mean-reversion-monk",
        amount: 50
      })
    ).toBe(lockedState);

    expect(
      createOrUpdateDraft(liveState, {
        roundId: mockArenaRounds[0].id,
        agentId: "volatility-sniper",
        amount: 50
      })
    ).toBe(liveState);

    const settlingState = {
      ...baseState,
      rounds: [mockArenaRounds[0], lockingRound, settlingRound],
      selectedRoundId: settlingRound.id
    };

    expect(
      createOrUpdateDraft(settlingState, {
        roundId: settlingRound.id,
        agentId: "liquidity-sense",
        amount: 50
      })
    ).toBe(settlingState);

    expect(
      createOrUpdateDraft(settledState, {
        roundId: mockArenaRounds[2].id,
        agentId: "liquidity-sense",
        amount: 50
      })
    ).toBe(settledState);
  });

  it("createOrUpdateDraft returns the same state on a locked round even when the agent id is stale", () => {
    const baseState = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const lockedRound = { ...mockArenaRounds[0], id: "round-btc-15m-locked", status: "locking" as const };
    const lockedState = {
      ...baseState,
      rounds: [lockedRound, ...mockArenaRounds.slice(1)],
      selectedRoundId: lockedRound.id
    };

    expect(
      createOrUpdateDraft(lockedState, {
        roundId: lockedRound.id,
        agentId: "missing-agent-id",
        amount: 50
      })
    ).toBe(lockedState);
  });

  it("recordBackedPosition adds a backed position with attribution metadata and clears the draft", () => {
    const state = createOrUpdateDraft(createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings), {
      roundId: "round-eth-30m",
      agentId: "volatility-sniper",
      amount: 100
    });

    const next = recordBackedPosition(state, {
      roundId: "round-eth-30m",
      agentId: "volatility-sniper",
      userAddress: "0xuser",
      managerId: "0xmanager",
      amount: 100,
      predictTxDigest: "0xdigest",
      attributionId: "attr_0xdigest_volatility-sniper",
      attributionStatus: "submitted",
      attributionError: null,
      predictPositionType: "directional",
      marketKey: "ETH_30m_LOCAL_DIRECTION",
      rangeKey: null
    });

    expect(next.backingDraft).toBeNull();
    expect(next.userBackings).toHaveLength(state.userBackings.length + 1);
    expect(next.userBackings.at(-1)).toMatchObject({
      id: "backing-round-eth-30m-volatility-sniper-0xdigest",
      userAddress: "0xuser",
      managerId: "0xmanager",
      roundId: "round-eth-30m",
      agentId: "volatility-sniper",
      amount: 100,
      status: "backed",
      predictTxDigest: "0xdigest",
      attributionId: "attr_0xdigest_volatility-sniper",
      attributionStatus: "submitted",
      attributionError: null,
      predictPositionType: "directional",
      marketKey: "ETH_30m_LOCAL_DIRECTION",
      rangeKey: null
    });
  });

  it("recordBackedPosition replaces an existing round and agent backing", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const created = recordBackedPosition(state, {
      roundId: "round-eth-30m",
      agentId: "volatility-sniper",
      userAddress: "0xuser",
      managerId: "0xmanager",
      amount: 100,
      predictTxDigest: "0xdigest",
      attributionId: "attr_0xdigest_volatility-sniper",
      attributionStatus: "submitted",
      attributionError: null,
      predictPositionType: "directional",
      marketKey: "ETH_30m_LOCAL_DIRECTION",
      rangeKey: null
    });

    const updated = recordBackedPosition(created, {
      roundId: "round-eth-30m",
      agentId: "volatility-sniper",
      userAddress: "0xuser",
      managerId: "0xmanager",
      amount: 150,
      predictTxDigest: "0xupdated",
      attributionId: "attr_0xupdated_volatility-sniper",
      attributionStatus: "submitted",
      attributionError: null,
      predictPositionType: "directional",
      marketKey: "ETH_30m_LOCAL_DIRECTION",
      rangeKey: null
    });

    expect(updated.userBackings).toHaveLength(created.userBackings.length);
    expect(
      updated.userBackings.find(
        (backing) => backing.roundId === "round-eth-30m" && backing.agentId === "volatility-sniper"
      )
    ).toMatchObject({
      amount: 150,
      predictTxDigest: "0xupdated",
      attributionId: "attr_0xupdated_volatility-sniper"
    });
  });

  it("recordBackedPosition returns the same state for locked rounds", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);

    expect(
      recordBackedPosition(state, {
        roundId: "round-btc-15m",
        agentId: "volatility-sniper",
        userAddress: "0xuser",
        managerId: "0xmanager",
        amount: 100,
        predictTxDigest: "0xdigest",
        attributionId: "attr_0xdigest_volatility-sniper",
        attributionStatus: "submitted",
        attributionError: null,
        predictPositionType: "directional",
        marketKey: "BTC_15m_LOCAL_DIRECTION",
        rangeKey: null
      })
    ).toBe(state);
  });

  it("cancelBacking cancels only a mock unsubmitted draft backing before lock", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = cancelBacking(state, "backing-draft-directional");

    expect(next.userBackings.find((backing) => backing.id === "backing-draft-directional")).toMatchObject({
      status: "cancelled",
      updatedAt: "2026-06-09T15:10:00+08:00"
    });
  });

  it("cancelBacking cancels a pending_signature backing without a digest on the unlocked upcoming round", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const pendingBacking = {
      ...mockUserBackings[1],
      id: "backing-pending-signature-no-digest",
      roundId: "round-eth-30m",
      status: "pending_signature" as const,
      predictTxDigest: null
    };
    const nextState = {
      ...state,
      userBackings: [...state.userBackings, pendingBacking]
    };

    const next = cancelBacking(nextState, "backing-pending-signature-no-digest");

    expect(next.userBackings.find((backing) => backing.id === "backing-pending-signature-no-digest")).toMatchObject({
      status: "cancelled",
      updatedAt: "2026-06-09T15:10:00+08:00",
      predictTxDigest: null
    });
  });

  it("cancelBacking does not cancel a pending_signature backing with a digest", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const pendingBacking = {
      ...mockUserBackings[1],
      id: "backing-pending-signature-with-digest",
      roundId: "round-eth-30m",
      status: "pending_signature" as const,
      predictTxDigest: "0xpending-signature-digest"
    };
    const nextState = {
      ...state,
      userBackings: [...state.userBackings, pendingBacking]
    };

    const next = cancelBacking(nextState, "backing-pending-signature-with-digest");

    expect(next.userBackings.find((backing) => backing.id === "backing-pending-signature-with-digest")).toMatchObject({
      status: "pending_signature",
      updatedAt: pendingBacking.updatedAt,
      predictTxDigest: "0xpending-signature-digest"
    });
  });

  it("cancelBacking does not cancel submitted backing without a digest", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const submittedBacking = {
      ...mockUserBackings[1],
      id: "backing-submitted-no-digest",
      status: "submitted" as const,
      predictTxDigest: null
    };
    const nextState = {
      ...state,
      userBackings: [...state.userBackings, submittedBacking]
    };

    const next = cancelBacking(nextState, "backing-submitted-no-digest");

    expect(next.userBackings.find((backing) => backing.id === "backing-submitted-no-digest")).toMatchObject({
      status: "submitted",
      updatedAt: submittedBacking.updatedAt,
      predictTxDigest: null
    });
  });

  it("cancelBacking does not cancel already minted backing", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = cancelBacking(state, "backing-live-range");

    expect(next.userBackings.find((backing) => backing.id === "backing-live-range")?.status).toBe("live");
  });

  it("closeMintedBacking changes a minted live backing to redeemable", () => {
    const state = createInitialArenaState(mockArenaRounds, mockAgents, mockUserBackings);
    const next = closeMintedBacking(state, "backing-live-range");

    expect(next.userBackings.find((backing) => backing.id === "backing-live-range")).toMatchObject({
      status: "redeemable",
      updatedAt: "2026-06-09T15:10:00+08:00"
    });
  });

  it("isRoundLocked returns false for upcoming and true for locking live settling and settled", () => {
    const upcomingRound = { ...mockArenaRounds[1], id: "round-eth-30m-upcoming", status: "upcoming" as const };
    const lockingRound = { ...mockArenaRounds[1], id: "round-eth-30m-locking", status: "locking" as const };
    const liveRound = { ...mockArenaRounds[0], id: "round-btc-15m-live", status: "live" as const };
    const settlingRound = { ...mockArenaRounds[2], id: "round-sui-1h-settling", status: "settling" as const };
    const settledRound = { ...mockArenaRounds[2], id: "round-sui-1h-settled", status: "settled" as const };

    expect(isRoundLocked(upcomingRound)).toBe(false);
    expect(isRoundLocked(lockingRound)).toBe(true);
    expect(isRoundLocked(liveRound)).toBe(true);
    expect(isRoundLocked(settlingRound)).toBe(true);
    expect(isRoundLocked(settledRound)).toBe(true);
  });
});
