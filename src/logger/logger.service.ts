/**
 * Logger service with Winston
 */

import winston from "winston"
import { randomUUID } from "crypto"
import { loggerConfig, exceptionHandlers, rejectionHandlers } from "./config"
import { LogContext, LoggerOptions, LogLevel } from "./types"

/**
 * Logger class with correlation ID support
 */
export class Logger {
  private winston: winston.Logger
  private defaultContext: LogContext = {}
  private correlationId?: string

  constructor(options?: LoggerOptions) {
    // Create Winston logger
    this.winston = winston.createLogger({
      ...loggerConfig,
      level: options?.level || loggerConfig.level,
      silent: options?.silent || false,
      exceptionHandlers,
      rejectionHandlers,
    })

    this.correlationId = options?.correlationId
  }

  /**
   * Set default context for all logs
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context }
  }

  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    this.correlationId = randomUUID()
    return this.correlationId
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId
  }

  /**
   * Set correlation ID
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = undefined
  }

  /**
   * Merge contexts
   */
  private mergeContext(context?: LogContext): LogContext {
    return {
      ...this.defaultContext,
      ...context,
      correlationId: context?.correlationId || this.correlationId,
    }
  }

  /**
   * Log error
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const mergedContext = this.mergeContext(context)

    if (error instanceof Error) {
      this.winston.error(message, {
        ...mergedContext,
        error: {
          message: error.message,
          stack: error.stack,

          code: (error as any).code,
        },
      })
    } else if (error) {
      this.winston.error(message, {
        ...mergedContext,
        error,
      })
    } else {
      this.winston.error(message, mergedContext)
    }
  }

  /**
   * Log warning
   */
  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, this.mergeContext(context))
  }

  /**
   * Log info
   */
  info(message: string, context?: LogContext): void {
    this.winston.info(message, this.mergeContext(context))
  }

  /**
   * Log HTTP request
   */
  http(message: string, context?: LogContext): void {
    this.winston.http(message, this.mergeContext(context))
  }

  /**
   * Log debug
   */
  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, this.mergeContext(context))
  }

  /**
   * Create child logger with preset context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger({
      level: this.winston.level as LogLevel,
      correlationId: this.correlationId,
    })
    childLogger.setDefaultContext({
      ...this.defaultContext,
      ...context,
    })
    return childLogger
  }

  /**
   * Start timer for performance logging
   */
  startTimer(): () => void {
    const start = Date.now()
    return (): void => {
      const duration = Date.now() - start
      this.debug("Operation completed", { duration })
    }
  }

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    this.winston.log(level, message, this.mergeContext(context))
  }

  /**
   * Close logger (flush transports)
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.close()
      // Wait a bit for transports to flush
      setTimeout(resolve, 500)
    })
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger()

/**
 * Create logger with correlation ID
 */
export function createLogger(correlationId?: string): Logger {
  return new Logger({ correlationId: correlationId || randomUUID() })
}

/**
 * Export default
 */
export default logger
