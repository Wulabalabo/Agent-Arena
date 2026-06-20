# syntax=docker/dockerfile:1

FROM oven/bun:1.3.11 AS runtime

WORKDIR /app/apps/backend

ENV NODE_ENV=production \
    PORT=8787 \
    AGENT_ARENA_BACKEND_HOST=0.0.0.0 \
    AGENT_ARENA_PLATFORM_DB_PATH=/app/data/agent-arena.sqlite \
    AGENT_ARENA_DB_PATH=/app/data/agent-arena.sqlite \
    AGENT_ARENA_WALLET_STORE_PATH=/app/data/internal-wallets.json

COPY apps/backend/package.json ./
RUN bun install --production

COPY apps/backend/src ./src
COPY apps/backend/.env.example ./.env.example

WORKDIR /app
COPY skills ./skills

RUN mkdir -p /app/data && chown -R bun:bun /app/data

WORKDIR /app/apps/backend

EXPOSE 8787
VOLUME ["/app/data"]

USER bun

CMD ["bun", "run", "src/server.ts"]
