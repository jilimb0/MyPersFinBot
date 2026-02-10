/**
 * Logger module
 *
 * Production-ready logging with Winston:
 * - Structured JSON logging
 * - Log rotation with daily-rotate-file
 * - Multiple transports (console, file, error)
 * - Correlation IDs for request tracking
 * - Performance logging
 * - Error tracking
 */

export { loggerConfig } from "./config"
export { createLogger, Logger, logger } from "./logger.service"
export {
  createLogContext,
  getRequestLogger,
  loggingMiddleware,
  logPerformance,
} from "./middleware"
export { LogContext, LogEntry, LoggerOptions, LogLevel } from "./types"

// Export default logger
import { logger } from "./logger.service"
export default logger
