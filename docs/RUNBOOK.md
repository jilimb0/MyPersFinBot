# Operational Runbook

## Service Control
- PM2:
  - `pm2 status`
  - `pm2 restart my-pers-fin-bot`
  - `pm2 logs my-pers-fin-bot`
- systemd:
  - `sudo systemctl status my-pers-fin-bot`
  - `sudo systemctl restart my-pers-fin-bot`
  - `journalctl -u my-pers-fin-bot -f`

## Health Checks
- `/healthz`
- `/readyz`
- Configure host/port via `HEALTH_HOST` and `HEALTH_PORT`

## Logs
- Default dir: `logs/` (see `LOG_DIR` in `docs/ENV.md`)
- Rotated files:
  - `application-%DATE%.log`
  - `error-%DATE%.log`
  - `http-%DATE%.log`
  - `exceptions-%DATE%.log`
  - `rejections-%DATE%.log`

## Backups
- Ensure scheduled backups (see `docs/DEPLOYMENT.md`)
- Verify backups before upgrades
- Restore process:
  1. Stop service
  2. Replace database file
  3. Start service

## Cache
- In-memory cache by default
- Redis optional (see `docs/ENV.md`)
- If cache corruption suspected:
  - restart service
  - or clear cache via maintenance scripts

## Queue (Recurring Jobs)
- Uses Bull (Redis optional). If stuck:
  - verify Redis connectivity
  - restart service
  - inspect queue logs

## Common Incidents

### 1) Bot not responding
- Check process status
- Check logs for startup errors
- Verify `TELEGRAM_BOT_TOKEN`
- Confirm DB is accessible

### 2) Reminder/Recurring jobs not firing
- Check scheduler logs (`LOG_SCHEDULER_TICK=true`)
- Validate system time and timezone
- Verify Redis (if enabled)

### 3) Voice transcription failing
- Ensure `ASSEMBLYAI_API_KEY` set
- Verify FFmpeg installation
- Check AssemblyAI API status

### 4) FX rates not updating
- Check `FX_API_KEY`
- Verify network connectivity
- Validate cache refresh interval

## Diagnostics
- Enable verbose logs:
  - `LOG_LEVEL=debug LOG_BOOT_DETAIL=true LOG_SCHEDULER_TICK=true`
- Use `docs/DEBUGGING.md` for advanced tracing
