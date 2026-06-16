import { createAgentArenaFetchHandler } from "./server";

const root = "http://localhost/api/arena";

interface JsonResponse<T> {
  response: Response;
  body: T;
}

async function requestJson<T>(
  fetcher: ReturnType<typeof createAgentArenaFetchHandler>,
  path: string,
  init?: RequestInit
): Promise<JsonResponse<T>> {
  if (init?.headers && "x-agent-arena-api-key" in Object.fromEntries(new Headers(init.headers))) {
    throw new Error("Smoke must not use x-agent-arena-api-key");
  }

  const response = await fetcher(new Request(`${root}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init?.headers))
    }
  }));
  const text = await response.text();

  if (text.includes("apiKey")) {
    throw new Error(`Response for ${path} leaked apiKey`);
  }

  const body = text.length === 0 ? null : JSON.parse(text);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${text}`);
  }

  return {
    response,
    body: body as T
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const fetcher = createAgentArenaFetchHandler();

const { body: draft } = await requestJson<{
  registrationCode: string;
}>(
  fetcher,
  "/agent/init",
  {
    method: "POST",
    body: JSON.stringify({ displayName: "Smoke Agent" })
  }
);

assert(draft.registrationCode.startsWith("PAIR-"), "init did not return a pairing code");

const { body: claimed } = await requestJson<{
  agent: { id: string; displayName: string };
  tradingWallet: { agentId: string; address: string };
  runtimeCredential: { token: string };
}>(
  fetcher,
  "/owner/agents/claim",
  {
    method: "POST",
    body: JSON.stringify({
      registrationCode: draft.registrationCode,
      ownerAddress: "0xowner_smoke",
      signature: "0xsignedClaimMessage",
      twitterHandle: "@SmokeAgent"
    })
  }
);

assert(claimed.runtimeCredential.token.startsWith("agent_runtime_"), "claim did not return a runtime token");

const runtimeHeaders = {
  "x-agent-arena-agent-token": claimed.runtimeCredential.token
};

const { body: me } = await requestJson<{ id: string; displayName: string }>(
  fetcher,
  "/agent/me",
  { headers: runtimeHeaders }
);
assert(me.id === claimed.agent.id, "runtime /agent/me did not return claimed agent");

const { body: wallet } = await requestJson<{ wallet: { agentId: string; address: string } }>(
  fetcher,
  "/agent/wallet",
  { headers: runtimeHeaders }
);
assert(wallet.wallet.agentId === claimed.agent.id, "runtime /agent/wallet did not return claimed wallet");

const { body: active } = await requestJson<{ competitions: Array<{ id: string }> }>(
  fetcher,
  "/competition/list-active"
);
assert(active.competitions.some((competition) => competition.id === "btc-15m-001"), "active competition missing");

const { body: execution } = await requestJson<{
  status: string;
  predictTxDigest?: string;
}>(
  fetcher,
  "/intents",
  {
    method: "POST",
    headers: runtimeHeaders,
    body: JSON.stringify({
      competitionId: "btc-15m-001",
      agentId: claimed.agent.id,
      idempotencyKey: "smoke-btc-15m-open-001",
      action: "open_directional",
      market: {
        kind: "directional",
        oracleId: "0xsmoke_oracle_btc_15m",
        expiry: "2026-06-15T10:15:00.000Z",
        strike: "65000",
        isUp: true
      },
      quantity: "1",
      maxCost: "1.00",
      confidence: 0.61,
      reason: "Smoke verifies executable backend contract flow.",
      createdAt: "2026-06-15T10:03:12.000Z"
    })
  }
);

assert(execution.status === "executed", "open_directional smoke intent did not execute");
assert(Boolean(execution.predictTxDigest), "open_directional smoke intent did not return predictTxDigest");

const { body: leaderboard } = await requestJson<{
  entries: Array<{ displayName: string }>;
}>(
  fetcher,
  "/leaderboard?competitionId=btc-15m-001"
);
assert(
  leaderboard.entries.some((entry) => entry.displayName === claimed.agent.displayName),
  "leaderboard did not include claimed Agent display name"
);

const { body: replay } = await requestJson<{
  events: Array<{ label: string; txDigest: string | null }>;
}>(
  fetcher,
  `/owner/agents/${claimed.agent.id}/replay`
);
const executionEvent = replay.events.find((event) => event.label === "Predict transaction confirmed");
assert(executionEvent?.txDigest, "replay did not include Predict transaction confirmed with txDigest");

console.log("Platform contract smoke passed");
