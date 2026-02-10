# Release Checklist

## Pre-Release
1. Sync main branch and ensure clean working tree
2. Update version (if needed)
3. Verify environment variables in `docs/ENV.md`
4. Run local checks:
   - `pnpm lint`
   - `pnpm type-check`
   - `pnpm test`
   - `pnpm test:coverage:ci`
5. Build production bundle:
   - `pnpm build`
6. Review migrations (if any) and confirm order of operations
7. Verify docs are up to date (README + docs index)

## Database Safety
1. Create backup (see `docs/DEPLOYMENT.md`)
2. Ensure WAL files are not stale and storage is healthy
3. Confirm foreign keys are enabled (PRAGMA)

## Deployment
1. Deploy build artifacts
2. Restart process (PM2/systemd)
3. Verify service is active and healthy
4. Run smoke checks:
   - `/start` renders main menu
   - quick expense/income flows
   - reminders/notifications (if enabled)
   - analytics menu

## Post-Release
1. Check logs for errors/warnings
2. Monitor health endpoints (`/healthz`, `/readyz`)
3. Verify scheduled jobs execute as expected
4. If issues detected, rollback using last known good build

## Rollback
1. Stop service
2. Restore previous build
3. Restore database from backup if needed
4. Start service and verify health
