import { join } from "node:path";
import { handleAttributionRequest, type AttributionStoreLike } from "./attribution";
import { createPlatformFetchHandler } from "./platform/api";
import { PlatformMockStore } from "./platform/mock-store";
import { createInternalPredictFetchHandler } from "./predict/internal-api";
import { isInternalArenaPath } from "./predict/internal-auth";
import { SQLiteAttributionStore } from "./sqlite-attribution-store";

export function createAttributionFetchHandler(store: AttributionStoreLike = createDefaultAttributionStore()) {
  return (request: Request) => handleAttributionRequest(request, store);
}

export function createAgentArenaFetchHandler({
  attributionStore = createDefaultAttributionStore(),
  internalToken = Bun.env.AGENT_ARENA_INTERNAL_TOKEN,
  platformStore = new PlatformMockStore()
}: {
  attributionStore?: AttributionStoreLike;
  internalToken?: string;
  platformStore?: PlatformMockStore;
} = {}) {
  const internalPredictFetch = createInternalPredictFetchHandler({ internalToken });
  const platformFetch = createPlatformFetchHandler(platformStore);
  const attributionFetch = createAttributionFetchHandler(attributionStore);

  return (request: Request) => {
    const url = new URL(request.url);
    if (isInternalArenaPath(url.pathname)) {
      return internalPredictFetch(request);
    }

    if (url.pathname === "/api/arena" || url.pathname.startsWith("/api/arena/")) {
      return platformFetch(request);
    }

    return attributionFetch(request);
  };
}

export function createDefaultAttributionStore(): SQLiteAttributionStore {
  return new SQLiteAttributionStore(getDefaultAttributionDbPath());
}

export function getDefaultAttributionDbPath(): string {
  return Bun.env.AGENT_ARENA_DB_PATH ?? join(import.meta.dir, "..", "data", "agent-arena.sqlite");
}

export function startAttributionServer(port = Number(Bun.env.PORT ?? 8787)) {
  return Bun.serve({
    port,
    fetch: createAgentArenaFetchHandler()
  });
}

if (import.meta.main) {
  const server = startAttributionServer();
  console.log(`Agent Arena attribution backend listening on http://localhost:${server.port}`);
}
