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

export { Logger, logger, createLogger } from "./logger.service"
export {
  loggingMiddleware,
  logPerformance,
  createLogContext,
  getRequestLogger,
} from "./middleware"
export { LogLevel, LogContext, LoggerOptions, LogEntry } from "./types"
export { loggerConfig } from "./config"

// Export default logger
import { logger } from "./logger.service"
export default logger
