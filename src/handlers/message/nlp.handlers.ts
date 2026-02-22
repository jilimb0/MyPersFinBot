/**
 * Natural Language Processing handlers
 * Handles inputs like "100 food", "потратил 500", etc.
 */

import type TelegramBot from "@telegram-api"
import * as handlers from "../../handlers"
import type { WizardManager } from "../../wizards/wizards"

/**
 * Check if text is NLP input
 */
export function isNLPInput(text: string): boolean {
  return (
    /^\d+\s+\w+/.test(text) ||
    /потратил|витратив|spent|получил|отримав|received|зарплата/i.test(text)
  )
}

/**
 * Handle NLP input
 */
export async function handleNLPInput(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string,
  wizardManager: WizardManager
): Promise<void> {
  await handlers.handleNLPInput(bot, chatId, userId, text, wizardManager)
}
