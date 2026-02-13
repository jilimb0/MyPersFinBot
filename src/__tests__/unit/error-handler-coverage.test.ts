import {
  createError,
  ErrorType,
  handleAssemblyAIError,
  handleDatabaseError,
  handleError,
  handleFXError,
  handleTelegramError,
  handleUnknownError,
  handleValidationError,
  sendErrorToUser,
} from "../../error-handler"

jest.mock("../../logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

jest.mock("../../i18n", () => ({
  t: jest.fn((_lang, key) => key),
  Language: "en",
}))

const mockBot = {
  sendMessage: jest.fn().mockResolvedValue({}),
} as any

describe("Error Handler Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createError", () => {
    test("creates basic error", () => {
      const error = createError(ErrorType.VALIDATION, "Test error")

      expect(error.type).toBe(ErrorType.VALIDATION)
      expect(error.message).toBe("Test error")
    })

    test("creates error with options", () => {
      const error = createError(ErrorType.DATABASE, "DB error", {
        userMessage: "User message",
        userMessageKey: "errors.db",
        userMessageParams: { code: "123" },
        context: { extra: "info" },
      })

      expect(error.userMessage).toBe("User message")
      expect(error.userMessageKey).toBe("errors.db")
      expect(error.userMessageParams).toEqual({ code: "123" })
      expect(error.context).toEqual({ extra: "info" })
    })
  })

  describe("handleTelegramError", () => {
    test("handles 403 Forbidden", () => {
      const error = {
        response: {
          body: {
            error_code: 403,
            description: "Forbidden: bot was blocked by the user",
          },
        },
      }

      const result = handleTelegramError(error)

      expect(result.type).toBe(ErrorType.TELEGRAM_API)
      expect(result.userMessageKey).toBe("common.botWasBlocked")
    })

    test("handles 429 Rate Limit with retry_after", () => {
      const error = {
        response: {
          body: {
            error_code: 429,
            description: "Too Many Requests",
            parameters: { retry_after: 30 },
          },
        },
      }

      const result = handleTelegramError(error)

      expect(result.type).toBe(ErrorType.RATE_LIMIT)
      expect(result.userMessageKey).toBe("errors.rateLimitExceeded")
      expect(result.userMessageParams).toEqual({ retryAfter: 30 })
    })

    test("handles 429 Rate Limit without retry_after", () => {
      const error = {
        response: {
          body: {
            error_code: 429,
            description: "Too Many Requests",
          },
        },
      }

      const result = handleTelegramError(error)

      expect(result.type).toBe(ErrorType.RATE_LIMIT)
      expect(result.userMessageKey).toBe("errors.rateLimitExceededShort")
    })

    test("handles 400 Bad Request", () => {
      const error = {
        response: {
          body: {
            error_code: 400,
            description: "Bad Request: invalid chat_id",
          },
        },
      }

      const result = handleTelegramError(error)

      expect(result.type).toBe(ErrorType.TELEGRAM_API)
      expect(result.userMessageKey).toBe("errors.telegramInvalidRequest")
    })

    test("handles generic Telegram error", () => {
      const error = {
        response: {
          body: {
            error_code: 500,
            description: "Internal Server Error",
          },
        },
      }

      const result = handleTelegramError(error)

      expect(result.type).toBe(ErrorType.TELEGRAM_API)
      expect(result.userMessageKey).toBe("errors.telegramGeneric")
    })
  })

  describe("handleDatabaseError", () => {
    test("handles SQLITE_BUSY", () => {
      const error = { code: "SQLITE_BUSY", message: "Database is busy" }

      const result = handleDatabaseError(error)

      expect(result.type).toBe(ErrorType.DATABASE)
      expect(result.userMessageKey).toBe("errors.databaseBusy")
    })

    test("handles SQLITE_LOCKED", () => {
      const error = { code: "SQLITE_LOCKED", message: "Database is locked" }

      const result = handleDatabaseError(error)

      expect(result.type).toBe(ErrorType.DATABASE)
      expect(result.userMessageKey).toBe("errors.databaseLocked")
    })

    test("handles SQLITE_CONSTRAINT", () => {
      const error = {
        code: "SQLITE_CONSTRAINT",
        message: "Constraint violation",
      }

      const result = handleDatabaseError(error)

      expect(result.type).toBe(ErrorType.DATABASE)
      expect(result.userMessageKey).toBe("errors.invalidData")
    })

    test("handles generic database error", () => {
      const error = { code: "SQLITE_ERROR", message: "Generic DB error" }

      const result = handleDatabaseError(error)

      expect(result.type).toBe(ErrorType.DATABASE)
      expect(result.userMessageKey).toBe("errors.databaseGeneric")
    })
  })

  describe("handleAssemblyAIError", () => {
    test("handles 429 quota exceeded", () => {
      const error = {
        response: { status: 429 },
        message: "Quota exceeded",
      }

      const result = handleAssemblyAIError(error)

      expect(result.type).toBe(ErrorType.ASSEMBLYAI)
      expect(result.userMessageKey).toBe("errors.assemblyQuota")
    })

    test("handles 402 payment required", () => {
      const error = {
        response: { status: 402 },
        message: "Payment required",
      }

      const result = handleAssemblyAIError(error)

      expect(result.type).toBe(ErrorType.ASSEMBLYAI)
      expect(result.userMessageKey).toBe("errors.assemblyPayment")
    })

    test("handles 401 authentication failed", () => {
      const error = {
        response: { status: 401 },
        message: "Authentication failed",
      }

      const result = handleAssemblyAIError(error)

      expect(result.type).toBe(ErrorType.ASSEMBLYAI)
      expect(result.userMessageKey).toBe(
        "messages.voiceTranscriptionUnavailable"
      )
    })

    test("handles generic AssemblyAI error", () => {
      const error = {
        response: { status: 500 },
        message: "Internal error",
      }

      const result = handleAssemblyAIError(error)

      expect(result.type).toBe(ErrorType.ASSEMBLYAI)
      expect(result.userMessageKey).toBe("voice.failed")
    })
  })

  describe("handleFXError", () => {
    test("handles FX API error", () => {
      const error = { code: "FX_ERROR", message: "FX API unavailable" }

      const result = handleFXError(error)

      expect(result.type).toBe(ErrorType.FX_API)
      expect(result.userMessageKey).toBe("warnings.usingFallbackRates")
    })
  })

  describe("handleValidationError", () => {
    test("handles validation error", () => {
      const result = handleValidationError("Invalid input")

      expect(result.type).toBe(ErrorType.VALIDATION)
      expect(result.userMessageKey).toBe("errors.validationMessage")
      expect(result.userMessageParams).toEqual({ message: "Invalid input" })
    })
  })

  describe("handleUnknownError", () => {
    test("handles error with message", () => {
      const error = new Error("Unknown error")

      const result = handleUnknownError(error)

      expect(result.type).toBe(ErrorType.UNKNOWN)
      expect(result.userMessageKey).toBe("errors.genericUnknown")
    })

    test("handles error without message", () => {
      const error = {}

      const result = handleUnknownError(error)

      expect(result.type).toBe(ErrorType.UNKNOWN)
      expect(result.message).toBe("Unknown error")
    })
  })

  describe("handleError", () => {
    test("returns AppError as-is", () => {
      const appError = createError(ErrorType.VALIDATION, "Test")

      const result = handleError(appError)

      expect(result).toBe(appError)
    })

    test("handles Telegram error", () => {
      const error = {
        response: {
          body: {
            error_code: 403,
            description: "Forbidden",
          },
        },
      }

      const result = handleError(error)

      expect(result.type).toBe(ErrorType.TELEGRAM_API)
    })

    test("handles database error", () => {
      const error = { code: "SQLITE_BUSY", message: "Busy" }

      const result = handleError(error)

      expect(result.type).toBe(ErrorType.DATABASE)
    })

    test("handles network error ECONNREFUSED", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" }

      const result = handleError(error)

      expect(result.type).toBe(ErrorType.NETWORK)
      expect(result.userMessageKey).toBe("errors.networkError")
    })

    test("handles network error ETIMEDOUT", () => {
      const error = { code: "ETIMEDOUT", message: "Timeout" }

      const result = handleError(error)

      expect(result.type).toBe(ErrorType.NETWORK)
      expect(result.userMessageKey).toBe("errors.networkError")
    })

    test("handles unknown error", () => {
      const error = new Error("Something went wrong")

      const result = handleError(error)

      expect(result.type).toBe(ErrorType.UNKNOWN)
    })
  })

  describe("sendErrorToUser", () => {
    test("sends error with userMessageKey", async () => {
      const error = createError(ErrorType.VALIDATION, "Test", {
        userMessageKey: "errors.validation",
      })

      await sendErrorToUser(mockBot, 123, error, { userId: "456" })

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "errors.validation",
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      )
    })

    test("sends error with userMessage", async () => {
      const error = createError(ErrorType.VALIDATION, "Test", {
        userMessage: "Custom message",
      })

      await sendErrorToUser(mockBot, 123, error)

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "Custom message",
        expect.any(Object)
      )
    })

    test("sends generic error when no user message", async () => {
      const error = createError(ErrorType.UNKNOWN, "Test")

      await sendErrorToUser(mockBot, 123, error)

      expect(mockBot.sendMessage).toHaveBeenCalled()
    })

    test("handles sendMessage failure gracefully", async () => {
      mockBot.sendMessage.mockRejectedValueOnce(new Error("Send failed"))
      const error = createError(ErrorType.VALIDATION, "Test")

      await expect(sendErrorToUser(mockBot, 123, error)).resolves.not.toThrow()
    })
  })
})
