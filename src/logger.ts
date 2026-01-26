/**
 * Production Logger
 *
 * Features:
 * - Structured logging with context
 * - Log levels (debug, info, warn, error)
 * - File rotation (daily, max 14 days)
 * - Console + File output
 * - Error stack traces
 * - Timestamp + metadata
 */

import winston from "winston"
import path from "path"
import { config } from "./config"

// ==========================================
// LOG LEVELS
// ==========================================

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
}

winston.addColors(colors)

// ==========================================
// LOG FORMAT
// ==========================================

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info

    let metaStr = ""
    if (Object.keys(meta).length > 0) {
      // Exclude internal winston properties
      const filteredMeta = Object.fromEntries(
        Object.entries(meta).filter(
          ([key]) => !["Symbol(level)", "Symbol(message)"].includes(key)
        )
      )
      if (Object.keys(filteredMeta).length > 0) {
        metaStr = " " + JSON.stringify(filteredMeta)
      }
    }

    return `${timestamp} [${level}]: ${message}${metaStr}`
  })
)

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// ==========================================
// TRANSPORTS
// ==========================================

const transports: winston.transport[] = [
  // Console output (colored)
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), "logs", "error.log"),
    level: "error",
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), "logs", "combined.log"),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 14, // 14 days
  }),
]

// ==========================================
// LOGGER INSTANCE
// ==========================================

const logger = winston.createLogger({
  level: config.LOG_LEVEL || "info",
  levels,
  transports,
  exitOnError: false,
})

// ==========================================
// HELPER METHODS
// ==========================================

/**
 * Log with context (userId, chatId, action)
 */
export function logWithContext(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: {
    userId?: string
    chatId?: number
    action?: string
    [key: string]: any
  }
) {
  logger.log(level, message, context)
}

/**
 * Log error with full context
 */
export function logError(
  error: Error | unknown,
  context?: {
    userId?: string
    chatId?: number
    action?: string
    [key: string]: any
  }
) {
  const err = error as Error
  logger.error(err.message || "Unknown error", {
    ...context,
    stack: err.stack,
    name: err.name,
  })
}

/**
 * Log bot action
 */
export function logBotAction(
  action: string,
  userId: string,
  details?: Record<string, any>
) {
  logger.info(`Bot action: ${action}`, {
    userId,
    action,
    ...details,
  })
}

/**
 * Log API call
 */
export function logAPICall(
  api: "telegram" | "assemblyai" | "fx",
  method: string,
  success: boolean,
  details?: Record<string, any>
) {
  const level = success ? "info" : "warn"
  logger.log(level, `API ${api}: ${method}`, {
    api,
    method,
    success,
    ...details,
  })
}

/**
 * Log user action for analytics
 */
export function logUserAction(
  userId: string,
  action: string,
  data?: Record<string, any>
) {
  logger.info(`User action: ${action}`, {
    userId,
    action,
    ...data,
  })
}

// ==========================================
// EXPORTS
// ==========================================

export default logger

export const log = {
  debug: (message: string, meta?: Record<string, any>) =>
    logger.debug(message, meta),
  info: (message: string, meta?: Record<string, any>) =>
    logger.info(message, meta),
  warn: (message: string, meta?: Record<string, any>) =>
    logger.warn(message, meta),
  error: (message: string, meta?: Record<string, any>) =>
    logger.error(message, meta),

  // With context
  withContext: logWithContext,

  // Specialized
  logError,
  botAction: logBotAction,
  apiCall: logAPICall,
  userAction: logUserAction,
}
