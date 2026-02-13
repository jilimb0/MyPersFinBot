/**
 * Message handler types
 */

import type TelegramBot from "node-telegram-bot-api"
import type { dbStorage } from "../../database/storage-db"
import type { Language } from "../../i18n"
import type { WizardManager } from "../../wizards/wizards"

/**
 * Message handler context
 */
export interface MessageContext {
  bot: TelegramBot
  msg: TelegramBot.Message
  chatId: number
  userId: string
  text: string
  lang: Language
  wizardManager: WizardManager
  db: typeof dbStorage
}

/**
 * Message handler function
 * Returns boolean to indicate if message was handled,
 * or undefined for fire-and-forget handlers
 */
export type MessageHandler = (
  context: MessageContext
) => Promise<boolean | undefined>

/**
 * Message route
 */
export interface MessageRoute {
  /**
   * Pattern to match against message text
   * Can be:
   * - string (exact match)
   * - RegExp (regex match)
   * - function (custom matcher)
   */
  pattern: string | RegExp | ((text: string, lang: Language) => boolean)

  /**
   * Handler function
   */
  handler: MessageHandler

  /**
   * Description for debugging
   */
  description?: string
}
