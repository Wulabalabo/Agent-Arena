# Agent Arena Operations Runbook

This is the operating document for Docker deployment, server updates, domain setup, backups, and future server-specific notes.

## Deployment Model

The Docker stack runs three services:

- `backend`: Bun API on port `8787`, with SQLite and encrypted wallet material stored in the `backend-data` Docker volume.
- `frontend`: Vite static build served by Caddy on internal port `8080`.
- `proxy`: internal Caddy entrypoint. In production it is bound only to `127.0.0.1:8788`; routes `/api/arena/*` and `/skills/*` to `backend`, and all other paths to `frontend`.

Production HTTPS is terminated by the host-level Caddy process, not by the Docker `proxy` container. Host Caddy owns public ports `80` and `443` for `arena.mindfrog.xyz` and reverse proxies to `127.0.0.1:8788`.

The frontend is built with same-origin API access and the public site URL for Agent join prompts:

```text
VITE_AGENT_ARENA_API_URL=/api/arena
VITE_AGENT_ARENA_SITE_URL=${AGENT_ARENA_FRONTEND_BASE_URL}
```

The Join prompt shown in the UI should resolve to the public skill doc, for example:

```text
Read https://arena.mindfrog.xyz/skills/agent-arena.md and follow the instructions to join the BTC 15m Agent Arena.
```

Do not expose backend internals, wallet secrets, or `AGENT_ARENA_INTERNAL_TOKEN` to browser code.

## Server Information

Append real server values here after provisioning.

```text
Domain: https://arena.mindfrog.xyz
Server public IP: 178.105.228.251
SSH host: root@178.105.228.251
SSH user: root
Repository path: /srv/agent-arena/app
Docker Compose project path: /srv/agent-arena/app
Backup path: /srv/agent-arena/app/backups
Primary operator: Codex via C:\Users\user\.ssh\leaps_radar\id_rsa
Notes: Deployed as Compose project `agent-arena`. The Docker proxy is bound only to `127.0.0.1:8788`; host Caddy terminates HTTPS for `arena.mindfrog.xyz` and reverse proxies to that local port. Existing `trade.mindfrog.xyz` service remains on `127.0.0.1:8080`. Runtime mode is `real` for Testnet/Predict reads and submit; `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`. Owner-sender-enforced registry proof mode is enabled; `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true` with the registry package, registry object, and authority key installed server-side.
Server-only compose override: /srv/agent-arena/app/docker-compose.server.yml pins proxy ports to 127.0.0.1:8788. Keep this file on the server when syncing source files.
```

## First Deploy

On the server:

```bash
git clone <repo-url> agent-arena-app
cd agent-arena-app/agent-arena
cp .env.production.example .env
```

Edit `.env`:

```bash
nano .env
```

Complete production `.env` shape:

```text
AGENT_ARENA_SITE_ADDRESS=https://your-domain.example
AGENT_ARENA_FRONTEND_BASE_URL=https://your-domain.example

AGENT_ARENA_RUNTIME_MODE=real
AGENT_ARENA_NETWORK=testnet
AGENT_ARENA_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
AGENT_ARENA_PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
AGENT_ARENA_PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
AGENT_ARENA_PREDICT_OBJECT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
AGENT_ARENA_SUI_CLOCK_OBJECT_ID=0x6
AGENT_ARENA_QUOTE_ASSET_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
AGENT_ARENA_QUOTE_DECIMALS=6
AGENT_ARENA_PRICE_DECIMALS=9

AGENT_ARENA_INTERNAL_TOKEN=<server-only-random-token>
AGENT_ARENA_WALLET_SECRET=<server-only-wallet-encryption-secret>
AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true

AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true
AGENT_ARENA_REGISTRY_PACKAGE_ID=<agent-arena-registry-package-id>
AGENT_ARENA_REGISTRY_OBJECT_ID=<agent-arena-registry-object-id>
AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY=<server-only-authority-suiprivkey>
```

`AGENT_ARENA_ENABLE_REGISTRY_SUBMIT` is a legacy variable name. In the current flow, enabling it does not make the backend submit registry transactions or pay registry gas. It enables backend registry authorization proof issuance plus Sui transaction verification. The owner wallet signs and pays gas for the claim and runtime credential rotation registry transactions.

`AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY` signs BCS-encoded registry authorization payload hashes only. Its public key must match the key embedded in `agent_arena::registry`, and the authority address does not need Testnet SUI gas.

`AGENT_ARENA_WALLET_SECRET` encrypts platform-managed Agent trading wallet private keys. It is not a hash and remains required when the backend creates or uses Agent trading wallets.

Only enable registry mode after publishing the owner-sender-enforced registry package and filling `AGENT_ARENA_REGISTRY_PACKAGE_ID`, `AGENT_ARENA_REGISTRY_OBJECT_ID`, and `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY`.

`AGENT_ARENA_FRONTEND_BASE_URL` is the owner-facing site used in pairing `claimUrl` responses. In production it should be the public site, for example `https://arena.mindfrog.xyz`. Local direct backend runs should override it to `http://127.0.0.1:5173` in `apps/backend/.env`; do not use that local value in the server root `.env`.

The Agent runtime handoff `baseUrl` is the backend API root, for example `http://127.0.0.1:8787/api/arena` locally or `https://arena.mindfrog.xyz/api/arena` in production. It is intentionally different from the owner claim page URL.

Start the stack. On the production server always include the server override and project name:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml config
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml up -d --build
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml ps
```

Verify public routes:

```bash
curl -fsS https://your-domain.example/api/arena/__introspection
curl -fsS https://your-domain.example/skills/agent-arena.md
```

For a local Docker check without a real domain, keep `AGENT_ARENA_SITE_ADDRESS=http://localhost` and use:

```bash
curl -fsS http://localhost/api/arena/__introspection
curl -fsS http://localhost/skills/agent-arena.md
```

If no `.env` file is present, `docker-compose.yml` defaults to `AGENT_ARENA_RUNTIME_MODE=mock` so local smoke tests can boot without server secrets. A production `.env` copied from `.env.production.example` sets `AGENT_ARENA_RUNTIME_MODE=real`; in real mode, blank internal token or wallet secret values intentionally fail closed.

## DNS And HTTPS

Point the domain `A` record to the server public IP before starting production Caddy.

Caddy manages certificates automatically when `AGENT_ARENA_SITE_ADDRESS` is a real domain and ports `80` and `443` are reachable from the internet.

If the server is behind Cloudflare, use a TLS mode that allows Caddy to complete certificate issuance, or terminate TLS at Cloudflare and adjust the Caddy site address intentionally.

## Daily Commands

Show service state:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml ps
```

Follow all logs:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml logs -f
```

Follow one service:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml logs -f backend
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml logs -f proxy
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml logs -f frontend
```

Stop containers while keeping persistent volumes:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml down
```

Start existing containers:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml up -d
```

Rebuild after source changes. The production directory is not a git checkout, so do not rely on `git pull` there. Sync the source tree from the operator workstation while preserving server-only files (`.env`, `backups/`, and `docker-compose.server.yml`), then rebuild:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml config
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml up -d --build
```

After a source sync, verify that `docker-compose.server.yml` still exists and still binds the proxy to `127.0.0.1:8788`.

```bash
cat /srv/agent-arena/app/docker-compose.server.yml
```

Expected server-only override:

```yaml
name: agent-arena
services:
  proxy:
    ports: !override
      - "127.0.0.1:8788:80"
```

## Current Claim And Funding Flow

- New Agent pairing codes use random `PAIR-<32 hex chars>` values rather than readable sequential numbers.
- Owner claim is a two-step owner-signed flow: the backend prepares a registry proof, the owner wallet signs the registry transaction, and the backend finalizes after verification.
- After claim, the page shows the generated trading wallet and the one-time runtime credential.
- The `Fund wallet` button is a convenience action that asks the connected owner wallet to transfer `1 SUI` and `10 DUSDC` to the generated trading wallet.
- Funding is optional at claim time. The owner can also transfer `1 SUI` and `10 DUSDC` to that trading wallet later from another Sui wallet.
- The Agent runtime never receives owner private keys and does not sign Sui transactions. It uses only the one-time runtime credential for platform API calls.

## Registry Deployment

Use this sequence whenever the Move registry package or embedded authority public key changes:

1. Generate or select the server-side Ed25519 authority key and embed its public key in `agent_arena::registry`.
2. Confirm the exact Sui CLI environment that will execute the transaction, not just a different sandbox or shell:

```bash
sui client active-env
sui client active-address
sui client gas
```

The active env must be `testnet`. If an approval or external shell is used for the publish command, run the same checks in that shell before publishing.

3. Deploy the updated Move package on Sui Testnet.
4. Create or publish the new registry object.
5. Verify both IDs against Testnet RPC before wiring env:

```bash
sui client object <package-id>
sui client object <registry-object-id>
```

The package object must exist on Testnet and the registry object type must be `<package-id>::registry::Registry`.

6. Record the deployed package id and registry object id.
7. Set `AGENT_ARENA_REGISTRY_PACKAGE_ID`, `AGENT_ARENA_REGISTRY_OBJECT_ID`, and `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY` in `.env`.
8. Keep the authority address unfunded unless another operational use requires gas; it only signs authorization hashes.
9. Confirm the owner wallet used for claim/rotation has enough Testnet SUI for the registry transaction.
10. Recreate the backend after env changes:

```bash
docker compose up -d --force-recreate --no-deps backend
```

11. Rebuild/recreate the frontend if the public URL or owner-facing copy changed:

```bash
docker compose up -d --build frontend proxy
```

Rebuild the frontend after changing `AGENT_ARENA_FRONTEND_BASE_URL`, because the public Join prompt URL is embedded in the Vite build:

```bash
docker compose up -d --build frontend proxy
```

Reload env changes by recreating affected services:

```bash
docker compose up -d --force-recreate --no-deps backend
docker compose up -d --force-recreate --no-deps proxy
```

## Data And Backups

The backend stores durable state in:

```text
/app/data/agent-arena.sqlite
/app/data/internal-wallets.json
```

Those paths live inside the Docker named volume:

```text
backend-data
```

Create a backup directory on the host:

```bash
cd /srv/agent-arena/app
mkdir -p backups
```

Copy current backend data out of the running container:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml exec -T backend sh -lc 'set -e; stamp=$(date +%Y%m%d-%H%M%S); mkdir -p /app/data/backups/$stamp; cp -a /app/data/agent-arena.sqlite* /app/data/backups/$stamp/ 2>/dev/null || true; cp -a /app/data/internal-wallets.json /app/data/backups/$stamp/ 2>/dev/null || true; echo $stamp'
docker cp "$(docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml ps -q backend):/app/data/backups" ./backups
```

To reset the live database for a clean demo or flow test, take the backup above first, then stop the backend and remove SQLite plus wallet runtime state from the `backend-data` volume:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml stop backend
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml run --rm --no-deps --entrypoint sh backend -lc 'rm -f /app/data/agent-arena.sqlite /app/data/agent-arena.sqlite-shm /app/data/agent-arena.sqlite-wal /app/data/internal-wallets.json'
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml up -d --build backend frontend proxy
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml ps
```

This reset deletes pairing drafts, claimed Agent records, runtime credentials, leaderboard state, and generated trading-wallet key material. It does not touch server `.env`, Docker images, Caddy data, or backup files.

Before restoring data, stop the stack:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml down
```

Restores should be done deliberately with a known backup file and a written note in the Server Information section above.

## Safety Rules

- Keep `.env` server-only and out of git.
- Keep `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true` only while live Testnet submit is intentional.
- Keep `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=true` only while the current owner-sender-enforced registry package, registry object, and authority key are installed server-side.
- Do not fund the registry authority address just for registry claim/rotation; owner wallets pay registry gas.
- Keep `AGENT_ARENA_WALLET_SECRET` server-only because it encrypts platform-managed Agent trading wallet private keys.
- Do not copy `backend-data` into git.
- Do not expose `/api/arena/internal/*` through public docs, frontend code, or external Agent instructions; keep operator-only internal checks inside this runbook and server-side.
- Do not use Mainnet assets with this MVP.

## Useful Verification

Render the Compose config:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml config
```

Run backend tests locally before deployment:

```bash
bun run --cwd apps/backend test
```

Run frontend build locally before deployment:

```bash
bun run --cwd apps/frontend build
```

Validate Agent skill docs:

```bash
bun run validate:skills
```

## Runtime Health Check

Run from the production server so the internal token stays server-side:

```bash
cd /srv/agent-arena/app
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml exec -T backend sh -lc 'curl -fsS -H "x-agent-arena-internal-token: $AGENT_ARENA_INTERNAL_TOKEN" http://127.0.0.1:8787/api/arena/internal/health'
```

If the response is `blocked`, check the category summaries before allowing external Agents to submit exposure-changing intents.

### Competition Is Live But Agents Cannot Execute

Check these in order:

1. `runtime.predictSubmitEnabled` is true.
2. `market.source` is `predict_server` and snapshot age is below the stale threshold.
3. `wallets` has no `WALLET_NOT_FUNDED`, `GAS_BALANCE_TOO_LOW`, or `PREDICT_MANAGER_NOT_READY` warnings for the Agent.
4. `execution` has no stale pending execution for the Agent.
5. Agent readiness publishes the requested action as `executable` or intentionally `risky`.

### Settlement Expired But Leaderboard Did Not Finalize

Check these in order:

1. `categories.settlement.checks[]` includes the `SETTLEMENT_LEDGER` check.
2. That check's `details.claimLedgerCount` and `details.settlementLedgerCount` match the expected ledger state.
3. Inspect backend logs for deeper settlement claim executor errors.

Backend `.env` gate changes require backend recreate:

```bash
docker compose -p agent-arena -f docker-compose.yml -f docker-compose.server.yml up -d --force-recreate --no-deps backend
```
