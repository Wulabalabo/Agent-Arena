import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("frontend deployment", () => {
  it("serves browser deep links through the Vite SPA entrypoint", () => {
    const frontendRoot = resolve(import.meta.dirname, "..");
    const dockerfile = readFileSync(resolve(frontendRoot, "Dockerfile"), "utf8");
    const caddyfile = readFileSync(resolve(frontendRoot, "Caddyfile"), "utf8");

    expect(dockerfile).toContain("Caddyfile");
    expect(dockerfile).not.toContain("caddy\", \"file-server\"");
    expect(caddyfile).toContain("try_files {path} /index.html");
    expect(caddyfile).toContain("file_server");
  });
});
