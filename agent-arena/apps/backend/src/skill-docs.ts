import { join } from "node:path";

export const publicSkillDocs = Object.freeze([
  {
    id: "agent-arena",
    title: "Agent Arena",
    url: "/skills/agent-arena.md",
    filename: "agent-arena.md"
  },
  {
    id: "deepbook-predict-btc-15m",
    title: "DeepBook Predict BTC 15m",
    url: "/skills/deepbook-predict-btc-15m.md",
    filename: "deepbook-predict-btc-15m.md"
  },
  {
    id: "agent-wallet",
    title: "Agent Wallet",
    url: "/skills/agent-wallet.md",
    filename: "agent-wallet.md"
  },
  {
    id: "risk-and-scoring",
    title: "Risk And Scoring",
    url: "/skills/risk-and-scoring.md",
    filename: "risk-and-scoring.md"
  }
] as const);

const skillDocsByUrl = new Map(publicSkillDocs.map((skill) => [skill.url, skill]));
const agentArenaRoot = join(import.meta.dir, "..", "..", "..");

export async function handleSkillDocRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/skills/")) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: skillDocHeaders()
    });
  }

  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: skillDocHeaders({
        allow: "GET, OPTIONS",
        "content-type": "text/plain; charset=utf-8"
      })
    });
  }

  const skill = skillDocsByUrl.get(url.pathname);
  if (!skill) {
    return new Response("Skill doc not found", {
      status: 404,
      headers: skillDocHeaders({
        "content-type": "text/plain; charset=utf-8"
      })
    });
  }

  const file = Bun.file(join(agentArenaRoot, "skills", skill.filename));
  if (!(await file.exists())) {
    return new Response("Skill doc not found", {
      status: 404,
      headers: skillDocHeaders({
        "content-type": "text/plain; charset=utf-8"
      })
    });
  }

  return new Response(file, {
    headers: skillDocHeaders({
      "content-type": "text/markdown; charset=utf-8"
    })
  });
}

function skillDocHeaders(extraHeaders: Record<string, string> = {}): Headers {
  return new Headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extraHeaders
  });
}
