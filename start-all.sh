#!/bin/bash
# SubsBuzz — Start All Local Services
# Loads .env.local (stable canonical localhost config) and runs each service
# against brew postgres + redis. No Docker involvement.
#
# Reads ports + URLs from .env.local — do NOT hardcode values here.

set -e

cd "$(dirname "$0")"

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found. Create it (see .env.dev as template)."
    exit 1
fi

# Export everything from .env.local to our shell AND to every child process.
# `set -a` means "any var assigned is auto-exported" — the missing piece that
# caused drift on the older version of this script.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "🚀 Starting SubsBuzz (local) from $ENV_FILE"
echo "   Frontend    : http://127.0.0.1:${UI_PORT}"
echo "   API Gateway : http://127.0.0.1:${API_GATEWAY_PORT}"
echo "   Data Server : http://localhost:${DATA_SERVER_PORT}"
echo ""

# Clean any stale processes on our ports
PORTS=("${UI_PORT}" "${DATA_SERVER_PORT}" "${API_GATEWAY_PORT}")
echo "🧹 Cleaning ports: ${PORTS[*]}"
for port in "${PORTS[@]}"; do
    if lsof -ti:"$port" >/dev/null 2>&1; then
        lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    fi
done

# Verify infra is up
echo "🐘 Checking PostgreSQL on ${DB_PORT}..."
if ! pg_isready -h localhost -p "${DB_PORT}" >/dev/null 2>&1; then
    echo "   Starting PostgreSQL..."
    brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || true
fi

echo "🟥 Checking Redis on ${REDIS_PORT}..."
if ! redis-cli -p "${REDIS_PORT}" ping >/dev/null 2>&1; then
    echo "   Starting Redis..."
    brew services start redis 2>/dev/null || true
fi

mkdir -p logs

# Distribute .env.local → each service's .env so dotenv/pydantic/pythondotenv
# all load the same canonical values. Overwritten every run — this file is
# generated, not hand-maintained.
for svc in data-server api-gateway email-worker; do
    cp "$ENV_FILE" "services/${svc}/.env"
done

echo ""
echo "🔧 Starting services..."

# Data Server (Node/tsx — dotenv/config reads ./services/data-server/.env)
echo "   📊 Data Server → port ${DATA_SERVER_PORT}"
(cd services/data-server && npm run dev > ../../logs/data-server.log 2>&1 &)

# API Gateway (FastAPI) — pass port via CLI so PORT env var conflicts can't bite
echo "   🌐 API Gateway → port ${API_GATEWAY_PORT}"
(cd services/api-gateway && python3 -m uvicorn main:app \
    --host 0.0.0.0 --port "${API_GATEWAY_PORT}" \
    > ../../logs/api-gateway.log 2>&1 &)

# Email Worker (Celery) — optional, commented out by default. Uncomment to test
# the digest generation loop locally. Otherwise Celery runs only on the server.
# echo "   📧 Email Worker (Celery)"
# (cd services/email-worker && python3 -m celery -A main worker --beat \
#     --loglevel=info > ../../logs/email-worker.log 2>&1 &)

# Frontend (Vite) — override port from env, do NOT use the hardcoded package.json
echo "   🎨 Frontend → port ${UI_PORT}"
(cd services/frontend && npx vite --port "${UI_PORT}" --host 0.0.0.0 \
    > ../../logs/frontend.log 2>&1 &)

echo ""
echo "✅ All services started"
echo ""
echo "📋 Logs: ./logs/{data-server,api-gateway,frontend}.log"
echo "🛑 Stop: ./stop-all.sh"
echo ""
echo "⏳ Give services ~5s to come up, then:"
echo "   curl http://localhost:${DATA_SERVER_PORT}/health"
echo "   curl http://127.0.0.1:${API_GATEWAY_PORT}/health"
echo "   open http://127.0.0.1:${UI_PORT}"
