/**
 * Error Handler Middleware
 * Centralized error handling for Telegram bot
 */

import type TelegramBot from "@telegram-api"
import { dbStorage as db } from "../database/storage-db"
import { type Language, t } from "../i18n"
import logger from "../logger"

/**
 * Custom error types
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, true)
  }
}

export class InsufficientFundsError extends AppError {
  constructor(
    public account: string,
    public current: number,
    public required: number
  ) {
    super("INSUFFICIENT_FUNDS", 400, true)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "DATABASE_ERROR") {
    super(message, 500, false)
  }
}

export class RateLimitError extends AppError {
  constructor(public retryAfter: number) {
    super("RATE_LIMIT_EXCEEDED", 429, true)
  }
}

/**
 * Error handler context
 */
interface ErrorContext {
  userId?: number
  chatId?: number
  username?: string
  messageId?: number
  command?: string
  data?: any
}

async function resolveUserLanguage(userId?: number): Promise<Language> {
  if (userId === undefined) return "en"
  try {
    return await db.getUserLanguage(String(userId))
  } catch (error) {
    logger.warn("Failed to resolve user language", {
      userId: String(userId),
      error: (error as Error).message,
    })
    return "en"
  }
}

/**
 * Main error handler
 */
export async function handleError(
  error: Error,
  bot: TelegramBot,
  chatId: number,
  context?: ErrorContext
): Promise<void> {
  // Log error with context
  logger.error("Error occurred", {
    error: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  })

  // Determine user-friendly message
  const lang = await resolveUserLanguage(context?.userId)
  let userMessage: string

  if (error instanceof InsufficientFundsError) {
    userMessage = t(lang, "errors.insufficientFunds", {
      account: error.account,
      current: error.current,
      required: Math.abs(error.required),
    })
  } else if (error instanceof ValidationError) {
    userMessage = error.message
  } else if (error instanceof NotFoundError) {
    userMessage = error.message
  } else if (error instanceof RateLimitError) {
    userMessage = t(lang, "errors.rateLimitExceeded", {
      retryAfter: error.retryAfter,
    })
  } else if (error instanceof DatabaseError) {
    userMessage = t(lang, "errors.databaseGeneric")
  } else if (error.message.includes("SQLITE_CONSTRAINT")) {
    userMessage = t(lang, "errors.transactionFailed")
  } else if (error.message.includes("Foreign key")) {
    userMessage = t(lang, "errors.transactionFailed")
  } else {
    // Unknown error - don't expose details
    userMessage = t(lang, "errors.genericUnknown")

    // Log unknown errors with more details
    logger.error("Unknown error type", {
      error: error.toString(),
      type: error.constructor.name,
      ...context,
    })
  }

  // Send error message to user
  try {
    await bot.sendMessage(chatId, userMessage, {
      parse_mode: "Markdown",
    })
  } catch (sendError) {
    logger.error("Failed to send error message to user", {
      originalError: error.message,
      sendError:
        sendError instanceof Error ? sendError.message : String(sendError),
      chatId,
    })
  }
}

/**
 * Wrap async handler with error catching
 */
export function asyncHandler(
  handler: (msg: TelegramBot.Message, bot: TelegramBot) => Promise<void>
) {
  return async (msg: TelegramBot.Message, bot: TelegramBot) => {
    try {
      await handler(msg, bot)
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error(String(error)),
        bot,
        msg.chat.id,
        {
          userId: msg.from?.id,
          chatId: msg.chat.id,
          username: msg.from?.username,
          messageId: msg.message_id,
          command: msg.text?.split(" ")[0],
        }
      )
    }
  }
}

/**
 * Wrap callback query handler with error catching
 */
export function asyncCallbackHandler(
  handler: (query: TelegramBot.CallbackQuery, bot: TelegramBot) => Promise<void>
) {
  return async (query: TelegramBot.CallbackQuery, bot: TelegramBot) => {
    try {
      await handler(query, bot)
    } catch (error) {
      const chatId = query.message?.chat.id

      if (chatId) {
        await handleError(
          error instanceof Error ? error : new Error(String(error)),
          bot,
          chatId,
          {
            userId: query.from.id,
            chatId,
            username: query.from.username,
            data: query.data,
          }
        )
      } else {
        logger.error("Callback query error without chat ID", {
          error: error instanceof Error ? error.message : String(error),
          queryId: query.id,
        })
      }
    }
  }
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandlers(): void {
  process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught Exception", {
      error: error.message,
      stack: error.stack,
    })

    // Give logger time to flush
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })

  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error("Unhandled Rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
    })
  })

  process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received: closing HTTP server")
    process.exit(0)
  })

  process.on("SIGINT", () => {
    logger.info("SIGINT signal received: closing HTTP server")
    process.exit(0)
  })
}

/**
 * Utility to check if error is operational (expected)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational
  }
  return false
}
