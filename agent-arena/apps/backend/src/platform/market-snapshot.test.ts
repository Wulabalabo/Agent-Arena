import { describe, expect, it } from "bun:test";
import { createMockCompetition } from "./types";
import { createMarketSnapshot } from "./market-snapshot";

describe("market snapshot", () => {
  it("exposes executable market identifiers and late-window flags without signing", () => {
    const competition = createMockCompetition("btc-15m-001");
    const snapshot = createMarketSnapshot(
      competition,
      Date.parse("2026-06-15T10:14:30.000Z")
    );

    expect(snapshot).toMatchObject({
      competitionId: "btc-15m-001",
      status: "live",
      oracleId: "0xbtc15m",
      oracleStatus: "active",
      expiryMs: String(Date.parse("2026-06-15T10:15:00.000Z")),
      underlyingAsset: "BTC",
      priceDecimals: 9,
      executableMarkets: {
        directional: {
          oracleId: "0xbtc15m",
          expiry: String(Date.parse("2026-06-15T10:15:00.000Z")),
          strike: "65000000000000"
        }
      },
      allowedActions: [
        "hold",
        "open_directional",
        "open_range",
        "reduce",
        "close"
      ],
      lateWindow: {
        isFinalMinute: true,
        openAllowedByPlatform: true,
        openMayFailOnPredictQuote: true
      }
    });
    expect(snapshot.strikeGrid.minStrikeRaw).toMatch(/^\d+$/);
    expect(snapshot.spotPriceRaw).toMatch(/^\d+$/);
    expect(JSON.stringify(snapshot)).not.toContain("privateKey");
  });
});
