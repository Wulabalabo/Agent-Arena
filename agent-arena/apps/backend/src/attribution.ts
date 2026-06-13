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
  createdAt: string;
  updatedAt: string;
}

export interface AttributionStoreLike {
  create(input: CreateAttributionInput, now?: string): AttributionRecord;
  listByUser(userAddress: string): AttributionRecord[];
}

export class AttributionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttributionInputError";
  }
}

export class AttributionStore implements AttributionStoreLike {
  private readonly records = new Map<string, AttributionRecord>();

  create(input: CreateAttributionInput, now = new Date().toISOString()): AttributionRecord {
    const record = createAttributionRecord(input, now);

    if (this.records.has(record.id)) {
      throw new AttributionInputError(`Attribution already exists for ${input.digest} and ${input.agentId}`);
    }

    this.records.set(record.id, record);
    return record;
  }

  listByUser(userAddress: string): AttributionRecord[] {
    const normalized = normalizeAddress(userAddress);

    return [...this.records.values()].filter((record) => normalizeAddress(record.userAddress) === normalized);
  }
}

export function createAttributionRecord(input: CreateAttributionInput, now = new Date().toISOString()): AttributionRecord {
  validateAttributionInput(input);

  return {
    ...input,
    id: `attr_${input.digest}_${input.agentId}`,
    status: "submitted",
    createdAt: now,
    updatedAt: now
  };
}

export async function handleAttributionRequest(request: Request, store: AttributionStoreLike): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: createCorsHeaders()
    });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({
      service: "agent-arena-attribution",
      ok: true,
      indexer: false
    });
  }

  if (url.pathname === "/attributions" && request.method === "GET") {
    const userAddress = url.searchParams.get("userAddress");

    if (!userAddress) {
      return jsonResponse({ error: "userAddress is required" }, 400);
    }

    return jsonResponse({ records: store.listByUser(userAddress) });
  }

  if (url.pathname === "/attributions" && request.method === "POST") {
    try {
      const input = (await request.json()) as CreateAttributionInput;
      return jsonResponse(store.create(input), 201);
    } catch (error) {
      if (error instanceof AttributionInputError) {
        return jsonResponse({ error: error.message }, 400);
      }

      return jsonResponse({ error: "Attribution backend error" }, 500);
    }
  }

  return jsonResponse({ error: "Not found" }, 404);
}

export function validateAttributionInput(input: CreateAttributionInput): void {
  const requiredFields: Array<keyof CreateAttributionInput> = [
    "userAddress",
    "managerId",
    "roundId",
    "agentId",
    "oracleId",
    "digest",
    "predictPositionType",
    "amount",
    "strategySnapshot"
  ];

  for (const field of requiredFields) {
    if (input[field] === "" || input[field] === null || input[field] === undefined) {
      throw new AttributionInputError(`${field} is required`);
    }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AttributionInputError("amount must be a positive number");
  }

  if (input.predictPositionType === "directional" && !input.marketKey) {
    throw new AttributionInputError("marketKey is required for directional attribution");
  }

  if (input.predictPositionType === "range" && !input.rangeKey) {
    throw new AttributionInputError("rangeKey is required for range attribution");
  }
}

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function jsonResponse(body: unknown, status = 200): Response {
  const headers = createCorsHeaders();
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status,
    headers
  });
}

function createCorsHeaders(): Headers {
  return new Headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
}
