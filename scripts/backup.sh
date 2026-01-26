#!/bin/bash

###############################################################################
# Backup Script for Personal Finance Telegram Bot
# 
# This script backs up:
# - SQLite database
# - Environment configuration
# - Logs (optional)
# 
# Usage:
#   ./backup.sh
#   ./backup.sh /custom/backup/path
# 
# Cron example (daily at 3 AM):
#   0 3 * * * /opt/my-pers-fin-bot/scripts/backup.sh >> /var/log/bot-backup.log 2>&1
###############################################################################

set -e  # Exit on error

# Configuration
BACKUP_DIR="${1:-/backups/my-pers-fin-bot}"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;0m' # No Color

echo -e "${GREEN}Starting backup at $(date)${NC}"
echo "App directory: $APP_DIR"
echo "Backup directory: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$APP_DIR/data/database.sqlite" ]; then
    echo -e "${RED}Error: Database file not found at $APP_DIR/data/database.sqlite${NC}"
    exit 1
fi

# Create temporary directory
TMP_DIR="$BACKUP_DIR/tmp_$DATE"
mkdir -p "$TMP_DIR"

echo "Creating backup files..."

# 1. Backup database
echo "- Backing up database..."
cp "$APP_DIR/data/database.sqlite" "$TMP_DIR/database.sqlite"

# Verify database integrity
if command -v sqlite3 &> /dev/null; then
    echo "- Verifying database integrity..."
    if ! sqlite3 "$TMP_DIR/database.sqlite" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo -e "${RED}Warning: Database integrity check failed${NC}"
    else
        echo -e "${GREEN}  Database integrity: OK${NC}"
    fi
fi

# 2. Backup .env file
if [ -f "$APP_DIR/.env" ]; then
    echo "- Backing up .env file..."
    cp "$APP_DIR/.env" "$TMP_DIR/.env"
else
    echo -e "${YELLOW}Warning: .env file not found${NC}"
fi

# 3. Backup logs (optional, last 7 days)
if [ -d "$APP_DIR/logs" ]; then
    echo "- Backing up recent logs..."
    find "$APP_DIR/logs" -name "*.log" -mtime -7 -exec cp {} "$TMP_DIR/" \;
fi

# 4. Create metadata file
echo "- Creating metadata..."
cat > "$TMP_DIR/backup_info.txt" << EOF
Backup Date: $(date)
App Directory: $APP_DIR
Node Version: $(node --version 2>/dev/null || echo "N/A")
Bot Version: $(cat $APP_DIR/package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
Database Size: $(du -h "$TMP_DIR/database.sqlite" | cut -f1)
EOF

# 5. Compress
echo "- Compressing backup..."
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.tar.gz"
tar -czf "$BACKUP_FILE" -C "$TMP_DIR" .

# 6. Clean up temporary directory
rm -rf "$TMP_DIR"

# 7. Verify backup
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}Backup completed successfully!${NC}"
    echo "File: $BACKUP_FILE"
    echo "Size: $BACKUP_SIZE"
else
    echo -e "${RED}Error: Backup file was not created${NC}"
    exit 1
fi

# 8. Clean up old backups
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 9. List all backups
echo ""
echo "Available backups:"
ls -lh "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null || echo "No backups found"

echo ""
echo -e "${GREEN}Backup completed at $(date)${NC}"
exit 0
