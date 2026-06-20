export const internalTokenHeader = "x-agent-arena-internal-token";

export function assertInternalRequest(request: Request, expectedToken: string | undefined): void {
  if (!expectedToken?.trim()) {
    throw new Error("INTERNAL_API_DISABLED");
  }

  if (request.headers.get(internalTokenHeader) !== expectedToken) {
    throw new Error("UNAUTHORIZED");
  }
}

export function isInternalArenaPath(pathname: string): boolean {
  return pathname === "/api/arena/internal" || pathname.startsWith("/api/arena/internal/");
}
