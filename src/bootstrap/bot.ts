/**
 * Bot initialization module
 */

import type TelegramBot from "@telegram-api"
import { config } from "../config"
import logger from "../logger"
import { TelegramBotTGWrapperAdapter } from "../telegram/tgwrapper-adapter"

export interface BotContext {
  bot: TelegramBot
}

/**
 * Create bot instance (minimal - just the bot itself)
 * Everything else (scheduler, commands, handlers, wizards) loaded later
 */
export async function createBot(token: string): Promise<BotContext> {
  const bot = new TelegramBotTGWrapperAdapter(token, { polling: true })
  await bot.launch()
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Bot instance created")
  }

  return { bot: bot as unknown as TelegramBot }
}

/**
 * Stop bot and cleanup
 */
export async function stopBot(context: BotContext): Promise<void> {
  const { bot } = context

  if (config.LOG_BOOT_DETAIL) {
    logger.info("⏳ Stopping bot...")
  }
  await bot.stopPolling()
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Bot stopped")
  }
}
