# 🚀 Deployment Guide

> **Personal Finance Telegram Bot**  
> Production Deployment Instructions

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment-recommended)
4. [PM2 Deployment](#pm2-deployment)
5. [Systemd Service](#systemd-service)
6. [Database Setup](#database-setup)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy-optional)
8. [Backup & Restore](#backup--restore)
9. [Update Procedure](#update-procedure)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required:
- **Node.js:** 20.x or higher
- **pnpm:** 8.x or higher
- **Telegram Bot Token:** From [@BotFather](https://t.me/botfather)

### Optional (recommended):
- **Docker:** 24.x or higher
- **Docker Compose:** 2.x or higher
- **PM2:** For process management
- **Redis:** For caching (optional but recommended)
- **Nginx:** For reverse proxy (if needed)

### Server Requirements:
- **RAM:** Minimum 512MB, recommended 1GB
- **Disk:** Minimum 1GB free space
- **OS:** Ubuntu 20.04/22.04, Debian 11/12, or similar

---

## Environment Setup

### 1. Create `.env` file:

```bash
cp .env.example .env
```

### 2. Configure environment variables:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Database
DB_PATH=./data/database.sqlite
DB_LOG_QUERIES=false

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Application
NODE_ENV=production
LOG_LEVEL=info

# Health checks
HEALTH_HOST=0.0.0.0
HEALTH_PORT=3001

# Sentry (optional)
SENTRY_DSN=
SENTRY_ENV=production
SENTRY_TRACES_SAMPLE_RATE=0
SENTRY_RELEASE=

# Currency API (optional)
EXCHANGE_RATE_API_KEY=your_api_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
```

---

## Docker Deployment (Recommended)

### Quick Start:

```bash
# 1. Clone repository
git clone https://github.com/yourusername/MyPersFinBot.git
cd MyPersFinBot

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your values

# 3. Start with Docker Compose
docker-compose up -d

# 4. Check logs
docker-compose logs -f bot
```

### Docker Compose Configuration:

```yaml
# docker-compose.yml (already exists)
version: '3.8'

services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - .//app/data
      - ./logs:/app/logs
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-/data

volumes:
  redis-
```

### Docker Commands:

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart bot
docker-compose restart bot

# View logs
docker-compose logs -f bot

# Update and restart
docker-compose pull
docker-compose up -d --build

# Clean up
docker-compose down -v  # Warning: removes volumes!
```

---

## PM2 Deployment

### 1. Install PM2:

```bash
npm install -g pm2
```

### 2. Build project:

```bash
pnpm install --frozen-lockfile
pnpm run build
```

### 3. Start with PM2:

```bash
# Production
pnpm run pm2:start

# Or directly
pm2 start ecosystem.config.js --env production
```

### PM2 Commands:

```bash
# Status
pm2 status
pm2 monit

# Logs
pm2 logs my-pers-fin-bot
pm2 logs my-pers-fin-bot --lines 100

# Restart
pm2 restart my-pers-fin-bot

# Stop
pm2 stop my-pers-fin-bot

# Delete
pm2 delete my-pers-fin-bot

# Save configuration
pm2 save

# Startup script (run on boot)
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

### PM2 Log Rotation:

```bash
# Install pm2-logrotate
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

---

## Systemd Service

### Systemd Service File

The systemd unit file is located at `systemd/my-pers-fin-bot.service`.

```ini
# /etc/systemd/system/my-pers-fin-bot.service
# Copy from repo: systemd/my-pers-fin-bot.service
```

### Install & Enable

```bash
# Copy the unit file
sudo cp systemd/my-pers-fin-bot.service /etc/systemd/system/

# Create non-root user
sudo useradd -r -s /bin/false bot

# Create log directory
sudo mkdir -p /var/log/my-pers-fin-bot
sudo chown bot:bot /var/log/my-pers-fin-bot

# Reload systemd
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable my-pers-fin-bot
sudo systemctl start my-pers-fin-bot

# Check status
sudo systemctl status my-pers-fin-bot

# Logs
sudo journalctl -u my-pers-fin-bot -f
```

### 1. Create service file:

```bash
sudo nano /etc/systemd/system/my-pers-fin-bot.service
```

### 2. Add configuration:

```ini
[Unit]
Description=Personal Finance Telegram Bot
After=network.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/opt/my-pers-fin-bot
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/my-pers-fin-bot/out.log
StandardError=append:/var/log/my-pers-fin-bot/error.log

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/opt/my-pers-fin-bot/.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/my-pers-fin-bot/data /opt/my-pers-fin-bot/logs

[Install]
WantedBy=multi-user.target
```

### 3. Enable and start:

```bash
# Create log directory
sudo mkdir -p /var/log/my-pers-fin-bot
sudo chown botuser:botuser /var/log/my-pers-fin-bot

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable my-pers-fin-bot

# Start service
sudo systemctl start my-pers-fin-bot

# Check status
sudo systemctl status my-pers-fin-bot

# View logs
sudo journalctl -u my-pers-fin-bot -f
```

---

## Database Setup

### SQLite (Default):

```bash
# Create data directory
mkdir -p data

# Database will be created automatically on first run
# Location: ./data/database.sqlite
```

### Database Migrations:

TypeORM handles migrations automatically:

```bash
# Synchronize schema (development)
DB_SYNCHRONIZE=true pnpm run dev

# In production, synchronization is disabled
# Use migrations for schema changes
```

---

## Nginx Reverse Proxy (Optional)

> Only needed if you're running a webhook-based bot or API

### Configuration:

```nginx
server {
    listen 80;
    server_name bot.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bot.yourdomain.com
```

---

## Backup & Restore

### Automated Backup Script:

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/my-pers-fin-bot"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/my-pers-fin-bot"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp $APP_DIR/data/database.sqlite $BACKUP_DIR/database_$DATE.sqlite

# Backup .env file
cp $APP_DIR/.env $BACKUP_DIR/env_$DATE.backup

# Compress
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz \
    $BACKUP_DIR/database_$DATE.sqlite \
    $BACKUP_DIR/env_$DATE.backup

# Clean up
rm $BACKUP_DIR/database_$DATE.sqlite
rm $BACKUP_DIR/env_$DATE.backup

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

### Cron Job (Daily Backup):

```bash
# Edit crontab
crontab -e

# Add line (backup at 3 AM daily)
0 3 * * * /opt/my-pers-fin-bot/backup.sh >> /var/log/backup.log 2>&1
```

### Restore:

```bash
# 1. Stop bot
pm2 stop my-pers-fin-bot
# or
docker-compose down

# 2. Extract backup
tar -xzf backup_20260126_030000.tar.gz

# 3. Restore database
cp database_20260126_030000.sqlite /opt/my-pers-fin-bot/data/database.sqlite

# 4. Restore env
cp env_20260126_030000.backup /opt/my-pers-fin-bot/.env

# 5. Start bot
pm2 start my-pers-fin-bot
# or
docker-compose up -d
```

---

## Update Procedure

### Docker:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild and restart
docker-compose up -d --build

# 3. Check logs
docker-compose logs -f bot
```

### PM2:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Build
pnpm run build

# 4. Restart
pnpm run deploy
# or
pm2 restart my-pers-fin-bot
```

### Zero-Downtime Update (PM2):

```bash
# Use reload instead of restart
pm2 reload my-pers-fin-bot
```

---

## Monitoring

### Sentry:

1. Set `SENTRY_DSN` and optional `SENTRY_ENV`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_RELEASE` in `.env`
2. Restart the bot
3. Trigger a test error and verify it appears in Sentry

### Verify Sentry

```bash
# Send a test error
node -e "throw new Error("sentry test")"
```

### PM2 Monitoring:

```bash
# Real-time monitoring
pm2 monit

# Web dashboard (optional)
pm2 install pm2-server-monit
```

### Log Monitoring:

```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# PM2 logs
pm2 logs my-pers-fin-bot --lines 100

# Docker logs
docker-compose logs -f bot
```

### Health Check:

HTTP endpoints:
- `GET /healthz`
- `GET /readyz`

### Verify Health

```bash
curl -s http://localhost:${HEALTH_PORT:-3001}/healthz

# Expect JSON {"status":"ok", ...}
```

Create a simple health check script:

```bash
#!/bin/bash
# healthcheck.sh

# Check if process is running
if pm2 list | grep -q "my-pers-fin-bot.*online"; then
    echo "✅ Bot is running"
    exit 0
else
    echo "❌ Bot is not running"
    # Send alert (email, Telegram, etc.)
    exit 1
fi
```

---

## Troubleshooting

### Bot not starting:

```bash
# Check logs
pm2 logs my-pers-fin-bot --err

# Check environment
cat .env

# Verify Telegram token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# Check Node.js version
node --version  # Should be 20.x+

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Database issues:

```bash
# Check database file
ls -lh data/database.sqlite

# Check permissions
chmod 644 data/database.sqlite

# Verify database integrity
sqlite3 data/database.sqlite "PRAGMA integrity_check;"
```

### High memory usage:

```bash
# Check memory
pm2 status

# Restart bot
pm2 restart my-pers-fin-bot

# Increase max memory (if needed)
# Edit ecosystem.config.js:
# max_memory_restart: '2G'
```

### Redis connection issues:

```bash
# Check Redis status
redis-cli ping

# Check Redis connection
redis-cli
127.0.0.1:6379> INFO

# Test connection from app
REDIS_URL=redis://localhost:6379 node -e "const redis = require('ioredis'); const client = new redis(); client.ping().then(console.log).catch(console.error);"
```

---

## Security Checklist

- [ ] ✅ `.env` file has correct permissions (600)
- [ ] ✅ Database file is not world-readable
- [ ] ✅ Firewall configured (only necessary ports open)
- [ ] ✅ Bot token kept secret
- [ ] ✅ Regular backups configured
- [ ] ✅ Logs rotated regularly
- [ ] ✅ SSL/TLS for webhooks (if used)
- [ ] ✅ Updates applied regularly
- [ ] ✅ Monitoring alerts configured

---

## Quick Reference

### Docker:
```bash
docker-compose up -d          # Start
docker-compose logs -f bot    # Logs
docker-compose restart bot    # Restart
docker-compose down           # Stop
```

### PM2:
```bash
pm2 start ecosystem.config.js   # Start
pm2 logs my-pers-fin-bot       # Logs
pm2 restart my-pers-fin-bot    # Restart
pm2 stop my-pers-fin-bot       # Stop
```

### Systemd:
```bash
sudo systemctl start my-pers-fin-bot    # Start
sudo journalctl -u my-pers-fin-bot -f   # Logs
sudo systemctl restart my-pers-fin-bot  # Restart
sudo systemctl stop my-pers-fin-bot     # Stop
```

---

## Support

For issues and questions:
- 📖 Check [README.md](README.md)
- 🐛 Report bugs in GitHub Issues
- 💬 Ask in Discussions

---

**Happy Deploying! 🚀**
