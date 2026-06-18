const defaultPlatformApiOrigin = "http://127.0.0.1:8787";

export const platformConfig = {
  apiBaseUrl: createArenaApiBaseUrl(import.meta.env.VITE_AGENT_ARENA_API_URL ?? defaultPlatformApiOrigin)
};

export function createArenaApiBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api/arena") ? normalized : `${normalized}/api/arena`;
}
