#!/bin/bash

###############################################################################
# Restore Script for Personal Finance Telegram Bot
# 
# Usage:
#   ./restore.sh /path/to/backup_20260126_030000.tar.gz
# 
# Warning: This will overwrite current database and configuration!
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;0m'

# Check arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 /path/to/backup_file.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will overwrite current data!${NC}"
echo "Backup file: $BACKUP_FILE"
echo "App directory: $APP_DIR"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

# Check if bot is running
if pm2 list 2>/dev/null | grep -q "my-pers-fin-bot.*online"; then
    echo "Stopping bot..."
    pm2 stop my-pers-fin-bot || true
    RESTART_BOT=true
else
    RESTART_BOT=false
fi

# Create temporary directory
TMP_DIR="/tmp/bot_restore_$$"
mkdir -p "$TMP_DIR"

echo "Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$TMP_DIR"

# Show backup info
if [ -f "$TMP_DIR/backup_info.txt" ]; then
    echo ""
    echo "Backup Information:"
    cat "$TMP_DIR/backup_info.txt"
    echo ""
fi

# Backup current data (just in case)
echo "Creating safety backup of current data..."
SAFETY_BACKUP="$APP_DIR/data/database.sqlite.pre-restore.$(date +%Y%m%d_%H%M%S)"
if [ -f "$APP_DIR/data/database.sqlite" ]; then
    cp "$APP_DIR/data/database.sqlite" "$SAFETY_BACKUP"
    echo "Current database backed up to: $SAFETY_BACKUP"
fi

# Restore database
if [ -f "$TMP_DIR/database.sqlite" ]; then
    echo "Restoring database..."
    cp "$TMP_DIR/database.sqlite" "$APP_DIR/data/database.sqlite"
    echo -e "${GREEN}Database restored${NC}"
else
    echo -e "${RED}Warning: No database found in backup${NC}"
fi

# Restore .env (optional)
if [ -f "$TMP_DIR/.env" ]; then
    read -p "Restore .env file? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$TMP_DIR/.env" "$APP_DIR/.env"
        echo -e "${GREEN}.env restored${NC}"
    fi
fi

# Clean up
rm -rf "$TMP_DIR"

echo ""
echo -e "${GREEN}Restore completed!${NC}"

# Restart bot if it was running
if [ "$RESTART_BOT" = true ]; then
    echo "Restarting bot..."
    pm2 restart my-pers-fin-bot
    echo -e "${GREEN}Bot restarted${NC}"
else
    echo "Bot was not running. Start manually with:"
    echo "  pm2 start ecosystem.config.js --env production"
fi

exit 0
