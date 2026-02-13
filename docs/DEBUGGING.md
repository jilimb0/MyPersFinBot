# Debugging

## Log Controls

These flags let you control log verbosity without changing code:

- `LOG_LEVEL`: `error | warn | info | debug`
- `LOG_BOOT_DETAIL`: `true | false`
- `LOG_CACHE_VERBOSE`: `true | false`
- `LOG_SCHEDULER_TICK`: `true | false`

### Defaults

- `LOG_LEVEL=info`
- `LOG_BOOT_DETAIL=false`
- `LOG_CACHE_VERBOSE=false`
- `LOG_SCHEDULER_TICK=false`

### Examples

Minimal logs (recommended for daily dev):

```bash
LOG_LEVEL=info LOG_BOOT_DETAIL=false LOG_CACHE_VERBOSE=false LOG_SCHEDULER_TICK=false pnpm dev
```

Verbose boot + cache + scheduler (debug session):

```bash
LOG_LEVEL=debug LOG_BOOT_DETAIL=true LOG_CACHE_VERBOSE=true LOG_SCHEDULER_TICK=true pnpm dev
```

## Common Issues

### Language/translation issues

If you see missing translations or `undefined` language warnings, enable debug and reproduce the flow:

```bash
LOG_LEVEL=debug LOG_BOOT_DETAIL=true pnpm dev
```

Then search for `Invalid language` or `Missing translation` in logs.

### Scheduler noise

Scheduler tick logs are gated by `LOG_SCHEDULER_TICK`. Keep it off unless you are debugging scheduled flows.
