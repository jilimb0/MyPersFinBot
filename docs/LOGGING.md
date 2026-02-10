# Logging

## Flags
- `LOG_LEVEL`: `error | warn | info | debug`
- `LOG_BOOT_DETAIL`: `true | false`
- `LOG_CACHE_VERBOSE`: `true | false`
- `LOG_SCHEDULER_TICK`: `true | false`
- `LOG_DIR`: directory for log files (default: `logs`)

## Recommended Presets

Minimal dev logs:
```bash
LOG_LEVEL=info LOG_BOOT_DETAIL=false LOG_CACHE_VERBOSE=false LOG_SCHEDULER_TICK=false pnpm dev
```

Investigating cache issues:
```bash
LOG_LEVEL=debug LOG_CACHE_VERBOSE=true pnpm dev
```

Investigating scheduler behavior:
```bash
LOG_LEVEL=debug LOG_SCHEDULER_TICK=true pnpm dev
```

Verbose boot + full debug:
```bash
LOG_LEVEL=debug LOG_BOOT_DETAIL=true LOG_CACHE_VERBOSE=true LOG_SCHEDULER_TICK=true pnpm dev
```

## Notes
- Boot logs are suppressed unless `LOG_BOOT_DETAIL=true`.
- Cache hit/miss details require `LOG_CACHE_VERBOSE=true`.
- Scheduler ticks are gated by `LOG_SCHEDULER_TICK=true`.
- In production, logs are written to rotating files (console only in dev).
- Log files rotate daily and are compressed:
  - `application-%DATE%.log` (keep 14 days)
  - `error-%DATE%.log` (keep 30 days)
  - `http-%DATE%.log` (keep 7 days)
  - `exceptions-%DATE%.log` and `rejections-%DATE%.log` (keep 30 days)
