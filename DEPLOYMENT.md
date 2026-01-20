# 🚀 Production Deployment Guide

**Personal Finance Telegram Bot - Production Setup**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Deployment Methods](#deployment-methods)
   - [PM2 (Recommended)](#option-1-pm2-recommended)
   - [Docker](#option-2-docker)
   - [Systemd](#option-3-systemd)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Monitoring](#monitoring)
7. [Backup Strategy](#backup-strategy)
8. [Updates & Maintenance](#updates--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

**Minimum:**
- **CPU:** 1 vCPU
- **RAM:** 512 MB
- **Disk:** 2 GB
- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+

**Recommended:**
- **CPU:** 2 vCPU
- **RAM:** 1 GB
- **Disk:** 5 GB SSD
- **OS:** Ubuntu 22.04 LTS

### Software Requirements

- **Node.js** 20+ LTS
- **pnpm** (package manager)
- **FFmpeg** (for voice messages)
- **Git** (for deployment)

---

## Server Setup

### 1. Update System

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2. Install Node.js 20+

```bash
# Using NodeSource repository (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v20.x.x
npm --version
```

### 3. Install pnpm

```bash
npm install -g pnpm
pnpm --version
```

### 4. Install FFmpeg

```bash
# Ubuntu/Debian
sudo apt install -y ffmpeg

# CentOS/RHEL
sudo yum install -y ffmpeg

# Verify
ffmpeg -version
```

### 5. Install Git

```bash
sudo apt install -y git  # Ubuntu/Debian
sudo yum install -y git  # CentOS/RHEL
```

### 6. Create Bot User (Optional but Recommended)

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash botuser
sudo su - botuser
```

---

## Deployment Methods

### Option 1: PM2 (Recommended) ⭐

**PM2** is a production process manager for Node.js with built-in load balancer, auto-restart, and monitoring.

#### Install PM2

```bash
npm install -g pm2
pm2 --version
```

#### Clone Repository

```bash
cd /home/botuser
git clone https://github.com/yourusername/MyPersFinBot.git
cd MyPersFinBot
```

#### Install Dependencies

```bash
pnpm install
```

#### Build Project

```bash
pnpm run build
```

#### Create PM2 Config

**Create:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'finance-bot',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}
```

#### Create Logs Directory

```bash
mkdir -p logs
```

#### Configure Environment

Create `.env` file (see [Environment Configuration](#environment-configuration))

#### Start Bot

```bash
# Start
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs finance-bot

# Monitor
pm2 monit
```

#### Auto-Start on Boot

```bash
# Generate startup script
pm2 startup

# Follow the output instructions (usually):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u botuser --hp /home/botuser

# Save current PM2 process list
pm2 save

# Verify
sudo systemctl status pm2-botuser
```

#### PM2 Commands Reference

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop finance-bot

# Restart
pm2 restart finance-bot

# Delete
pm2 delete finance-bot

# Logs
pm2 logs finance-bot
pm2 logs finance-bot --lines 100

# Monitor
pm2 monit

# List
pm2 list

# Info
pm2 info finance-bot

# Reload (zero-downtime)
pm2 reload finance-bot
```

---

### Option 2: Docker 🐳

#### Create Dockerfile

**Create:** `Dockerfile`

```dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY . .

# Build TypeScript
RUN pnpm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose (not needed for Telegram bot, but useful for health checks)
# EXPOSE 3000

# Start bot
CMD ["node", "dist/index.js"]
```

#### Create .dockerignore

```
node_modules
dist
logs
data/*.db
.env
secure.json
.git
*.md
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  bot:
    build: .
    container_name: finance-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - .//app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
    # Optional: health check
    # healthcheck:
    #   test: ["CMD", "node", "healthcheck.js"]
    #   interval: 30s
    #   timeout: 10s
    #   retries: 3
```

#### Build & Run

```bash
# Build image
docker-compose build

# Start
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

#### Docker Commands

```bash
# View logs
docker logs finance-bot
docker logs -f finance-bot
docker logs --tail 100 finance-bot

# Execute command inside container
docker exec -it finance-bot sh

# Stop/Start
docker stop finance-bot
docker start finance-bot

# Remove
docker rm -f finance-bot

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

---

### Option 3: Systemd

#### Create Service File

**Create:** `/etc/systemd/system/finance-bot.service`

```ini
[Unit]
Description=Personal Finance Telegram Bot
After=network.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/home/botuser/MyPersFinBot
Environment=NODE_ENV=production
EnvironmentFile=/home/botuser/MyPersFinBot/.env
ExecStart=/usr/bin/node /home/botuser/MyPersFinBot/dist/index.js
Restart=on-failure
RestartSec=10s
StandardOutput=append:/home/botuser/MyPersFinBot/logs/bot.log
StandardError=append:/home/botuser/MyPersFinBot/logs/error.log

[Install]
WantedBy=multi-user.target
```

#### Enable & Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start
sudo systemctl enable finance-bot

# Start service
sudo systemctl start finance-bot

# Check status
sudo systemctl status finance-bot

# View logs
journalctl -u finance-bot -f
journalctl -u finance-bot --since "1 hour ago"
```

#### Systemd Commands

```bash
# Start
sudo systemctl start finance-bot

# Stop
sudo systemctl stop finance-bot

# Restart
sudo systemctl restart finance-bot

# Status
sudo systemctl status finance-bot

# Enable auto-start
sudo systemctl enable finance-bot

# Disable auto-start
sudo systemctl disable finance-bot

# Logs
journalctl -u finance-bot
journalctl -u finance-bot -f  # Follow
journalctl -u finance-bot --since today
```

---

## Environment Configuration

### Create .env File

**Create:** `.env` in project root

```env
#
# Telegram Bot Configuration
#
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890

#
# AssemblyAI (Voice Transcription) - OPTIONAL
# Get free key: https://www.assemblyai.com/
#
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

#
# FX Rates API - OPTIONAL
# Get free key: https://freecurrencyapi.com/
#
FX_API_KEY=your_fx_api_key_here

#
# Environment
#
NODE_ENV=production
```

### Secure File Permissions

```bash
chmod 600 .env
chmod 600 secure.json  # If using legacy config
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | Telegram bot token from @BotFather |
| `ASSEMBLYAI_API_KEY` | ❌ No | AssemblyAI API key for voice transcription |
| `FX_API_KEY` | ❌ No | Free Currency API key for exchange rates |
| `NODE_ENV` | ❌ No | Set to `production` |

**Note:** Bot works without optional keys, but features are disabled:
- Without `ASSEMBLYAI_API_KEY`: Voice messages won't work
- Without `FX_API_KEY`: Exchange rates won't update (uses defaults)

---

## Database Setup

### SQLite Database

The bot uses **SQLite** with **WAL mode** for better concurrency.

**Location:** `data/database.db`

### Initial Setup

```bash
# Create data directory
mkdir -p data

# Database is created automatically on first run
# No manual setup needed!
```

### Database Files

```
data/
├── database.db          # Main database
├── database.db-shm      # Shared memory (WAL mode)
└── database.db-wal      # Write-ahead log (WAL mode)
```

### Migrations

TypeORM handles migrations automatically.

**To create migration:**

```bash
pnpm run migration:generate -- -n MigrationName
pnpm run migration:run
```

---

## Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard (optional)
pm2 plus

# Process info
pm2 info finance-bot

# Logs
pm2 logs finance-bot --lines 100
```

### Log Files

**PM2:**
```
logs/
├── err.log          # Error logs
├── out.log          # Output logs
└── combined.log     # Combined
```

**Systemd:**
```bash
journalctl -u finance-bot
```

**Docker:**
```bash
docker logs finance-bot
```

### Health Checks

**Check if bot is running:**

```bash
# PM2
pm2 status

# Systemd
sudo systemctl status finance-bot

# Docker
docker ps | grep finance-bot

# Process
ps aux | grep "node.*index.js"
```

**Check logs for errors:**

```bash
# PM2
pm2 logs finance-bot --err

# Systemd
journalctl -u finance-bot -p err

# Docker
docker logs finance-bot 2>&1 | grep -i error
```

### Monitoring Tools (Optional)

**PM2 Plus** (Free tier available):
- Real-time monitoring
- Error tracking
- Performance metrics
- https://pm2.io/

**Prometheus + Grafana** (Advanced):
- Custom metrics
- Dashboards
- Alerting

---

## Backup Strategy

### What to Backup

1. **Database** (`data/database.db`)
2. **Environment** (`.env` or `secure.json`)
3. **Logs** (optional)

### Automated Backup Script

**Create:** `backup.sh`

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/botuser/backups"
BOT_DIR="/home/botuser/MyPersFinBot"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp $BOT_DIR/data/database.db $BACKUP_DIR/database_$DATE.db

# Backup environment (optional)
cp $BOT_DIR/.env $BACKUP_DIR/env_$DATE.backup

# Compress
cd $BACKUP_DIR
tar -czf backup_$DATE.tar.gz database_$DATE.db env_$DATE.backup
rm database_$DATE.db env_$DATE.backup

# Delete old backups (older than 30 days)
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

**Make executable:**

```bash
chmod +x backup.sh
```

### Schedule Backups (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /home/botuser/MyPersFinBot/backup.sh >> /home/botuser/backup.log 2>&1
```

### Manual Backup

```bash
# Quick backup
cp data/database.db data/database_$(date +%Y%m%d).db

# Or use backup script
./backup.sh
```

### Restore from Backup

```bash
# Stop bot
pm2 stop finance-bot  # PM2
# OR
sudo systemctl stop finance-bot  # Systemd

# Restore database
cp /home/botuser/backups/database_20260119.db data/database.db

# Start bot
pm2 start finance-bot
# OR
sudo systemctl start finance-bot
```

---

## Updates & Maintenance

### Update Bot Code

```bash
# Navigate to bot directory
cd /home/botuser/MyPersFinBot

# Pull latest changes
git pull origin main

# Install new dependencies
pnpm install

# Rebuild
pnpm run build

# Restart bot
pm2 restart finance-bot  # PM2
# OR
sudo systemctl restart finance-bot  # Systemd
# OR
docker-compose restart  # Docker
```

### Update Dependencies

```bash
# Check outdated packages
pnpm outdated

# Update all
pnpm update

# Or update specific package
pnpm update axios

# Rebuild & restart
pnpm run build
pm2 restart finance-bot
```

### Update Node.js

```bash
# Check current version
node --version

# Update via NodeSource (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version

# Restart bot
pm2 restart finance-bot
```

### Database Maintenance

```bash
# Vacuum database (optimize)
sqlite3 data/database.db "VACUUM;"

# Check integrity
sqlite3 data/database.db "PRAGMA integrity_check;"

# Database size
du -sh data/database.db
```

---

## Troubleshooting

### Bot Not Starting

**Check logs:**

```bash
# PM2
pm2 logs finance-bot --err

# Systemd
journalctl -u finance-bot -n 50

# Docker
docker logs finance-bot
```

**Common issues:**

1. **Missing environment variables**
   ```bash
   # Check .env exists
   cat .env
   
   # Verify TELEGRAM_BOT_TOKEN is set
   grep TELEGRAM_BOT_TOKEN .env
   ```

2. **Port already in use** (if using webhooks)
   ```bash
   lsof -i :3000
   kill <PID>
   ```

3. **Database locked**
   ```bash
   # Check for multiple instances
   ps aux | grep "node.*index.js"
   
   # Kill duplicates
   pkill -f "node.*index.js"
   ```

4. **Permission errors**
   ```bash
   # Fix ownership
   sudo chown -R botuser:botuser /home/botuser/MyPersFinBot
   
   # Fix database permissions
   chmod 644 data/database.db
   ```

### Voice Messages Not Working

**Check FFmpeg:**

```bash
ffmpeg -version
```

**Check AssemblyAI key:**

```bash
grep ASSEMBLYAI_API_KEY .env
```

**See:** [VOICE_QUICK_START.md](VOICE_QUICK_START.md)

### High Memory Usage

```bash
# Check memory
free -h

# Check bot memory
pm2 info finance-bot | grep memory

# Restart if needed
pm2 restart finance-bot
```

**Configure memory limit in PM2:**

```javascript
// ecosystem.config.js
max_memory_restart: '300M',  // Restart if exceeds 300MB
```

### Database Issues

**Database locked:**

```bash
# Stop bot
pm2 stop finance-bot

# Remove lock files
rm data/database.db-shm data/database.db-wal

# Start bot
pm2 start finance-bot
```

**Corrupt database:**

```bash
# Restore from backup
cp /home/botuser/backups/database_latest.db data/database.db

# Or create new (CAUTION: loses all data)
rm data/database.db
pm2 restart finance-bot  # Creates new DB
```

---

## Security Checklist

- [ ] `.env` and `secure.json` in `.gitignore`
- [ ] File permissions: `chmod 600 .env`
- [ ] Firewall configured (if using webhooks)
- [ ] Regular backups enabled
- [ ] Updates scheduled
- [ ] Logs rotation configured
- [ ] User whitelist enabled (optional)
- [ ] SSL/TLS for webhooks (if used)

---

## Performance Tuning

### Database Optimization

```bash
# Add indexes (if needed)
sqlite3 data/database.db <<EOF
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(userId);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
EOF
```

### PM2 Clustering (Optional)

```javascript
// ecosystem.config.js
instances: 2,  // Run 2 instances
exec_mode: 'cluster',
```

**Note:** Not recommended for Telegram bots (use only for webhooks)

---

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Systemd Documentation](https://systemd.io/)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)

---

## Quick Reference

### PM2 Commands

```bash
pm2 start ecosystem.config.js
pm2 stop finance-bot
pm2 restart finance-bot
pm2 logs finance-bot
pm2 monit
pm2 save
```

### Docker Commands

```bash
docker-compose up -d
docker-compose down
docker-compose restart
docker logs -f finance-bot
```

### Systemd Commands

```bash
sudo systemctl start finance-bot
sudo systemctl stop finance-bot
sudo systemctl restart finance-bot
sudo systemctl status finance-bot
journalctl -u finance-bot -f
```

---

**Need help?** See [README.md](README.md) or open an issue.

**Happy deploying!** 🚀
