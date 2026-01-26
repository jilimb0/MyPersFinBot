/**
 * Security Module
 *
 * Provides:
 * - User whitelist/blacklist
 * - Rate limiting per user
 * - Security logging
 */

import TelegramBot from "node-telegram-bot-api"

// ==========================================
// CONFIGURATION
// ==========================================

/**
 * User Access Control
 *
 * Leave empty arrays to allow all users (default)
 * Add Telegram user IDs to restrict access
 */
export const SECURITY_CONFIG = {
  // Whitelist: Only these users can use the bot (empty = allow all)
  // Example: ['123456789', '987654321']
  ALLOWED_USERS: (process.env.ALLOWED_USERS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),

  // Blacklist: These users are blocked (even if in whitelist)
  // Example: ['111111111', '222222222']
  BLOCKED_USERS: (process.env.BLOCKED_USERS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),

  // Rate limiting
  RATE_LIMIT: {
    enabled: process.env.RATE_LIMIT_ENABLED === "true" || false,
    maxMessages: parseInt(process.env.RATE_LIMIT_MAX_MESSAGES || "30"),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
  },

  // Security logging
  LOG_UNAUTHORIZED_ACCESS:
    process.env.LOG_UNAUTHORIZED_ACCESS === "true" || true,
}

// ==========================================
// USER ACCESS CONTROL
// ==========================================

/**
 * Check if user is allowed to use the bot
 */
export function isUserAllowed(userId: string): boolean {
  // Check blacklist first
  if (SECURITY_CONFIG.BLOCKED_USERS.includes(userId)) {
    return false
  }

  // If whitelist is empty, allow everyone
  if (SECURITY_CONFIG.ALLOWED_USERS.length === 0) {
    return true
  }

  // Check whitelist
  return SECURITY_CONFIG.ALLOWED_USERS.includes(userId)
}

/**
 * Send unauthorized access message
 */
export function sendUnauthorizedMessage(
  bot: TelegramBot,
  chatId: number,
  userId: string
) {
  bot.sendMessage(
    chatId,
    "🚫 *Access Denied*\n\n" +
      "You are not authorized to use this bot.\n\n" +
      `Your ID: ${userId}`,
    { parse_mode: "Markdown" }
  )
  if (SECURITY_CONFIG.LOG_UNAUTHORIZED_ACCESS) {
    console.warn(`🚫 Unauthorized access attempt from user ${userId}`)
  }
}

// ==========================================
// RATE LIMITING
// ==========================================

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Check if user exceeded rate limit
 */
export function isRateLimited(userId: string): boolean {
  if (!SECURITY_CONFIG.RATE_LIMIT.enabled) {
    return false
  }

  const now = Date.now()
  const entry = rateLimitStore.get(userId)

  // No entry or expired - create new
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT.windowMs,
    })
    return false
  }

  // Increment counter
  entry.count++

  // Check limit
  if (entry.count > SECURITY_CONFIG.RATE_LIMIT.maxMessages) {
    return true
  }

  return false
}

/**
 * Send rate limit exceeded message
 */
export function sendRateLimitMessage(
  bot: TelegramBot,
  chatId: number,
  userId: string
) {
  const entry = rateLimitStore.get(userId)
  const waitSeconds = entry
    ? Math.ceil((entry.resetTime - Date.now()) / 1000)
    : 60

  bot.sendMessage(
    chatId,
    "⏱ *Rate Limit Exceeded*\n\n" +
      `Too many requests.Please wait ${waitSeconds} seconds.`,
    { parse_mode: "Markdown" }
  )

  console.warn(`⏱ Rate limit exceeded for user ${userId}`)
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits() {
  const now = Date.now()
  for (const [userId, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(userId)
    }
  }
}

// Clean up every 5 minutes
if (SECURITY_CONFIG.RATE_LIMIT.enabled) {
  setInterval(cleanupRateLimits, 5 * 60 * 1000)
}

/**
 * Security middleware for message handling
 *
 * @returns true if message should be processed, false if blocked
 */
export function securityCheck(
  bot: TelegramBot,
  msg: TelegramBot.Message
): boolean {
  const chatId = msg.chat.id
  const userId = msg.from?.id.toString() || ""

  // Check user access
  if (!isUserAllowed(userId)) {
    sendUnauthorizedMessage(bot, chatId, userId)
    return false
  }

  // Check rate limit
  if (isRateLimited(userId)) {
    sendRateLimitMessage(bot, chatId, userId)
    return false
  }

  return true
}
