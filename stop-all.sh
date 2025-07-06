#!/bin/bash

# SubsBuzz - Stop All Services Script
echo "🛑 Stopping SubsBuzz services..."

# Load environment variables
source .env.dev 2>/dev/null || echo "⚠️  No .env.dev found, using defaults"

# Define ports
PORTS=(${UI_PORT:-5500} ${DATA_SERVER_PORT:-3001} ${API_GATEWAY_PORT:-8000})

# Kill processes by PID files first
if [ -f logs/data-server.pid ]; then
    kill $(cat logs/data-server.pid) 2>/dev/null || true
    rm logs/data-server.pid
fi

if [ -f logs/api-gateway.pid ]; then
    kill $(cat logs/api-gateway.pid) 2>/dev/null || true
    rm logs/api-gateway.pid
fi

if [ -f logs/frontend.pid ]; then
    kill $(cat logs/frontend.pid) 2>/dev/null || true
    rm logs/frontend.pid
fi

# Kill any remaining processes on our ports
echo "🧹 Cleaning up ports: ${PORTS[*]}"
for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   Killing processes on port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# Clean up any node/python processes that might be hanging
pkill -f "uvicorn.*main:app" 2>/dev/null || true
pkill -f "tsx.*server/index.ts" 2>/dev/null || true
pkill -f "node.*dist/index.js" 2>/dev/null || true

echo "✅ All services stopped"
echo "📋 Logs preserved in ./logs/"