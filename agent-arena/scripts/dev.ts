import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");
const backendDir = join(rootDir, "apps", "backend");
const frontendDir = join(rootDir, "apps", "frontend");
const backendPort = Bun.env.AGENT_ARENA_BACKEND_PORT ?? Bun.env.PORT ?? "8787";
const frontendHost = Bun.env.AGENT_ARENA_FRONTEND_HOST ?? "127.0.0.1";
const frontendPort = Bun.env.AGENT_ARENA_FRONTEND_PORT ?? "5173";
const backendUrl = Bun.env.VITE_AGENT_ARENA_API_URL ?? `http://127.0.0.1:${backendPort}`;
const dbPath = Bun.env.AGENT_ARENA_DB_PATH ?? join(backendDir, "data", "agent-arena.sqlite");

if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
  console.log(`Agent Arena dev stack

Usage:
  bun run dev

Environment overrides:
  AGENT_ARENA_BACKEND_PORT   Backend port, default ${backendPort}
  AGENT_ARENA_FRONTEND_HOST  Frontend host, default ${frontendHost}
  AGENT_ARENA_FRONTEND_PORT  Frontend port, default ${frontendPort}
  AGENT_ARENA_DB_PATH        SQLite path, default ${dbPath}
  VITE_AGENT_ARENA_API_URL   Frontend API URL, default ${backendUrl}
`);
  process.exit(0);
}

console.log("Starting Agent Arena dev stack");
console.log(`Backend:  http://127.0.0.1:${backendPort}`);
console.log(`Frontend: http://${frontendHost}:${frontendPort}`);
console.log(`SQLite:   ${dbPath}`);

const backend = Bun.spawn(["bun", "run", "dev"], {
  cwd: backendDir,
  env: {
    ...Bun.env,
    AGENT_ARENA_DB_PATH: dbPath,
    PORT: backendPort
  },
  stderr: "pipe",
  stdout: "pipe"
});
const frontend = Bun.spawn(["bun", "run", "dev", "--", "--host", frontendHost, "--port", frontendPort], {
  cwd: frontendDir,
  env: {
    ...Bun.env,
    VITE_AGENT_ARENA_API_URL: backendUrl
  },
  stderr: "pipe",
  stdout: "pipe"
});
const children = [backend, frontend];
let shuttingDown = false;

void pipeOutput(backend.stdout, "backend", "log");
void pipeOutput(backend.stderr, "backend", "error");
void pipeOutput(frontend.stdout, "frontend", "log");
void pipeOutput(frontend.stderr, "frontend", "error");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const exitCode = await Promise.race([
  backend.exited.then((code) => {
    console.error(`[backend] exited with code ${code}`);
    return code;
  }),
  frontend.exited.then((code) => {
    console.error(`[frontend] exited with code ${code}`);
    return code;
  })
]);

shutdown(exitCode);

async function pipeOutput(
  stream: ReadableStream<Uint8Array> | null,
  label: string,
  level: "log" | "error"
): Promise<void> {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      writeLine(label, line, level);
    }
  }

  if (buffer) {
    writeLine(label, buffer, level);
  }
}

function writeLine(label: string, line: string, level: "log" | "error"): void {
  if (!line.trim()) {
    return;
  }

  const message = `[${label}] ${line}`;
  if (level === "error") {
    console.error(message);
    return;
  }

  console.log(message);
}

function shutdown(code: number): never {
  if (!shuttingDown) {
    shuttingDown = true;

    for (const child of children) {
      child.kill();
    }
  }

  process.exit(code);
}
