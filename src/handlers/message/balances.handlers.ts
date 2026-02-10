/**
 * Balances message handlers
 */

import { t } from "../../i18n"
import * as menus from "../../menus-i18n"
import type { MessageHandler } from "./types"

/**
 * Handle balances menu button
 */
export const handleBalancesMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "BALANCE_LIST",
    data: {},
    returnTo: "balances",
    lang,
  })

  await menus.showBalancesMenu(wizardManager, chatId, userId, lang)
  return true
}

/**
 * Handle "Add Balance" button
 */
export const handleAddBalance: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "BALANCE_NAME",
    data: {},
    returnTo: "balances",
    lang,
  })

  await bot.sendMessage(
    chatId,
    `${t(lang, "balances.addTitle")}\n\n${t(lang, "balances.enterName")}`,
    {
      parse_mode: "Markdown",
      ...wizardManager.getBackButton(lang),
    }
  )
  return true
}
