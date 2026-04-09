#!/bin/bash
# promote.sh — Promote main → subsbuzz.com (production)
#
# Goal: `ssh subsbuzz "rm -rf /home/webdev/sites/subsbuzz.com" && ./promote.sh`
# should produce a fully working production site.
#
# Note: dev and prod live on the SAME server (SSH alias `subsbuzz`), in
# different directories, on different ports. The dev/prod compose files
# don't collide because they bind to disjoint host ports.
#
# Mirrors deploy.sh, but:
#   - Targets the prod directory.
#   - Refuses to run unless you're on `main` with a clean tree.
#   - Requires an explicit `yes` confirmation (this is PROD).
#   - Sends `.env.prod` → `.env` and `docker-compose.yml` → `docker-compose.yml`.
#   - Health-checks against prod-internal ports (8000/3001/3000).
#
# Run from the root of your local SubsBuzz repo.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SSH_ALIAS="subsbuzz"
REMOTE_DIR="/home/webdev/sites/subsbuzz.com"
GIT_REPO="https://github.com/tmattoneill/SubsBuzz.git"
REQUIRED_BRANCH="main"

LOCAL_ENV_FILE=".env.prod"
LOCAL_COMPOSE_FILE="docker-compose.yml"

REMOTE_ENV_FILE=".env"
REMOTE_COMPOSE_FILE="docker-compose.yml"

# Prod-internal ports (see docker-compose.yml)
PROD_API_GATEWAY_PORT=8000
PROD_DATA_SERVER_PORT=3001
PROD_FRONTEND_PORT=3000

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}▶ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }

# ── 1. Pre-flight ─────────────────────────────────────────────────────────────
info "Pre-flight checks (PRODUCTION)..."

[[ -f "$LOCAL_ENV_FILE" ]]     || error "$LOCAL_ENV_FILE not found in $(pwd). Cannot promote without prod secrets."
[[ -f "$LOCAL_COMPOSE_FILE" ]] || error "$LOCAL_COMPOSE_FILE not found in $(pwd)."

if [[ -n $(git status --porcelain) ]]; then
    error "Uncommitted changes detected. Commit (or stash) first, then re-run."
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "$REQUIRED_BRANCH" ]]; then
    error "Promotion requires branch '$REQUIRED_BRANCH' (you are on '$CURRENT_BRANCH'). Merge to main first."
fi

# Make sure local main matches origin/main (no unpushed or behind state)
git fetch origin "$REQUIRED_BRANCH" >/dev/null 2>&1 || error "git fetch origin $REQUIRED_BRANCH failed."
LOCAL_SHA=$(git rev-parse "$REQUIRED_BRANCH")
REMOTE_SHA=$(git rev-parse "origin/$REQUIRED_BRANCH")
if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
    warn "Local $REQUIRED_BRANCH ($LOCAL_SHA) differs from origin/$REQUIRED_BRANCH ($REMOTE_SHA)."
    warn "Will push local → origin before promoting."
fi

warn "You are about to promote '$REQUIRED_BRANCH' to PRODUCTION ($SSH_ALIAS:$REMOTE_DIR)."
warn "This will rebuild and restart all containers on the live site."
read -r -p "Type 'yes' to proceed: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { info "Aborted."; exit 0; }

# ── 2. Push to GitHub ─────────────────────────────────────────────────────────
info "Pushing to GitHub ($REQUIRED_BRANCH)..."
git push origin "$REQUIRED_BRANCH"

# ── 3+4. Ensure remote checkout, sync to origin/main, scrub leftovers ────────
info "Syncing remote checkout at $REMOTE_DIR..."
ssh "$SSH_ALIAS" bash <<EOF
    set -euo pipefail
    if [[ ! -d "$REMOTE_DIR/.git" ]]; then
        echo "── Fresh checkout: cloning $GIT_REPO into $REMOTE_DIR ──"
        mkdir -p "\$(dirname "$REMOTE_DIR")"
        git clone "$GIT_REPO" "$REMOTE_DIR"
    fi
    cd "$REMOTE_DIR"
    echo "── Resetting to origin/$REQUIRED_BRANCH ──"
    git fetch origin
    git checkout "$REQUIRED_BRANCH" 2>/dev/null || git checkout -b "$REQUIRED_BRANCH" "origin/$REQUIRED_BRANCH"
    git reset --hard "origin/$REQUIRED_BRANCH"
    echo "── Removing untracked leftovers (git clean -fd) ──"
    git clean -fd
EOF

# ── 5. rsync .env.prod → .env ────────────────────────────────────────────────
info "rsync $LOCAL_ENV_FILE → $REMOTE_DIR/$REMOTE_ENV_FILE"
rsync -av --chmod=F600 "$LOCAL_ENV_FILE" "$SSH_ALIAS:$REMOTE_DIR/$REMOTE_ENV_FILE"

# ── 6. rsync docker-compose.yml → docker-compose.yml ─────────────────────────
# (Same name, but rsync ensures the local version overwrites whatever git brought.)
info "rsync $LOCAL_COMPOSE_FILE → $REMOTE_DIR/$REMOTE_COMPOSE_FILE"
rsync -av "$LOCAL_COMPOSE_FILE" "$SSH_ALIAS:$REMOTE_DIR/$REMOTE_COMPOSE_FILE"

# ── 7. Drop the now-redundant suffixed files on the server ───────────────────
info "Removing redundant env/compose files on server..."
ssh "$SSH_ALIAS" bash <<EOF
    set -euo pipefail
    cd "$REMOTE_DIR"
    # The dev variants come down via git but prod doesn't run with them.
    rm -f .env.dev .env.prod .env.dev-staging .env.local docker-compose.dev.yml
EOF

# ── 8. Build & start containers ───────────────────────────────────────────────
info "Building and starting containers..."
ssh "$SSH_ALIAS" bash <<EOF
    set -euo pipefail
    cd "$REMOTE_DIR"
    docker compose down --remove-orphans
    docker compose build --no-cache
    docker compose up -d

    echo "── Waiting for services to start ──"
    sleep 5

    echo "── Container status ──"
    docker compose ps
EOF

# ── 9. Health checks ──────────────────────────────────────────────────────────
info "Health checks..."
ssh "$SSH_ALIAS" bash <<EOF
    curl -sf http://localhost:$PROD_API_GATEWAY_PORT/health && echo "✓ API Gateway healthy" || echo "✗ API Gateway not responding"
    curl -sf http://localhost:$PROD_DATA_SERVER_PORT/health && echo "✓ Data Server healthy" || echo "✗ Data Server not responding"
    curl -sf http://localhost:$PROD_FRONTEND_PORT             && echo "✓ Frontend reachable" || echo "✗ Frontend not responding"
EOF

info "Done! Test at https://subsbuzz.com"
