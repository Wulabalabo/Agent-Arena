import { describe, expect, it } from "bun:test";
import {
  confirmOracleForExecution,
  normalizePredictOracle,
  PredictOracleError,
  selectNearestFutureBtcOracle
} from "./oracle";
import { createPredictServerClient } from "./predict-server-client";

const validOracle = {
  oracleId: "0xbtc-nearest",
  underlyingAsset: "BTC",
  expiryMs: 1781622900000,
  status: "active",
  strikeGrid: {
    minStrikeRaw: "65500000000000",
    maxStrikeRaw: "65700000000000",
    strikeStepRaw: "100000000000"
  }
};

const validSuiRpcOracle = {
  data: {
    objectId: "0xbtc-nearest",
    version: "42",
    content: {
      fields: {
        predict_id: "0xpredict",
        underlying_asset: "BTC",
        expiry: "1781622900000",
        status: "active",
        strike_grid: {
          min_strike: "65500000000000",
          max_strike: "65700000000000",
          strike_step: "100000000000"
        }
      }
    }
  }
};

const suiRpcOracleWithMoveUid = {
  data: {
    objectId: "0xbtc-nearest",
    version: "42",
    content: {
      fields: {
        id: {
          id: "0xmove-uid"
        },
        predict_id: "0xpredict",
        underlying_asset: "BTC",
        expiry: "1781622900000",
        status: "active",
        strike_grid: {
          min_strike: "65500000000000",
          max_strike: "65700000000000",
          strike_step: "100000000000"
        }
      }
    }
  }
};

describe("selectNearestFutureBtcOracle", () => {
  it("selects the nearest future active BTC oracle from a mixed list", () => {
    const selected = selectNearestFutureBtcOracle({
      serverTimeMs: 1781622000000,
      oracles: [
        {
          ...validOracle,
          oracleId: "0xbtc-later",
          expiryMs: 1781623800000
        },
        {
          ...validOracle,
          oracleId: "0xeth-nearest",
          underlyingAsset: "ETH",
          expiryMs: 1781622500000
        },
        {
          ...validOracle,
          oracleId: "0xbtc-inactive",
          expiryMs: 1781622300000,
          status: "settled"
        },
        validOracle
      ]
    });

    expect(selected?.oracleId).toBe("0xbtc-nearest");
  });

  it("ignores stale active BTC oracles whose expiry is before or equal to serverTimeMs", () => {
    const selected = selectNearestFutureBtcOracle({
      serverTimeMs: 1781622000000,
      oracles: [
        {
          ...validOracle,
          oracleId: "0xbtc-stale",
          expiryMs: 1781621000000
        },
        {
          ...validOracle,
          oracleId: "0xbtc-equal",
          expiryMs: 1781622000000
        },
        {
          ...validOracle,
          oracleId: "0xbtc-future",
          expiryMs: 1781622100000
        }
      ]
    });

    expect(selected?.oracleId).toBe("0xbtc-future");
  });

  it("ignores non-BTC and inactive oracles", () => {
    const selected = selectNearestFutureBtcOracle({
      serverTimeMs: 1781622000000,
      oracles: [
        {
          ...validOracle,
          oracleId: "0xeth-active",
          underlyingAsset: "ETH",
          expiryMs: 1781622100000
        },
        {
          ...validOracle,
          oracleId: "0xbtc-settled",
          expiryMs: 1781622200000,
          status: "settled"
        }
      ]
    });

    expect(selected).toBeNull();
  });
});

describe("normalizePredictOracle", () => {
  it("handles a realistic snake_case server payload", () => {
    const normalized = normalizePredictOracle({
      oracle_id: "0xserver-oracle",
      underlying_asset: "btc",
      expiry: "1781622900000",
      status: "ACTIVE",
      strike_grid: {
        min_strike: "65500000000000",
        max_strike: "65700000000000",
        strike_step: "100000000000"
      }
    });

    expect(normalized).toMatchObject({
      oracleId: "0xserver-oracle",
      underlyingAsset: "BTC",
      expiryMs: 1781622900000,
      status: "active",
      strikeGrid: {
        minStrikeRaw: "65500000000000",
        maxStrikeRaw: "65700000000000",
        strikeStepRaw: "100000000000"
      }
    });
  });

  it("handles a realistic Sui RPC payload with object metadata and content fields", () => {
    const normalized = normalizePredictOracle(validSuiRpcOracle);

    expect(normalized).toMatchObject({
      oracleId: "0xbtc-nearest",
      version: "42",
      predictId: "0xpredict",
      underlyingAsset: "BTC",
      expiryMs: 1781622900000,
      status: "active",
      strikeGrid: {
        minStrikeRaw: "65500000000000",
        maxStrikeRaw: "65700000000000",
        strikeStepRaw: "100000000000"
      }
    });
  });

  it("prefers Sui object metadata over nested Move UID id objects", () => {
    const normalized = normalizePredictOracle(suiRpcOracleWithMoveUid);

    expect(normalized).toMatchObject({
      oracleId: "0xbtc-nearest",
      version: "42",
      predictId: "0xpredict",
      underlyingAsset: "BTC",
      expiryMs: 1781622900000,
      status: "active"
    });
  });
});

describe("confirmOracleForExecution", () => {
  it("rejects server/onchain expiry mismatch with ORACLE_MISMATCH", async () => {
    await expect(confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000
      },
      readOracle: async () => ({
        ...validOracle,
        expiryMs: 1781623800000
      })
    })).rejects.toThrow("ORACLE_MISMATCH");
  });

  it("accepts a matching active BTC oracle with a valid strike grid", async () => {
    const confirmed = await confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000
      },
      readOracle: async () => validOracle
    });

    expect(confirmed).toMatchObject({
      oracleId: "0xbtc-nearest",
      underlyingAsset: "BTC",
      expiryMs: 1781622900000,
      status: "active"
    });
  });

  it("accepts a matching active BTC Sui RPC oracle with valid object version freshness", async () => {
    const confirmed = await confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        predictObjectId: "0xpredict",
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000,
        minObjectVersion: "42"
      },
      readOracle: async () => validSuiRpcOracle
    });

    expect(confirmed).toMatchObject({
      oracleId: "0xbtc-nearest",
      version: "42",
      predictId: "0xpredict",
      underlyingAsset: "BTC",
      expiryMs: 1781622900000,
      status: "active"
    });
  });

  it("confirms Sui RPC oracle objects using metadata id instead of nested Move UID", async () => {
    const confirmed = await confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        predictObjectId: "0xpredict",
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000,
        minObjectVersion: "42"
      },
      readOracle: async () => suiRpcOracleWithMoveUid
    });

    expect(confirmed).toMatchObject({
      oracleId: "0xbtc-nearest",
      version: "42",
      predictId: "0xpredict"
    });
  });

  it("rejects mint or preview with expired active oracle using ORACLE_NOT_TRADEABLE", async () => {
    await expect(confirmOracleForExecution({
      request: {
        operation: "mint_directional",
        oracleId: "0xbtc-nearest",
        expiryMs: 1781621000000,
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000
      },
      readOracle: async () => ({
        ...validOracle,
        expiryMs: 1781621000000
      })
    })).rejects.toMatchObject<PredictOracleError>({
      code: "ORACLE_NOT_TRADEABLE"
    });
  });

  it("accepts settled operations with settled expired oracles", async () => {
    const confirmed = await confirmOracleForExecution({
      request: {
        operation: "settled_redeem",
        oracleId: "0xbtc-nearest",
        expiryMs: 1781621000000,
        predictObjectId: "0xpredict",
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000,
        minObjectVersion: "42"
      },
      readOracle: async () => ({
        ...validSuiRpcOracle,
        data: {
          ...validSuiRpcOracle.data,
          content: {
            fields: {
              ...validSuiRpcOracle.data.content.fields,
              expiry: "1781621000000",
              status: "settled"
            }
          }
        }
      })
    });

    expect(confirmed).toMatchObject({
      oracleId: "0xbtc-nearest",
      status: "settled",
      expiryMs: 1781621000000
    });
  });

  it("accepts explicit settled claim operations only with settled oracles", async () => {
    for (const operation of ["claim_settled_directional", "claim_settled_range"] as const) {
      const confirmed = await confirmOracleForExecution({
        request: {
          operation,
          oracleId: "0xbtc-nearest",
          expiryMs: 1781621000000,
          predictObjectId: "0xpredict",
          strikeRaw: operation === "claim_settled_directional" ? "65600000000000" : undefined,
          lowerStrikeRaw: operation === "claim_settled_range" ? "65500000000000" : undefined,
          higherStrikeRaw: operation === "claim_settled_range" ? "65600000000000" : undefined,
          serverTimeMs: 1781622000000,
          minObjectVersion: "42"
        },
        readOracle: async () => ({
          ...validSuiRpcOracle,
          data: {
            ...validSuiRpcOracle.data,
            content: {
              fields: {
                ...validSuiRpcOracle.data.content.fields,
                expiry: "1781621000000",
                status: "settled"
              }
            }
          }
        })
      });

      expect(confirmed.status).toBe("settled");
    }
  });

  it("rejects settled directional claim unless the oracle is settled", async () => {
    await expect(confirmOracleForExecution({
      request: {
        operation: "claim_settled_directional",
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        predictObjectId: "0xpredict",
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000,
        minObjectVersion: "42"
      },
      readOracle: async () => validSuiRpcOracle
    })).rejects.toMatchObject<PredictOracleError>({
      code: "ORACLE_NOT_TRADEABLE"
    });
  });

  it("rejects non-settled close or redeem with settled expired oracle", async () => {
    await expect(confirmOracleForExecution({
      request: {
        operation: "redeem_directional",
        oracleId: "0xbtc-nearest",
        expiryMs: 1781621000000,
        predictObjectId: "0xpredict",
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000,
        minObjectVersion: "42"
      },
      readOracle: async () => ({
        ...validSuiRpcOracle,
        data: {
          ...validSuiRpcOracle.data,
          content: {
            fields: {
              ...validSuiRpcOracle.data.content.fields,
              expiry: "1781621000000",
              status: "settled"
            }
          }
        }
      })
    })).rejects.toMatchObject<PredictOracleError>({
      code: "ORACLE_NOT_TRADEABLE"
    });
  });

  it("rejects stale object version freshness with ORACLE_NOT_TRADEABLE", async () => {
    await expect(confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        predictObjectId: "0xpredict",
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000,
        minObjectVersion: 43
      },
      readOracle: async () => validSuiRpcOracle
    })).rejects.toThrow("ORACLE_NOT_TRADEABLE");
  });

  it("rejects missing oracle data with ORACLE_NOT_FOUND", async () => {
    await expect(confirmOracleForExecution({
      request: {
        oracleId: "0xmissing",
        expiryMs: 1781622900000,
        serverTimeMs: 1781622000000
      },
      readOracle: async () => null
    })).rejects.toThrow("ORACLE_NOT_FOUND");
  });

  it("rejects non-active, non-BTC, or grid-invalid oracle data with ORACLE_NOT_TRADEABLE", async () => {
    await expect(confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        strikeRaw: "65650000000000",
        serverTimeMs: 1781622000000
      },
      readOracle: async () => validOracle
    })).rejects.toThrow("ORACLE_NOT_TRADEABLE");

    await expect(confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000
      },
      readOracle: async () => ({
        ...validOracle,
        status: "settled"
      })
    })).rejects.toThrow("ORACLE_NOT_TRADEABLE");

    await expect(confirmOracleForExecution({
      request: {
        oracleId: "0xbtc-nearest",
        expiryMs: 1781622900000,
        strikeRaw: "65600000000000",
        serverTimeMs: 1781622000000
      },
      readOracle: async () => ({
        ...validOracle,
        underlyingAsset: "ETH"
      })
    })).rejects.toThrow("ORACLE_NOT_TRADEABLE");
  });
});

describe("createPredictServerClient", () => {
  it("normalizes URL joining for Predict public server endpoints", async () => {
    const requestedUrls: string[] = [];
    const client = createPredictServerClient({
      baseUrl: "https://predict.example/api/",
      fetch: async (url) => {
        requestedUrls.push(String(url));
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });

    await client.getStatus();
    await client.getPredictOracles("0xpredict");
    await client.getManagers();
    await client.getMintedPositions();
    await client.getRedeemedPositions();
    await client.getMintedRanges();
    await client.getRedeemedRanges();

    expect(requestedUrls).toEqual([
      "https://predict.example/api/status",
      "https://predict.example/api/predicts/0xpredict/oracles",
      "https://predict.example/api/managers",
      "https://predict.example/api/positions/minted",
      "https://predict.example/api/positions/redeemed",
      "https://predict.example/api/ranges/minted",
      "https://predict.example/api/ranges/redeemed"
    ]);
  });

  it("throws useful errors for non-2xx fetch responses", async () => {
    const client = createPredictServerClient({
      baseUrl: "https://predict.example",
      fetch: async () => new Response("bad gateway", {
        status: 502,
        statusText: "Bad Gateway"
      })
    });

    await expect(client.getManagers()).rejects.toThrow(/502.*\/managers.*bad gateway/);
  });
});
