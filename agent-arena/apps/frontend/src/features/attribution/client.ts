import { attributionConfig } from "./config";

export type PredictPositionType = "directional" | "range";
export type AttributionStatus = "submitted" | "confirmed" | "redeemable" | "redeemed" | "failed";

export interface CreateAttributionInput {
  userAddress: string;
  managerId: string;
  roundId: string;
  agentId: string;
  oracleId: string;
  digest: string;
  predictPositionType: PredictPositionType;
  marketKey: string | null;
  rangeKey: string | null;
  amount: number;
  strategySnapshot: string;
}

export interface AttributionRecord extends CreateAttributionInput {
  id: string;
  status: AttributionStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface AttributionListResponse {
  records: AttributionRecord[];
}

interface AttributionErrorResponse {
  error?: string;
}

type AttributionFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface CreateAttributionClientOptions {
  baseUrl?: string;
  fetcher?: AttributionFetcher;
}

export function createAttributionClient({
  baseUrl = attributionConfig.apiBaseUrl,
  fetcher = fetch
}: CreateAttributionClientOptions = {}) {
  const root = normalizeBaseUrl(baseUrl);

  return {
    createAttribution: (input: CreateAttributionInput) =>
      requestJson<AttributionRecord>(fetcher, `${root}/attributions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),
    listAttributions: (userAddress: string) =>
      requestJson<AttributionListResponse>(
        fetcher,
        `${root}/attributions?userAddress=${encodeURIComponent(userAddress)}`
      ).then((response) => response.records)
  };
}

async function requestJson<T>(fetcher: AttributionFetcher, url: string, init?: RequestInit): Promise<T> {
  const response = init ? await fetcher(url, init) : await fetcher(url);
  const payload = (await response.json()) as T & AttributionErrorResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? `Attribution request failed: ${response.status}`);
  }

  return payload;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
