# 🚀 Quick Deployment Guide

> **TL;DR:** Get your bot running in production in 5 minutes!

---

## 📍 Choose Your Deployment Method

### Option 1: Docker (Recommended) ⭐

**Fastest way to deploy!**

```bash
# 1. Configure
cp .env.example .env
nano .env  # Add your TELEGRAM_BOT_TOKEN

# 2. Deploy
docker-compose up -d

# 3. Check
docker-compose logs -f bot

# Done! 🎉
```

**Pros:**
- ✅ Easiest setup
- ✅ Isolated environment
- ✅ Includes Redis
- ✅ One command to start

---

### Option 2: PM2 (Node.js)

**Good for VPS deployment**

```bash
# 1. Install
pnpm install --frozen-lockfile
pnpm run build

# 2. Configure
cp .env.example .env
nano .env  # Add your TELEGRAM_BOT_TOKEN

# 3. Deploy
pnpm run pm2:start

# 4. Check
pnpm run pm2:status

# Done! 🎉
```

**Pros:**
- ✅ Direct Node.js execution
- ✅ Auto-restart on crash
- ✅ Built-in monitoring
- ✅ Log management

---

### Option 3: Systemd (Linux Service)

**For dedicated servers**

```bash
# 1. Copy service file
sudo cp scripts/my-pers-fin-bot.service /etc/systemd/system/

# 2. Configure
sudo nano /etc/systemd/system/my-pers-fin-bot.service
# Update paths and user

# 3. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable my-pers-fin-bot
sudo systemctl start my-pers-fin-bot

# 4. Check
sudo systemctl status my-pers-fin-bot

# Done! 🎉
```

**Pros:**
- ✅ Native Linux integration
- ✅ Starts on boot
- ✅ Systemd logging
- ✅ Security hardening

---

## ⚙️ Environment Variables

**Minimum required:**

```env
TELEGRAM_BOT_TOKEN=your_token_here
```

**Recommended:**

```env
TELEGRAM_BOT_TOKEN=your_token_here
NODE_ENV=production
LOG_LEVEL=info
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

**Full configuration:** See [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🔄 Update Your Bot

### Docker:
```bash
git pull origin main
docker-compose up -d --build
```

### PM2:
```bash
git pull origin main
pnpm run deploy
```

### Systemd:
```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm run build
sudo systemctl restart my-pers-fin-bot
```

---

## 📦 Backup Your Data

### Automated Backup:

```bash
# Make executable
chmod +x scripts/backup.sh

# Run backup
./scripts/backup.sh

# Setup daily backups (3 AM)
crontab -e
# Add:
0 3 * * * /opt/my-pers-fin-bot/scripts/backup.sh >> /var/log/bot-backup.log 2>&1
```

### Restore:

```bash
chmod +x scripts/restore.sh
./scripts/restore.sh /path/to/backup_20260126_030000.tar.gz
```

---

## 📊 Monitor Your Bot

### Docker:
```bash
docker-compose logs -f bot        # View logs
docker-compose ps                 # Check status
docker stats                      # Resource usage
```

### PM2:
```bash
pm2 logs my-pers-fin-bot         # View logs
pm2 monit                        # Real-time monitoring
pm2 status                       # Check status
```

### Systemd:
```bash
sudo journalctl -u my-pers-fin-bot -f    # View logs
sudo systemctl status my-pers-fin-bot    # Check status
```

---

## ❓ Common Issues

### Bot not starting?

```bash
# Check logs
docker-compose logs bot
# or
pm2 logs my-pers-fin-bot --err

# Verify token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# Check environment
cat .env | grep TELEGRAM_BOT_TOKEN
```

### Database issues?

```bash
# Check database exists
ls -lh data/database.sqlite

# Check permissions
chmod 644 data/database.sqlite
```

### Redis connection failed?

```bash
# Check Redis is running
redis-cli ping

# Or disable Redis
# In .env:
REDIS_ENABLED=false
```

---

## 📚 Full Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
- **[ACTION_PLAN.md](ACTION_PLAN.md)** - Development roadmap
- **[STATUS.md](STATUS.md)** - Project status

---

## 🎯 Quick Reference

| Task | Docker | PM2 | Systemd |
|------|--------|-----|----------|
| **Start** | `docker-compose up -d` | `pnpm run pm2:start` | `sudo systemctl start my-pers-fin-bot` |
| **Stop** | `docker-compose down` | `pnpm run pm2:stop` | `sudo systemctl stop my-pers-fin-bot` |
| **Restart** | `docker-compose restart bot` | `pnpm run pm2:restart` | `sudo systemctl restart my-pers-fin-bot` |
| **Logs** | `docker-compose logs -f bot` | `pnpm run pm2:logs` | `sudo journalctl -u my-pers-fin-bot -f` |
| **Status** | `docker-compose ps` | `pnpm run pm2:status` | `sudo systemctl status my-pers-fin-bot` |

---

## ✅ Deployment Checklist

- [ ] Get Telegram Bot Token from [@BotFather](https://t.me/botfather)
- [ ] Choose deployment method (Docker/PM2/Systemd)
- [ ] Configure `.env` file
- [ ] Deploy bot
- [ ] Check logs
- [ ] Setup automated backups
- [ ] Configure monitoring (optional)
- [ ] Setup domain/SSL (if using webhooks)

---

**Ready to deploy?** Follow the instructions above for your chosen method! 🚀

**Need help?** See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.
