# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the SubsBuzz microservices ecosystem.

## 🏗️ Architecture Overview

SubsBuzz is a **microservices application** for AI-powered email digest generation. The system consists of independent, containerized services that communicate via REST APIs.

### Core Services

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   API Gateway    │───▶│   Data Server   │
│   (React SPA)   │    │   (FastAPI)      │    │   (Node.js)     │
│   Local: 5500   │    │   Local:  8080   │    │   Port: 3001    │
│   Dev:   5501   │    │   Dev:    8001   │    │   (all envs)    │
│   Prod:  3000   │    │   Prod:   8000   │    │                 │
│                 │    │ • JWT Auth       │    │ • PostgreSQL    │
│ • Production:   │    │ • Rate Limiting  │    │ • OpenAI API    │
│   Docker + Nginx│    │ • Routing        │    │ • Drizzle ORM   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Email Worker   │───▶│   PostgreSQL    │
                       │  (Python/Celery)│    │   Database      │
                       │  Background     │    │   Port: 5432    │
                       │                 │    │                 │
                       │ • Gmail API     │    │ • User Data     │
                       │ • Task Queue    │    │ • Digests       │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │  Message Broker │
                       │   Port: 6379    │
                       │                 │
                       │ • Celery Queue  │
                       │ • Cache Layer   │
                       └─────────────────┘
```

---

## 📁 Project Structure

```
/SubsBuzz/
├── services/              # Microservices (THE source of truth)
│   ├── api-gateway/       # FastAPI public API
│   ├── data-server/       # Node.js internal API + business logic
│   ├── email-worker/      # Python Celery background tasks
│   └── frontend/          # Production React build container
├── infrastructure/        # Deployment & configuration
│   ├── nginx/            # Nginx configs (dev & prod)
│   └── postgres/         # Database init + migrate.sql
├── tests/                # Integration & E2E tests
├── docs/                 # WORKFLOW.md (end-to-end ship runbook)
├── .env.dev              # Development secrets (gitignored)
├── .env.prod             # Production secrets (gitignored)
├── .env.example          # Environment template
├── docker-compose.yml    # Production compose
├── docker-compose.dev.yml # Development compose (different ports)
├── deploy.sh             # Promote current branch → dev.subsbuzz.com
├── promote.sh            # Promote main → subsbuzz.com (prod)
├── start-all.sh          # Run services locally (non-Docker)
├── stop-all.sh           # Stop local services
├── package.json          # Root workspace management
└── CLAUDE.md             # This file
```

---

## ⚡ Quick Start

### Development (Local — brew services, no Docker)

**Start all backend services:**
```bash
./start-all.sh
```

This starts:
- Data Server on port **3001**
- API Gateway on port **8080**
- Frontend on port **5500**
- PostgreSQL on 5432 / Redis on 6379 (if not running)

**Open the app at http://127.0.0.1:5500** — use `127.0.0.1` (not `localhost`) so the origin matches the OAuth callback host.

#### ⚠️ !IMPORTANT — Local ports are GCP-constrained, do NOT change them

These exact ports (`5500 / 8080 / 3001`) are pinned because they're the ones already in the GCP OAuth client's allowlist:
- **JS origins** approved: `http://localhost:5500`, `http://127.0.0.1:5500`
- **Redirect URI** approved: `http://127.0.0.1:8080/auth/callback`

If you pick different ports, Google will reject sign-in with `redirect_uri_mismatch` and you'll have to add new URIs to GCP — which is exactly the loop we're avoiding. Do NOT confuse these with the remote dev-server ports (`5501 / 8001 / 3002`, defined in `.env.dev` for docker-compose.dev.yml).

#### Local env is `.env.local`, not `.env.dev`

Local dev has its own env file (gitignored) separate from the remote dev/prod ones:

| File | Used by | Runs against |
|---|---|---|
| `.env.local` | `./start-all.sh` | brew postgres (5432) + brew redis (6379) on your Mac |
| `.env.dev` | `./deploy.sh` → `dev.subsbuzz.com` | docker-compose.dev.yml on the remote server |
| `.env.prod` | `./promote.sh` → `subsbuzz.com` | docker-compose.yml on the remote server |

`start-all.sh` sources `.env.local` with `set -a` (so every var auto-exports to child processes) and then distributes it to `services/{data-server,api-gateway,email-worker}/.env` on every run. **The service-level `.env` files are generated artifacts — don't hand-edit them, your changes will be overwritten on next `./start-all.sh`.**

If `.env.local` doesn't exist, copy `.env.dev` as a starting point and then edit:
- `DATABASE_URL=postgresql://$(whoami)@localhost:5432/subsbuzz_dev` (brew pg has no password by default)
- `DB_PORT=5432` / `REDIS_PORT=6379` (not 5433/6380 which are the docker ports)
- `UI_PORT=5500` / `API_GATEWAY_PORT=8080` / `DATA_SERVER_PORT=3001` / `PORT=3001`
- `UI_URL=http://127.0.0.1:5500` / `API_GATEWAY_URL=http://127.0.0.1:8080` / `DATA_SERVER_URL=http://localhost:3001`
- `OAUTH_REDIRECT_URI=http://127.0.0.1:5500/auth/callback` (port 5500 — frontend serves `/auth/callback`, NOT the api-gateway)
- `VITE_API_URL=http://127.0.0.1:8080`
- `CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500`
- `ALLOW_HTTP_OAUTH=true` / `SSL_ENABLED=false`

**Manual service startup** (rarely needed — `./start-all.sh` does it all):
```bash
# Terminal 1 - Data Server
cd services/data-server && npm run dev

# Terminal 2 - API Gateway (note: 8080 locally, not 8000)
cd services/api-gateway && python3 -m uvicorn main:app --port 8080

# Terminal 3 - Email Worker (optional)
cd services/email-worker && python3 main.py
```

**Stop all services:**
```bash
./stop-all.sh
```

### Production (Docker)

**Build and start all services:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f
docker-compose logs -f data-server  # specific service
```

**Stop services:**
```bash
docker-compose down
```

---

## 🚀 Service-Specific Development

### 1. Data Server (Node.js + Express + Drizzle ORM)

**Location:** `services/data-server/`

**Technology:** Node.js, Express, TypeScript, Drizzle ORM, OpenAI API

**Commands:**
```bash
cd services/data-server

npm run dev              # Development server (port 3001)
npm run build            # Production build
npm run start            # Start built version
npm run check            # TypeScript type checking

# Database operations (Drizzle ORM)
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio (visual DB editor)
```

**Database Schema:**
- Location: `services/data-server/src/db/schema.ts`
- ORM: Drizzle ORM
- Database: PostgreSQL
- Tables: users, monitored_emails, email_digests, digest_emails, user_settings, oauth_tokens, thematic_digests, thematic_sections, theme_source_emails

**Key Files:**
- `src/index.ts` - Express server entry point
- `src/db.ts` - Database connection
- `src/db/schema.ts` - Database schema
- `src/routes/` - API routes
- `src/services/` - Business logic (storage, openai, thematic-processor)
- `src/middleware/` - Auth, health, error handling

**Environment Variables:**
```bash
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://postgres@localhost:5432/subsbuzz_dev
OPENAI_API_KEY=sk-proj-...
INTERNAL_API_SECRET=...
```

---

### 2. API Gateway (FastAPI + Python)

**Location:** `services/api-gateway/`

**Technology:** Python, FastAPI, JWT authentication, httpx

**Commands:**
```bash
cd services/api-gateway

python3 main.py          # Start FastAPI server (port 8000)
# OR
uvicorn main:app --reload --port 8000

# Install dependencies
pip install -r requirements.txt
```

**Key Files:**
- `main.py` - FastAPI application entry point
- `routes/` - API route handlers (auth, digest, monitored_emails, settings)
- `middleware.py` - CORS, rate limiting, security
- `auth.py` - Firebase & JWT authentication
- `config.py` - Configuration management
- `health.py` - Health check endpoint

**Environment Variables:**
```bash
JWT_SECRET=...
DATA_SERVER_URL=http://localhost:3001
INTERNAL_API_SECRET=...
ALLOWED_ORIGINS=["http://localhost:5500"]
```

---

### 3. Email Worker (Python + Celery)

**Location:** `services/email-worker/`

**Technology:** Python, Celery, Gmail API, Redis

**Commands:**
```bash
cd services/email-worker

python3 main.py          # Start Celery worker
# OR
celery -A tasks worker --loglevel=info

# Install dependencies
pip install -r requirements.txt
```

**Key Files:**
- `main.py` - Celery worker entry point
- `tasks.py` - Background task definitions
- `gmail_client.py` - Gmail API integration
- `content_extractor.py` - Email parsing logic

**Environment Variables:**
```bash
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
DATA_SERVER_URL=http://localhost:3001
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
INTERNAL_API_SECRET=...
```

---

### 4. Frontend Service (React SPA)

**Location:** `services/frontend/`

**Technology:** React + TypeScript + Vite, Tailwind CSS, served by Nginx in production

**Commands:**
```bash
cd services/frontend

npm install              # Install dependencies
npm run dev              # Vite dev server (port 5500)
npm run build            # Production build → dist/
npm run preview          # Preview production build
```

**Key Files:**
- `src/main.tsx` - React entry point
- `src/App.tsx` - Root component / router
- `src/pages/` - Route pages (dashboard, digest, history, settings, login, etc.)
- `src/components/` - UI components (`dashboard/`, `layout/`, `ui/`, `ErrorBoundary.tsx`)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Client-side utilities and API helpers
- `vite.config.ts` - Vite build config
- `tailwind.config.ts` - Tailwind config
- `Dockerfile` - Multi-stage build (Vite build → Nginx serve)
- `nginx.conf` / `nginx-global.conf` - Production Nginx configs

**Backend Integration:**
- Talks to API Gateway at `http://localhost:8000` in dev
- CORS for the dev origin is configured in the API Gateway

**For Production:**
```bash
docker-compose up frontend
```

---

## 🗄️ Database Management

### PostgreSQL with Drizzle ORM

**Start PostgreSQL:**
```bash
brew services start postgresql     # macOS
sudo systemctl start postgresql   # Linux
docker-compose up postgres        # Docker
```

**Database Operations:**
```bash
cd services/data-server

# Generate migrations from schema changes
npm run db:generate

# Run migrations
npm run db:migrate

# Visual database editor
npm run db:studio
```

**Schema Location:**
- `services/data-server/src/db/schema.ts`

**Database Tables:**
- `users` - User accounts
- `monitored_emails` - Email addresses to monitor per user
- `oauth_tokens` - Gmail OAuth tokens (encrypted)
- `email_digests` - Generated digest summaries
- `digest_emails` - Individual processed emails with AI analysis
- `user_settings` - User preferences
- `thematic_digests` - Daily thematic meta-summaries
- `thematic_sections` - Individual themes within digests
- `theme_source_emails` - Links themes to source emails

---

## 🧪 Testing

### Run All Tests

```bash
npm test
# OR
node tests/run-tests.js
```

### Individual Test Suites

```bash
node tests/test-database-simple.js  # PostgreSQL connectivity
node tests/test-data-server.js      # Data Server API + auth middleware
node tests/test-api-gateway.js      # API Gateway health, auth, CORS
node tests/test-integration.js      # Cross-service error propagation + load
```

**Prerequisites:** All services running (PostgreSQL, Data Server on 3001, API Gateway on 8000) and `.env.dev` configured.

**Remote (dev server):** override the ports to match `docker-compose.dev.yml`:
```bash
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  API_GATEWAY_URL=http://localhost:8001 \
  DATA_SERVER_URL=http://localhost:3002 \
  DATABASE_URL=\$(grep '^DATABASE_URL=' .env | cut -d= -f2-) \
  INTERNAL_API_SECRET=\$(grep '^INTERNAL_API_SECRET=' .env | cut -d= -f2-) \
  node tests/run-tests.js"
```

---

## 🔧 Environment Configuration

### Three env files — one per environment

| File | Who uses it | Target |
|---|---|---|
| `.env.local` | `./start-all.sh` | Local Mac (brew postgres + brew redis, no Docker). Ports `5500 / 8080 / 3001`. |
| `.env.dev` | `./deploy.sh` | `dev.subsbuzz.com` (docker-compose.dev.yml on remote). Ports `5501 / 8001 / 3002`. |
| `.env.prod` | `./promote.sh` | `subsbuzz.com` (docker-compose.yml on remote). Ports `5500 / 8000 / 3001`. |

All three are gitignored. **`.env.local` must never be edited to point at docker ports or remote URLs** — if something's broken locally, fix the code or the brew service, not `.env.local`.

**Local:** Use `.env.local`
```bash
cp .env.example .env.local
# Edit: DATABASE_URL=postgresql://$(whoami)@localhost:5432/subsbuzz_dev
# Edit: ports to 5500 / 8080 / 3001 (see "Development (Local)" section above)
./start-all.sh
```

**Remote dev:** Use `.env.dev`
```bash
cp .env.example .env.dev
# Edit .env.dev with dev credentials (docker-compose.dev.yml ports)
./deploy.sh
```

**Production:** Use `.env.prod`
```bash
cp .env.example .env.prod
# Edit .env.prod with production credentials
./promote.sh
```

### Key Environment Variables

**Database:**
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/subsbuzz_dev
POSTGRES_PASSWORD=your_secure_password
```

**Security:**
```bash
JWT_SECRET=long-random-secret-key-at-least-32-characters
INTERNAL_API_SECRET=service-to-service-auth-secret
```

**Google OAuth:**
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
# LOCAL: must be exactly http://127.0.0.1:5500/auth/callback
#   — port 5500 (frontend), NOT 8080 (api-gateway).
#   /auth/callback is served by the React SPA which then POSTs to /api/auth/oauth-callback.
#   See services/frontend/src/pages/auth-callback.tsx. Using port 8080 gives "Not Found"
#   because the api-gateway's route is at /api/auth/callback (with the /api prefix).
# Remote dev: https://dev.subsbuzz.com/auth/callback  (nginx → frontend → api-gateway)
# Prod:       https://subsbuzz.com/auth/callback
OAUTH_REDIRECT_URI=http://127.0.0.1:5500/auth/callback
```

**OpenAI:**
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

**Service URLs:**
```bash
DATA_SERVER_URL=http://localhost:3001
API_GATEWAY_URL=http://localhost:8000
```

---

## 🚢 Deployment

Both `deploy.sh` (dev) and `promote.sh` (prod) run **from your local machine**, not on the server. They:

1. Push the current branch to GitHub
2. SSH the server, clone-if-missing, `git fetch && reset --hard`, `git clean -fd`
3. rsync the local env file → `.env` on the server (`.env.dev` → `.env`, or `.env.prod` → `.env`)
4. rsync the right compose file → `docker-compose.yml` on the server
5. `docker compose down --remove-orphans && build && up -d` (uses docker layer cache — removed `--no-cache` on 2026-04-14 to conserve server disk space)
6. Health-check the public ports

Both dev and prod live on the **same server** (SSH alias `subsbuzz`) in different directories on disjoint host ports — they coexist.

### Development Deployment (dev.subsbuzz.com)

```bash
./deploy.sh
```

- Default branch: `main` (warns and prompts if you're on another branch)
- Server dir: `/home/webdev/sites/dev.subsbuzz.com`
- Sends: `.env.dev` → `.env`, `docker-compose.dev.yml` → `docker-compose.yml`
- Health-checks ports `8001 / 3002 / 5501`

### Production Deployment (subsbuzz.com)

```bash
./promote.sh
```

- Refuses to run unless you're on `main` with a clean tree
- Verifies local `main` matches `origin/main`
- Requires explicit `yes` confirmation
- Server dir: `/home/webdev/sites/subsbuzz.com`
- Sends: `.env.prod` → `.env`, `docker-compose.yml` → `docker-compose.yml`
- Health-checks ports `8000 / 3001 / 3000`

### Emergency clean rebuild (skip docker layer cache)

Normal deploys reuse docker's build cache. For the rare case where a dependency has corrupted or a base image needs a fresh pull, opt in explicitly:

```bash
NO_CACHE=1 ./deploy.sh
NO_CACHE=1 ./promote.sh
```

Each run eats ~2 GB of server disk. Repeated unconditional `--no-cache` builds were the root cause of the April 2026 disk-pressure incident (see commit `f5ab3e8`).

### Dev email-worker is opt-in (profile-gated)

`docker-compose.dev.yml` puts the dev `email-worker` service behind `profiles: [workers]`. Plain `./deploy.sh` does NOT start it — intentional, so dev doesn't burn OpenAI credits or duplicate prod's 03:00 UTC digest schedule. To enable it for Celery debugging:

```bash
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  docker compose -f docker-compose.dev.yml --profile workers up -d email-worker"
```

Stop again with `docker compose -f docker-compose.dev.yml stop email-worker`. Prod's worker is always on — only dev is gated.

### ⚠️ !IMPORTANT — env file source-of-truth and drift

`.env.dev` and `.env.prod` are **gitignored** and live only on (a) your local machine and (b) the server. They drift if anyone edits them in only one place. `deploy.sh` and `promote.sh` treat the **local** file as source of truth and overwrite the server's copy via `rsync`.

**Before running `deploy.sh` or `promote.sh`, verify your local file matches what's actually running on the server:**

```bash
# For deploy.sh — verify .env.dev
ssh subsbuzz "cat /home/webdev/sites/dev.subsbuzz.com/.env.dev" | sha256sum
sha256sum .env.dev
# Hashes must match. If not, pull the server file down first:
#   cp .env.dev .env.dev.local-backup
#   scp subsbuzz:/home/webdev/sites/dev.subsbuzz.com/.env.dev .env.dev
#   chmod 600 .env.dev

# For promote.sh — same drill against the prod dir
ssh subsbuzz "cat /home/webdev/sites/subsbuzz.com/.env.prod" | sha256sum  # if a prod checkout exists
sha256sum .env.prod
```

**Why this matters:** if local is stale, the rsync overwrites the working server file with broken values (missing `POSTGRES_PASSWORD`, `CELERY_BROKER_URL`, `CORS_ORIGINS`, etc.) → containers come up broken or refuse to start.

**Key-only diff (no values exposed) for a structural sanity check:**

```bash
ssh subsbuzz "grep -E '^[A-Z_]+=' /home/webdev/sites/dev.subsbuzz.com/.env.dev | cut -d= -f1 | sort" > /tmp/server_keys.txt
grep -E '^[A-Z_]+=' .env.dev | cut -d= -f1 | sort > /tmp/local_keys.txt
diff /tmp/server_keys.txt /tmp/local_keys.txt && echo "✓ key sets match"
```

Any key set drift, especially `POSTGRES_*` / `REDIS_*` / `SESSION_SECRET` / `INTERNAL_API_SECRET` / `JWT_SECRET`, is a hard blocker — resolve before deploying.

### Nginx & SSL (one-time bootstrap, not per-deploy)

- Dev: `infrastructure/nginx/dev.subsbuzz.com.conf`
- Prod: `infrastructure/nginx/subsbuzz.conf`

These live at `/etc/nginx/sites-enabled/...` on the server, outside `$REMOTE_DIR`. They survive `rm -rf $REMOTE_DIR`. New servers need a one-time bootstrap (nginx install, certbot, systemd) before `deploy.sh` will work end-to-end.

---

## 🔍 Service Health Checks

```bash
# Local dev (./start-all.sh)
curl http://localhost:3001/health    # Data Server
curl http://127.0.0.1:8080/health    # API Gateway (8080 locally, GCP-pinned)

# Docker services
docker-compose ps
docker-compose logs -f
```

---

## 🐳 Docker Commands

### Build & Run

```bash
# Build all services
docker-compose build
# OR per service
docker-compose build data-server

# Start services
docker-compose up -d

# Start specific service
docker-compose up -d data-server

# View logs
docker-compose logs -f
docker-compose logs -f data-server

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Database in Docker

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d subsbuzz

# Backup database
docker-compose exec postgres pg_dump -U postgres subsbuzz > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d subsbuzz
```

---

## 📦 NPM Scripts (Root)

From the root directory:

```bash
npm run start:all        # ./start-all.sh
npm run stop:all         # ./stop-all.sh
npm run test             # Run all tests

# Build commands
npm run build:all        # Build all services
npm run build:data-server
npm run build:api-gateway
npm run build:frontend

# Development commands
npm run dev:data-server
npm run dev:api-gateway
npm run dev:email-worker

# Docker commands
npm run docker:build
npm run docker:up
npm run docker:down
npm run docker:logs

# Database commands
npm run db:generate
npm run db:migrate
npm run db:studio
```

---

## 🔑 Key Implementation Notes

### Service Independence
- Each service has its own `package.json` or `requirements.txt`
- No shared code between services (except via REST APIs)
- Services can be deployed and scaled independently

### Database Strategy
- **PostgreSQL** with Drizzle ORM in data-server
- Schema location: `services/data-server/src/db/schema.ts`
- Migrations managed via `npm run db:generate` and `npm run db:migrate`

### Authentication Flow
- **Public API:** API Gateway handles JWT authentication
- **Internal API:** Data Server requires `INTERNAL_API_SECRET` header
- **Service-to-Service:** API Gateway and Email Worker authenticate to Data Server

### OAuth Token Persistence (DB-backed sessions)
OAuth tokens are persisted to PostgreSQL rather than held in memory, so sessions survive service restarts:

- **On OAuth callback:** API Gateway stores `accessToken`, `refreshToken`, and `expiresAt` via `POST /api/storage/oauth-tokens` on the Data Server
- **Session token:** A separate 30-day `sessionToken` is created via `POST /api/storage/session-token/:uid` and stored in `oauth_tokens.session_expires_at`
- **Token refresh:** Email Worker queries expiring tokens every 6 hours (`tasks.refresh_oauth_tokens`) and refreshes them via Google's OAuth API, then patches the DB via `PATCH /api/storage/oauth-token/:uid`
- **Key schema fields:** `oauth_tokens` table — `access_token`, `refresh_token`, `expires_at`, `session_token`, `session_expires_at`
- **Session validation:** `POST /api/storage/session-validate` — returns 200 if valid, 401 if expired/invalid

### Digest Schedule
The daily digest is generated by Celery beat in the email worker:

- **Schedule:** 3AM UTC daily (`crontab(hour=3, minute=0)` in `services/email-worker/main.py`)
- **Task:** `tasks.generate_daily_digests` — fetches emails for all users, runs AI analysis, writes to `email_digests` + `thematic_digests` tables
- **Token refresh:** Also runs every 6 hours (`crontab(minute=0, hour='*/6')`)

### Communication Patterns
- **Synchronous:** HTTP REST APIs between services
- **Asynchronous:** Redis/Celery for background email processing

---

## 🆘 Troubleshooting

### Port Conflicts

```bash
# Kill processes on specific ports (local dev)
lsof -ti:3001 | xargs kill -9   # Data Server
lsof -ti:8080 | xargs kill -9   # API Gateway (local; remote dev uses 8001, prod uses 8000)
lsof -ti:5500 | xargs kill -9   # Frontend
lsof -ti:5432 | xargs kill -9   # PostgreSQL

# OR use stop script
./stop-all.sh
```

### PostgreSQL Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL
brew services start postgresql     # macOS
sudo systemctl start postgresql   # Linux

# Create database
createdb subsbuzz_dev

# Reset database (CAUTION: destroys data)
dropdb subsbuzz_dev && createdb subsbuzz_dev
cd services/data-server && npm run db:migrate
```

### Service Not Starting

```bash
# Check logs
tail -f logs/data-server.log
tail -f logs/api-gateway.log

# Check environment variables
cat .env.dev

# Verify services directory
ls -la services/
```

### Schema Import Path

All schema imports inside the data-server should resolve to:
```typescript
import { ... } from '../db/schema.js';  // In data-server source files
```

The canonical schema lives at `services/data-server/src/db/schema.ts` and is referenced by `services/data-server/drizzle.config.ts`. There is no longer a root-level `shared/` directory.

---

## 📚 Additional Documentation

- `README.md` - Project overview
- `docs/WORKFLOW.md` - End-to-end ship runbook (local → dev → prod)
- `infrastructure/nginx/` - Nginx reverse-proxy configs (dev + prod)
- `infrastructure/postgres/` - `init.sql` + idempotent `migrate.sql`
- `services/*/README.md` - Service-specific documentation

---

## 🎯 Architecture Summary

**✅ Clean Microservices:** Each service is independent and self-contained

**✅ Single Codebase:** Both dev and prod use same code, different `.env`

**✅ PostgreSQL Database:** Drizzle ORM with schema in data-server

**✅ Docker Ready:** All services containerized for production

**✅ Scalable:** Each service can be scaled independently

---

**Version:** 2.0.0 (Microservices Architecture)
**Last Updated:** October 2025

<!-- DEVCTX:START -->
## Project Context (auto-updated by devctx)

> **IMPORTANT:** When starting a new conversation, greet the user with a brief summary of the project context below — current focus, branch, and any active todos. Keep it to 2-3 sentences. Do not skip this greeting.

**Project:** SubsBuzz - AI-powered email digest application with microservices architecture

**Branch:** `email/cleanup-mails`
**Last Updated:** 15/04/2026, 07:22:15

### Active Todos
- [ ] [high] Monitor prod digest quality — first prod digest runs 03:00 UTC (add monitored emails beforehand). Watch for reasoning_effort regression. (`main`)
- [ ] [high] [TEEPER-81] Verify multi-user support — confirm each user has isolated Google OAuth, account data, and settings; identify any shared-state issues https://linear.app/teemo-personal-projects/issue/TEEPER-81 (`main`)
- [ ] [high] Push email/cleanup-mails branch to remote repository (`email/cleanup-mails`)
- [ ] [high] Create pull request to merge email/cleanup-mails into main (`email/cleanup-mails`)
- [ ] [medium] [TEEPER-82] Add unit tests for OpenAI reasoning_effort parameter handling https://linear.app/teemo-personal-projects/issue/TEEPER-82 (`main`)
- [ ] [medium] [TEEPER-80] Support Gmail labels in addition to sender addresses — users choose label(s) to monitor and all emails in those labels are pulled in for analysis https://linear.app/teemo-personal-projects/issue/TEEPER-80 (`main`)
- [IN PROGRESS] [medium] [TEEPER-42] Post-processing inbox cleanup option — toggle in profile to archive+remove from inbox after processing, OR move to a chosen label+remove from inbox https://linear.app/teemo-personal-projects/issue/TEEPER-42 (`main`)
- [ ] [medium] [TEEPER-40] Improve monitored emails UI — currently a single long list; redesign with better visual management (search, filtering, grouping, bulk actions, etc.) https://linear.app/teemo-personal-projects/issue/TEEPER-40 (`main`)
- [ ] [medium] [TEEPER-86] Remove Firebase from api-gateway — dead code (firebase_admin init, /auth/firebase endpoint, requirements.txt entry). Refactor not a delete. https://linear.app/teemo-personal-projects/issue/TEEPER-86 (`main`)
- [ ] [medium] Update TEEPER-42 status from in_progress to review/complete (`email/cleanup-mails`)
- [ ] [medium] Test the Gmail cleanup functionality in development environment (`email/cleanup-mails`)
- [ ] [medium] Consider adding unit tests for the new cleanup configuration options (`email/cleanup-mails`)
- [ ] [low] [TEEPER-83] Document the gpt-5.4-nano reasoning mode discovery and fix in technical docs https://linear.app/teemo-personal-projects/issue/TEEPER-83 (`main`)

<!-- DEVCTX:END -->
