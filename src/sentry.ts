import * as Sentry from "@sentry/node"
import { config } from "./config"
import logger from "./logger"

let initialized = false

export function initSentry() {
  if (initialized) return
  if (!config.SENTRY_DSN) {
    if (config.LOG_BOOT_DETAIL) {
      logger.info("Sentry disabled (no DSN)")
    }
    return
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENV || config.NODE_ENV,
    tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
    release: config.SENTRY_RELEASE,
  })

  initialized = true
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Sentry initialized")
  }
}

export { Sentry }
