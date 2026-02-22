import type { BotClient } from "@jilimb0/tgwrapper"
import logger from "../logger"
import { sanitizeAmount, sanitizeText } from "../utils"

/**
 * Middleware to sanitize user input for @jilimb0/tgwrapper
 * Protects against XSS and injection attacks
 */

/**
 * Sanitize text message middleware
 */
export function sanitizeTextMiddleware(bot: BotClient) {
  bot.on("message", (msg) => {
    if (!msg.text) return

    const originalText = msg.text
    const sanitizedText = sanitizeText(originalText)

    // Log if sanitization changed the input (potential attack)
    if (originalText !== sanitizedText) {
      logger.warn("Input sanitized - potential XSS attempt", {
        userId: msg.from?.id?.toString(),
        username: msg.from?.username,
        chatId: msg.chat.id.toString(),
        original: originalText.substring(0, 100),
        sanitized: sanitizedText.substring(0, 100),
      })
    }

    // Replace text with sanitized version
    msg.text = sanitizedText
  })
}

/**
 * Sanitize callback query data middleware
 */
export function sanitizeCallbackMiddleware(bot: BotClient) {
  bot.on("callback_query", (query) => {
    if (!query.data) return

    const originalData = query.data
    const sanitizedData = sanitizeText(originalData)

    if (originalData !== sanitizedData) {
      logger.warn("Callback data sanitized", {
        userId: query.from.id.toString(),
        username: query.from.username,
        original: originalData,
        sanitized: sanitizedData,
      })
    }

    // Replace data with sanitized version
    query.data = sanitizedData
  })
}

/**
 * Apply all sanitization middleware
 */
export function applySanitization(bot: BotClient) {
  sanitizeTextMiddleware(bot)
  sanitizeCallbackMiddleware(bot)
}

/**
 * Sanitize transaction input helper
 */
export interface TransactionInput {
  amount: string | number
  category: string
  description?: string
  accountId: string
  date?: string
}

export function sanitizeTransactionInput(input: TransactionInput): {
  amount: number | null
  category: string
  description: string
  accountId: string
  date: string
} {
  const amountStr =
    typeof input.amount === "number" ? input.amount.toString() : input.amount

  // Ensure rawDate is always a string
  const defaultDate = new Date().toISOString().split("T")[0]
  const rawDate = input.date?.trim() || defaultDate

  return {
    amount: sanitizeAmount(amountStr),
    category: sanitizeText(input.category),
    description: sanitizeText(input.description || ""),
    accountId: sanitizeText(input.accountId),
    date: sanitizeText(rawDate),
  }
}

/**
 * Validate and sanitize with custom rules
 */
export function validateAndSanitize<T extends Record<string, any>>(
  data: T,
  rules: Partial<Record<keyof T, (value: any) => any>>
): T {
  const result = { ...data }

  for (const [key, validator] of Object.entries(rules)) {
    if (key in result && validator) {
      try {
        result[key as keyof T] = validator(result[key as keyof T])
      } catch (error: any) {
        logger.error("Validation error", { key, error: error.message })
        throw new Error(`Invalid ${key}: ${error.message}`)
      }
    }
  }

  return result
}
