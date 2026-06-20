const defaultPlatformApiOrigin = "http://127.0.0.1:8787";
const configuredApiSource = import.meta.env.VITE_AGENT_ARENA_API_URL ?? defaultPlatformApiOrigin;
const configuredPublicSource =
  import.meta.env.VITE_AGENT_ARENA_SITE_URL ?? import.meta.env.VITE_AGENT_ARENA_PUBLIC_URL ?? configuredApiSource;

export const platformConfig = {
  apiBaseUrl: createArenaApiBaseUrl(configuredApiSource),
  publicBaseUrl: createArenaPublicBaseUrl(configuredPublicSource)
};

export function createArenaApiBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api/arena") ? normalized : `${normalized}/api/arena`;
}

export function createArenaPublicBaseUrl(value: string, runtimeOrigin = readRuntimeOrigin()): string {
  const normalized = value.trim().replace(/\/+$/, "");
  const fallbackOrigin = runtimeOrigin.trim().replace(/\/+$/, "") || defaultPlatformApiOrigin;

  if (!normalized || normalized.startsWith("/")) {
    return fallbackOrigin;
  }

  return normalized.endsWith("/api/arena") ? normalized.slice(0, -"/api/arena".length) : normalized;
}

function readRuntimeOrigin(): string {
  if (typeof window === "undefined" || !window.location.origin || window.location.origin === "null") {
    return defaultPlatformApiOrigin;
  }

  return window.location.origin;
}
