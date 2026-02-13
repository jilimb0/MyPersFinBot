/**
 * Input sanitization utilities
 * Protects against XSS, SQL injection, and malicious input
 */

import sanitizeHtml from "sanitize-html"
import validator from "validator"
import logger from "../logger"

/**
 * Sanitize text input for safe storage and display
 * Removes HTML tags and escapes special characters
 */
export function sanitizeText(input: string | undefined): string {
  if (!input || typeof input !== "string") {
    return ""
  }

  // Remove excessive whitespace
  const trimmed = input.trim()

  if (!trimmed) {
    return ""
  }

  // First remove HTML tags
  const stripped = sanitizeHtml(trimmed, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {}, // No attributes allowed
  })

  // Then escape remaining special characters
  const escaped = validator.escape(stripped)

  // Limit length to prevent abuse
  const maxLength = 1000
  if (escaped.length > maxLength) {
    logger.warn("Input truncated due to excessive length", {
      original: escaped.length,
      max: maxLength,
    })
    return escaped.substring(0, maxLength)
  }

  return escaped
}

/**
 * Sanitize description field (more permissive)
 * Allows basic formatting but removes dangerous content
 */
export function sanitizeDescription(input: string): string {
  if (!input || typeof input !== "string") {
    return ""
  }

  const trimmed = input.trim()

  // Allow some basic text formatting but strip dangerous tags
  const cleaned = sanitizeHtml(trimmed, {
    allowedTags: [], // Even for descriptions, no HTML in Telegram
    allowedAttributes: {},
    textFilter: (text) => {
      // Preserve newlines for Telegram formatting
      return text
    },
  })

  // Limit length
  const maxLength = 500
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned
}

/**
 * Sanitize account/counterparty names
 * Strict validation for identifiers
 */
export function sanitizeName(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("Name must contain alphanumeric characters")
  }

  const trimmed = input.trim()

  // Check early for empty input
  if (!trimmed) {
    throw new Error("Name must contain alphanumeric characters")
  }

  // Remove all HTML
  const stripped = sanitizeHtml(trimmed, {
    allowedTags: [],
    allowedAttributes: {},
  })
  const escaped = validator.escape(stripped)

  // Names should be reasonable length
  const maxLength = 100
  const result =
    escaped.length > maxLength ? escaped.substring(0, maxLength) : escaped

  // Validate that name contains at least some alphanumeric characters
  if (!result || !/[a-zA-Z0-9]/.test(result)) {
    throw new Error("Name must contain alphanumeric characters")
  }

  return result
}

/**
 * Validate and sanitize user ID from Telegram
 * Ensures it's a valid number and converts to string
 */
export function sanitizeUserId(userId: number | string): string {
  const id = String(userId)

  // Validate it's numeric
  if (!validator.isNumeric(id)) {
    throw new Error("Invalid user ID format")
  }

  // Telegram user IDs are positive integers
  const numId = parseInt(id, 10)
  if (numId <= 0 || !Number.isInteger(numId)) {
    throw new Error("User ID must be a positive integer")
  }

  return id
}

/**
 * Validate email (if used for exports/reports)
 */
export function sanitizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()

  if (!validator.isEmail(trimmed)) {
    throw new Error("Invalid email format")
  }

  // Additional XSS protection
  return validator.normalizeEmail(trimmed) || trimmed
}

/**
 * Sanitize currency code
 * Ensures it matches expected format
 */
export function sanitizeCurrency(currency: string): string {
  const upper = currency.toUpperCase().trim()

  // Currency codes are exactly 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(upper)) {
    throw new Error("Invalid currency code format")
  }

  return upper
}

/**
 * Sanitize amount input
 * Prevents injection through numeric fields
 */
export function sanitizeAmount(amount: number | string): number {
  const num = typeof amount === "string" ? parseFloat(amount) : amount

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    throw new Error("Invalid amount: must be a valid number")
  }

  // Prevent unreasonably large numbers (overflow protection)
  const MAX_SAFE_AMOUNT = 999999999.99 // ~1 billion
  if (Math.abs(num) > MAX_SAFE_AMOUNT) {
    throw new Error(`Amount too large. Max: ${MAX_SAFE_AMOUNT}`)
  }

  // Round to 2 decimal places for currency
  return Math.round(num * 100) / 100
}

/**
 * Validate date input
 * Prevents date-related injection
 */
export function sanitizeDate(date: string | Date): Date {
  let parsedDate: Date

  if (date instanceof Date) {
    parsedDate = date
  } else if (typeof date === "string") {
    // Validate ISO date format with strict option
    if (!validator.isISO8601(date, { strict: true, strictSeparator: true })) {
      throw new Error("Invalid date format. Use ISO 8601")
    }
    parsedDate = new Date(date)

    // Check if date is valid after parsing (catches invalid dates like 2024-13-45)
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date value")
    }
  } else {
    throw new Error("Invalid date type")
  }

  // Additional check for already-parsed Date objects
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date value")
  }

  // Prevent dates too far in the past or future
  const now = new Date()
  const minDate = new Date("2000-01-01")
  const maxDate = new Date(now.getFullYear() + 10, 11, 31)

  if (parsedDate < minDate || parsedDate > maxDate) {
    throw new Error(
      `Date out of range. Must be between ${minDate.toISOString()} and ${maxDate.toISOString()}`
    )
  }

  return parsedDate
}

/**
 * Raw transaction input (before sanitization)
 */
export interface RawTransactionInput {
  userId: number | string
  amount: number | string
  currency: string
  description?: string
  category?: string
  fromAccountId?: string
  toAccountId?: string
  date?: string | Date
}

/**
 * Sanitized transaction data (after sanitization)
 */
export interface SanitizedTransactionInput {
  userId: string
  amount: number
  currency: string
  description?: string
  category?: string
  fromAccountId?: string
  toAccountId?: string
  date?: Date
}

export function sanitizeTransactionInput(
  input: Partial<RawTransactionInput>
): SanitizedTransactionInput {
  const sanitized: SanitizedTransactionInput = {
    userId: sanitizeUserId(input.userId!),
    amount: sanitizeAmount(input.amount!),
    currency: sanitizeCurrency(input.currency!),
  }

  if (input.description) {
    sanitized.description = sanitizeDescription(input.description)
  }

  if (input.category) {
    sanitized.category = sanitizeText(input.category)
  }

  if (input.fromAccountId) {
    sanitized.fromAccountId = sanitizeName(input.fromAccountId)
  }

  if (input.toAccountId) {
    sanitized.toAccountId = sanitizeName(input.toAccountId)
  }

  if (input.date) {
    sanitized.date = sanitizeDate(input.date)
  }

  return sanitized
}

/**
 * Log potentially malicious input attempts
 */
export function detectMaliciousInput(input: string): boolean {
  const maliciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /eval\(/i,
    /expression\(/i,
    // SQL injection patterns
    /'\s*(or|and)\s*'/i, // ' OR ' or ' AND '
    /\bor\b\s*'?\s*'?\s*=\s*'?/i, // OR '1'='1' or OR 1=1
    /union\s+(all\s+)?select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /update\s+.*\s+set/i,
    /delete\s+from/i,
    /exec(ute)?\s*\(/i,
    /script\s*\(/i,
    /;\s*(drop|delete|update|insert)/i, // ; DROP TABLE
  ]

  for (const pattern of maliciousPatterns) {
    if (pattern.test(input)) {
      logger.warn("Potentially malicious input detected", {
        pattern: pattern.toString(),
        input: input.substring(0, 100), // Log only first 100 chars
      })
      return true
    }
  }

  return false
}
