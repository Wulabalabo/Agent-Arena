import { describe, expect, it, vi } from "vitest";
import { predictConfig } from "./config";
import { loadLiveBtcMarketSnapshot, refreshLiveBtcMarketPrice } from "./live-market";
import type { PredictStatus } from "./types";

describe("loadLiveBtcMarketSnapshot", () => {
  it("selects the nearest future active BTC oracle and normalizes price and betting events", async () => {
    const client = {
      getStatus: vi.fn(async (): Promise<PredictStatus> => ({
        status: "OK",
        current_time_ms: 1781622000000,
        latest_onchain_checkpoint: 349166000
      })),
      getPredictOracles: vi.fn(async () => [
        {
          oracle_id: "0xstale-active",
          underlying_asset: "BTC",
          expiry: 1781621000000,
          status: "active"
        },
        {
          oracle_id: "0xfuture-later",
          underlying_asset: "BTC",
          expiry: 1781623800000,
          status: "active"
        },
        {
          oracle_id: "0xfuture-nearest",
          underlying_asset: "BTC",
          expiry: 1781622900000,
          status: "active"
        },
        {
          oracle_id: "0xeth",
          underlying_asset: "ETH",
          expiry: 1781622500000,
          status: "active"
        }
      ]),
      getOracleState: vi.fn(async () => ({
        oracle: {
          oracle_id: "0xfuture-nearest",
          expiry: 1781622900000,
          tick_size: 1000000000
        },
        latest_price: {
          spot: 65611517258518,
          forward: 65611186326705,
          onchain_timestamp: 1781622054893,
          checkpoint_timestamp_ms: 1781622055034,
          checkpoint: 349166156
        }
      })),
      getOracleTrades: vi.fn(async () => [
        {
          event_digest: "trade_digest",
          checkpoint_timestamp_ms: 1781622055000,
          oracle_id: "0xfuture-nearest",
          expiry: 1781622900000,
          strike: 65611000000000,
          is_up: true,
          quantity: 200000,
          cost: 1250000,
          ask_price: 625000000
        }
      ]),
      getMintedPositions: vi.fn(async () => [
        {
          event_digest: "mint_digest",
          checkpoint_timestamp_ms: 1781622054000,
          oracle_id: "0xfuture-later",
          expiry: 1781623800000,
          strike: 65650000000000,
          is_up: false,
          quantity: 100000,
          cost: 8006,
          ask_price: 80060678
        }
      ]),
      getRedeemedPositions: vi.fn(async () => [
        {
          event_digest: "redeem_digest",
          checkpoint_timestamp_ms: 1781622053000,
          oracle_id: "0xfuture-later",
          expiry: 1781623800000,
          strike: 65670000000000,
          is_up: true,
          quantity: 5359973,
          payout: 2462561,
          bid_price: 459435336,
          is_settled: false
        }
      ]),
      getMintedRanges: vi.fn(async () => [
        {
          event_digest: "range_mint_digest",
          checkpoint_timestamp_ms: 1781622052000,
          oracle_id: "0xfuture-later",
          expiry: 1781623800000,
          lower_strike: 65600000000000,
          higher_strike: 65700000000000,
          quantity: 1561578,
          cost: 1042813,
          ask_price: 667794894
        }
      ]),
      getRedeemedRanges: vi.fn(async () => [
        {
          event_digest: "range_redeem_digest",
          checkpoint_timestamp_ms: 1781622051000,
          oracle_id: "0xfuture-later",
          expiry: 1781623800000,
          lower_strike: 65500000000000,
          higher_strike: 65750000000000,
          quantity: 100000000,
          payout: 10104242,
          bid_price: 101042420,
          is_settled: false
        }
      ])
    };

    const snapshot = await loadLiveBtcMarketSnapshot({ client, config: predictConfig });

    expect(client.getOracleState).toHaveBeenCalledWith("0xfuture-nearest");
    expect(client.getOracleTrades).toHaveBeenCalledWith("0xfuture-nearest");
    expect(snapshot.health).toBe("ready");
    expect(snapshot.oracle?.oracleId).toBe("0xfuture-nearest");
    expect(snapshot.oracle?.expiresAt).toBe("2026-06-16T15:15:00.000Z");
    expect(snapshot.oracle?.secondsToExpiry).toBe(900);
    expect(snapshot.price?.spot).toBe(65611.517258518);
    expect(snapshot.price?.forward).toBe(65611.186326705);
    expect(snapshot.price?.updatedAt).toBe("2026-06-16T15:00:54.893Z");
    expect(snapshot.currentOracleTradeCount).toBe(1);
    expect(snapshot.events.map((event) => event.kind)).toEqual([
      "oracle_trade",
      "position_minted",
      "position_redeemed",
      "range_minted",
      "range_redeemed"
    ]);
    expect(snapshot.events[0]).toMatchObject({
      digest: "trade_digest",
      strikeRaw: "65611000000000",
      strike: 65611,
      quantityRaw: "200000",
      quoteAmount: 1.25,
      probabilityPrice: 0.625,
      direction: "UP"
    });
    expect(snapshot.events[1]).toMatchObject({
      digest: "mint_digest",
      strikeRaw: "65650000000000",
      strike: 65650,
      quantityRaw: "100000",
      quoteAmount: 0.008006,
      probabilityPrice: 0.080060678,
      direction: "DOWN"
    });
    expect(snapshot.events[3]).toMatchObject({
      lowerStrikeRaw: "65600000000000",
      lowerStrike: 65600,
      higherStrikeRaw: "65700000000000",
      higherStrike: 65700,
      quantityRaw: "1561578",
      quoteAmount: 1.042813
    });
  });

  it("returns a degraded snapshot without fetching oracle state when no future BTC oracle exists", async () => {
    const client = {
      getStatus: vi.fn(async (): Promise<PredictStatus> => ({
        status: "OK",
        current_time_ms: 1781622000000
      })),
      getPredictOracles: vi.fn(async () => [
        {
          oracle_id: "0xsettled",
          underlying_asset: "BTC",
          expiry: 1781621000000,
          status: "settled"
        }
      ]),
      getOracleState: vi.fn(),
      getOracleTrades: vi.fn(),
      getMintedPositions: vi.fn(),
      getRedeemedPositions: vi.fn(),
      getMintedRanges: vi.fn(),
      getRedeemedRanges: vi.fn()
    };

    const snapshot = await loadLiveBtcMarketSnapshot({ client, config: predictConfig });

    expect(client.getOracleState).not.toHaveBeenCalled();
    expect(client.getOracleTrades).not.toHaveBeenCalled();
    expect(snapshot.health).toBe("degraded");
    expect(snapshot.oracle).toBeNull();
    expect(snapshot.price).toBeNull();
    expect(snapshot.events).toEqual([]);
  });

  it("refreshes only server time and oracle price for an existing live snapshot", async () => {
    const previousSnapshot = await loadLiveBtcMarketSnapshot({
      client: {
        getStatus: vi.fn(async (): Promise<PredictStatus> => ({
          status: "OK",
          current_time_ms: 1781622000000
        })),
        getPredictOracles: vi.fn(async () => [
          {
            oracle_id: "0xfuture-nearest",
            underlying_asset: "BTC",
            expiry: 1781622900000,
            status: "active"
          }
        ]),
        getOracleState: vi.fn(async () => ({
          latest_price: {
            spot: 65600000000000,
            forward: 65599000000000,
            onchain_timestamp: 1781622000000
          }
        })),
        getOracleTrades: vi.fn(async () => []),
        getMintedPositions: vi.fn(async () => [
          {
            event_digest: "mint_digest",
            checkpoint_timestamp_ms: 1781621999000,
            oracle_id: "0xfuture-nearest",
            expiry: 1781622900000,
            strike: 65600000000000,
            is_up: true,
            quantity: 100000,
            cost: 1000000,
            ask_price: 500000000
          }
        ]),
        getRedeemedPositions: vi.fn(async () => []),
        getMintedRanges: vi.fn(async () => []),
        getRedeemedRanges: vi.fn(async () => [])
      },
      config: predictConfig
    });
    const client = {
      getStatus: vi.fn(async (): Promise<PredictStatus> => ({
        status: "OK",
        current_time_ms: 1781622000500
      })),
      getOracleState: vi.fn(async () => ({
        latest_price: {
          spot: 65601000000000,
          forward: 65600500000000,
          onchain_timestamp: 1781622000500,
          checkpoint: 349166200
        }
      }))
    };

    const snapshot = await refreshLiveBtcMarketPrice({
      client,
      snapshot: previousSnapshot
    });

    expect(client.getStatus).toHaveBeenCalledTimes(1);
    expect(client.getOracleState).toHaveBeenCalledWith("0xfuture-nearest");
    expect(snapshot.price?.spot).toBe(65601);
    expect(snapshot.price?.forward).toBe(65600.5);
    expect(snapshot.serverTime).toBe("2026-06-16T15:00:00.500Z");
    expect(snapshot.oracle?.secondsToExpiry).toBe(900);
    expect(snapshot.events).toEqual(previousSnapshot.events);
  });
});
