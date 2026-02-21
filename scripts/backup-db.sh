#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Comics Trunk - Database Backup Script (cPanel Cron Job)
# =============================================================================
# Usage: ./scripts/backup-db.sh
#
# This script creates a mysqldump backup of the Comics Trunk database and
# retains the last N days of backups (default: 7). Designed to be registered
# as a daily cron job in cPanel.
#
# cPanel Cron Job setup:
#   Schedule: 0 3 * * * (daily at 3:00 AM)
#   Command: /home/username/comicstrunk/scripts/backup-db.sh
#
# Environment variables (set in cPanel or source from a file):
#   DB_HOST     - MySQL host (default: localhost)
#   DB_PORT     - MySQL port (default: 3306)
#   DB_NAME     - Database name (required)
#   DB_USER     - Database user (required)
#   DB_PASSWORD - Database password (required)
#   BACKUP_DIR  - Where to store backups (default: ~/backups/db)
#   BACKUP_RETENTION_DAYS - Days to retain backups (default: 7)
# =============================================================================

# Load environment from file if it exists (for cron context)
ENV_FILE="${HOME}/.comicstrunk-backup-env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:?ERROR: DB_NAME environment variable is required}"
DB_USER="${DB_USER:?ERROR: DB_USER environment variable is required}"
DB_PASSWORD="${DB_PASSWORD:?ERROR: DB_PASSWORD environment variable is required}"
BACKUP_DIR="${BACKUP_DIR:-${HOME}/backups/db}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "=== Comics Trunk Database Backup ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Database: ${DB_NAME}"
echo "Backup dir: ${BACKUP_DIR}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Run mysqldump and compress
echo "[1/3] Creating backup..."
mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty! Something went wrong with mysqldump."
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Clean up old backups
echo "[2/3] Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${BACKUP_RETENTION_DAYS} -delete -print | wc -l)
echo "Deleted $DELETED_COUNT old backup(s)"

# List current backups
echo "[3/3] Current backups:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null || echo "  (none found)"

echo ""
echo "=== Backup complete ==="
