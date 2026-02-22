# 📖 Operations Runbook

Operational guide for maintaining and troubleshooting MyPersFinBot in production.

---

## 📋 Table of Contents

- [Daily Operations](#-daily-operations)
- [Health Checks](#-health-checks)
- [Common Issues](#%EF%B8%8F-common-issues)
- [Performance Tuning](#-performance-tuning)
- [Backup & Recovery](#-backup--recovery)
- [Security](#-security)
- [Incident Response](#-incident-response)
- [Maintenance Windows](#%EF%B8%8F-maintenance-windows)

---

## 📅 Daily Operations

### Morning Checklist (☕ 10 minutes)

```bash
# 1. Check bot status
pm2 status my-pers-fin-bot
# Status should be "online"

# 2. Check uptime
pm2 show my-pers-fin-bot | grep uptime
# Should be > 12 hours

# 3. Check memory usage
pm2 show my-pers-fin-bot | grep memory
# Should be < 500MB

# 4. Check error logs
pm2 logs my-pers-fin-bot --err --lines 50
# Should have no critical errors

# 5. Check disk space
df -h
# Should have > 2GB free

# 6. Test bot responsiveness
# Send /start command in Telegram
# Should respond within 2 seconds
```

### Weekly Checklist (🗓️ 30 minutes)

```bash
# 1. Review error logs
grep -i error logs/app.log | tail -100

# 2. Check database size
du -h data/database.sqlite
# Should grow steadily, not suddenly

# 3. Review resource usage trends
pm2 show my-pers-fin-bot

# 4. Check for updates
git fetch
git log HEAD..origin/main --oneline

# 5. Backup database
cp data/database.sqlite backups/db-weekly-$(date +%Y%m%d).sqlite

# 6. Review metrics (if Sentry configured)
# Check error rate, response times
```

### Monthly Checklist (📆 2 hours)

```bash
# 1. Update dependencies
pnpm outdated
pnpm update

# 2. Security audit
pnpm audit

# 3. Clean old logs
find logs/ -name "*.log" -mtime +30 -delete

# 4. Clean old backups
find backups/ -name "*.sqlite" -mtime +30 -delete

# 5. Performance review
# Analyze slow queries, optimize if needed

# 6. Update documentation
# Document any new operational procedures
```

---

## 💚 Health Checks

## 🧪 Test Stability Notes

- For stable coverage runs in CI/local, use:
  - `pnpm test:coverage:stable`
- If Jest reports worker force-exit warnings:
  - rerun target suite with `--runInBand --detectOpenHandles`
  - check queue/timer cleanup in affected tests

### Automated Health Check

**Endpoint (local):** `http://localhost:3005/health` (also `/healthz`, `/readyz`)
**Endpoint (prod via nginx TLS):** `https://your-domain.example.com/healthz`
**Script:** `scripts/ops/health-check.sh`

```bash
HEALTHCHECK_URL=http://127.0.0.1:3005/healthz ./scripts/ops/health-check.sh

# Production probe through nginx + basic auth
HEALTHCHECK_URL=https://your-domain.example.com/healthz \
HEALTH_BASIC_AUTH_USER=health \
HEALTH_BASIC_AUTH_PASS=your_password \
./scripts/ops/health-check.sh
```

**Cron job:**

```bash
# Run every 5 minutes
*/5 * * * * /path/to/health-check.sh
```

### Manual Health Check

```bash
# 1. Check process
pm2 list | grep my-pers-fin-bot
# Status: online, uptime: > 0

# 2. Check port
netstat -tulpn | grep 3005
# Should show Node.js process

# 2.1 Check external TLS health endpoint
curl -u health:your_password https://your-domain.example.com/healthz
curl -u health:your_password https://your-domain.example.com/metrics

# 3. Check logs for errors
pm2 logs my-pers-fin-bot --lines 20 --err
# No recent critical errors

# 4. Check database connection
sqlite3 data/database.sqlite "SELECT COUNT(*) FROM users;"
# Should return a number

# 5. Test bot commands
# /start, /balance, /help
# All should respond < 2 seconds
```

### Health Check Metrics

| Metric | Healthy | Warning | Critical |
| -------------------------------------- |
| **Response time** | < 1s | 1-3s | > 3s |
| **Memory usage** | < 300MB | 300-700MB | > 700MB |
| **CPU usage** | < 20% | 20-50% | > 50% |
| **Uptime** | > 1 day | 1h - 1 day | < 1 hour |
| **Error rate** | < 0.1% | 0.1-1% | > 1% |
| **Disk space** | > 5GB | 2-5GB | < 2GB |

---

## ⚠️ Common Issues

### Issue 1: Bot Not Responding

**Symptoms:**

- Users report bot not responding
- Health check fails
- No logs being written

**Diagnosis:**

```bash
# Check if process is running
pm2 list | grep my-pers-fin-bot

# Check logs
pm2 logs my-pers-fin-bot --lines 100

# Check system resources
top
free -h
df -h
```

**Solution:**

```bash
# Restart bot
pm2 restart my-pers-fin-bot

# If restart fails, check logs for errors
pm2 logs my-pers-fin-bot --err

# Check Telegram API status
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

**Root Causes:**

- Out of memory (increase limit)
- Telegram API down (wait for recovery)
- Database locked (restart clears locks)
- Network issues (check connectivity)

---

### Issue 2: High Memory Usage

**Symptoms:**

- Memory usage > 700MB
- Bot slow to respond
- Frequent restarts

**Diagnosis:**

```bash
# Check memory
pm2 show my-pers-fin-bot | grep memory

# Check for memory leaks
node --inspect dist/index.js
# Use Chrome DevTools to profile
```

**Solution:**

```bash
# Quick fix: Restart
pm2 restart my-pers-fin-bot

# Increase memory limit
# Edit ecosystem.config.js:
max_memory_restart: "1500M"

# Long-term: Find and fix memory leak
# Profile with Chrome DevTools
# Check for unclosed connections
# Review caching strategies
```

**Prevention:**

- Monitor memory trends
- Implement proper cache limits
- Close database connections
- Use streaming for large files

---

### Issue 3: Database Locked

**Symptoms:**

- Errors: "database is locked"
- Slow queries
- Write failures

**Diagnosis:**

```bash
# Check for lock files
ls -la data/*.db-*

# Check for multiple processes
pm2 list
ps aux | grep node

# Check database integrity
sqlite3 data/database.sqlite "PRAGMA integrity_check;"
```

**Solution:**

```bash
# Stop bot
pm2 stop my-pers-fin-bot

# Remove WAL files
rm -f data/*.db-shm data/*.db-wal

# Restart
pm2 start my-pers-fin-bot
```

**Prevention:**

- Use WAL mode (already enabled)
- Don't run multiple instances
- Use connection pooling
- Implement query timeouts

---

### Issue 4: Voice Messages Not Working

**Symptoms:**

- "FFmpeg not found" errors
- Voice conversion fails
- AssemblyAI errors

**Diagnosis:**

```bash
# Check FFmpeg
ffmpeg -version

# Check AssemblyAI key
echo $ASSEMBLYAI_API_KEY

# Check temp directory
ls -la /tmp/voice_*

# Check logs
grep -i "voice" logs/app.log | tail -20
```

**Solution:**

```bash
# Install FFmpeg
sudo apt install ffmpeg

# Verify AssemblyAI key in .env
vim .env
# ASSEMBLYAI_API_KEY=your_key_here

# Clean temp files
rm -f /tmp/voice_*

# Restart bot
pm2 restart my-pers-fin-bot
```

---

### Issue 5: Slow Response Times

**Symptoms:**

- Response time > 3 seconds
- Users complain about lag
- Health checks timing out

**Diagnosis:**

```bash
# Check CPU usage
top -p $(pm2 pid my-pers-fin-bot)

# Check database performance
sqlite3 data/database.sqlite "PRAGMA optimize;"

# Profile slow queries
# Add logging for query times
```

**Solution:**

```bash
# Optimize database
sqlite3 data/database.sqlite "VACUUM;"
sqlite3 data/database.sqlite "ANALYZE;"

# Check for missing indexes
# Review slow query logs

# Consider caching
# Implement Redis for hot data

# Scale vertically
# Upgrade server resources
```

---

## ⚡ Performance Tuning

### Database Optimization

```bash
# Optimize database
sqlite3 data/database.sqlite <<EOF
PRAGMA optimize;
VACUUM;
ANALYZE;
EOF

# Check size after optimization
du -h data/database.sqlite
```

### Node.js Performance

```bash
# Enable production mode
export NODE_ENV=production

# Use clustering (if supported)
# Edit ecosystem.config.js:
instances: "max"
exec_mode: "cluster"

# Increase event loop monitoring
node --max-old-space-size=1024 dist/index.js
```

### Caching Strategy

```typescript
// Implement Redis for hot data
import Redis from 'ioredis'

const redis = new Redis()

// Cache exchange rates
await redis.setex('fx:rates', 3600, JSON.stringify(rates))

// Cache user sessions
await redis.setex(`session:${userId}`, 1800, JSON.stringify(session))
```

---

## 💾 Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_FILE="data/database.sqlite"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "[$(date)] Starting backup..."
cp $DB_FILE $BACKUP_DIR/database-$TIMESTAMP.sqlite

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup successful: database-$TIMESTAMP.sqlite"
else
  echo "[$(date)] Backup failed!"
  exit 1
fi

# Compress old backups
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -exec gzip {} \;

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sqlite.gz" -mtime +30 -delete

echo "[$(date)] Backup complete"
```

**Cron job:**

```bash
# Daily at 2 AM
0 2 * * * /path/to/backup.sh >> /path/to/backup.log 2>&1
```

### Recovery Procedure

```bash
# 1. Stop bot
pm2 stop my-pers-fin-bot

# 2. Backup current database
cp data/database.sqlite data/database.before-restore.sqlite

# 3. Restore from backup
cp backups/database-20260211-020000.sqlite data/database.sqlite

# 4. Verify integrity
sqlite3 data/database.sqlite "PRAGMA integrity_check;"

# 5. Start bot
pm2 start my-pers-fin-bot

# 6. Verify functionality
# Test bot commands
```

---

## 🔒 Security

### Security Checklist

- [ ] Bot token stored in .env (not in code)
- [ ] .env file has 600 permissions
- [ ] Rate limiting enabled
- [ ] User authorization implemented
- [ ] SQL injection prevented (using TypeORM)
- [ ] XSS prevented (using sanitize-html)
- [ ] Regular security audits (`pnpm audit`)
- [ ] Dependencies up-to-date
- [ ] HTTPS for external APIs
- [ ] Logs don't contain secrets

### Security Audit

```bash
# Check for vulnerabilities
pnpm audit

# Update vulnerable packages
pnpm audit fix

# Check file permissions
ls -la .env
# Should be: -rw------- (600)

# Check for exposed secrets
grep -r "TELEGRAM_BOT_TOKEN" .
# Should only appear in .env
```

### Rate Limiting

```bash
# Enable in .env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_WINDOW_MS=60000  # 1 minute

# Monitor rate limit hits
grep "Rate limit exceeded" logs/app.log
```

---

## 🚨 Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
| --------------------------------------------- |
| **P0 - Critical** | Service down | < 15 min | Bot completely offline |
| **P1 - High** | Major degradation | < 1 hour | 50%+ errors |
| **P2 - Medium** | Partial degradation | < 4 hours | Some features broken |
| **P3 - Low** | Minor issue | < 24 hours | UI glitch |

### Incident Response Playbook

#### 1. Acknowledge

```bash
# Confirm the incident
# Check monitoring/alerts
# Verify impact
```

#### 2. Assess

```bash
# Check logs
pm2 logs my-pers-fin-bot --lines 200

# Check metrics
pm2 show my-pers-fin-bot

# Check dependencies
curl https://api.telegram.org/bot<TOKEN>/getMe
```

#### 3. Mitigate

```bash
# Quick fix
pm2 restart my-pers-fin-bot

# Rollback if needed
git checkout HEAD~1
pnpm run deploy:quick
```

#### 4. Resolve

```bash
# Fix root cause
# Deploy fix
# Verify resolution
```

#### 5. Document

```markdown
# Incident Report

**Date:** 2026-02-11
**Duration:** 15 minutes
**Severity:** P1

**Impact:**
- Bot unavailable for 15 minutes
- ~50 users affected

**Root Cause:**
- Out of memory
- No automatic restart

**Resolution:**
- Increased memory limit
- Configured auto-restart

**Action Items:**
- [ ] Implement memory monitoring
- [ ] Set up alerts
- [ ] Review caching strategy
```

---

## 🛠️ Maintenance Windows

### Planned Maintenance

**Frequency:** Monthly  
**Duration:** 30 minutes  
**Window:** Sunday 2:00 AM - 2:30 AM (low traffic)

**Pre-maintenance:**

```bash
# 1. Announce to users (if applicable)

# 2. Backup database
./scripts/backup.sh

# 3. Document rollback plan

# 4. Prepare deployment
git pull
pnpm install
pnpm run build
```

**During maintenance:**

```bash
# 1. Stop bot
pm2 stop my-pers-fin-bot

# 2. Run updates/migrations
pnpm run migrate

# 3. Deploy new version
pm2 start my-pers-fin-bot

# 4. Verify health
curl http://localhost:3005/health
```

**Post-maintenance:**

```bash
# 1. Monitor for 30 minutes
pm2 logs my-pers-fin-bot -f

# 2. Test critical features
# /start, /balance, /export

# 3. Document changes

# 4. Update status (if applicable)
```

---

## 📊 Monitoring & Alerts

### Prometheus Metrics (Optional)

```javascript
// Add to src/monitoring.ts
import promClient from 'prom-client'

const register = new promClient.Registry()

// Metrics
const messagesProcessed = new promClient.Counter({
  name: 'bot_messages_processed_total',
  help: 'Total messages processed',
  registers: [register]
})

const responseTime = new promClient.Histogram({
  name: 'bot_response_time_seconds',
  help: 'Response time in seconds',
  registers: [register]
})

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})
```

### Alert Rules

```yaml
# deploy/alerts/metrics-alerts.yml
# includes:
# - BotHealthEndpointDown
# - BotSearchLatencyHigh
# - BotChartLatencyHigh
```

---

## 📚 Resources

- **PM2 Documentation:** <https://pm2.keymetrics.io/>
- **Node.js Best Practices:** <https://github.com/goldbergyoni/nodebestpractices>
- **SRE Book:** <https://sre.google/books/>
- **Incident Response:** <https://response.pagerduty.com/>

---

## 🎉 Summary

**Runbook Rating:** ⭐⭐⭐⭐⭐ 9/10

**Covers:**

- ✅ Daily/Weekly/Monthly operations
- ✅ Health checks
- ✅ Common issues & solutions
- ✅ Performance tuning
- ✅ Backup & recovery
- ✅ Security best practices
- ✅ Incident response
- ✅ Maintenance procedures

**Use this runbook for:**

- New team member onboarding
- On-call rotations
- Incident response
- Regular maintenance

---

**Last Updated:** February 11, 2026  
**Maintained by:** MyPersFinBot Operations Team
