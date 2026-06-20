interface PredictServerClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface PredictServerClient {
  getStatus: () => Promise<unknown>;
  getPredictOracles: (predictId: string) => Promise<unknown>;
  getOracleState: (oracleId: string) => Promise<unknown>;
  getManagers: () => Promise<unknown>;
  getMintedPositions: () => Promise<unknown>;
  getRedeemedPositions: () => Promise<unknown>;
  getMintedRanges: () => Promise<unknown>;
  getRedeemedRanges: () => Promise<unknown>;
}

export function createPredictServerClient({
  baseUrl,
  fetch: fetcher = globalThis.fetch
}: PredictServerClientOptions): PredictServerClient {
  if (baseUrl.trim() === "") {
    throw new Error("PREDICT_SERVER_URL_REQUIRED");
  }

  return {
    getStatus: () => requestJson(fetcher, baseUrl, "/status"),
    getPredictOracles: (predictId: string) =>
      requestJson(fetcher, baseUrl, `/predicts/${encodeURIComponent(predictId)}/oracles`),
    getOracleState: (oracleId: string) =>
      requestJson(fetcher, baseUrl, `/oracles/${encodeURIComponent(oracleId)}/state`),
    getManagers: () => requestJson(fetcher, baseUrl, "/managers"),
    getMintedPositions: () => requestJson(fetcher, baseUrl, "/positions/minted"),
    getRedeemedPositions: () => requestJson(fetcher, baseUrl, "/positions/redeemed"),
    getMintedRanges: () => requestJson(fetcher, baseUrl, "/ranges/minted"),
    getRedeemedRanges: () => requestJson(fetcher, baseUrl, "/ranges/redeemed")
  };
}

async function requestJson(fetcher: typeof fetch, baseUrl: string, path: string): Promise<unknown> {
  const response = await fetcher(joinUrl(baseUrl, path));

  if (!response.ok) {
    const body = await safeResponseText(response);
    throw new Error(
      `Predict server request failed with ${response.status} ${response.statusText} for ${path}: ${body}`
    );
  }

  return response.json();
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}
