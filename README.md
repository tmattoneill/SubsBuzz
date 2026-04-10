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
