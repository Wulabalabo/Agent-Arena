# syntax=docker/dockerfile:1

FROM oven/bun:1.3.11 AS build

WORKDIR /app/apps/frontend

ARG VITE_AGENT_ARENA_API_URL=/api/arena
ARG VITE_AGENT_ARENA_SITE_URL=
ENV VITE_AGENT_ARENA_API_URL=${VITE_AGENT_ARENA_API_URL}
ENV VITE_AGENT_ARENA_SITE_URL=${VITE_AGENT_ARENA_SITE_URL}

COPY apps/frontend/package.json apps/frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY apps/frontend/index.html ./index.html
COPY apps/frontend/tsconfig.json ./tsconfig.json
COPY apps/frontend/vite.config.ts ./vite.config.ts
COPY apps/frontend/vitest.setup.ts ./vitest.setup.ts
COPY apps/frontend/public ./public
COPY apps/frontend/src ./src

RUN bun run build

FROM caddy:2.9-alpine AS runtime

COPY --from=build /app/apps/frontend/dist /srv
COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
