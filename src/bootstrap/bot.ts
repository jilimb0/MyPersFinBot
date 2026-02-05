/**
 * Bot initialization module
 */

import TelegramBot from "node-telegram-bot-api"
import logger from "../logger"

export interface BotContext {
  bot: TelegramBot
}

/**
 * Create bot instance (minimal - just the bot itself)
 * Everything else (scheduler, commands, handlers, wizards) loaded later
 */
export async function createBot(token: string): Promise<BotContext> {
  // TODO: try to fix warning in future
  process.env.NTBA_FIX_350 = "1"

  const bot = new TelegramBot(token, { polling: true })
  logger.info("✅ Bot instance created")

  return { bot }
}

/**
 * Stop bot and cleanup
 */
export async function stopBot(context: BotContext): Promise<void> {
  const { bot } = context

  logger.info("⏳ Stopping bot...")
  await bot.stopPolling()
  logger.info("✅ Bot stopped")
}
