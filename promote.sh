#!/bin/bash
# promote.sh - Promote dev.subsbuzz.com to www.subsbuzz.com
# Usage: Run this ON THE SERVER as webdev
# ssh subsbuzz then ./promote.sh

set -e

# ── Config ────────────────────────────────────────────────────────────────────
DEV_DIR="/home/webdev/sites/dev.subsbuzz.com"
PROD_DIR="/home/webdev/sites/subsbuzz.com"
DEV_COMPOSE="docker-compose.dev.yml"
PROD_COMPOSE="docker-compose.prod.yml"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ── Safety check ──────────────────────────────────────────────────────────────
warn "This will promote dev to production (www.subsbuzz.com)"
read -p "Are you sure? (yes/no): " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { info "Aborted."; exit 0; }

# ── 1. Verify dev is healthy before promoting ─────────────────────────────────
info "Checking dev environment health..."
curl -sf http://localhost:8001/health || error "API Gateway not healthy — fix dev before promoting"
curl -sf http://localhost:3001/health || error "Data Server not healthy — fix dev before promoting"
info "Dev environment is healthy, proceeding..."

# ── 2. Set up prod directory if needed ───────────────────────────────────────
if [ ! -d "$PROD_DIR" ]; then
    info "Creating prod directory..."
    mkdir -p $PROD_DIR
fi

# ── 3. Sync code ──────────────────────────────────────────────────────────────
info "Syncing code to prod directory..."
rsync -av --exclude='.env*' \
          --exclude='node_modules' \
          --exclude='__pycache__' \
          --exclude='.git' \
          $DEV_DIR/ $PROD_DIR/

# ── 4. Check prod env file exists ─────────────────────────────────────────────
if [ ! -f "$PROD_DIR/.env.prod" ]; then
    warn "No .env.prod found in $PROD_DIR"
    warn "Copy and edit your prod env file before continuing:"
    warn "  cp $DEV_DIR/.env.prod $PROD_DIR/.env.prod"
    warn "  nano $PROD_DIR/.env.prod"
    error "Halted — set up .env.prod first"
fi

# ── 5. Build and start prod containers ───────────────────────────────────────
info "Building production containers..."
cd $PROD_DIR
docker compose -f $PROD_COMPOSE down --remove-orphans
docker compose -f $PROD_COMPOSE build --no-cache
docker compose -f $PROD_COMPOSE up -d

info "Waiting for services..."
sleep 5

# ── 6. Health checks ──────────────────────────────────────────────────────────
info "Running health checks..."
docker compose -f $PROD_COMPOSE ps

curl -sf http://localhost:8000/health && echo "✓ API Gateway (prod) healthy" || warn "✗ API Gateway not responding"
curl -sf http://localhost:3001/health && echo "✓ Data Server (prod) healthy" || warn "✗ Data Server not responding"
curl -sf http://localhost:5500         && echo "✓ Frontend (prod) healthy"    || warn "✗ Frontend not responding"

info "Done! Check https://www.subsbuzz.com"
