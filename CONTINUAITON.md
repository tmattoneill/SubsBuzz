# Continuation Notes

## Repo Snapshot
- `.git/` is empty; actual metadata lives in `.git-broken/`. Move it back (`mv .git-broken .git`) or re-init to restore history.
- Shell commands warn about `/Users/thomasoneill/.local/bin/env`. Patch `~/.profile` or create the missing shim to stop the noise.
- Active code lives at the root (`client/`, `server/`, `services/`, `shared/`, `tests/`, `docs/`); `dev.subsbuzz.com/` mirrors an older layout—treat it as archive for reference only.
- `AGENTS.md`, `README.md`, `ENVIRONMENT.md`, and `docs/SECURITY.md` now represent the authoritative contributor guidance.

## Service Status
- Frontend (`client/` + `server/`) runs via `npm run dev`, wiring Vite and Express with `tsx`.
- Data Server (`services/data-server/src/index.ts`) exposes the Drizzle/Postgres API and expects `DATABASE_URL`, `OPENAI_API_KEY`, `INTERNAL_API_SECRET`.
- API Gateway (`services/api-gateway/main.py`) is FastAPI with middleware stack; launch using `uvicorn main:app --reload` after env setup.
- Email Worker (`services/email-worker/`) drives Celery tasks; requires Redis plus Gmail/OpenAI credentials before `python3 main.py` does useful work.
- `mail-proc/` is a separate microservice experiment (branch `mail-proc`) with its own Docker/Alembic harness—decide whether to integrate or park.

## Risks & Gaps
- Dependencies aren’t installed yet; expect initial `npm install` / `pip install` passes across services.
- `.env` copies must exist (`cp .env.dev .env`) prior to running scripts; ensure secrets are filled locally.
- Integration tests in `tests/` hit live Gmail/OpenAI. Prepare credentials or document skips to avoid blocking automation.
- Docker Compose files still reference shared services; confirm images build against current Node and Python versions.

## Quick Restart Plan
1. Restore git metadata, check `git status`, and handle existing doc changes.
2. Install dependencies: `npm install` at root, `npm install` in `services/data-server`, `pip install -r requirements.txt` for API gateway and email worker.
3. Copy env templates and supply required keys (Postgres, OpenAI, Gmail, Redis).
4. Start backing services (`brew services start postgresql`, `docker compose -f docker-compose.dev.yml up redis`) or use the compose stack.
5. Launch each service (`npm run dev`, `npm run dev` in `services/data-server`, `uvicorn main:app --reload`, `python3 services/email-worker/main.py`) and verify `/health` endpoints.
6. Run smoke tests (`node tests/test-data-server.js`, `node tests/test-api-gateway.js`, `node tests/run-tests.js`) and log any skipped integration suites.

## Follow-Ups
- Decide whether to merge or retire `dev.subsbuzz.com/` and the `mail-proc/` service snapshot.
- Once stable, add CI coverage for core tests and document the updated startup flow in `README.md`.
