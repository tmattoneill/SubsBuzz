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

This is a full-stack email digest application built with TypeScript, Express, React, and PostgreSQL that generates intelligent thematic summaries from monitored email sources.

### Core Components

**Server Architecture** (`server/`):
- `index.ts` - Main Express server with request logging and error handling
- `routes.ts` - API routes for auth, digest generation, monitored emails, and settings
- `cron.ts` - Scheduled jobs for daily digest generation at 7:00 AM
- `gmail.ts` - Gmail API integration for fetching emails (24-hour lookback, unlimited results)
- `openai.ts` - OpenAI integration for email analysis and digest generation
- `thematic-processor.ts` - **Core thematic digest processor** with 3-stage pipeline
- `storage.ts` - Database operations using Drizzle ORM with dual storage support
- `auth.ts` - Firebase Admin authentication and OAuth token management

**Client Architecture** (`client/src/`):
- React SPA using Wouter for routing and TanStack Query for data fetching
- `App.tsx` - Main app with providers (QueryClient, ThemeProvider, AuthProvider)
- `pages/dashboard.tsx` - **Intelligent digest switching** between thematic and individual email views
- `components/ui/thematic-digest.tsx` - **Thematic summary display component**
- `components/ui/` - Shadcn/ui component library
- `lib/AuthContext.tsx` - Firebase auth with development mode bypass

**Database Schema** (`shared/schema.ts`):
- **Dual-tier architecture**: Regular digests + thematic meta-digests
- Core tables: users, monitored emails, email digests, digest emails, user settings, OAuth tokens
- **Thematic tables**: thematic_digests, thematic_sections, theme_source_emails
- Uses Drizzle ORM with PostgreSQL and Zod validation

### Key Features

**Thematic Digest System** (Primary Feature):
1. **3-Stage Processing Pipeline**:
   - Stage 1: NLP analysis and email clustering by themes
   - Stage 2: LLM synthesis using GPT-4o-mini for narrative summaries  
   - Stage 3: Database storage with source email linking
2. **Intelligent Theme Discovery**: Hybrid NLP + LLM approach for topic clustering
3. **Journalistic Summaries**: Narrative-style thematic sections, not individual email descriptions
4. **Source Traceability**: Each thematic section links back to contributing source emails

**Email Processing Pipeline**:
1. Gmail OAuth integration for accessing user emails
2. **24-hour lookback window** with unlimited email ingestion
3. Monitored email addresses configuration (user-defined)
4. Automated daily email fetching and analysis using OpenAI
5. **Dual digest generation**: Individual email summaries + thematic meta-digest

**Storage Architecture**:
- **PostgreSQL Only**: Exclusively uses PostgreSQL database for all data storage
- **No In-Memory Storage**: All data persisted to database for reliability and consistency
- **Drizzle ORM**: Modern TypeScript-first ORM for database operations
- **Required for All Features**: Database connection mandatory for application startup

### Development Configuration

**PostgreSQL Always Required**:
The application requires PostgreSQL for all functionality including thematic digests, user data, and email processing.

**Automatic Database Setup**:
The application now automatically:
1. Checks if PostgreSQL is running and starts it if needed
2. Creates the database if it doesn't exist
3. Initializes all required tables and schema
4. Handles database migrations automatically

**Manual PostgreSQL Setup** (if automatic setup fails):
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

**Development Features**:
- Development server serves at `127.0.0.1:5500` with API at `/api/*`
- OAuth redirects configured for `http://127.0.0.1:5500/auth/callback` in development
- **Database required**: Always uses PostgreSQL with DATABASE_URL configuration

### Technology Stack

- **Frontend**: React 18, TypeScript, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn/ui
- **Backend**: Express, TypeScript, Firebase Admin, Google APIs, OpenAI API (GPT-4o-mini)
- **Database**: PostgreSQL with Drizzle ORM
- **Build**: Vite (client), esbuild (server), tsx (development)
- **Scheduling**: node-cron for automated digest generation
- **Email Processing**: Cheerio + html-to-text for content extraction

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
- `DATABASE_URL` - PostgreSQL connection string (enables thematic digests)

**Gmail API Configuration**:
- **24-hour lookback**: Fetches emails from monitored senders within last 24 hours
- **Unlimited results**: No maxResults limit - processes all matching emails
- **OAuth scopes**: gmail.readonly, userinfo.email, userinfo.profile

**OpenAI Configuration**:
- **Model**: GPT-4o-mini for cost-effective thematic summary generation
- **Individual analysis**: GPT-4o for detailed email summaries and topic extraction
- **Temperature**: 0.7 for balanced creativity in thematic narratives

**User Setup**:
- New users start with no monitored emails
- Users must manually add email addresses they want to monitor
- System generates both individual and thematic digests automatically

**Never commit `.env.dev` or `.env.prod` files to version control.**

## Important Implementation Notes

**Thematic Digest Priority**: The `/api/digest/latest` endpoint prioritizes thematic digests when available, falling back to regular digests for compatibility.

**Database Requirement**: The system requires PostgreSQL with DATABASE_URL configuration for all functionality.

**Email Fetching Strategy**: Gmail integration uses a 24-hour sliding window to ensure fresh content while avoiding overwhelming the API.

**Error Handling**: Thematic digest generation is fault-tolerant - failures don't prevent basic digest functionality.