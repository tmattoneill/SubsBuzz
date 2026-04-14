# SubsBuzz

AI-powered email digest application built with **microservices architecture** that monitors Gmail accounts and generates intelligent thematic summaries of newsletters, updates, and important communications.

## Overview

SubsBuzz automatically processes emails from monitored senders, uses OpenAI to generate summaries and extract topics, and presents them in a clean, organized dashboard.

### Features

- **Email Monitoring** — configure specific senders to watch
- **AI-Powered Analysis** — OpenAI GPT-4o-mini summarization and topic extraction
- **Thematic Digests** — 3-stage pipeline for narrative-style, theme-based summaries
- **Daily Automation** — Celery workers generate digests on schedule
- **Gmail OAuth 2.0** — multi-user support with per-user token management
- **Modern UI** — React dashboard with light/dark theme, calendar history, responsive design

## Architecture

```
Frontend (React SPA)  →  API Gateway (FastAPI)  →  Data Server (Node.js/Express)
   port 5500/3000           port 8000                   port 3001
                                 ↓
                          Email Worker (Celery)  →  PostgreSQL + Redis
```

| Service | Stack | Role |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind | User interface, OAuth flow |
| **API Gateway** | Python, FastAPI, JWT auth | Public API, routing, rate limiting |
| **Data Server** | Node.js, Express, Drizzle ORM | Database ops, OpenAI integration |
| **Email Worker** | Python, Celery, Gmail API | Background email processing |

## Project Structure

```
SubsBuzz/
├── services/
│   ├── api-gateway/       # FastAPI public API
│   ├── data-server/       # Node.js internal API + business logic
│   │   └── src/db/schema.ts   # Canonical database schema (Drizzle ORM)
│   ├── email-worker/      # Python Celery background tasks
│   └── frontend/          # React SPA (Vite build → Nginx in Docker)
│       └── src/           # App.tsx, pages/, components/, hooks/, lib/
├── infrastructure/
│   ├── nginx/             # Dev + prod Nginx configs
│   ├── postgres/          # Database init scripts
│   ├── scripts/           # Server bootstrap scripts
│   ├── ssl/               # SSL setup
│   └── systemd/           # Systemd service files
├── tests/                 # Integration & E2E tests
├── docker-compose.yml     # Production compose
├── docker-compose.dev.yml # Development compose (different ports)
├── deploy.sh              # Deploy current branch → dev.subsbuzz.com
├── promote.sh             # Promote main → subsbuzz.com (production)
├── start-all.sh           # Start services locally (non-Docker)
├── stop-all.sh            # Stop local services
├── .env.dev               # Dev secrets (gitignored)
├── .env.prod              # Prod secrets (gitignored)
├── .env.example           # Template
└── CLAUDE.md              # Canonical dev guide
```

## Quick Start

See **CLAUDE.md** for comprehensive setup, service-by-service commands, database management, environment config, Docker usage, and troubleshooting.

### Local development

```bash
cp .env.example .env.dev   # fill in credentials
./start-all.sh             # starts Data Server + API Gateway + PostgreSQL
```

### Docker (production)

```bash
docker compose up -d
```

### Deploy to dev

```bash
./deploy.sh                # pushes branch, rsyncs env + compose, rebuilds on server
```

### Promote to production

```bash
./promote.sh               # main branch only, explicit confirmation required
```

## Testing

```bash
npm test                   # runs full test suite (requires services running)
```

Individual suites: `test-database-simple.js`, `test-data-server.js`, `test-api-gateway.js`, `test-integration.js` — all under `tests/`.

## Deployment

Both `deploy.sh` (dev) and `promote.sh` (prod) run from your local machine. They push to GitHub, clone-or-reset the server checkout, rsync the right `.env` and `docker-compose.yml`, then rebuild containers. Dev and prod coexist on the same server on disjoint ports.

See CLAUDE.md for the full deployment guide and the **!IMPORTANT** env drift warning.

### Deploy operations reference

**Normal deploy (uses docker layer cache — fast, ~200 MB disk churn):**
```bash
./deploy.sh         # → dev.subsbuzz.com
./promote.sh        # → subsbuzz.com (prod; must be on clean main)
```

**Emergency clean rebuild (bypass layer cache — slow, ~2 GB disk per run):**
```bash
NO_CACHE=1 ./deploy.sh
NO_CACHE=1 ./promote.sh
```
Use only when a dependency has genuinely corrupted or a base image needs refreshing. Repeated `--no-cache` rebuilds are what filled the server disk in April 2026 (see commit history).

**Dev email-worker is opt-in** (gated behind `profiles: [workers]` in `docker-compose.dev.yml`). Plain `./deploy.sh` will **not** start it — this is intentional so dev doesn't burn OpenAI/Gmail credits or duplicate prod's 03:00 UTC digest schedule.

To enable dev's worker when actively debugging Celery tasks:
```bash
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  docker compose -f docker-compose.dev.yml --profile workers up -d email-worker"
```

To stop it again:
```bash
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  docker compose -f docker-compose.dev.yml stop email-worker"
```

**Disk maintenance (if the server gets tight again):**
```bash
ssh subsbuzz "sudo docker image prune --all --force && \
              sudo docker builder prune --all --force && \
              sudo journalctl --vacuum-size=500M"
```

## API

### Public (via API Gateway)

```
POST /auth/gmail-access       # Generate OAuth URL
GET  /auth/callback           # OAuth callback
POST /auth/firebase           # Firebase token auth
GET  /auth/validate           # Validate JWT
GET  /digest/latest           # Latest digest (thematic preferred)
GET  /digest/history          # Digest history with pagination
GET  /digest/date/:date       # Digest for specific date
POST /digest/generate         # Manually generate digest
GET  /monitored-emails        # List monitored senders
POST /monitored-emails        # Add monitored sender
DELETE /monitored-emails/:id  # Remove monitored sender
GET  /settings                # User settings
PATCH /settings               # Update settings
```

### Internal (Data Server, requires `x-internal-api-key`)

See `services/data-server/README.md` for the full internal API surface.

## Database

PostgreSQL with Drizzle ORM. Schema at `services/data-server/src/db/schema.ts`.

```bash
cd services/data-server
npm run db:generate   # generate migration files
npm run db:migrate    # run migrations
npm run db:studio     # visual DB editor
```

## License

MIT
