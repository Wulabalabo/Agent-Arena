import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateIntentPayload } from "../apps/backend/src/platform/validation";

const requiredFiles = [
  "skills/agent-arena.md",
  "skills/deepbook-predict-btc-15m.md",
  "skills/agent-wallet.md",
  "skills/risk-and-scoring.md"
];

const projectRoot = join(import.meta.dir, "..");
const jsonBlockPattern = /```json\r?\n([\s\S]*?)\r?\n```/g;

for (const file of requiredFiles) {
  const path = join(projectRoot, file);
  const text = readFileSync(path, "utf8");

  for (const match of text.matchAll(jsonBlockPattern)) {
    let payload: unknown;
    try {
      payload = JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`${file} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (hasAction(payload)) {
      validateIntentPayload(payload);
    }
  }
}

console.log("Skill docs validated");

function hasAction(payload: unknown): payload is { action: unknown } {
  return typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    "action" in payload;
}
