import type { BotClient } from "@jilimb0/tgwrapper"
import { dbStorage as db } from "./database/storage-db"
import { type Language, t } from "./i18n"
import { logger as log } from "./logger"

export enum ErrorType {
  TELEGRAM_API = "TELEGRAM_API",
  DATABASE = "DATABASE",
  VALIDATION = "VALIDATION",
  ASSEMBLYAI = "ASSEMBLYAI",
  FX_API = "FX_API",
  PERMISSION = "PERMISSION",
  RATE_LIMIT = "RATE_LIMIT",
  NETWORK = "NETWORK",
  UNKNOWN = "UNKNOWN",
}

export interface AppError extends Error {
  type: ErrorType
  code?: string
  statusCode?: number
  context?: Record<string, any>
  userMessage?: string
  userMessageKey?: string
  userMessageParams?: Record<string, string | number>
}

export function createError(
  type: ErrorType,
  message: string,
  options?: {
    userMessage?: string
    userMessageKey?: string
    userMessageParams?: Record<string, string | number>
    context?: Record<string, any>
  }
): AppError {
  const error = new Error(message) as AppError
  error.type = type
  error.userMessage = options?.userMessage
  error.userMessageKey = options?.userMessageKey
  error.userMessageParams = options?.userMessageParams
  error.context = options?.context
  return error
}

export function handleTelegramError(error: any): AppError {
  const code = error.response?.body?.error_code
  const description = error.response?.body?.description

  log.error("Telegram API error", {
    code,
    description,
    stack: error.stack,
  })

  if (code === 403) {
    return createError(ErrorType.TELEGRAM_API, `Telegram 403: ${description}`, {
      userMessageKey: "common.botWasBlocked",
      context: { code, description },
    })
  }

  if (code === 429) {
    const retryAfter = error.response?.body?.parameters?.retry_after
    return createError(
      ErrorType.RATE_LIMIT,
      `Telegram rate limit: ${description}`,
      {
        userMessageKey: retryAfter
          ? "errors.rateLimitExceeded"
          : "errors.rateLimitExceededShort",
        userMessageParams: retryAfter ? { retryAfter } : undefined,
        context: { code, description },
      }
    )
  }

  if (code === 400) {
    return createError(ErrorType.TELEGRAM_API, `Telegram 400: ${description}`, {
      userMessageKey: "errors.telegramInvalidRequest",
      context: { code, description },
    })
  }

  return createError(ErrorType.TELEGRAM_API, description || error.message, {
    userMessageKey: "errors.telegramGeneric",
    context: { code, description },
  })
}

export function handleDatabaseError(error: any): AppError {
  log.error("Database error", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  })

  if (error.code === "SQLITE_BUSY") {
    return createError(ErrorType.DATABASE, "Database is busy", {
      userMessageKey: "errors.databaseBusy",
      context: { code: error.code },
    })
  }

  if (error.code === "SQLITE_LOCKED") {
    return createError(ErrorType.DATABASE, "Database is locked", {
      userMessageKey: "errors.databaseLocked",
      context: { code: error.code },
    })
  }

  if (error.code === "SQLITE_CONSTRAINT") {
    return createError(ErrorType.DATABASE, "Constraint violation", {
      userMessageKey: "errors.invalidData",
      context: { code: error.code },
    })
  }

  return createError(ErrorType.DATABASE, error.message, {
    userMessageKey: "errors.databaseGeneric",
    context: { code: error.code },
  })
}

export function handleAssemblyAIError(error: any): AppError {
  const status = error.response?.status

  log.error("AssemblyAI error", {
    status,
    message: error.message,
    stack: error.stack,
  })

  if (status === 429) {
    return createError(ErrorType.ASSEMBLYAI, "AssemblyAI quota exceeded", {
      userMessageKey: "errors.assemblyQuota",
      context: { status },
    })
  }

  if (status === 402) {
    return createError(ErrorType.ASSEMBLYAI, "AssemblyAI payment required", {
      userMessageKey: "errors.assemblyPayment",
      context: { status },
    })
  }

  if (status === 401) {
    return createError(
      ErrorType.ASSEMBLYAI,
      "AssemblyAI authentication failed",
      {
        userMessageKey: "messages.voiceTranscriptionUnavailable",
        context: { status },
      }
    )
  }

  return createError(ErrorType.ASSEMBLYAI, error.message, {
    userMessageKey: "voice.failed",
    context: { status },
  })
}

export function handleFXError(error: any): AppError {
  log.warn("FX API error (using fallback)", {
    message: error.message,
    code: error.code,
  })

  return createError(ErrorType.FX_API, error.message, {
    userMessageKey: "warnings.usingFallbackRates",
    context: { code: error.code },
  })
}

export function handleValidationError(message: string): AppError {
  return createError(ErrorType.VALIDATION, message, {
    userMessageKey: "errors.validationMessage",
    userMessageParams: { message },
    context: {},
  })
}

export function handleUnknownError(error: any): AppError {
  log.error("Unknown error", {
    message: error.message,
    stack: error.stack,
    type: typeof error,
  })

  return createError(ErrorType.UNKNOWN, error.message || "Unknown error", {
    userMessageKey: "errors.genericUnknown",
    context: {},
  })
}

export function handleError(error: any): AppError {
  if ((error as AppError).type) {
    return error as AppError
  }

  if (error.response?.body?.error_code) {
    return handleTelegramError(error)
  }

  if (error.code?.startsWith("SQLITE_")) {
    return handleDatabaseError(error)
  }

  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    return createError(ErrorType.NETWORK, error.message, {
      userMessageKey: "errors.networkError",
      context: { code: error.code },
    })
  }

  return handleUnknownError(error)
}

export async function sendErrorToUser(
  bot: BotClient,
  chatId: number,
  error: AppError,
  context?: {
    userId?: string
    action?: string
  }
) {
  // Log structured error information
  log.error("AppError sent to user", {
    type: error.type,
    message: error.message,
    userMessage: error.userMessage,
    chatId,
    context,
    stack: error.stack,
  })

  try {
    let lang: Language = "en"
    if (context?.userId !== undefined) {
      try {
        lang = await db.getUserLanguage(String(context.userId))
      } catch (langError) {
        log.warn("Failed to resolve user language", {
          userId: context.userId,
          error: (langError as Error).message,
        })
      }
    }

    const resolvedMessage = error.userMessageKey
      ? t(lang, error.userMessageKey, error.userMessageParams)
      : error.userMessage || t(lang, "errors.genericUnknown")

    await bot.sendMessage(chatId, resolvedMessage, {
      reply_markup: {
        keyboard: [
          [
            { text: t(lang, "buttons.tryAgain") },
            { text: t(lang, "mainMenu.mainMenuButton") },
          ],
        ],
        resize_keyboard: true,
      },
    })
  } catch (sendError) {
    log.error("Failed to send error message to user", {
      chatId,
      originalError: error.message,
      sendError: (sendError as Error).message,
    })
  }
}

export function setupGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    log.error("Unhandled Promise Rejection", {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    })
  })

  process.on("uncaughtException", (error: Error) => {
    log.error("Uncaught Exception", {
      message: error.message,
      stack: error.stack,
    })

    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })

  process.on("SIGTERM", () => {
    log.info("SIGTERM received, shutting down gracefully...")
    process.exit(0)
  })

  process.on("SIGINT", () => {
    log.info("SIGINT received, shutting down gracefully...")
    process.exit(0)
  })
}

export default {
  handleError,
  handleTelegramError,
  handleDatabaseError,
  handleAssemblyAIError,
  handleFXError,
  handleValidationError,
  handleUnknownError,
  sendErrorToUser,
  setupGlobalErrorHandlers,
  createError,
  ErrorType,
}
