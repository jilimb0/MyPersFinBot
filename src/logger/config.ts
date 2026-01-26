/**
 * Winston logger configuration
 */

import winston from "winston"
import DailyRotateFile from "winston-daily-rotate-file"
import path from "path"
import { LogLevel } from "./types"

const LOG_DIR = process.env.LOG_DIR || "logs"
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO
const IS_PRODUCTION = process.env.NODE_ENV === "production"

/**
 * Custom format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    ({ level, message, timestamp, correlationId, ...meta }) => {
      let log = `${timestamp} [${level}]`

      if (correlationId) {
        log += ` [${correlationId}]`
      }

      log += `: ${message}`

      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        const metaStr = JSON.stringify(meta, null, 2)
        if (metaStr !== "{}") {
          log += `\n${metaStr}`
        }
      }

      return log
    }
  )
)

/**
 * JSON format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

/**
 * Console transport
 */
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: LOG_LEVEL,
})

/**
 * File transport for all logs (with rotation)
 */
const allLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  format: fileFormat,
  maxSize: "20m", // Rotate when file reaches 20MB
  maxFiles: "14d", // Keep logs for 14 days
  level: LOG_LEVEL,
  zippedArchive: true, // Compress rotated files
})

/**
 * File transport for errors only (with rotation)
 */
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  format: fileFormat,
  maxSize: "20m",
  maxFiles: "30d", // Keep error logs longer
  level: LogLevel.ERROR,
  zippedArchive: true,
})

/**
 * File transport for HTTP requests (optional)
 */
const httpLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "http-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  format: fileFormat,
  maxSize: "20m",
  maxFiles: "7d", // Keep HTTP logs for 7 days
  level: LogLevel.HTTP,
  zippedArchive: true,
})

/**
 * Export transports based on environment
 */
export const transports: winston.transport[] = IS_PRODUCTION
  ? [
      // Production: file logging only
      allLogsTransport,
      errorLogsTransport,
      httpLogsTransport,
    ]
  : [
      // Development: console + file logging
      consoleTransport,
      allLogsTransport,
      errorLogsTransport,
    ]

/**
 * Logger configuration
 */
export const loggerConfig: winston.LoggerOptions = {
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports,
  exitOnError: false, // Don't exit on handled exceptions
}

/**
 * Exception handlers (for uncaught exceptions)
 */
export const exceptionHandlers: winston.transport[] = [
  new DailyRotateFile({
    filename: path.join(LOG_DIR, "exceptions-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: fileFormat,
    maxSize: "20m",
    maxFiles: "30d",
    zippedArchive: true,
  }),
]

/**
 * Rejection handlers (for unhandled promise rejections)
 */
export const rejectionHandlers: winston.transport[] = [
  new DailyRotateFile({
    filename: path.join(LOG_DIR, "rejections-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: fileFormat,
    maxSize: "20m",
    maxFiles: "30d",
    zippedArchive: true,
  }),
]
