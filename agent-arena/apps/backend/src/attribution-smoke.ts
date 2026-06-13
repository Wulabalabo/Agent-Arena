import type { CreateAttributionInput } from "./attribution";

interface SmokeOptions {
  baseUrl?: string;
  userAddress?: string;
  fetcher?: typeof fetch;
}

export function buildSmokeAttributionInput(userAddress: string): CreateAttributionInput {
  return {
    userAddress,
    managerId: "0xsmoke-manager",
    roundId: "smoke-round-btc",
    agentId: "volatility-sniper",
    oracleId: "0xsmoke-oracle",
    digest: "0xsmoke-digest",
    predictPositionType: "directional",
    marketKey: "BTC_UP_SMOKE",
    rangeKey: null,
    amount: 100,
    strategySnapshot: "Smoke test attribution after a Predict transaction digest is available."
  };
}

export async function runAttributionSmoke({
  baseUrl = Bun.env.AGENT_ARENA_API_URL ?? "http://127.0.0.1:8787",
  userAddress = Bun.env.AGENT_ARENA_SMOKE_USER ?? "0xsmoke",
  fetcher = fetch
}: SmokeOptions = {}) {
  const root = baseUrl.replace(/\/+$/, "");
  const input = buildSmokeAttributionInput(userAddress);
  const created = await fetcher(`${root}/attributions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!created.ok && created.status !== 400) {
    throw new Error(`Smoke attribution create failed: ${created.status} ${await created.text()}`);
  }

  const listed = await fetcher(`${root}/attributions?userAddress=${encodeURIComponent(userAddress)}`);

  if (!listed.ok) {
    throw new Error(`Smoke attribution list failed: ${listed.status} ${await listed.text()}`);
  }

  const payload = (await listed.json()) as { records?: Array<{ digest?: string; agentId?: string }> };
  const found = payload.records?.some((record) => record.digest === input.digest && record.agentId === input.agentId);

  if (!found) {
    throw new Error("Smoke attribution record was not found after create");
  }

  return {
    userAddress,
    digest: input.digest,
    agentId: input.agentId,
    recordCount: payload.records?.length ?? 0
  };
}

if (import.meta.main) {
  const result = await runAttributionSmoke();
  console.log(JSON.stringify(result, null, 2));
}
