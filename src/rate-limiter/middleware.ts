/**
 * Rate limiter middleware for Telegram bot
 */

import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { dbStorage as db } from "../database/storage-db"
import { type Language, t } from "../i18n"
import logger from "../logger"
import { rateLimiter } from "./rate-limiter.service"
import type { RateLimitResult } from "./types"

/**
 * Rate limiter middleware
 */
export function rateLimiterMiddleware(
  bot: BotClient,
  adminUserIds: string[] = []
): void {
  // Track processed message IDs to avoid duplicate checks
  const processedMessages = new Set<string>()

  // Intercept all messages
  bot.on("message", async (msg) => {
    const userId = msg.from?.id.toString()
    const messageId = msg.message_id.toString()

    if (!userId) return

    // Skip if already processed
    if (processedMessages.has(messageId)) return
    processedMessages.add(messageId)

    // Clean old entries (keep last 1000)
    if (processedMessages.size > 1000) {
      const toDelete = Array.from(processedMessages).slice(0, 500)
      toDelete.forEach((id) => processedMessages.delete(id))
    }

    const isAdmin = adminUserIds.includes(userId)

    try {
      const result = await rateLimiter.checkLimit(userId, isAdmin)

      if (!result.allowed) {
        const lang = await resolveUserLanguage(userId)
        await handleRateLimitExceeded(bot, msg, result, lang)

        // Log the event
        logger.warn("Rate limit exceeded for user", {
          userId,
          chatId: msg.chat.id.toString(),
          remaining: result.remaining,
          retryAfter: result.retryAfter,
        })
      }
    } catch (error) {
      logger.error("Rate limiter middleware error", error, { userId })
      // On error, allow the message through (fail open)
    }
  })

  // Intercept callback queries
  bot.on("callback_query", async (query) => {
    const userId = query.from.id.toString()
    const queryId = query.id

    const isAdmin = adminUserIds.includes(userId)

    try {
      const result = await rateLimiter.checkLimit(userId, isAdmin)

      if (!result.allowed) {
        const lang = await resolveUserLanguage(userId)
        await handleCallbackQueryRateLimit(bot, query, result, lang)

        logger.warn("Rate limit exceeded for callback query", {
          userId,
          queryId,
          remaining: result.remaining,
          retryAfter: result.retryAfter,
        })
      }
    } catch (error) {
      logger.error("Rate limiter callback query error", error, { userId })
    }
  })

  logger.info("Rate limiter middleware initialized", {
    enabled: rateLimiter.getConfig().enabled,
    maxRequests: rateLimiter.getConfig().maxRequests,
    windowMs: rateLimiter.getConfig().windowMs,
  })
}

/**
 * Handle rate limit exceeded for message
 */
async function handleRateLimitExceeded(
  bot: BotClient,
  msg: Tg.Message,
  result: RateLimitResult,
  lang: Language
): Promise<void> {
  const retryAfter = result.retryAfter || 60
  const minutes = Math.ceil(retryAfter / 60)

  const message = t(lang, "rateLimiter.tooManyMessages", {
    minutes,
    minutesLabel: t(lang, "rateLimiter.minutesLabel"),
  })

  try {
    await bot.sendMessage(msg.chat.id, message)
  } catch (error) {
    logger.error("Error sending rate limit message", error, {
      chatId: msg.chat.id.toString(),
    })
  }
}

/**
 * Handle rate limit exceeded for callback query
 */
async function handleCallbackQueryRateLimit(
  bot: BotClient,
  query: Tg.CallbackQuery,
  result: RateLimitResult,
  lang: Language
): Promise<void> {
  const retryAfter = result.retryAfter || 60
  const minutes = Math.ceil(retryAfter / 60)

  const message = t(lang, "rateLimiter.tooManyActions", {
    minutes,
    minutesLabel: t(lang, "rateLimiter.minutesLabel"),
  })

  try {
    await bot.answerCallbackQuery(query.id, {
      text: message,
      show_alert: true,
    })
  } catch (error) {
    logger.error("Error answering callback query rate limit", error, {
      queryId: query.id,
    })
  }
}

/**
 * Get correct word form for minutes in Russian
 */
async function resolveUserLanguage(userId: string): Promise<Language> {
  try {
    return await db.getUserLanguage(userId)
  } catch {
    return "en"
  }
}

/**
 * Create rate limit status message
 */
export async function getRateLimitStatus(userId: string): Promise<string> {
  const lang = await resolveUserLanguage(userId)
  try {
    const info = await rateLimiter.getInfo(userId)
    const config = rateLimiter.getConfig()

    if (info.blocked && info.blockedUntil) {
      const minutesLeft = Math.ceil(
        (info.blockedUntil.getTime() - Date.now()) / 60000
      )
      return t(lang, "rateLimiter.blocked", {
        minutes: minutesLeft,
        minutesLabel: t(lang, "rateLimiter.minutesLabel"),
      })
    }

    const remaining = config.maxRequests - info.count
    const resetIn = Math.ceil((info.resetAt.getTime() - Date.now()) / 60000)

    return t(lang, "rateLimiter.status", {
      remaining,
      max: config.maxRequests,
      minutes: resetIn,
      minutesLabel: t(lang, "rateLimiter.minutesLabel"),
    })
  } catch (error) {
    logger.error("Error getting rate limit status", error, { userId })
    return t(lang, "rateLimiter.statusError")
  }
}
