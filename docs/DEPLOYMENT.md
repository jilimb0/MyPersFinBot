# 🚀 Deployment Guide

Comprehensive guide for deploying MyPersFinBot to production.

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Deployment Methods](#-deployment-methods)
- [Docker Deployment](#-docker-deployment)
- [PM2 Deployment](#-pm2-deployment)
- [Systemd Service](#-systemd-service)
- [Environment Configuration](#%EF%B8%8F-environment-configuration)
- [Database Setup](#-database-setup)
- [Monitoring](#-monitoring)
- [Rollback](#-rollback)
- [Troubleshooting](#-troubleshooting)

---

## 📋 Prerequisites

### Server Requirements

- **OS:** Linux (Ubuntu 20.04+ or similar)
- **Node.js:** 20.x or higher
- **pnpm:** 8.x or higher
- **Memory:** 512MB minimum, 1GB recommended
- **Storage:** 5GB minimum
- **FFmpeg:** Required for voice messages

### Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Install FFmpeg
sudo apt install -y ffmpeg

# Verify installations
node --version  # v20.x.x
pnpm --version  # 8.x.x
ffmpeg -version  # Should show FFmpeg info
```

### Required Secrets

- 🔑 **TELEGRAM_BOT_TOKEN** - From [@BotFather](https://t.me/BotFather)
- 🔑 **ASSEMBLYAI_API_KEY** - For voice transcription (optional)
- 🔑 **SENTRY_DSN** - For error tracking (optional)

---

## 📦 Deployment Methods

### Method Comparison

| Method | Difficulty | Isolation | Auto-restart | Logs | Recommended For |
| -------------------------------------------------------------------- |
| **Docker** | Easy | ✅ High | ✅ Yes | ✅ Built-in | Production, Cloud |
| **PM2** | Medium | ❌ None | ✅ Yes | ✅ Built-in | VPS, Dedicated |
| **Systemd** | Hard | ❌ None | ✅ Yes | 📃 Journald | Linux servers |
| **Manual** | Easy | ❌ None | ❌ No | ❌ None | Development only |

**Recommendation:** 👑 **Docker** for production

---

## 🐳 Docker Deployment

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/yourusername/MyPersFinBot.git
cd MyPersFinBot

# 2. Create .env file
cp .env.production .env
vim .env  # Add your TELEGRAM_BOT_TOKEN

# 3. Build and run
docker build -t mypersfin-bot .
docker run -d \
  --name mypersfin-bot \
  --env-file .env \
  -v $(pwd)//app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  mypersfin-bot

# 4. Check logs
docker logs -f mypersfin-bot
```

### Dockerfile Explained

```dockerfile
# Use Alpine Linux for minimal size
FROM node:20-alpine

# Install FFmpeg for voice message processing
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN pnpm run build

# Create data directories
RUN mkdir -p /app/data /app/logs

# Set environment to production
ENV NODE_ENV=production

# Run the bot
CMD ["node", "dist/index.js"]
```

**Benefits:**

- ✅ **Small size:** ~200MB (Alpine Linux)
- ✅ **Isolated:** No conflicts with system packages
- ✅ **Reproducible:** Same environment everywhere
- ✅ **Easy updates:** Just rebuild and restart

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  bot:
    build: .
    container_name: mypersfin-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - .//app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3005/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Usage:**

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart

# Update (rebuild)
git pull
docker-compose up -d --build
```

### Docker Commands

```bash
# Build image
docker build -t mypersfin-bot:latest .

# Run container
docker run -d \
  --name mypersfin-bot \
  --env-file .env \
  -v $(pwd)//app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  mypersfin-bot:latest

# View logs
docker logs -f mypersfin-bot
docker logs --tail 100 mypersfin-bot

# Enter container
docker exec -it mypersfin-bot sh

# Stop container
docker stop mypersfin-bot

# Remove container
docker rm mypersfin-bot

# Remove image
docker rmi mypersfin-bot

# Check container status
docker ps
docker ps -a

# Inspect container
docker inspect mypersfin-bot

# View container stats
docker stats mypersfin-bot
```

---

## 🔧 PM2 Deployment

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/yourusername/MyPersFinBot.git
cd MyPersFinBot
pnpm install

# 2. Build
pnpm run build

# 3. Configure environment
cp .env.production .env
vim .env  # Add your secrets

# 4. Install PM2
sudo npm install -g pm2

# 5. Start with PM2
pm2 start ecosystem.config.js --env production

# 6. Save PM2 configuration
pm2 save

# 7. Setup PM2 to start on boot
pm2 startup
# Run the command it outputs (with sudo)
```

### PM2 Configuration

**File:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: "my-pers-fin-bot",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
}
```

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Stop application
pm2 stop my-pers-fin-bot

# Restart application
pm2 restart my-pers-fin-bot

# Delete from PM2
pm2 delete my-pers-fin-bot

# View logs
pm2 logs my-pers-fin-bot
pm2 logs my-pers-fin-bot --lines 100

# Monitor
pm2 monit

# List applications
pm2 list

# Show application info
pm2 show my-pers-fin-bot

# Flush logs
pm2 flush

# Save configuration
pm2 save

# Reload saved apps
pm2 resurrect
```

### PM2 Scripts (package.json)

```json
{
  "scripts": {
    "pm2:start": "pm2 start ecosystem.config.js --env production",
    "pm2:dev": "pm2 start ecosystem.config.js --env development",
    "pm2:stop": "pm2 stop my-pers-fin-bot",
    "pm2:restart": "pm2 restart my-pers-fin-bot",
    "pm2:delete": "pm2 delete my-pers-fin-bot",
    "deploy": "pnpm run validate && pnpm run build && pnpm run pm2:restart",
    "deploy:quick": "pnpm run build && pnpm run pm2:restart"
  }
}
```

**Usage:**

```bash
# Full deployment (with tests)
pnpm run deploy

# Quick deployment (skip tests)
pnpm run deploy:quick
```

---

## 🔧 Systemd Service

### Create Service File

```bash
# Create service file
sudo vim /etc/systemd/system/mypersfin-bot.service
```

**Content:**

```ini
[Unit]
Description=MyPersFinBot - Personal Finance Telegram Bot
After=network.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/home/botuser/MyPersFinBot
EnvironmentFile=/home/botuser/MyPersFinBot/.env
ExecStart=/usr/bin/node /home/botuser/MyPersFinBot/dist/index.js
Restart=on-failure
RestartSec=10
KillMode=process
StandardOutput=append:/home/botuser/MyPersFinBot/logs/bot.log
StandardError=append:/home/botuser/MyPersFinBot/logs/bot-error.log

[Install]
WantedBy=multi-user.target
```

### Setup and Start

```bash
# Create bot user
sudo useradd -r -s /bin/false botuser

# Set permissions
sudo chown -R botuser:botuser /home/botuser/MyPersFinBot

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable mypersfin-bot

# Start service
sudo systemctl start mypersfin-bot

# Check status
sudo systemctl status mypersfin-bot
```

### Systemd Commands

```bash
# Start service
sudo systemctl start mypersfin-bot

# Stop service
sudo systemctl stop mypersfin-bot

# Restart service
sudo systemctl restart mypersfin-bot

# Check status
sudo systemctl status mypersfin-bot

# View logs
sudo journalctl -u mypersfin-bot -f
sudo journalctl -u mypersfin-bot -n 100

# Enable auto-start
sudo systemctl enable mypersfin-bot

# Disable auto-start
sudo systemctl disable mypersfin-bot
```

---

## ⚙️ Environment Configuration

### Production .env

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional - Voice transcription
ASSEMBLYAI_API_KEY=your_assemblyai_key_here

# Optional - Error tracking
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENV=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Environment
NODE_ENV=production
LOG_LEVEL=info
LOG_BOOT_DETAIL=false

# Database
DB_PATH=./data/database.sqlite
DB_WAL_ENABLED=true

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_WINDOW_MS=60000

# Health check
HEALTH_PORT=3005
```

### Environment Validation

```bash
# Check if all required vars are set
node -e "require('./dist/config').validateConfig()"

# Or run validation script
pnpm run validate:env
```

---

## 💾 Database Setup

### SQLite Configuration

**Database location:**

```text
/app/data/database.sqlite
```

**Features:**

- ✅ WAL mode enabled (better concurrency)
- ✅ Auto-migration on startup
- ✅ Foreign keys enabled
- ✅ Optimized cache settings

### Backup

```bash
# Manual backup
cp data/database.sqlite data/database.backup-$(date +%Y%m%d).sqlite

# Automated backup script
#!/bin/bash
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR
cp data/database.sqlite $BACKUP_DIR/database-$(date +%Y%m%d-%H%M%S).sqlite

# Keep only last 30 days
find $BACKUP_DIR -name "database-*.sqlite" -mtime +30 -delete
```

### Restore

```bash
# Stop bot
pm2 stop my-pers-fin-bot

# Restore database
cp backups/database-20260211.sqlite data/database.sqlite

# Start bot
pm2 start my-pers-fin-bot
```

---

## 📊 Monitoring

### Health Check Endpoint

```bash
# Check if bot is healthy
curl http://localhost:3005/health
curl http://localhost:3005/healthz
curl http://localhost:3005/readyz

# Expected response:
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-02-11T04:45:00.000Z"
}

# APM/metrics snapshot
curl http://localhost:3005/metrics
curl http://localhost:3005/metrics/prometheus

# Admin monetization UI (Telegram auth)
open http://localhost:3005/admin/ui
```

### HTTPS + Reverse Proxy for Health

Use `deploy/nginx/my-pers-fin-bot.conf` as a starting point for TLS termination in nginx and proxying to `127.0.0.1:3005`.

```bash
# Copy nginx config template
sudo cp deploy/nginx/my-pers-fin-bot.conf /etc/nginx/sites-available/my-pers-fin-bot.conf
sudo ln -s /etc/nginx/sites-available/my-pers-fin-bot.conf /etc/nginx/sites-enabled/my-pers-fin-bot.conf

# Issue certificate (Let's Encrypt)
sudo certbot certonly --webroot -w /var/www/certbot -d your-domain.example.com

# Validate + reload nginx
sudo nginx -t && sudo systemctl reload nginx

# Create basic auth user for health/metrics endpoints
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-my-pers-fin-bot health
sudo nginx -t && sudo systemctl reload nginx
```

Validation after setup:

```bash
# HTTPS + auth check
curl -u health:your_password https://your-domain.example.com/healthz
curl -u health:your_password https://your-domain.example.com/metrics
curl -u health:your_password https://your-domain.example.com/metrics/prometheus
```

Optional app-level TLS:

- `HEALTH_TLS_ENABLED=true`
- `HEALTH_TLS_KEY_PATH=/path/to/key.pem`
- `HEALTH_TLS_CERT_PATH=/path/to/cert.pem`

Optional app-level basic auth:

- `HEALTH_BASIC_AUTH_USER=...`
- `HEALTH_BASIC_AUTH_PASS=...`

Recommended production values:

- `HEALTH_HOST=127.0.0.1`
- `HEALTH_PORT=3005`
- `ADMIN_AUDIT_RETENTION_DAYS=30`
- `ADMIN_AUDIT_PRUNE_INTERVAL_HOURS=24`
- Use nginx TLS + basic auth as the external boundary.

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Process list
pm2 list

# Detailed info
pm2 show my-pers-fin-bot
```

### Log Monitoring

```bash
# PM2 logs
pm2 logs my-pers-fin-bot --lines 100

# Application logs
tail -f logs/app.log
tail -f logs/error.log

# Docker logs
docker logs -f mypersfin-bot

# Systemd logs
journalctl -u mypersfin-bot -f
```

### Metrics

```bash
# PM2 metrics
pm2 show my-pers-fin-bot

# System metrics
htop
free -h
df -h

# App metrics endpoint
curl http://localhost:3005/metrics
```

### Alert Rules

Sample rules are in `deploy/alerts/metrics-alerts.yml`:

- `BotHealthEndpointDown`
- `BotSearchLatencyHigh`
- `BotChartLatencyHigh`

---

## 🔙 Rollback

### Docker Rollback

```bash
# Keep previous image tagged
docker tag mypersfin-bot:latest mypersfin-bot:previous

# Rollback to previous version
docker stop mypersfin-bot
docker rm mypersfin-bot
docker run -d \
  --name mypersfin-bot \
  --env-file .env \
  -v $(pwd)//app/data \
  --restart unless-stopped \
  mypersfin-bot:previous
```

### PM2 Rollback

```bash
# Keep previous build
mv dist dist.backup

# Rollback
git checkout HEAD~1
pnpm install
pnpm run build
pm2 restart my-pers-fin-bot

# Or restore from backup
rm -rf dist
mv dist.backup dist
pm2 restart my-pers-fin-bot
```

---

## 🔧 Troubleshooting

### Bot Not Starting

**1. Check logs:**

```bash
pm2 logs my-pers-fin-bot --lines 50
# or
docker logs mypersfin-bot
```

**2. Check environment:**

```bash
echo $TELEGRAM_BOT_TOKEN
# Should not be empty
```

**3. Check port:**

```bash
netstat -tulpn | grep 3005
# Health check port should be free
```

### Database Locked

```bash
# Stop all instances
pm2 stop my-pers-fin-bot

# Remove lock files
rm -f data/*.db-shm data/*.db-wal

# Restart
pm2 start my-pers-fin-bot
```

### Out of Memory

```bash
# Check memory usage
free -h
pm2 show my-pers-fin-bot | grep memory

# Increase PM2 memory limit
# Edit ecosystem.config.js:
max_memory_restart: "2G"

# Restart
pm2 restart my-pers-fin-bot
```

### High CPU Usage

```bash
# Check CPU usage
top -p $(pm2 pid my-pers-fin-bot)

# Check for infinite loops in logs
pm2 logs my-pers-fin-bot | grep -i error
```

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`pnpm test`)
- [ ] Build successful (`pnpm run build`)
- [ ] Environment variables configured
- [ ] Database backed up
- [ ] Health check endpoint working
- [ ] Logs directory writable
- [ ] FFmpeg installed (for voice)
- [ ] Sufficient disk space (5GB+)
- [ ] Sufficient memory (1GB+)
- [ ] Monitoring configured
- [ ] Rollback plan documented

---

## 📚 Resources

- [Docker Documentation](https://docs.docker.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Systemd Documentation](https://www.freedesktop.org/wiki/Software/systemd/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🎉 Summary

**Recommended Setup:**

1. 🐳 **Docker** for production (easiest, most isolated)
2. 🔧 **PM2** for VPS deployment
3. 📊 **Health checks** for monitoring
4. 💾 **Automated backups** for database
5. 📝 **Centralized logging** for debugging

**Deployment Rating:** ⭐⭐⭐⭐⭐ 9/10

**Why 9/10?**

- ✅ Multiple deployment options
- ✅ Docker-first approach
- ✅ PM2 for process management
- ✅ Health checks built-in
- ✅ Comprehensive documentation

**Could be better:**

- Add Kubernetes manifests
- Add CI/CD pipeline examples
- Add blue-green deployment

---

**Last Updated:** February 11, 2026  
**Next Review:** March 11, 2026
