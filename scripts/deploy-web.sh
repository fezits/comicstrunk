#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Comics Trunk - Web Frontend Deployment Script (cPanel / Passenger)
# =============================================================================
# Usage: ./scripts/deploy-web.sh [DEPLOY_PATH]
#
# This script builds the Next.js frontend in standalone mode and deploys it
# to the specified cPanel application directory. The standalone output is
# self-contained — do NOT run pnpm install inside it.
#
# Prerequisites:
#   - pnpm installed
#   - Node.js 18+ available
#   - CI=true or NODE_ENV=production to enable standalone output
#   - cPanel Node.js application configured with startup file: server.js
#   - Environment variables HOSTNAME=0.0.0.0 and PORT set in cPanel
# =============================================================================

DEPLOY_PATH="${1:-/home/username/comicstrunk.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== Comics Trunk Web Deployment ==="
echo "Timestamp: $TIMESTAMP"
echo "Deploy path: $DEPLOY_PATH"
echo ""

# Step 1: Build contracts (web dependency)
echo "[1/5] Building contracts package..."
cd "$PROJECT_ROOT"
pnpm --filter contracts build

# Step 2: Build web (standalone mode)
echo "[2/5] Building web frontend (standalone)..."
CI=true pnpm --filter web build

# Verify standalone output was created
STANDALONE_DIR="$PROJECT_ROOT/apps/web/.next/standalone"
if [ ! -f "$STANDALONE_DIR/apps/web/server.js" ]; then
  echo "ERROR: Standalone server.js not found at $STANDALONE_DIR/apps/web/server.js"
  echo "Ensure output: 'standalone' is enabled in next.config.ts"
  exit 1
fi

# Step 3: Prepare deployment directory
echo "[3/5] Preparing deployment directory..."
mkdir -p "$DEPLOY_PATH/tmp"

# Copy standalone output (self-contained with traced node_modules)
cp -r "$STANDALONE_DIR/"* "$DEPLOY_PATH/"

# Step 4: Copy static assets into standalone
echo "[4/5] Copying static assets..."

# Copy public/ directory
if [ -d "$PROJECT_ROOT/apps/web/public" ]; then
  cp -r "$PROJECT_ROOT/apps/web/public" "$DEPLOY_PATH/apps/web/public"
fi

# Copy .next/static/ into standalone .next/static/
mkdir -p "$DEPLOY_PATH/apps/web/.next/static"
cp -r "$PROJECT_ROOT/apps/web/.next/static/"* "$DEPLOY_PATH/apps/web/.next/static/"

# Step 5: Restart Passenger
echo "[5/5] Restarting Passenger..."
touch "$DEPLOY_PATH/tmp/restart.txt"

echo ""
echo "=== Deployment complete ==="
echo "Deployed at: $TIMESTAMP"
echo "Restart triggered: $DEPLOY_PATH/tmp/restart.txt"
echo ""
echo "IMPORTANT: Do NOT run 'pnpm install' in the standalone directory."
echo "The standalone build is self-contained with traced node_modules."
echo ""
echo "Post-deployment checklist:"
echo "  1. Ensure HOSTNAME=0.0.0.0 is set in cPanel environment variables"
echo "  2. Ensure PORT is set to the cPanel-assigned port"
echo "  3. Verify: curl https://comicstrunk.com"
