#!/usr/bin/env bash
# =============================================================================
# Comics Trunk - Cron Job: Sync catálogo Panini + Rika
# =============================================================================
# Configurar no cPanel → Cron Jobs:
#   Comando: /home/ferna5257/applications/api.comicstrunk.com/scripts/cron-sync.sh
#   Horário: 0 4 * * * (4h da manhã, todo dia)
#
# O que faz:
#   1. Sync incremental Panini + Rika (novos gibis + atualização de preços)
#   2. Baixa capas faltantes
#   3. Redimensiona capas > 500KB
#
# Log: /home/ferna5257/logs/sync-catalog.log (rotação: últimos 5 dias)
# =============================================================================

set -euo pipefail

export PATH=/usr/nodejs/node-v20.1.0/bin:/home/ferna5257/.local/bin:$PATH
export DATABASE_URL='mysql://ferna5257_comics:ComicsComics@123@localhost:3306/ferna5257_comicstrunk_db'

APP_DIR="/home/ferna5257/applications/api.comicstrunk.com"
LOG_DIR="/home/ferna5257/logs"
LOG_FILE="$LOG_DIR/sync-catalog.log"
COVERS_DIR="$APP_DIR/uploads/comicstrunk/covers"

mkdir -p "$LOG_DIR"

# Rotação de log: mantém últimos 5 dias
find "$LOG_DIR" -name "sync-catalog-*.log" -mtime +5 -delete 2>/dev/null || true
if [ -f "$LOG_FILE" ]; then
  mv "$LOG_FILE" "$LOG_DIR/sync-catalog-$(date +%Y%m%d).log"
fi

exec > "$LOG_FILE" 2>&1

echo "=== SYNC INICIADO $(date) ==="

cd "$APP_DIR"

# 1. Sync catálogo (incremental - para ao encontrar 100 consecutivos já existentes)
echo ""
echo "--- Sync Catálogo ---"
npx tsx scripts/sync-catalog.ts 2>&1 || echo "WARN: sync-catalog falhou"

# 2. Baixar capas faltantes
echo ""
echo "--- Capas Faltantes ---"
npx tsx scripts/fetch-missing-covers.ts 2>&1 || echo "WARN: fetch-covers falhou"

# 3. Corrigir entries com URL mas sem arquivo
echo ""
echo "--- Fix Cover Files ---"
npx tsx scripts/fix-missing-cover-files.js 2>&1 || echo "WARN: fix-covers falhou"

# 4. Redimensionar capas grandes
echo ""
echo "--- Resize Capas ---"
LARGE=$(find "$COVERS_DIR" -name "*.jpg" -size +500k 2>/dev/null | wc -l)
if [ "$LARGE" -gt 0 ]; then
  echo "Redimensionando $LARGE capas > 500KB..."
  find "$COVERS_DIR" -name "*.jpg" -size +500k -print0 | xargs -0 -P 2 mogrify -resize "600x>" -quality 80 -strip {} 2>/dev/null || echo "WARN: resize falhou"
  echo "Resize concluído"
else
  echo "Nenhuma capa grande encontrada"
fi

echo ""
echo "=== SYNC FINALIZADO $(date) ==="
