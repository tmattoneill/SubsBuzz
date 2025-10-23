#!/bin/bash

# SubsBuzz Microservices Launch Script
# Launches all backend services and React frontend in correct order

set -e  # Exit on any error

echo "🚀 SubsBuzz Microservices Launch Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if port is in use and kill process
cleanup_port() {
    local port=$1
    local service_name=$2
    
    print_status "Checking port $port for $service_name..."
    
    if lsof -ti:$port > /dev/null 2>&1; then
        print_warning "Port $port is in use, killing existing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready at $url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
print_status "Script directory: $SCRIPT_DIR"

# 1. Start PostgreSQL
print_status "Step 1: Starting PostgreSQL..."
if brew services list | grep -q "postgresql.*started"; then
    print_success "PostgreSQL is already running"
else
    brew services start postgresql
    print_success "PostgreSQL started"
fi

# 2. Clean up existing processes
print_status "Step 2: Cleaning up existing processes..."
cleanup_port 3001 "Data Server"
cleanup_port 8000 "API Gateway" 
cleanup_port 5500 "Frontend"

# 3. Data Server Setup and Launch
print_status "Step 3: Setting up Data Server..."
cd "$SCRIPT_DIR/services/data-server"

print_status "Cleaning Data Server node_modules..."
rm -rf node_modules package-lock.json 2>/dev/null || true

print_status "Installing Data Server dependencies..."
npm install

print_status "Starting Data Server..."
npm run dev > "$SCRIPT_DIR/logs/data-server.log" 2>&1 &
DATA_SERVER_PID=$!
echo $DATA_SERVER_PID > "$SCRIPT_DIR/logs/data-server.pid"

# Wait for Data Server to be ready
wait_for_service "http://localhost:3001/health" "Data Server"

# 4. API Gateway Setup and Launch
print_status "Step 4: Setting up API Gateway..."
cd "$SCRIPT_DIR/services/api-gateway"

print_status "Starting API Gateway..."
python main.py > "$SCRIPT_DIR/logs/api-gateway.log" 2>&1 &
API_GATEWAY_PID=$!
echo $API_GATEWAY_PID > "$SCRIPT_DIR/logs/api-gateway.pid"

# Wait for API Gateway to be ready
wait_for_service "http://localhost:8000/health" "API Gateway"

# 5. Frontend Setup and Launch
print_status "Step 5: Setting up Frontend..."
cd "$SCRIPT_DIR/client"

print_status "Cleaning Frontend node_modules..."
rm -rf node_modules package-lock.json 2>/dev/null || true

print_status "Installing Frontend dependencies..."
npm install

print_status "Starting Frontend..."
npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/logs/frontend.pid"

# Wait for Frontend to be ready
wait_for_service "http://localhost:5500" "Frontend"

# 6. Final Status Check
print_status "Step 6: Final health checks..."

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Check all services
echo ""
print_status "=== SERVICE STATUS ==="

# Data Server
if curl -s http://localhost:3001/health > /dev/null; then
    print_success "✅ Data Server (port 3001) - HEALTHY"
    curl -s http://localhost:3001/health | python -m json.tool 2>/dev/null || echo "  Status: Running"
else
    print_error "❌ Data Server (port 3001) - NOT RESPONDING"
fi

# API Gateway
if curl -s http://localhost:8000/health > /dev/null; then
    print_success "✅ API Gateway (port 8000) - HEALTHY"
else
    print_error "❌ API Gateway (port 8000) - NOT RESPONDING"
fi

# Frontend
if curl -s http://localhost:5500 > /dev/null; then
    print_success "✅ Frontend (port 5500) - HEALTHY"
else
    print_error "❌ Frontend (port 5500) - NOT RESPONDING"
fi

# PostgreSQL
if brew services list | grep -q "postgresql.*started"; then
    print_success "✅ PostgreSQL - RUNNING"
else
    print_warning "⚠️  PostgreSQL - STATUS UNKNOWN"
fi

echo ""
print_status "=== OAUTH FLOW TEST ==="
print_status "Testing OAuth endpoint..."
if curl -s -X POST http://localhost:8000/api/auth/gmail-access -H "Content-Type: application/json" -d '{}' > /dev/null; then
    print_success "✅ OAuth endpoint responding"
else
    print_warning "⚠️  OAuth endpoint may have issues"
fi

echo ""
print_success "🎉 ALL SERVICES LAUNCHED SUCCESSFULLY!"
print_status "=== NEXT STEPS ==="
print_status "1. Open your browser to: http://localhost:5500"
print_status "2. Click 'Get Started with Google'"  
print_status "3. Complete OAuth authentication"
print_status "4. You should reach the dashboard"

echo ""
print_status "=== LOG FILES ==="
print_status "Data Server logs: $SCRIPT_DIR/logs/data-server.log"
print_status "API Gateway logs: $SCRIPT_DIR/logs/api-gateway.log"
print_status "Frontend logs: $SCRIPT_DIR/logs/frontend.log"

echo ""
print_status "=== PROCESS IDs ==="
print_status "Data Server PID: $DATA_SERVER_PID"
print_status "API Gateway PID: $API_GATEWAY_PID" 
print_status "Frontend PID: $FRONTEND_PID"

echo ""
print_warning "To stop all services, run: ./stop.sh"

print_success "🚀 SubsBuzz is ready for testing!"