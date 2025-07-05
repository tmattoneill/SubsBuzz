#!/bin/bash

# SubsBuzz Microservices Stop Script
# Gracefully stops all services

echo "🛑 Stopping SubsBuzz Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Stop services by PID if available
if [ -f "$SCRIPT_DIR/logs/data-server.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/logs/data-server.pid")
    if kill -0 $PID 2>/dev/null; then
        print_status "Stopping Data Server (PID: $PID)..."
        kill $PID
    fi
    rm -f "$SCRIPT_DIR/logs/data-server.pid"
fi

if [ -f "$SCRIPT_DIR/logs/api-gateway.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/logs/api-gateway.pid")
    if kill -0 $PID 2>/dev/null; then
        print_status "Stopping API Gateway (PID: $PID)..."
        kill $PID
    fi
    rm -f "$SCRIPT_DIR/logs/api-gateway.pid"
fi

if [ -f "$SCRIPT_DIR/logs/frontend.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/logs/frontend.pid")
    if kill -0 $PID 2>/dev/null; then
        print_status "Stopping Frontend (PID: $PID)..."
        kill $PID
    fi
    rm -f "$SCRIPT_DIR/logs/frontend.pid"
fi

# Also kill by port as backup
print_status "Cleaning up any remaining processes on ports..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true  
lsof -ti:5500 | xargs kill -9 2>/dev/null || true

sleep 2

print_success "🛑 All SubsBuzz services stopped"