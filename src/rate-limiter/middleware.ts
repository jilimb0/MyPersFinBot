/**
 * Rate limiter middleware for Telegram bot
 */

import TelegramBot from "node-telegram-bot-api"
import { rateLimiter } from "./rate-limiter.service"
import logger from "../logger"
import { RateLimitResult } from "./types"

/**
 * Rate limiter middleware
 */
export function rateLimiterMiddleware(
  bot: TelegramBot,
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
        await handleRateLimitExceeded(bot, msg, result)

        // Log the event
        logger.warn("Rate limit exceeded for user", {
          userId,
          chatId: msg.chat.id,
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
        await handleCallbackQueryRateLimit(bot, query, result)

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
  bot: TelegramBot,
  msg: TelegramBot.Message,
  result: RateLimitResult
): Promise<void> {
  const retryAfter = result.retryAfter || 60
  const minutes = Math.ceil(retryAfter / 60)

  const message =
    `⚠️ Вы отправляете слишком много сообщений.\n\n` +
    `Пожалуйста, подождите ${minutes} ${getMinutesWord(minutes)} перед следующей командой.\n\n` +
    `Это помогает предотвратить спам и защищает бота от перегрузки.`

  try {
    await bot.sendMessage(msg.chat.id, message)
  } catch (error) {
    logger.error("Error sending rate limit message", error, {
      chatId: msg.chat.id,
    })
  }
}

/**
 * Handle rate limit exceeded for callback query
 */
async function handleCallbackQueryRateLimit(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  result: RateLimitResult
): Promise<void> {
  const retryAfter = result.retryAfter || 60
  const minutes = Math.ceil(retryAfter / 60)

  const message = `⚠️ Слишком много действий. Подождите ${minutes} ${getMinutesWord(minutes)}.`

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
function getMinutesWord(minutes: number): string {
  if (minutes === 1) return "минуту"
  if (minutes >= 2 && minutes <= 4) return "минуты"
  return "минут"
}

/**
 * Create rate limit status message
 */
export async function getRateLimitStatus(userId: string): Promise<string> {
  try {
    const info = await rateLimiter.getInfo(userId)
    const config = rateLimiter.getConfig()

    if (info.blocked) {
      const minutesLeft = Math.ceil(
        (info.blockedUntil!.getTime() - Date.now()) / 60000
      )
      return (
        `🚫 Вы временно заблокированы за превышение лимита.\n` +
        `⏰ Осталось: ${minutesLeft} ${getMinutesWord(minutesLeft)}`
      )
    }

    const remaining = config.maxRequests - info.count
    const resetIn = Math.ceil((info.resetAt.getTime() - Date.now()) / 60000)

    return (
      `📊 Статус лимита:\n\n` +
      `✅ Доступно команд: ${remaining}/${config.maxRequests}\n` +
      `⏰ Сброс через: ${resetIn} ${getMinutesWord(resetIn)}`
    )
  } catch (error) {
    logger.error("Error getting rate limit status", error, { userId })
    return "❌ Не удалось получить информацию о лимите."
  }
}
