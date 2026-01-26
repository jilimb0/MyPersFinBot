import sanitizeHtml from "sanitize-html"
import validator from "validator"

/**
 * Sanitization utilities to prevent XSS and injection attacks
 */

/**
 * Sanitize user text input
 * Removes HTML tags and dangerous characters
 */
export function sanitizeText(input?: string): string {
  if (!input || typeof input !== "string") {
    return ""
  }

  // Remove HTML tags
  const noHtml = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  })

  // Escape special characters
  return validator.escape(noHtml.trim())
}

/**
 * Sanitize description (allows limited formatting)
 */
export function sanitizeDescription(
  input: string,
  maxLength: number = 500
): string {
  if (!input || typeof input !== "string") {
    return ""
  }

  // Allow basic formatting
  const sanitized = sanitizeHtml(input, {
    allowedTags: ["b", "i", "em", "strong"],
    allowedAttributes: {},
  })

  // Truncate to max length
  return sanitized.substring(0, maxLength).trim()
}

/**
 * Sanitize amount input
 * Ensures only valid number format
 */
export function sanitizeAmount(input: string): number | null {
  if (!input || typeof input !== "string") {
    return null
  }

  // Remove all non-numeric characters except dot and comma
  const cleaned = input.replace(/[^0-9.,]/g, "")

  // Replace comma with dot
  const normalized = cleaned.replace(",", ".")

  // Parse to float
  const amount = parseFloat(normalized)

  if (isNaN(amount) || !isFinite(amount)) {
    return null
  }

  return amount
}

/**
 * Sanitize category name
 */
export function sanitizeCategory(input: string): string {
  if (!input || typeof input !== "string") {
    return ""
  }

  // Remove HTML and special characters
  const sanitized = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  })

  // Only allow alphanumeric, spaces, and &
  return sanitized.replace(/[^a-zA-Z0-9 &]/g, "").trim()
}

/**
 * Sanitize account/person name
 */
export function sanitizeName(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== "string") {
    return ""
  }

  const sanitized = sanitizeText(input)
  return sanitized.substring(0, maxLength)
}

/**
 * Sanitize date string
 */
export function sanitizeDate(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null
  }

  // Check if valid date format
  if (!validator.isDate(input, { format: "YYYY-MM-DD", strictMode: true })) {
    return null
  }

  return input
}

/**
 * Sanitize currency code
 */
export function sanitizeCurrency(input: string): string {
  if (!input || typeof input !== "string") {
    return "USD"
  }

  // Only allow 3 uppercase letters
  const cleaned = input.toUpperCase().replace(/[^A-Z]/g, "")
  return cleaned.substring(0, 3) || "USD"
}

/**
 * Sanitize telegram user ID
 */
export function sanitizeUserId(input: string | number): string {
  if (typeof input === "number") {
    return input.toString()
  }

  if (typeof input !== "string") {
    return ""
  }

  // Only allow digits
  return input.replace(/[^0-9]/g, "")
}

/**
 * Deep sanitize object
 * Recursively sanitizes all string values in an object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key as keyof T] = sanitizeText(value) as any
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key as keyof T] = sanitizeObject(value)
    } else if (Array.isArray(value)) {
      result[key as keyof T] = value.map((item) =>
        typeof item === "string" ? sanitizeText(item) : item
      ) as any
    } else {
      result[key as keyof T] = value
    }
  }

  return result
}
