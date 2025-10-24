# Repository Guidelines

## Project Structure & Module Organization
SubsBuzz is a microservice suite rooted here. `client/` ships the React SPA (`client/src`), `server/` provides the Vite-driven Node shell, and `services/` contains deployables: `data-server/` (Express + Drizzle), `api-gateway/` (FastAPI), and `email-worker/` (Celery). Shared DTOs and types live under `shared/`, while environment helpers sit in `lib/` and `utils/`. Keep new work in these roots; treat `dev.subsbuzz.com/` artifacts as read-only history.

## Build, Test, and Development Commands
Run `npm run dev` at the repo root to copy `.env.dev` and launch the SPA plus Node harness on port 5500. Start the internal API via `cd services/data-server && npm run dev`, syncing schema changes with `npm run db:push`. Launch the FastAPI gateway using `cd services/api-gateway && uvicorn main:app --reload`, and spin up Celery workers through `cd services/email-worker && python3 main.py` (Redis via `docker-compose.dev.yml`). Use `docker-compose up` for an end-to-end stack locally.

## Coding Style & Naming Conventions
TypeScript modules use strict ESM, two-space indents, double quotes, and PascalCase components, with helpers in camelCase. Prefer the `@/` alias and reuse DTOs from `shared/`. FastAPI code follows four-space indents, typed signatures, and structured logging. Before committing, run `npm run check` and apply Black-compatible formatting.

## Testing Guidelines
Consult `tests/TEST_EXECUTION_GUIDE.md` for prerequisites. Bring up the data-server, API gateway, and Postgres before executing harnesses. While iterating, run targeted suites (`node tests/test-data-server.js`, `node tests/test-api-gateway.js`), then finish with `node tests/run-tests.js`. Refresh fixtures in `tests/samples/` when responses shift and document any skipped Gmail/OpenAI suites.

## Commit & Pull Request Guidelines
Write commits in imperative present tense (e.g., `api-gateway: Add digest rate limits`). PRs should outline context, manual test evidence (commands or curl logs), linked migrations/env keys, and any screenshots for UI or API updates. Request service owners on changes touching their areas and cross-link supporting docs such as `ENVIRONMENT.md` or `docs/SECURITY.md` when relevant.

## Security & Configuration Tips
Never commit secrets; copy `.env.dev` templates (`cp .env.dev .env`) instead. Sync OAuth or OpenAI adjustments with middleware defaults and `docs/SECURITY.md`. Maintain `/health` endpoints, stick with structured logs rather than ad hoc prints, and keep Docker overrides under `infrastructure/`.
