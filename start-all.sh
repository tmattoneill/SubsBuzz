#!/bin/bash

# SubsBuzz - Start All Services Script
echo "🚀 Starting SubsBuzz - Full Stack Application"

# Load environment variables
source .env.dev 2>/dev/null || echo "⚠️  No .env.dev found, using defaults"

# Define ports from env or defaults
PORTS=(${UI_PORT:-5500} ${DATA_SERVER_PORT:-3001} ${API_GATEWAY_PORT:-8000} ${DB_PORT:-5432})

echo "🧹 Cleaning up ports: ${PORTS[*]}"

# Kill any processes on our ports
for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   Killing processes on port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
done

echo "✅ Ports cleaned"

# Ensure PostgreSQL is running
echo "🐘 Checking PostgreSQL..."
if ! pg_isready >/dev/null 2>&1; then
    echo "   Starting PostgreSQL..."
    brew services start postgresql 2>/dev/null || echo "   PostgreSQL start attempted"
fi

# Copy environment file
cp .env.dev .env

echo "🔧 Starting services..."

# Start Data Server (in background)
echo "   📊 Starting Data Server on port ${DATA_SERVER_PORT:-3001}..."
cd services/data-server
npm run dev > ../../logs/data-server.log 2>&1 &
DATA_SERVER_PID=$!
cd ../..

# Wait a moment for data server
sleep 2

# Start API Gateway (in background)
echo "   🌐 Starting API Gateway on port ${API_GATEWAY_PORT:-8000}..."
cd services/api-gateway
python -m uvicorn main:app --host 0.0.0.0 --port ${API_GATEWAY_PORT:-8000} > ../../logs/api-gateway.log 2>&1 &
API_GATEWAY_PID=$!
cd ../..

# Wait a moment for API gateway
sleep 2

# Start Email Worker (Celery)
echo "   📧 Starting Email Worker (Celery)..."
cd services/email-worker
python -m celery -A tasks worker --loglevel=info > ../../logs/email-worker.log 2>&1 &
EMAIL_WORKER_PID=$!
cd ../..

# Wait a moment for email worker
sleep 2

# Start Frontend (Vite dev server)
echo "   🎨 Starting Frontend on port ${UI_PORT:-5500}..."
cd services/frontend
npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Create logs directory if it doesn't exist
mkdir -p logs

# Save PIDs for easy cleanup
echo "$DATA_SERVER_PID" > logs/data-server.pid
echo "$API_GATEWAY_PID" > logs/api-gateway.pid
echo "$EMAIL_WORKER_PID" > logs/email-worker.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Data Server:    http://localhost:${DATA_SERVER_PORT:-3001}"
echo "🌐 API Gateway:    http://localhost:${API_GATEWAY_PORT:-8000}"
echo "📧 Email Worker:   Running (Celery)"
echo "🎨 Frontend:       http://localhost:${UI_PORT:-5500}"
echo ""
echo "📋 Logs available in ./logs/"
echo "🛑 To stop all services: ./stop-all.sh"
echo ""
echo "⏳ Services are starting... Full stack ready"