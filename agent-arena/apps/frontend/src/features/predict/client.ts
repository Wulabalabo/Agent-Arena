import type {
  PredictManagerListItem,
  PredictManagerPnl,
  PredictManagerPositionsSummary,
  PredictManagerSummary,
  PredictMintedPosition,
  PredictMintedRange,
  PredictOracleState,
  PredictOracleSummary,
  PredictOracleTrade,
  PredictRedeemedPosition,
  PredictRedeemedRange,
  PredictState,
  PredictStatus
} from "./types";

interface PredictResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

type PredictFetcher = (url: string) => Promise<PredictResponse>;

interface CreatePredictClientOptions {
  serverUrl: string;
  fetcher?: PredictFetcher;
}

async function requestJson<T>(fetcher: PredictFetcher, url: string): Promise<T> {
  const response = await fetcher(url);

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    throw new Error(`Predict server request failed: ${response.status}${statusText}`);
  }

  return response.json() as Promise<T>;
}

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, "");
}

export function createPredictClient({ serverUrl, fetcher = fetch }: CreatePredictClientOptions) {
  const root = normalizeServerUrl(serverUrl);

  return {
    getStatus: () => requestJson<PredictStatus>(fetcher, `${root}/status`),
    getPredictState: (predictId: string) => requestJson<PredictState>(fetcher, `${root}/predicts/${predictId}/state`),
    getPredictOracles: (predictId: string) =>
      requestJson<PredictOracleSummary[]>(fetcher, `${root}/predicts/${predictId}/oracles`),
    getOracleState: (oracleId: string) => requestJson<PredictOracleState>(fetcher, `${root}/oracles/${oracleId}/state`),
    getManagers: () => requestJson<PredictManagerListItem[]>(fetcher, `${root}/managers`),
    getManagerSummary: (managerId: string) =>
      requestJson<PredictManagerSummary>(fetcher, `${root}/managers/${managerId}/summary`),
    getManagerPositionsSummary: (managerId: string) =>
      requestJson<PredictManagerPositionsSummary>(fetcher, `${root}/managers/${managerId}/positions/summary`),
    getManagerPnl: (managerId: string) =>
      requestJson<PredictManagerPnl>(fetcher, `${root}/managers/${managerId}/pnl?range=ALL`),
    getOracleTrades: (oracleId: string) => requestJson<PredictOracleTrade[]>(fetcher, `${root}/trades/${oracleId}`),
    getMintedPositions: () => requestJson<PredictMintedPosition[]>(fetcher, `${root}/positions/minted`),
    getRedeemedPositions: () => requestJson<PredictRedeemedPosition[]>(fetcher, `${root}/positions/redeemed`),
    getMintedRanges: () => requestJson<PredictMintedRange[]>(fetcher, `${root}/ranges/minted`),
    getRedeemedRanges: () => requestJson<PredictRedeemedRange[]>(fetcher, `${root}/ranges/redeemed`)
  };
}
