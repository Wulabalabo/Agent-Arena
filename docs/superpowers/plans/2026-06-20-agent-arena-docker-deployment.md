# Agent Arena Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Agent Arena for server deployment with Docker Compose, persistent backend state, reverse proxy routing, and an operator runbook.

**Architecture:** Run the backend Bun API, frontend static site, and Caddy reverse proxy as separate services. The frontend uses same-origin `/api/arena`; Caddy routes `/api/arena/*` and `/skills/*` to backend and all other requests to frontend. Backend state is stored in a named Docker volume mounted at `/app/data`.

**Tech Stack:** Bun 1.3.11, Vite, React, Caddy 2, Docker Compose, SQLite-backed backend persistence.

---

### Task 1: Backend Container Runtime

**Files:**
- Modify: `agent-arena/apps/backend/src/server.ts`
- Modify: `agent-arena/apps/backend/src/server.test.ts`
- Create: `agent-arena/apps/backend/Dockerfile`

- [ ] **Step 1: Add failing backend host config test**

Add a test that proves `AGENT_ARENA_BACKEND_HOST` is read before `HOST`, and that blank values are ignored.

Run: `bun run --cwd agent-arena/apps/backend test src/server.test.ts`
Expected before implementation: fail because the host helper is not exported.

- [ ] **Step 2: Add backend host config helper**

Export a helper that resolves `AGENT_ARENA_BACKEND_HOST`, then `HOST`, then `undefined`.

Run: `bun run --cwd agent-arena/apps/backend test src/server.test.ts`
Expected after implementation: pass.

- [ ] **Step 3: Add backend Dockerfile**

Create a production Bun image that installs backend dependencies, copies backend source plus root skills/docs needed by `/skills/*`, exposes `8787`, and starts `bun run src/server.ts`.

Run: `docker compose -f agent-arena/docker-compose.yml config`
Expected after compose files exist: config renders without invalid service references.

### Task 2: Frontend Static Runtime

**Files:**
- Create: `agent-arena/apps/frontend/Dockerfile`
- Create: `agent-arena/deploy/Caddyfile`
- Create: `agent-arena/docker-compose.yml`
- Create: `agent-arena/.dockerignore`

- [ ] **Step 1: Add frontend Dockerfile**

Build Vite with `VITE_AGENT_ARENA_API_URL=/api/arena`, then serve `dist` from Caddy on port `8080`.

Run: `bun run --cwd agent-arena/apps/frontend build`
Expected: TypeScript and Vite build complete.

- [ ] **Step 2: Add Caddy reverse proxy**

Route `/api/arena/*` and `/skills/*` to `backend:8787`, and route remaining paths to `frontend:8080`.

Run: `docker compose -f agent-arena/docker-compose.yml config`
Expected: backend, frontend, and proxy services are present.

- [ ] **Step 3: Add Docker ignore rules**

Exclude `node_modules`, local data, build output, git metadata, and local env files from image build contexts.

Run: `docker compose -f agent-arena/docker-compose.yml config`
Expected: compose remains valid.

### Task 3: Operator Documentation

**Files:**
- Create: `agent-arena/.env.production.example`
- Create: `agent-arena/OPERATE.md`
- Modify: `agent-arena/README.md`

- [ ] **Step 1: Add production env template**

Document required domain, internal token, wallet secret, Predict submit flag, Testnet endpoints, and volume-backed DB paths.

- [ ] **Step 2: Add OPERATE runbook**

Document first deploy, start, stop, logs, update, backup, restore, env changes, and where future server information should be appended.

- [ ] **Step 3: Link runbook from README**

Add a short deployment pointer without duplicating the runbook.

### Task 4: Verification

**Files:**
- Read: all created and modified deployment files

- [ ] **Step 1: Run backend server tests**

Run: `bun run --cwd agent-arena/apps/backend test src/server.test.ts`
Expected: all `server.test.ts` tests pass.

- [ ] **Step 2: Run frontend build**

Run: `bun run --cwd agent-arena/apps/frontend build`
Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Validate compose config**

Run: `docker compose -f agent-arena/docker-compose.yml config`
Expected: rendered compose config exits 0.

- [ ] **Step 4: Check git scope**

Run: `git status --short`
Expected: only Docker/deployment docs plus existing local untracked runtime files are visible.
