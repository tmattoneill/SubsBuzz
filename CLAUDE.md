# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Server
```bash
npm run dev              # Development server on port 5500 with hot reload
npm run dev:load-env     # Development with explicit .env.dev file loading
```
Both commands serve API and client using tsx and Vite hot reloading. The second variant explicitly loads `.env.dev`.

### Build and Production
```bash
npm run build       # Production build (client + server bundle)
npm run start       # Start production server from built files
npm run start:prod  # Start with production environment (.env.prod)
```
Build creates production bundle using Vite for client and esbuild for server.

### Type Checking and Database
```bash
npm run check      # TypeScript type checking
npm run db:push    # Push database schema changes using Drizzle
```

## Architecture Overview

This is a full-stack email digest application built with TypeScript, Express, React, and PostgreSQL.

### Core Components

**Server Architecture** (`server/`):
- `index.ts` - Main Express server with request logging and error handling
- `routes.ts` - API routes for auth, digest generation, monitored emails, and settings
- `cron.ts` - Scheduled jobs for daily digest generation at 7:00 AM
- `gmail.ts` - Gmail API integration for fetching emails
- `openai.ts` - OpenAI integration for email analysis and digest generation
- `storage.ts` - Database operations using Drizzle ORM
- `auth.ts` - Firebase Admin authentication and OAuth token management

**Client Architecture** (`client/src/`):
- React SPA using Wouter for routing and TanStack Query for data fetching
- `App.tsx` - Main app with providers (QueryClient, ThemeProvider, AuthProvider)
- `pages/` - Page components (dashboard, history, favorites, settings, login)
- `components/ui/` - Shadcn/ui component library
- `lib/AuthContext.tsx` - Firebase auth with development mode bypass

**Database Schema** (`shared/schema.ts`):
- Users, monitored emails, email digests, digest emails, user settings, OAuth tokens
- Uses Drizzle ORM with PostgreSQL and Zod validation

### Key Features

**Email Processing Pipeline**:
1. Gmail OAuth integration for accessing user emails
2. Monitored email addresses configuration
3. Automated daily email fetching and analysis using OpenAI
4. Topic clustering and keyword extraction
5. Digest generation with summaries and original links

**Development Mode**:
- `DEV_MODE = true` in `AuthContext.tsx` bypasses Firebase auth with mock user
- Development server serves at `127.0.0.1:5500` with API at `/api/*`
- OAuth redirects configured for `http://127.0.0.1:5500/auth/callback` in development
- **Requires PostgreSQL**: Uses persistent PostgreSQL storage for development
- Comes with pre-configured monitored emails for testing

**PostgreSQL Setup**:
1. Start PostgreSQL service:
```bash
brew services start postgresql          # Using Homebrew
# OR
pg_ctl -D /usr/local/var/postgres start # Using pg_ctl
# OR  
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres # Using Docker
```

2. Create database and user (first time only):
```bash
createuser -s postgres                  # Create postgres superuser
createdb subsbuzz_dev -O postgres      # Create development database
npm run db:push                        # Initialize database schema
```

**Configuration**:
- Firebase credentials in `firebase-service-account.json` and `service-account.json`
- OAuth credentials embedded in routes for Gmail API access
- Database URL required in environment for Drizzle migrations

### Technology Stack

- **Frontend**: React 18, TypeScript, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn/ui
- **Backend**: Express, TypeScript, Firebase Admin, Google APIs, OpenAI API
- **Database**: PostgreSQL with Drizzle ORM
- **Build**: Vite (client), esbuild (server), tsx (development)
- **Scheduling**: node-cron for automated digest generation

### Environment Configuration

**All sensitive credentials are managed via environment variables:**

- Development: `npm run dev` (uses `.env.dev`)
- Production: `npm run start:prod` (uses `.env.prod`)
- See `SECURITY.md` for complete credential setup guide

**Required Environment Variables:**
- `OPENAI_API_KEY` - OpenAI API access
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Gmail OAuth
- `FIREBASE_*` - Firebase server credentials  
- `VITE_FIREBASE_*` - Firebase client credentials
- `DATABASE_URL` - PostgreSQL connection string (production only)

**Pre-configured Monitored Emails** (for testing):
- `daily@pivot5.ai` - Tech industry updates
- `eletters@om.adexchanger.com` - Digital advertising news  
- `email@washingtonpost.com` - News updates

**Never commit `.env.dev` or `.env.prod` files to version control.**