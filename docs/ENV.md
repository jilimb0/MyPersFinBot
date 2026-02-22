# Environment Variables

## Required

- `TELEGRAM_BOT_TOKEN`

## Optional

- `ASSEMBLYAI_API_KEY`
- `FX_API_KEY`
- `ALLOWED_USERS` (comma‑separated user IDs)
- `BLOCKED_USERS` (comma‑separated user IDs)
- `RATE_LIMIT_ENABLED` (`true|false`)
- `RATE_LIMIT_MAX_MESSAGES` (number)
- `RATE_LIMIT_WINDOW_MS` (ms)
- `LOG_UNAUTHORIZED_ACCESS` (`true|false`)
- `DB_PATH`
- `DB_WAL_ENABLED` (`true|false`)
- `SCHEDULER_MINUTE`
- `RECURRING_CHECK_INTERVAL`
- `VOICE_TRANSCRIPTION_TIMEOUT` (ms)
- `VOICE_MAX_DURATION` (seconds)
- `ASSEMBLYAI_POLL_INTERVAL` (ms)
- `FX_REFRESH_INTERVAL_HOURS`
- `ANALYTICS_DAYS_DEFAULT`
- `REMINDER_CHECK_INTERVAL`
- `MAX_FILE_SIZE_MB`
- `SENTRY_DSN`
- `SENTRY_ENV`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_RELEASE`
- `HEALTH_HOST`
- `HEALTH_PORT`
- `HEALTH_TLS_ENABLED` (`true|false`)
- `HEALTH_TLS_KEY_PATH` (path to TLS private key PEM)
- `HEALTH_TLS_CERT_PATH` (path to TLS certificate PEM)
- `HEALTH_BASIC_AUTH_USER`
- `HEALTH_BASIC_AUTH_PASS`
- `NODE_ENV` (`development|production|test`)
- `LOG_LEVEL` (`error|warn|info|debug`)
- `LOG_BOOT_DETAIL` (`true|false`)
- `LOG_CACHE_VERBOSE` (`true|false`)
- `LOG_SCHEDULER_TICK` (`true|false`)
- `LOG_DIR` (default: `logs`)

## Cache/Redis

- `USE_REDIS` (`true|false`)
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
