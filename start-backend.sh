#!/bin/bash

# SubsBuzz - Start Backend Services Only
echo "🚀 Starting SubsBuzz Backend Services"

# Load environment variables
source .env.dev 2>/dev/null || echo "⚠️  No .env.dev found, using defaults"

# Define backend ports
PORTS=(${DATA_SERVER_PORT:-3001} ${API_GATEWAY_PORT:-8000} ${DB_PORT:-5432})

echo "🧹 Cleaning up backend ports: ${PORTS[*]}"

# Kill any processes on backend ports
for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   Killing processes on port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
done

echo "✅ Backend ports cleaned"

# Ensure PostgreSQL is running
echo "🐘 Checking PostgreSQL..."
if ! pg_isready >/dev/null 2>&1; then
    echo "   Starting PostgreSQL..."
    brew services start postgresql 2>/dev/null || echo "   PostgreSQL start attempted"
fi

# Copy environment file
cp .env.dev .env

echo "🔧 Starting backend services..."

# Create logs directory
mkdir -p logs

# Start Data Server (in background)
echo "   📊 Starting Data Server on port ${DATA_SERVER_PORT:-3001}..."
cd services/data-server
npm start > ../../logs/data-server.log 2>&1 &
DATA_SERVER_PID=$!
cd ../..

# Wait for data server
sleep 3

# Start API Gateway (in background)  
echo "   🌐 Starting API Gateway on port ${API_GATEWAY_PORT:-8000}..."
cd services/api-gateway
python -m uvicorn main:app --host 0.0.0.0 --port ${API_GATEWAY_PORT:-8000} > ../../logs/api-gateway.log 2>&1 &
API_GATEWAY_PID=$!
cd ../..

# Save PIDs
echo "$DATA_SERVER_PID" > logs/data-server.pid
echo "$API_GATEWAY_PID" > logs/api-gateway.pid

echo ""
echo "✅ Backend services started!"
echo ""
echo "📊 Data Server:    http://localhost:${DATA_SERVER_PORT:-3001}"
echo "🌐 API Gateway:    http://localhost:${API_GATEWAY_PORT:-8000}"
echo ""
echo "📋 Logs available in ./logs/"
echo "🎨 To start frontend: npm run dev"