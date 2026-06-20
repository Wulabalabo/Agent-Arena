# Agent Arena Operations Runbook

This is the operating document for Docker deployment, server updates, domain setup, backups, and future server-specific notes.

## Deployment Model

The Docker stack runs three services:

- `backend`: Bun API on port `8787`, with SQLite and encrypted wallet material stored in the `backend-data` Docker volume.
- `frontend`: Vite static build served by Caddy on internal port `8080`.
- `proxy`: public Caddy entrypoint on ports `80` and `443`; routes `/api/arena/*` and `/skills/*` to `backend`, and all other paths to `frontend`.

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
Notes: Deployed as Compose project `agent-arena`. The Docker proxy is bound only to `127.0.0.1:8788`; host Caddy terminates HTTPS for `arena.mindfrog.xyz` and reverse proxies to that local port. Existing `trade.mindfrog.xyz` service remains on `127.0.0.1:8080`. Runtime mode is `real` for Testnet/Predict reads and submit; `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true`.
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

Start the stack:

```bash
docker compose up -d --build
docker compose ps
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
docker compose ps
```

Follow all logs:

```bash
docker compose logs -f
```

Follow one service:

```bash
docker compose logs -f backend
docker compose logs -f proxy
docker compose logs -f frontend
```

Stop containers while keeping persistent volumes:

```bash
docker compose down
```

Start existing containers:

```bash
docker compose up -d
```

Rebuild after source changes:

```bash
git pull --ff-only
docker compose up -d --build
```

## Registry Deployment

Use this sequence whenever the Move registry package or embedded authority public key changes:

1. Generate or select the server-side Ed25519 authority key and embed its public key in `agent_arena::registry`.
2. Deploy the updated Move package on Sui Testnet.
3. Create or publish the new registry object.
4. Record the deployed package id and registry object id.
5. Set `AGENT_ARENA_REGISTRY_PACKAGE_ID`, `AGENT_ARENA_REGISTRY_OBJECT_ID`, and `AGENT_ARENA_REGISTRY_AUTHORITY_PRIVATE_KEY` in `.env`.
6. Keep the authority address unfunded unless another operational use requires gas; it only signs authorization hashes.
7. Confirm the owner wallet used for claim/rotation has enough Testnet SUI for the registry transaction.
8. Recreate the backend after env changes:

```bash
docker compose up -d --force-recreate --no-deps backend
```

9. Rebuild/recreate the frontend if the public URL or owner-facing copy changed:

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
mkdir -p backups
```

Copy current backend data out of the running container:

```bash
docker compose exec backend sh -lc 'mkdir -p /app/data/backups && cp /app/data/agent-arena.sqlite /app/data/backups/agent-arena-$(date +%Y%m%d-%H%M%S).sqlite'
docker cp "$(docker compose ps -q backend):/app/data/backups" ./backups
```

Before restoring data, stop the stack:

```bash
docker compose down
```

Restores should be done deliberately with a known backup file and a written note in the Server Information section above.

## Safety Rules

- Keep `.env` server-only and out of git.
- Keep `AGENT_ARENA_ENABLE_PREDICT_SUBMIT=true` only while live Testnet submit is intentional.
- Keep `AGENT_ARENA_ENABLE_REGISTRY_SUBMIT=false` until the current owner-sender-enforced registry package is published and the authority key is installed server-side.
- Do not fund the registry authority address just for registry claim/rotation; owner wallets pay registry gas.
- Keep `AGENT_ARENA_WALLET_SECRET` server-only because it encrypts platform-managed Agent trading wallet private keys.
- Do not copy `backend-data` into git.
- Do not expose `/api/arena/internal/*` through docs, frontend code, or external Agent instructions.
- Do not use Mainnet assets with this MVP.

## Useful Verification

Render the Compose config:

```bash
docker compose config
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
