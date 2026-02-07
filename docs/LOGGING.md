# Logging

## Flags
- `LOG_LEVEL`: `error | warn | info | debug`
- `LOG_BOOT_DETAIL`: `true | false`
- `LOG_CACHE_VERBOSE`: `true | false`
- `LOG_SCHEDULER_TICK`: `true | false`

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
