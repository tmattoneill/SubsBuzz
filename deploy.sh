#!/bin/bash
# deploy.sh - Deploy committed changes to dev.subsbuzz.com
# Usage: ./deploy.sh
# Commit your changes first, then run this to push and deploy.
# Run from the root of your local SubsBuzz repo

set -e

# ── Config ────────────────────────────────────────────────────────────────────
SSH_ALIAS="subsbuzz"
REMOTE_DIR="/home/webdev/sites/dev.subsbuzz.com"
COMPOSE_FILE="docker-compose.dev.yml"
BRANCH="main"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ── 1. Git ────────────────────────────────────────────────────────────────────
if [[ -n $(git status --porcelain) ]]; then
    error "Uncommitted changes detected. Commit first, then run ./deploy.sh"
fi

info "Pushing to GitHub ($BRANCH)..."
git push origin $BRANCH

# ── 2. Sync promote.sh to server ──────────────────────────────────────────────
info "Syncing promote.sh to server..."
rsync -av promote.sh $SSH_ALIAS:$REMOTE_DIR/promote.sh

# ── 3. Deploy to server ──────────────────────────────────────────────────────
info "Deploying to dev.subsbuzz.com..."
ssh $SSH_ALIAS bash << EOF
    set -e

    echo "── Pulling latest code ──"
    cd $REMOTE_DIR
    git fetch origin
    git reset --hard origin/$BRANCH

    echo "── Building and starting containers ──"
    docker compose -f $COMPOSE_FILE --env-file .env.dev down --remove-orphans
    docker compose -f $COMPOSE_FILE --env-file .env.dev build --no-cache
    docker compose -f $COMPOSE_FILE --env-file .env.dev up -d

    echo "── Waiting for services to start ──"
    sleep 5

    echo "── Container status ──"
    docker compose -f $COMPOSE_FILE --env-file .env.dev ps

    echo "── Health checks ──"
    curl -sf http://localhost:8001/health && echo "✓ API Gateway healthy" || echo "✗ API Gateway not responding"
    curl -sf http://localhost:3002/health && echo "✓ Data Server healthy" || echo "✗ Data Server not responding"
    curl -sf http://localhost:5501         && echo "✓ Frontend healthy"    || echo "✗ Frontend not responding"
EOF

info "Done! Test at https://dev.subsbuzz.com"
