#!/bin/bash

# SubsBuzz - Start Frontend Only
echo "🎨 Starting SubsBuzz Frontend"

# Load environment variables
source .env.dev 2>/dev/null || echo "⚠️  No .env.dev found, using defaults"

# Clean frontend port
FRONTEND_PORT=${UI_PORT:-5500}

echo "🧹 Cleaning up frontend port: $FRONTEND_PORT"
if lsof -ti:$FRONTEND_PORT >/dev/null 2>&1; then
    echo "   Killing processes on port $FRONTEND_PORT..."
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 0.5
fi

# Copy environment file
cp .env.dev .env

# Create logs directory
mkdir -p logs

echo "🔧 Starting frontend..."
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Save PID
echo "$FRONTEND_PID" > logs/frontend.pid

echo ""
echo "✅ Frontend started!"
echo ""
echo "🎨 Frontend:       http://localhost:$FRONTEND_PORT"
echo ""
echo "📋 Logs available in ./logs/frontend.log"
echo "⏳ Frontend will be ready in ~30 seconds"