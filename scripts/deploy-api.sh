#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Comics Trunk - API Deployment Script (cPanel / Passenger)
# =============================================================================
# Usage: ./scripts/deploy-api.sh [DEPLOY_PATH]
#
# This script builds the Express API and deploys it to the specified cPanel
# application directory. Passenger is restarted via touch tmp/restart.txt.
#
# Prerequisites:
#   - pnpm installed
#   - Node.js 18+ available
#   - cPanel Node.js application configured with startup file: dist/app.js
# =============================================================================

DEPLOY_PATH="${1:-/home/username/api.comicstrunk.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== Comics Trunk API Deployment ==="
echo "Timestamp: $TIMESTAMP"
echo "Deploy path: $DEPLOY_PATH"
echo ""

# Step 1: Build contracts (API dependency)
echo "[1/5] Building contracts package..."
cd "$PROJECT_ROOT"
pnpm --filter contracts build

# Step 2: Build API
echo "[2/5] Building API..."
pnpm --filter api build

# Step 3: Run Prisma generate (ensures client is up to date)
echo "[3/5] Generating Prisma client..."
cd "$PROJECT_ROOT/apps/api"
npx prisma generate

# Step 4: Copy build output to deployment path
echo "[4/5] Copying files to $DEPLOY_PATH..."
mkdir -p "$DEPLOY_PATH/dist"
mkdir -p "$DEPLOY_PATH/node_modules"
mkdir -p "$DEPLOY_PATH/tmp"

# Copy compiled JS
cp -r "$PROJECT_ROOT/apps/api/dist/"* "$DEPLOY_PATH/dist/"

# Copy Prisma schema and migrations (needed for prisma migrate deploy)
mkdir -p "$DEPLOY_PATH/prisma"
cp -r "$PROJECT_ROOT/apps/api/prisma/schema.prisma" "$DEPLOY_PATH/prisma/"
cp -r "$PROJECT_ROOT/apps/api/prisma/migrations" "$DEPLOY_PATH/prisma/" 2>/dev/null || true

# Copy package.json for reference
cp "$PROJECT_ROOT/apps/api/package.json" "$DEPLOY_PATH/package.json"

# Copy .htaccess for HTTPS enforcement
cp "$PROJECT_ROOT/apps/api/.htaccess" "$DEPLOY_PATH/.htaccess"

# Step 5: Restart Passenger
echo "[5/5] Restarting Passenger..."
touch "$DEPLOY_PATH/tmp/restart.txt"

echo ""
echo "=== Deployment complete ==="
echo "Deployed at: $TIMESTAMP"
echo "Restart triggered: $DEPLOY_PATH/tmp/restart.txt"
echo ""
echo "Post-deployment checklist:"
echo "  1. Run database migrations: cd $DEPLOY_PATH && npx prisma migrate deploy"
echo "  2. Verify health: curl https://api.comicstrunk.com/health"
