#!/bin/bash
set -e

# SubsBuzz Development Deployment Script
# Deploys isolated development environment to dev.subsbuzz.com
# DOES NOT interfere with production deployment

echo "🚀 Deploying SubsBuzz Development Environment..."
echo "📍 Target: dev.subsbuzz.com (isolated from production)"

# Configuration
DEV_APP_DIR="/home/webdev/sites/dev.subsbuzz.com"
BACKUP_DIR="/opt/subsbuzz-dev-backup"
DEPLOY_DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/subsbuzz/deploy-dev-$DEPLOY_DATE.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Create log directory
sudo mkdir -p /var/log/subsbuzz
sudo touch "$LOG_FILE"
sudo chown $USER:$USER "$LOG_FILE"

log "Starting SubsBuzz Development Deployment"
log "Deployment ID: $DEPLOY_DATE"

# Pre-deployment checks
log "🔍 Running pre-deployment checks..."

# Check if we're in the right directory
if [[ ! -f "docker-compose.dev.yml" ]]; then
    error "docker-compose.dev.yml not found. Run this script from the SubsBuzz root directory."
fi

# Check if development environment file exists
if [[ ! -f ".env.dev-staging" ]]; then
    error ".env.dev-staging file not found. Please create it first."
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    error "Docker is not running. Please start Docker first."
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        error "Docker Compose not found. Please install Docker Compose."
    else
        DOCKER_COMPOSE="docker compose"
    fi
else
    DOCKER_COMPOSE="docker-compose"
fi

# Check for port conflicts (make sure production isn't using dev ports)
log "🔍 Checking for port conflicts..."
DEV_PORTS=(5501 8001 3002 5433 6380 8080)
for port in "${DEV_PORTS[@]}"; do
    if netstat -tlpn 2>/dev/null | grep -q ":$port "; then
        warning "Port $port is already in use. This may cause conflicts."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment aborted due to port conflict on $port"
        fi
    fi
done

success "Pre-deployment checks passed"

# Create development application directory
log "📁 Setting up development directory structure..."
sudo mkdir -p "$DEV_APP_DIR"
sudo mkdir -p "$BACKUP_DIR"

# Create backup of current deployment if it exists
if [[ -d "$DEV_APP_DIR" ]] && [[ "$(ls -A $DEV_APP_DIR)" ]]; then
    log "💾 Creating backup of current development deployment..."
    sudo cp -r "$DEV_APP_DIR" "$BACKUP_DIR-$DEPLOY_DATE"
    success "Backup created at $BACKUP_DIR-$DEPLOY_DATE"
fi

# Copy application files
log "📁 Copying application files to development directory..."
sudo rsync -av --exclude='.git' --exclude='node_modules' --exclude='logs' --exclude='.env*' . "$DEV_APP_DIR/"
sudo chown -R $USER:$USER "$DEV_APP_DIR"
success "Files copied to $DEV_APP_DIR"

# Copy development environment file
log "⚙️  Setting up development environment..."
cp .env.dev-staging "$DEV_APP_DIR/.env"
success "Development environment configured"

# Change to development directory
cd "$DEV_APP_DIR"

# Stop any existing development services
log "🛑 Stopping existing development services..."
$DOCKER_COMPOSE -f docker-compose.dev.yml down --remove-orphans || true
success "Existing services stopped"

# Clean up old images and containers
log "🧹 Cleaning up old Docker resources..."
docker system prune -f --filter "label=project=subsbuzz" --filter "label=environment=development" || true

# Pull/build latest images
log "🐳 Building development Docker images..."
$DOCKER_COMPOSE -f docker-compose.dev.yml build --no-cache
success "Docker images built successfully"

# Start development services
log "🚀 Starting development services..."
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d
success "Development services started"

# Wait for services to initialize
log "⏳ Waiting for services to initialize..."
sleep 45

# Check service health
log "🔍 Checking service health..."
SERVICES=("postgres" "redis" "data-server" "api-gateway" "frontend")
HEALTHY=true
RETRY_COUNT=0
MAX_RETRIES=5

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    HEALTHY=true
    
    for service in "${SERVICES[@]}"; do
        # Check if service is running
        if $DOCKER_COMPOSE -f docker-compose.dev.yml ps "$service" | grep -q "Up"; then
            # Check health status
            health_status=$($DOCKER_COMPOSE -f docker-compose.dev.yml ps "$service" | grep "$service" | awk '{print $5}')
            if [[ "$health_status" == *"healthy"* ]] || [[ "$service" == "frontend" ]]; then
                success "$service: healthy"
            else
                warning "$service: not healthy yet ($health_status)"
                HEALTHY=false
            fi
        else
            error "$service: not running"
            HEALTHY=false
        fi
    done
    
    if [[ "$HEALTHY" == "true" ]]; then
        break
    fi
    
    ((RETRY_COUNT++))
    if [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; then
        log "⏳ Waiting 30 seconds before retry ($RETRY_COUNT/$MAX_RETRIES)..."
        sleep 30
    fi
done

# Test API endpoints
log "🧪 Testing API endpoints..."
API_BASE="http://localhost:8001"

# Test health endpoint
if curl -sf "$API_BASE/health" >/dev/null; then
    success "API Gateway health check: OK"
else
    warning "API Gateway health check: FAILED"
    HEALTHY=false
fi

# Test data server health (through API gateway)
if curl -sf "http://localhost:3002/health" >/dev/null; then
    success "Data Server health check: OK"
else
    warning "Data Server health check: FAILED"
    HEALTHY=false
fi

# Test frontend
if curl -sf "http://localhost:5501" >/dev/null; then
    success "Frontend health check: OK"
else
    warning "Frontend health check: FAILED"
    HEALTHY=false
fi

# Display deployment results
echo ""
if [[ "$HEALTHY" == "true" ]]; then
    echo "🎉 Development Deployment Successful!"
    echo ""
    success "All services are healthy and running"
else
    echo "⚠️  Development Deployment Completed with Warnings"
    echo ""
    warning "Some services may not be fully healthy. Check logs for details."
fi

# Display service information
echo ""
log "📊 Development Service Status:"
$DOCKER_COMPOSE -f docker-compose.dev.yml ps

echo ""
log "🌐 Development URLs:"
echo "   Frontend: https://dev.subsbuzz.com"
echo "   API: https://dev.subsbuzz.com/api"
echo "   Health Check: https://dev.subsbuzz.com/health"
echo "   Database Admin: http://dev.subsbuzz.com:8080 (if enabled)"

echo ""
log "🔐 Development Access:"
echo "   Authentication: HTTP Basic Auth (configured during SSL setup)"
echo "   SSL Certificate: Let's Encrypt for dev.subsbuzz.com"

echo ""
log "📋 Useful Commands:"
echo "   View logs: $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f [service-name]"
echo "   Restart service: $DOCKER_COMPOSE -f docker-compose.dev.yml restart [service-name]"
echo "   Stop all: $DOCKER_COMPOSE -f docker-compose.dev.yml down"
echo "   Shell access: $DOCKER_COMPOSE -f docker-compose.dev.yml exec [service-name] /bin/sh"

echo ""
log "📋 Next Steps:"
echo "1. Configure Google OAuth redirect URI: https://dev.subsbuzz.com/auth/callback"
echo "2. Test OAuth login flow"
echo "3. Test email monitoring and digest generation"
echo "4. Verify all microservices functionality"

if [[ "$HEALTHY" != "true" ]]; then
    echo ""
    warning "Some services are not healthy. Check logs:"
    echo "   docker-compose -f docker-compose.dev.yml logs --tail=50"
    echo ""
    echo "🔄 Rollback command (if needed):"
    echo "   $DOCKER_COMPOSE -f docker-compose.dev.yml down"
    if [[ -d "$BACKUP_DIR-$DEPLOY_DATE" ]]; then
        echo "   sudo rm -rf $DEV_APP_DIR && sudo mv $BACKUP_DIR-$DEPLOY_DATE $DEV_APP_DIR"
    fi
fi

# Log deployment completion
log "Deployment completed at $(date)"
log "Log file: $LOG_FILE"

success "🎯 SubsBuzz Development Environment Ready!"
echo "   Access at: https://dev.subsbuzz.com"