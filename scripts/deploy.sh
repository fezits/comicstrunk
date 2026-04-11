#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Comics Trunk - Deploy local → servidor (build local + tar/ssh)
# =============================================================================
# Pré-requisitos locais: pnpm, ssh com chave configurada
# Uso: ./scripts/deploy.sh [api|web|all]
# =============================================================================

# Garante que nvm/node/pnpm estejam no PATH
export NVM_DIR="/c/Users/Fernando/AppData/Local/nvm"
export PATH="$NVM_DIR/v24.14.1:$NVM_DIR/v24.14.1/node_modules/corepack/shims:$PATH"

SSH_USER="ferna5257"
SSH_HOST="server34.integrator.com.br"
API_REMOTE="/home/ferna5257/applications/api.comicstrunk.com"
WEB_REMOTE="/home/ferna5257/applications/comicstrunk.com"
PNPM_SERVER="/home/ferna5257/.local/bin/pnpm"
NODE_SERVER="/usr/nodejs/node-v20.1.0/bin/node"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-all}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# Envia um diretório local para o servidor via tar+ssh
# upload_dir <dir_local> <dir_remoto>
upload_dir() {
  local src="$1"
  local dest="$2"
  ssh "$SSH_USER@$SSH_HOST" "mkdir -p $dest"
  tar czf - -C "$src" . | ssh "$SSH_USER@$SSH_HOST" "tar xzf - -C $dest"
}

# ---------- BUILD CONTRACTS (sempre necessário) ----------
build_contracts() {
  log "Buildando contracts..."
  cd "$ROOT"
  pnpm --filter contracts build
}

# ---------- API ----------
deploy_api() {
  log "Buildando API..."
  cd "$ROOT"
  pnpm --filter api build

  # Empacotar contracts como tgz (resolve dep workspace:*)
  log "Empacotando contracts..."
  cd "$ROOT/packages/contracts"
  CONTRACTS_TGZ=$(pnpm pack --pack-destination "$ROOT/packages/contracts" 2>/dev/null | tail -1)
  cd "$ROOT"

  # Gerar package.json sem dep workspace para o servidor
  DEPLOY_PKG="$ROOT/scripts/.deploy-package.json"
  node "$ROOT/scripts/patch-package-deploy.js" "$(cygpath -w "$ROOT")" "$(cygpath -w "$DEPLOY_PKG")"

  log "Enviando artefatos..."
  upload_dir "$ROOT/apps/api/dist" "$API_REMOTE/dist"
  upload_dir "$ROOT/apps/api/prisma" "$API_REMOTE/prisma"
  scp -q "$DEPLOY_PKG" "$SSH_USER@$SSH_HOST:$API_REMOTE/package.json"
  scp -q "$CONTRACTS_TGZ" "$SSH_USER@$SSH_HOST:$API_REMOTE/contracts.tgz"

  # Limpar arquivos temporários locais
  rm -f "$CONTRACTS_TGZ" "$DEPLOY_PKG"

  log "Instalando dependências no servidor (pnpm --prod)..."
  ssh "$SSH_USER@$SSH_HOST" "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && cd $API_REMOTE && $PNPM_SERVER install --prod --no-frozen-lockfile"

  log "Gerando Prisma client no servidor..."
  ssh "$SSH_USER@$SSH_HOST" "export PATH=/usr/nodejs/node-v20.1.0/bin:\$PATH && cd $API_REMOTE && $NODE_SERVER ./node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js generate"

  log "Criando entry point app.js na raiz..."
  ssh "$SSH_USER@$SSH_HOST" "echo \"require('./dist/app.js');\" > $API_REMOTE/app.js"

  log "Reiniciando API (Passenger)..."
  ssh "$SSH_USER@$SSH_HOST" "mkdir -p $API_REMOTE/tmp && touch $API_REMOTE/tmp/restart.txt"

  log "API deployada."
}

# ---------- WEB ----------
deploy_web() {
  log "Buildando Web (standalone)..."
  cd "$ROOT"
  CI=true pnpm --filter web build

  STANDALONE="$ROOT/apps/web/.next/standalone"
  if [ ! -f "$STANDALONE/apps/web/server.js" ]; then
    echo "ERRO: standalone não gerado. Verifique output: 'standalone' no next.config.ts"
    exit 1
  fi

  log "Enviando standalone..."
  upload_dir "$STANDALONE" "$WEB_REMOTE"

  log "Enviando public/..."
  upload_dir "$ROOT/apps/web/public" "$WEB_REMOTE/apps/web/public"

  log "Enviando .next/static/..."
  upload_dir "$ROOT/apps/web/.next/static" "$WEB_REMOTE/apps/web/.next/static"

  log "Criando symlink server.js..."
  ssh "$SSH_USER@$SSH_HOST" \
    "ln -sf $WEB_REMOTE/apps/web/server.js $WEB_REMOTE/server.js 2>/dev/null || true"

  log "Reiniciando Web (Passenger)..."
  ssh "$SSH_USER@$SSH_HOST" "mkdir -p $WEB_REMOTE/tmp && touch $WEB_REMOTE/tmp/restart.txt"

  log "Web deployada."
}

# ---------- MAIN ----------
build_contracts

case "$TARGET" in
  api)  deploy_api ;;
  web)  deploy_web ;;
  all)  deploy_api; deploy_web ;;
  *)    echo "Uso: $0 [api|web|all]"; exit 1 ;;
esac

log "Deploy finalizado!"
