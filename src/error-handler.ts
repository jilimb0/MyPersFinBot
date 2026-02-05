import TelegramBot from "node-telegram-bot-api"
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
}

export function createError(
  type: ErrorType,
  message: string,
  userMessage?: string,
  context?: Record<string, any>
): AppError {
  const error = new Error(message) as AppError
  error.type = type
  error.userMessage = userMessage || message
  error.context = context
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
    return createError(
      ErrorType.TELEGRAM_API,
      `Telegram 403: ${description}`,
      "🚫 Bot was blocked by user or chat not found.",
      { code, description }
    )
  }

  if (code === 429) {
    return createError(
      ErrorType.RATE_LIMIT,
      `Telegram rate limit: ${description}`,
      "⏱ Too many requests. Please wait a moment.",
      { code, description }
    )
  }

  if (code === 400) {
    return createError(
      ErrorType.TELEGRAM_API,
      `Telegram 400: ${description}`,
      "❌ Invalid request. Please try again.",
      { code, description }
    )
  }

  return createError(
    ErrorType.TELEGRAM_API,
    description || error.message,
    "❌ Telegram error. Please try again.",
    { code, description }
  )
}

export function handleDatabaseError(error: any): AppError {
  log.error("Database error", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  })

  if (error.code === "SQLITE_BUSY") {
    return createError(
      ErrorType.DATABASE,
      "Database is busy",
      "⏳ Database is busy. Please try again.",
      { code: error.code }
    )
  }

  if (error.code === "SQLITE_LOCKED") {
    return createError(
      ErrorType.DATABASE,
      "Database is locked",
      "🔒 Database is locked. Please try again.",
      { code: error.code }
    )
  }

  if (error.code === "SQLITE_CONSTRAINT") {
    return createError(
      ErrorType.DATABASE,
      "Constraint violation",
      "❌ Invalid data. Please check your input.",
      { code: error.code }
    )
  }

  return createError(
    ErrorType.DATABASE,
    error.message,
    "❌ Database error. Please try again later.",
    { code: error.code }
  )
}

export function handleAssemblyAIError(error: any): AppError {
  const status = error.response?.status

  log.error("AssemblyAI error", {
    status,
    message: error.message,
    stack: error.stack,
  })

  if (status === 429) {
    return createError(
      ErrorType.ASSEMBLYAI,
      "AssemblyAI quota exceeded",
      "⏱ Voice transcription quota exceeded. Please try again later or upgrade your plan.",
      { status }
    )
  }

  if (status === 402) {
    return createError(
      ErrorType.ASSEMBLYAI,
      "AssemblyAI payment required",
      "💳 AssemblyAI payment required. Please check your account.",
      { status }
    )
  }

  if (status === 401) {
    return createError(
      ErrorType.ASSEMBLYAI,
      "AssemblyAI authentication failed",
      "🔑 Voice transcription unavailable. Please contact support.",
      { status }
    )
  }

  return createError(
    ErrorType.ASSEMBLYAI,
    error.message,
    "❌ Voice transcription failed. Please try text input.",
    { status }
  )
}

export function handleFXError(error: any): AppError {
  log.warn("FX API error (using fallback)", {
    message: error.message,
    code: error.code,
  })

  return createError(
    ErrorType.FX_API,
    error.message,
    "⚠️ Using fallback exchange rates.",
    { code: error.code }
  )
}

export function handleValidationError(message: string): AppError {
  return createError(ErrorType.VALIDATION, message, `❌ ${message}`, {})
}

export function handleUnknownError(error: any): AppError {
  log.error("Unknown error", {
    message: error.message,
    stack: error.stack,
    type: typeof error,
  })

  return createError(
    ErrorType.UNKNOWN,
    error.message || "Unknown error",
    "❌ Something went wrong. Please try again.",
    {}
  )
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
    return createError(
      ErrorType.NETWORK,
      error.message,
      "🌐 Network error. Please check your connection.",
      { code: error.code }
    )
  }

  return handleUnknownError(error)
}

export async function sendErrorToUser(
  bot: TelegramBot,
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
    await bot.sendMessage(
      chatId,
      error.userMessage || "❌ An error occurred. Please try again.",
      {
        reply_markup: {
          keyboard: [[{ text: "🔄 Try Again" }, { text: "🏠 Main Menu" }]],
          resize_keyboard: true,
        },
      }
    )
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
