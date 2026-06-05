SubsBuzz: Managed Infrastructure Migration Plan

 Context

 The self-hosted Ubuntu server (subsbuzz.com / dev.subsbuzz.com) currently runs PostgreSQL, Redis, and a Docker volume for hero image caching
 alongside the application containers. The goal is to offload all stateful/storage services to cheap managed providers — freeing the server to run
 only the application containers (api-gateway, data-server, email-worker, frontend/nginx) and reducing operational overhead.

 Three migrations in sequence:
 1. Neon — managed serverless Postgres (full Postgres compatibility, zero code changes)
 2. Cloudflare R2 — object storage + CDN for hero images (replaces Docker named volume)
 3. Upstash — serverless Redis (replaces Docker redis container)

 Local dev (.env.local / start-all.sh) stays on brew postgres + brew redis. Only .env.dev and .env.prod point at managed services.

 ---
 Phase 1: Neon (PostgreSQL)

 Neon instance (already provisioned)

 ┌──────┬───────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
 │      │                        Direct                         │                      Pooler (PgBouncer)                      │
 ├──────┼───────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ Host │ ep-falling-glade-aqj5hwiz.c-8.us-east-1.aws.neon.tech │ ep-falling-glade-aqj5hwiz-pooler.c-8.us-east-1.aws.neon.tech │
 ├──────┼───────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ DB   │ neondb                                                │ neondb                                                       │
 ├──────┼───────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ Role │ neondb_owner                                          │ neondb_owner                                                 │
 └──────┴───────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘

 Connection string format:
 postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require

 Use the direct host for db:migrate (Drizzle migrations use session-level features incompatible with PgBouncer).
 Use the pooler host for all runtime services (data-server's max: 10 pool + the app's concurrency fits the pooler well and avoids hitting Neon's
 direct connection cap).

 A second database (subsbuzz_dev) should be created in the same Neon project for the dev environment.

 Data migration (one-off, before cutover)

 # Dump current prod DB from the server
 ssh subsbuzz "docker exec subsbuzz-postgres-1 pg_dump -U postgres subsbuzz" > /tmp/subsbuzz_prod.sql

 # Restore into Neon prod DB (connection string from Neon dashboard)
 psql "postgresql://...@ep-xxx.neon.tech/subsbuzz?sslmode=require" < /tmp/subsbuzz_prod.sql

 # Run Drizzle migrations to apply any schema changes not in the dump
 DATABASE_URL="postgresql://...@ep-xxx.neon.tech/subsbuzz?sslmode=require" \
   npm --prefix services/data-server run db:migrate

 Repeat with subsbuzz_dev DB for dev.

 Code changes

 .env.prod — replace DB vars:
 # Remove:
 POSTGRES_USER=postgres
 POSTGRES_PASSWORD=...
 POSTGRES_DB=subsbuzz

 # Replace DATABASE_URL with Neon URL:
 DATABASE_URL=postgresql://...@ep-xxx.neon.tech/subsbuzz?sslmode=require

 .env.dev — same pattern, pointing at Neon dev DB.

 .env.example — update DATABASE_URL comment/example to show Neon format.

 docker-compose.yml:
 - Remove the entire postgres service block (lines ~99–115)
 - Remove postgres_data volume from the volumes: section
 - Change data-server's DATABASE_URL env var from the docker-internal substitution to ${DATABASE_URL} (reads from .env)
 - Remove depends_on: postgres from data-server and email-worker services
 - Remove the init.sql volume mount

 docker-compose.dev.yml — same removals.

 services/data-server/drizzle.config.ts — update the fallback URL in dbCredentials from localhost to a comment noting Neon is required (or remove
 the fallback entirely to force explicit config).

 No changes needed to src/db.ts, health checks, schema, or migrations — they are all standard Postgres.

 ---
 Phase 2: Cloudflare R2 (Hero Image Storage)

 Manual setup (user, outside codebase)

 1. In Cloudflare dashboard: create an R2 bucket (e.g. subsbuzz-heroes). Enable public access or create a custom domain.
 2. Create R2 API credentials (Account ID, Access Key ID, Secret Access Key).
 3. Note the public URL base: https://pub-xxx.r2.dev or custom domain.

 Code changes

 services/email-worker/requirements.txt — add boto3.

 services/email-worker/content_extractor.py — rewrite _cache_hero_image() (lines 965–1003):
 - Replace local filesystem write with an S3-compatible put_object call via boto3, using the R2 endpoint
 (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)
 - Keep the same SHA256 content-addressed filename scheme
 - Return f"{R2_PUBLIC_URL}/{filename}" (absolute URL) on success, None on failure
 - Read credentials from env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 - Initialise boto3 client once at module level (reuse across calls)

 services/frontend/src/lib/article-heroes.ts — add /hero-cache/ to the HERO_URL_REJECT regex so DB rows with old local paths fall back to manifest
 art silently (no 404s in browser).

 services/frontend/nginx.conf — remove the /hero-cache/ location block (lines 41–45). No alias, no volume needed.

 docker-compose.yml:
 - Remove hero_image_cache volume from volumes: section
 - Remove volume mount from email-worker service
 - Remove volume mount from frontend service
 - Add R2 env vars to email-worker service: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL

 docker-compose.dev.yml — same volume removals; R2 env vars optional for dev (if absent, _cache_hero_image returns None and falls back to original
 CDN URL, which already works per existing dev behaviour).

 .env.prod / .env.dev / .env.example — add the five R2 env vars.

 No changes needed to: tasks.py (calls _cache_hero_image, already handles None return), schema.ts (field is plain text), or frontend rendering
 (isGoodHeroUrl() already handles absolute URLs).

 ---
 Phase 3: Upstash (Redis)

 Manual setup (user, outside codebase)

 1. Create Upstash Redis instance at console.upstash.com. Copy the rediss:// connection URL.

 Code changes

 .env.prod — replace all Redis vars:
 REDIS_URL=rediss://default:...@...upstash.io:6379
 CELERY_BROKER_URL=rediss://default:...@...upstash.io:6379
 CELERY_RESULT_BACKEND=rediss://default:...@...upstash.io:6379

 .env.dev — same (can use same Upstash instance or a separate free-tier one).

 docker-compose.yml:
 - Remove the entire redis service block
 - Remove redis_data volume
 - Change all service env var references from redis://redis:6379/0 to ${REDIS_URL} / ${CELERY_BROKER_URL}

 docker-compose.dev.yml — same removals.

 services/api-gateway/health.py — fix check_redis() (lines 54–79): the current raw TCP PING won't survive TLS. Replace with a proper redis-py ping:
 import redis as _redis_sync
 r = _redis_sync.from_url(settings.REDIS_URL)
 r.ping()
 Requires redis in services/api-gateway/requirements.txt (add if not present).

 services/email-worker/tasks.py lines 49–56 — redis.asyncio.from_url() auto-detects TLS from the rediss:// scheme, so no code change needed. Verify
 in testing.

 services/email-worker/main.py — no change; already reads from CELERY_BROKER_URL env var.

 services/data-server/src/services/celery-client.ts — no change; celery-node supports rediss:// URLs natively.

 ---
 Project Document

 Create docs/DB_HOST.md documenting the managed services in use (provider, purpose, env vars, notes on local-dev override). Written during
 implementation as a durable reference.

 ---
 Verification

 Neon:
 # After deploy.sh — confirm data-server connects and digests are readable
 curl https://dev.subsbuzz.com/api/health
 # Check data-server logs for "Database connected" and no pg errors
 ssh subsbuzz "docker logs subsbuzz-dev-data-server-1 2>&1 | tail -30"

 R2:
 - Generate a digest on dev.subsbuzz.com, open an article, confirm hero image loads from R2 URL (not /hero-cache/)
 - Open an older article with a /hero-cache/ path — confirm it falls back to manifest art (no broken img)

 Upstash:
 curl https://dev.subsbuzz.com/health
 # "redis-broker": "ok" in the health response
 # Trigger a manual digest from the UI and confirm the Celery task is consumed
 ssh subsbuzz "docker logs subsbuzz-dev-email-worker-1 2>&1 | tail -20"

 Full smoke test order: deploy.sh → health check → login → view digest history → generate new digest → verify hero images → check email-worker logs
 for no Redis errors.
