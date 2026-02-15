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

**Technology:** React, Docker, Nginx (production)

**Note:** Frontend source code is not currently in this repository. The `services/frontend/` directory contains only the production Docker container configuration.

**For Development:**
- Frontend should be developed separately
- Use API Gateway at `http://localhost:8000` as backend
- CORS is configured for `http://localhost:5500`

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

### Development Deployment (dev.subsbuzz.com)

Use the same codebase with `.env.dev`:

```bash
# On development server
git pull origin main
cp .env.example .env.dev
# Edit .env.dev with dev credentials
./start-all.sh
```

**Nginx Configuration:** `infrastructure/nginx/dev.subsbuzz.com.conf`

### Production Deployment (subsbuzz.com)

Use the same codebase with `.env.prod`:

```bash
# On production server
git pull origin main
cp .env.example .env.prod
# Edit .env.prod with production credentials
docker-compose up -d
```

**Nginx Configuration:** `infrastructure/nginx/subsbuzz.conf`

### Deployment Scripts

```bash
# Development deployment
./infrastructure/scripts/deploy-dev.sh

# Production deployment (create if needed)
./infrastructure/scripts/deploy-prod.sh
```

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

### Import Errors After Cleanup

All schema imports should now point to:
```typescript
import { ... } from '../db/schema.js';  // In data-server files
```

If you see errors about `shared/schema`, the imports weren't updated correctly.

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

**Project:** AI-powered email digest generation microservices application with React frontend, FastAPI gateway, Node.js data server, and Python/Celery email worker

**Branch:** `ui-overhaul`
**Last Updated:** 15/02/2026, 13:40:52

<!-- DEVCTX:END -->
