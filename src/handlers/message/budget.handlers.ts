/**
 * Budget Planner message handlers
 */

import * as menus from "../../menus-i18n"
import type { MessageHandler } from "./types"

/**
 * Handle budget planner menu button
 */
export const handleBudgetMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context

  await menus.showBudgetMenu(wizardManager, chatId, userId, lang)
  return true
}
