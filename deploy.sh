#!/bin/bash
# deploy.sh — Deploy current branch to dev.subsbuzz.com
#
# Goal: `ssh subsbuzz "rm -rf /home/webdev/sites/dev.subsbuzz.com" && ./deploy.sh`
# should produce a fully working dev site.
#
# Flow:
#   1. Verify clean working tree, on `main` (or confirm if not).
#   2. git push origin <branch>  → GitHub.
#   3. SSH server: clone repo if missing; otherwise git fetch + reset --hard.
#   4. SSH server: git clean -fd  → wipes any untracked leftovers (does NOT
#      touch gitignored files like .env or named docker volumes).
#   5. rsync local .env.dev              → server :.env
#   6. rsync local docker-compose.dev.yml → server :docker-compose.yml
#      (canonical name; overwrites the prod compose that came down via git).
#   7. SSH server: rm the now-redundant .env.dev / .env.prod / docker-compose.dev.yml
#      so the server only carries the files it actually runs with.
#   8. SSH server: docker compose down && build && up -d.
#   9. Health checks against the dev ports (8001/3002/5501).
#
# Run from the root of your local SubsBuzz repo.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SSH_ALIAS="subsbuzz"
REMOTE_DIR="/home/webdev/sites/dev.subsbuzz.com"
GIT_REPO="https://github.com/tmattoneill/SubsBuzz.git"
DEFAULT_BRANCH="main"

LOCAL_ENV_FILE=".env.dev"
LOCAL_COMPOSE_FILE="docker-compose.dev.yml"

REMOTE_ENV_FILE=".env"
REMOTE_COMPOSE_FILE="docker-compose.yml"

# Dev-specific external ports (see docker-compose.dev.yml)
DEV_API_GATEWAY_PORT=8001
DEV_DATA_SERVER_PORT=3002
DEV_FRONTEND_PORT=5501

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}▶ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }

# ── 1. Pre-flight ─────────────────────────────────────────────────────────────
info "Pre-flight checks..."

[[ -f "$LOCAL_ENV_FILE" ]]     || error "$LOCAL_ENV_FILE not found in $(pwd). Cannot deploy without secrets."
[[ -f "$LOCAL_COMPOSE_FILE" ]] || error "$LOCAL_COMPOSE_FILE not found in $(pwd)."

if [[ -n $(git status --porcelain) ]]; then
    error "Uncommitted changes detected. Commit (or stash) first, then re-run."
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRANCH="$DEFAULT_BRANCH"
if [[ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]]; then
    warn "You are on '$CURRENT_BRANCH', not '$DEFAULT_BRANCH'."
    read -r -p "Deploy '$CURRENT_BRANCH' to dev anyway? (yes/no): " CONFIRM
    [[ "$CONFIRM" == "yes" ]] || { info "Aborted."; exit 0; }
    BRANCH="$CURRENT_BRANCH"
fi

# ── 2. Push to GitHub ─────────────────────────────────────────────────────────
info "Pushing to GitHub ($BRANCH)..."
git push origin "$BRANCH"

# ── 3+4. Ensure remote checkout, sync to origin/$BRANCH, scrub leftovers ─────
info "Syncing remote checkout at $REMOTE_DIR..."
ssh "$SSH_ALIAS" bash <<EOF
    set -euo pipefail
    if [[ ! -d "$REMOTE_DIR/.git" ]]; then
        echo "── Fresh checkout: cloning $GIT_REPO into $REMOTE_DIR ──"
        mkdir -p "\$(dirname "$REMOTE_DIR")"
        git clone "$GIT_REPO" "$REMOTE_DIR"
    fi
    cd "$REMOTE_DIR"
    echo "── Resetting to origin/$BRANCH ──"
    git fetch origin
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
    git reset --hard "origin/$BRANCH"
    echo "── Removing untracked leftovers (git clean -fd) ──"
    git clean -fd
EOF

# ── 5. rsync .env.dev → .env ─────────────────────────────────────────────────
info "rsync $LOCAL_ENV_FILE → $REMOTE_DIR/$REMOTE_ENV_FILE"
rsync -av --chmod=F600 "$LOCAL_ENV_FILE" "$SSH_ALIAS:$REMOTE_DIR/$REMOTE_ENV_FILE"

# ── 6. rsync docker-compose.dev.yml → docker-compose.yml ─────────────────────
info "rsync $LOCAL_COMPOSE_FILE → $REMOTE_DIR/$REMOTE_COMPOSE_FILE"
rsync -av "$LOCAL_COMPOSE_FILE" "$SSH_ALIAS:$REMOTE_DIR/$REMOTE_COMPOSE_FILE"

# ── 7. Drop the now-redundant suffixed files on the server ───────────────────
info "Removing redundant env/compose files on server..."
ssh "$SSH_ALIAS" bash <<EOF
    set -euo pipefail
    cd "$REMOTE_DIR"
    # These came down via git but are not what this server runs.
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
info "Health checks (retrying up to 12 × 5s = 60s per service)..."
ssh "$SSH_ALIAS" bash <<EOF
    wait_healthy() {
        local name="\$1" url="\$2" retries=12 delay=5
        for i in \$(seq 1 "\$retries"); do
            if curl -sf --max-time 8 "\$url" > /dev/null 2>&1; then
                echo "✓ \$name healthy"
                return 0
            fi
            echo "  \$name not ready yet (attempt \$i/\$retries)..."
            sleep "\$delay"
        done
        echo "✗ \$name did not become healthy after \$((retries * delay))s"
        return 1
    }

    overall=0
    wait_healthy "API Gateway" "http://localhost:$DEV_API_GATEWAY_PORT/health" || overall=1
    wait_healthy "Data Server" "http://localhost:$DEV_DATA_SERVER_PORT/health"  || overall=1
    wait_healthy "Frontend"    "http://localhost:$DEV_FRONTEND_PORT"            || overall=1
    exit \$overall
EOF

info "Done! Test at https://dev.subsbuzz.com"
