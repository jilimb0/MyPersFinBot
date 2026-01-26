/**
 * Logger types and interfaces
 */

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  HTTP = "http",
  DEBUG = "debug",
}

export interface LogContext {
  userId?: string
  chatId?: string
  messageId?: string
  command?: string
  correlationId?: string
  duration?: number

  [key: string]: any
}

export interface LoggerOptions {
  level?: LogLevel
  silent?: boolean
  correlationId?: string
}

export interface LogEntry {
  level: string
  message: string
  timestamp: string
  correlationId?: string
  context?: LogContext
  error?: {
    message: string
    stack?: string
    code?: string
  }
}
