/**
 * Budget Planner message handlers
 */

import { MessageHandler } from "./types"
import * as menus from "../../menus-i18n"

/**
 * Handle budget planner menu button
 */
export const handleBudgetMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context

  await menus.showBudgetMenu(wizardManager, chatId, userId, lang)
}
