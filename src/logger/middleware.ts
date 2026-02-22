/**
 * Logger middleware for Telegram bot
 */

import type TelegramBot from "@telegram-api"
import { createLogger, type Logger } from "./logger.service"
import type { LogContext } from "./types"

/**
 * Request logger storage (using AsyncLocalStorage pattern)
 */
const requestLoggers = new Map<string, Logger>()

/**
 * Get logger for current request
 */
export function getRequestLogger(messageId: string): Logger | undefined {
  return requestLoggers.get(messageId)
}

/**
 * Logging middleware for bot messages
 */
export function loggingMiddleware(bot: TelegramBot, logger: Logger): void {
  // Log all incoming messages
  bot.on("message", (msg) => {
    const messageId = msg.message_id.toString()
    const correlationId = createLogger().generateCorrelationId()

    const requestLogger = createLogger(correlationId)
    requestLoggers.set(messageId, requestLogger)

    const context: LogContext = {
      userId: msg.from?.id.toString(),
      chatId: msg.chat.id.toString(),
      messageId,
      correlationId,
    }

    // Log text messages
    if (msg.text) {
      const command = msg.text.startsWith("/")
        ? msg.text.split(" ")[0]
        : undefined
      requestLogger.info("Incoming message", {
        ...context,
        command,
        text: msg.text.substring(0, 100), // First 100 chars
      })
    }

    // Log callback queries
    if (msg.text?.includes("callback_data")) {
      requestLogger.info("Callback query", context)
    }

    // Cleanup after 1 minute
    setTimeout(() => {
      requestLoggers.delete(messageId)
    }, 60000)
  })

  // Log callback queries
  bot.on("callback_query", (query) => {
    const correlationId = createLogger().generateCorrelationId()
    const requestLogger = createLogger(correlationId)

    const context: LogContext = {
      userId: query.from.id.toString(),
      chatId: query.message?.chat.id.toString(),
      messageId: query.message?.message_id.toString(),
      correlationId,
    }

    requestLogger.info("Callback query received", {
      ...context,
      data: query.data,
    })
  })

  // Log errors
  bot.on("polling_error", (error) => {
    logger.error("Polling error", error)
  })

  // Log when bot starts
  logger.info("Bot started", {
    environment: process.env.NODE_ENV || "development",
  })
}

/**
 * Performance logging decorator
 */
export function logPerformance(
  _target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const start = Date.now()
    const logger = (this as any).logger || createLogger()

    try {
      const result = await method.apply(this, args)
      const duration = Date.now() - start

      logger.debug(`${propertyName} completed`, { duration })

      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`${propertyName} failed`, error as Error, { duration })
      throw error
    }
  }

  return descriptor
}

/**
 * Log context helper
 */
export function createLogContext(
  msg: TelegramBot.Message | TelegramBot.CallbackQuery
): LogContext {
  if ("message" in msg && msg.message) {
    // Callback query
    return {
      userId: msg.from.id.toString(),
      chatId: msg.message.chat.id.toString(),
      messageId: msg.message.message_id.toString(),
    }
  } else if ("chat" in msg) {
    // Message
    return {
      userId: msg.from?.id.toString(),
      chatId: msg.chat.id.toString(),
      messageId: msg.message_id.toString(),
    }
  } else {
    // Callback query without message
    return {
      userId: msg.from.id.toString(),
    }
  }
}
