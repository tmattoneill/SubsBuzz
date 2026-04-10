# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the SubsBuzz microservices ecosystem.

## 🏗️ Architecture Overview

SubsBuzz is a **microservices application** for AI-powered email digest generation. The system consists of independent, containerized services that communicate via REST APIs.

### Core Services

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   API Gateway    │───▶│   Data Server   │
│   (React SPA)   │    │   (FastAPI)      │    │   (Node.js)     │
│   Port: 5500/   │    │   Port: 8000     │    │   Port: 3001    │
│   Docker: 3000  │    │                  │    │                 │
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
│   ├── docker/           # Docker utilities
│   ├── scripts/          # Deployment scripts
│   ├── postgres/         # Database init scripts
│   └── systemd/          # Systemd service files
├── tests/                # Integration & E2E tests
├── docs/                 # Documentation
├── worker-test/          # Experimental remote worker (keep for now)
├── .env.dev              # Development environment
├── .env.prod             # Production environment
├── .env.example          # Environment template
├── docker-compose.yml    # Production Docker compose
├── package.json          # Root workspace management
├── start-all.sh          # Quick start all services
├── stop-all.sh           # Stop all services
└── CLAUDE.md            # This file
```

---

## ⚡ Quick Start

### Development (Local)

**Start all backend services:**
```bash
./start-all.sh
```

This starts:
- Data Server on port 3001
- API Gateway on port 8000
- PostgreSQL (if not running)

**Manual service startup:**
```bash
# Terminal 1 - Data Server
cd services/data-server && npm run dev

# Terminal 2 - API Gateway
cd services/api-gateway && python3 main.py

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

**Database Tests:**
```bash
node tests/test-database.js
node tests/test-database-simple.js
```

**Service Tests:**
```bash
node tests/test-data-server.js      # Data Server API
node tests/test-api-gateway.js      # API Gateway auth & routing
```

**Integration Tests:**
```bash
node tests/test-integration.js              # End-to-end service communication
node tests/test-complete-email-pipeline.js  # Gmail → OpenAI → Database
node tests/test-digest-creation-only.js     # Core digest logic
```

**Prerequisites for Tests:**
1. PostgreSQL running
2. Data Server running on port 3001
3. API Gateway running on port 8000
4. Environment variables configured in `.env.dev`

---

## 🔧 Environment Configuration

### Development vs Production

**Development:** Use `.env.dev`
```bash
cp .env.example .env.dev
# Edit .env.dev with your credentials
./start-all.sh
```

**Production:** Use `.env.prod`
```bash
cp .env.example .env.prod
# Edit .env.prod with production credentials
docker-compose up -d
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
OAUTH_REDIRECT_URI=http://localhost:8000/auth/callback
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
5. `docker compose down --remove-orphans && build --no-cache && up -d`
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
# Check all services are running
curl http://localhost:3001/health    # Data Server
curl http://localhost:8000/health    # API Gateway

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

### Communication Patterns
- **Synchronous:** HTTP REST APIs between services
- **Asynchronous:** Redis/Celery for background email processing

---

## 🆘 Troubleshooting

### Port Conflicts

```bash
# Kill processes on specific ports
lsof -ti:3001 | xargs kill -9   # Data Server
lsof -ti:8000 | xargs kill -9   # API Gateway
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
- `docs/` - Detailed documentation
- `infrastructure/nginx/` - Nginx configurations
- `infrastructure/scripts/` - Deployment scripts
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

**Branch:** `main`
**Last Updated:** 09/04/2026, 18:49:57

### Active Todos
- [ ] [high] Continue UI overhaul testing with all services verified running (`ui-overhaul`)
- [ ] [high] Monitor OAuth session persistence in production to ensure 30-day DB-backed tokens work correctly (`main`)
- [ ] [high] Create automated tests for the new DB-backed OAuth session token persistence to prevent regressions (`main`)
- [ ] [medium] Debug CSS specificity and next-themes integration timing issues (`ui-overhaul`)
- [ ] [medium] Test cross-service communication after CORS middleware reordering (`ui-overhaul`)
- [ ] [medium] Commit the modified CLAUDE.md documentation updates (`main`)
- [ ] [medium] Verify all microservices communicate properly after recent CORS fixes (`main`)
- [ ] [medium] Verify the 3AM UTC digest schedule is working properly by checking tomorrow's digest generation (`main`)
- [ ] [medium] Add monitoring/alerting for Celery beat scheduler health to catch future scheduling issues (`main`)
- [ ] [medium] Set up logging and monitoring for the Celery beat scheduler to track digest generation timing and failures (`main`)
- [ ] [medium] Test the enhanced email processing pipeline with real email data to validate the richer per-email processing (`main`)
- [ ] [low] Consider merging ui-overhaul to main once testing is complete (`ui-overhaul`)
- [ ] [low] Document the OAuth persistence changes and 3AM schedule change in user-facing documentation (`main`)
- [ ] [low] Test the Claude Code plan label persistence bug reproduction steps and document the workaround (`main`)

<!-- DEVCTX:END -->
