# SubsBuzz Ship Workflow

The actual, current way code moves from your laptop to prod. Five stages. Written 2026-04-14, after prod went live.

## Quick reference

| Stage | Command | Where |
|---|---|---|
| 1. Develop locally | edit code in `services/*` | laptop |
| 2. Test locally | `npm test` / `./start-all.sh` | laptop |
| 3. Deploy to dev | `./deploy.sh` | laptop → dev.subsbuzz.com |
| 4. Test dev | browser + `curl` + remote tests | dev.subsbuzz.com |
| 5. Promote to prod | `./promote.sh` | laptop → subsbuzz.com |

Everything runs from your local repo. There is no CI, no GitHub Actions, no registry — just `git push` + SSH + `docker compose`. Simple on purpose.

---

## Stage 1 — Develop locally

Edit code in `services/*`. Schema lives at `services/data-server/src/db/schema.ts`.

**Running services locally (non-Docker):**
```bash
./start-all.sh    # data-server (3001) + api-gateway (8000) + PostgreSQL
```
Stops with `./stop-all.sh`.

**Running the frontend against local backends:**
```bash
cd services/frontend && npm run dev    # Vite dev server on 5500
```

**Schema changes:**
```bash
cd services/data-server
npm run db:generate    # create migration from schema.ts diff
npm run db:migrate     # apply to local PostgreSQL
```
Then mirror the change in `infrastructure/postgres/migrate.sql` as an idempotent `ALTER TABLE ... IF NOT EXISTS`. That file is re-run by `promote.sh` on every deploy — the server's source of truth for schema drift.

---

## Stage 2 — Test locally

```bash
npm test    # all four suites, requires services running from stage 1
```

Individual suites:
- `test-database-simple.js` — PG connectivity
- `test-data-server.js` — internal API + auth middleware
- `test-api-gateway.js` — public API, JWT, CORS
- `test-integration.js` — cross-service error propagation, load

**For UI work**, open http://localhost:5500 and exercise the feature. Type-checking and tests verify code correctness, not feature correctness — if you can't click through the change, it's not tested.

**Commit when green:**
```bash
git add <files>
git commit -m "..."
```
Commit only what the change requires. Avoid drive-by edits to unrelated files.

---

## Stage 3 — Deploy to dev

**Pre-flight — check env drift before every deploy:**
```bash
ssh subsbuzz "cat /home/webdev/sites/dev.subsbuzz.com/.env.dev" | sha256sum
sha256sum .env.dev
# Hashes must match. If not, pull server → local first:
#   scp subsbuzz:/home/webdev/sites/dev.subsbuzz.com/.env.dev .env.dev && chmod 600 .env.dev
```
`.env.dev` is gitignored and drifts silently. `deploy.sh` overwrites the server's copy — stale local = broken dev.

**Deploy:**
```bash
./deploy.sh    # pushes current branch, rsyncs env + compose, rebuilds on server
```
Uses docker layer cache by default. For a forced clean rebuild (rare — dependency corruption, base-image refresh):
```bash
NO_CACHE=1 ./deploy.sh    # eats ~2 GB server disk per run
```

**What gets built on dev:** frontend, api-gateway, data-server. **Not built:** `email-worker` (profile-gated — see below).

**Expected output:** 5 dev containers healthy, health-checks pass on `localhost:8001 / 3002 / 5501`.

---

## Stage 4 — Test dev

**Smoke test:**
```bash
curl -sI https://dev.subsbuzz.com/ | head -3           # 200
curl -s  https://dev.subsbuzz.com/health | jq .        # healthy
curl -s  https://dev.subsbuzz.com/api/health | jq .    # gateway health
```

**Integration tests against dev** (requires `INTERNAL_API_SECRET` from the dev `.env`):
```bash
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  API_GATEWAY_URL=http://localhost:8001 \
  DATA_SERVER_URL=http://localhost:3002 \
  DATABASE_URL=\$(grep '^DATABASE_URL=' .env | cut -d= -f2-) \
  INTERNAL_API_SECRET=\$(grep '^INTERNAL_API_SECRET=' .env | cut -d= -f2-) \
  node tests/run-tests.js"
```

**Manual browser test:** open https://dev.subsbuzz.com, exercise the feature end-to-end. Dev uses the same Google OAuth app as prod, so you can sign in as yourself and verify login, settings, monitored emails, etc.

**Testing Celery tasks on dev** (opt-in — the worker is profile-gated to avoid burning API credits):
```bash
# Start dev worker
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  docker compose -f docker-compose.dev.yml --profile workers up -d email-worker"

# Watch logs
ssh subsbuzz "docker logs -f subsbuzz-dev-email-worker-1"

# Stop when done
ssh subsbuzz "cd ~/sites/dev.subsbuzz.com && \
  docker compose -f docker-compose.dev.yml stop email-worker"
```

**If something fails:**
```bash
ssh subsbuzz "docker logs --tail=100 <container-name>"
# Container names: subsbuzz-dev-<service>-1
```

---

## Stage 5 — Promote to prod

`promote.sh` refuses to run unless:
- You are on `main`
- Working tree is clean
- Local `main` matches `origin/main`

So first: merge/rebase to main, push, verify tests still green on dev.

**Env drift check (again, for prod):**
```bash
ssh subsbuzz "sha256sum /home/webdev/sites/subsbuzz.com/.env" 
sha256sum .env.prod
# Must match the server's running .env. If not, pull → local → re-promote.
```

**Promote:**
```bash
./promote.sh    # prompts for explicit 'yes'
```
Uses layer cache. Emergency path same as dev: `NO_CACHE=1 ./promote.sh`.

**What it does** (see `promote.sh:49-166`):
1. Verifies branch + clean tree + origin sync
2. Pushes to GitHub
3. On server: fetches + resets to origin/main, `git clean -fd`
4. rsyncs `.env.prod` → `.env`, `docker-compose.yml` → `docker-compose.yml`
5. `docker compose down && build && up -d`
6. Runs `infrastructure/postgres/migrate.sql` (idempotent ALTER TABLEs)
7. Health-checks `localhost:8000 / 3001 / 3000`

**Post-deploy verification:**
```bash
curl -sI https://subsbuzz.com/                   # 200
curl -sI https://www.subsbuzz.com/               # 301 → apex
curl -s  https://subsbuzz.com/health | jq .      # healthy
```

Then manual: open https://subsbuzz.com, sign in, confirm the feature you shipped actually works. If it doesn't, roll back (see below).

---

## Rollback

**Fast rollback (previous commit on main):**
```bash
git revert HEAD
git push origin main
./promote.sh
```

**Slow rollback (compose/container issues):**
```bash
ssh subsbuzz "cd ~/sites/subsbuzz.com && docker compose down && docker compose up -d"
# If still broken, revert the offending commit and re-promote.
```

**Nuclear rollback (schema corruption, DB needs reset):**
Prod postgres volume is `subsbuzz_postgres_data`. Dropping it drops all prod data. Don't do this without a `pg_dump` first:
```bash
ssh subsbuzz "docker exec subsbuzz-postgres-1 pg_dump -U postgres subsbuzz" > prod-backup-$(date +%Y%m%d).sql
```

---

## Non-obvious things to remember

- **Two stacks on one server.** Dev at `/home/webdev/sites/dev.subsbuzz.com`, prod at `/home/webdev/sites/subsbuzz.com`. Container name prefixes `subsbuzz-dev-*` vs `subsbuzz-*`. Ports disjoint (5501/8001/3002 dev, 3000/8000/3001 prod). They coexist — dev work doesn't affect prod.
- **`.env` files never live in git.** Always drift between your laptop and server. Check sha256 before every deploy.
- **Prod email-worker is always on.** Dev's is opt-in.
- **Daily digest fires at 03:00 UTC** on prod only. If you add monitored emails at 02:55 UTC, they're in tonight's digest. Otherwise, tomorrow night's.
- **Schema changes live in two places.** Drizzle (`schema.ts`) for local dev + type safety; `migrate.sql` (raw SQL) for production apply. Keep both in sync or the next `promote.sh` will fail a healthcheck.
- **OAuth tokens persist** in the DB for 30 days (session) + refresh indefinitely. Users don't need to re-log-in after deploys.
- **Disk fills up.** Run `docker image prune --all --force && docker builder prune --all --force && journalctl --vacuum-size=500M` on the server if `df -h /` climbs above 80%.

## Where to look when debugging

| Problem | Look here |
|---|---|
| Container won't start | `ssh subsbuzz "docker logs --tail=100 <container>"` |
| Health check failing | `ssh subsbuzz "curl -v http://localhost:<port>/health"` |
| OAuth broken | `docker logs subsbuzz-api-gateway-1` + check Google Console redirect URIs |
| Digest didn't run | `docker logs subsbuzz-email-worker-1` (search for `Beat` + task name) |
| Schema mismatch | compare `services/data-server/src/db/schema.ts` vs `migrate.sql` |
| Nginx issue | `ssh subsbuzz "sudo tail /var/log/nginx/subsbuzz-error.log"` |
| Disk pressure | `ssh subsbuzz "df -h / && docker system df"` |

See `CLAUDE.md` for the full service-by-service reference.
