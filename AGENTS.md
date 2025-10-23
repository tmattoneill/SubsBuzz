# Repository Guidelines

## Project Structure & Module Organization
SubsBuzz ships as a microservice suite: `client/` houses the React SPA (`client/src`), `server/` provides the Vite-coupled Node entrypoint, and `services/` holds the deployable services—`data-server` (Express/Drizzle), `api-gateway` (FastAPI), `email-worker` (Celery). Shared contracts live in `shared/`, environment helpers in `lib/` and `utils/`, documentation in `docs/`, and regression scripts in `tests/`. Treat `dev.subsbuzz.com/` as an archival mirror; add new work in the root paths.

## Build, Test, and Development Commands
- `npm run dev` (root): copies `.env.dev` and runs the SPA + Node shell on port 5500.
- `cd services/data-server && npm run dev`: runs the internal API on 3001; use `npm run db:push` for schema sync.
- `cd services/api-gateway && uvicorn main:app --reload`: starts FastAPI on 8000 with hot reload.
- `cd services/email-worker && python3 main.py`: launches Celery tasks; bring Redis via `docker-compose.dev.yml`.
- `docker-compose up`: spins up the full stack when you need production-like wiring.

## Coding Style & Naming Conventions
TypeScript code uses strict ESM, two-space indents, double quotes, PascalCase components, and camelCase helpers; reuse the `@/` alias and surface shared DTOs through `shared/`. FastAPI modules stick to four-space indents, typed signatures, and the structured logging already in place; follow existing filename patterns (`*-routes.ts`, `*-client.py`). Run `npm run check` plus Black-compatible formatting before sending a PR.

## Testing Guidelines
Review `tests/TEST_EXECUTION_GUIDE.md` for prerequisites; ensure data-server, API gateway, and Postgres are running before executing Node harnesses. Use targeted scripts (`node tests/test-data-server.js`, `node tests/test-api-gateway.js`) while iterating, then finish with `node tests/run-tests.js`. Gmail/OpenAI suites require real credentials—record skips in the PR and refresh `samples/` fixtures when responses change.

## Commit & Pull Request Guidelines
Write commits in imperative present tense (e.g., `api-gateway: Add digest rate limits`) and keep scope tight. Each PR should outline context, manual test commands, and any migrations or env keys touched, with screenshots or curl logs for UI or API updates. Request service owners when modifying their area and cross-link docs like `ENVIRONMENT.md` or `docs/SECURITY.md` whenever you change them.

## Security & Configuration Tips
Never commit secrets; rely on `.env.dev` templates and refresh local envs with `cp .env.dev .env`. Sync OAuth or OpenAI changes with middleware defaults and the guidance in `docs/SECURITY.md`. Maintain `/health` endpoints and structured logs instead of ad hoc debugging, and keep Docker overrides in `infrastructure/`.
