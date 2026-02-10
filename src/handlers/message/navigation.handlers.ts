/**
 * Navigation handlers (Back, Cancel, Main Menu)
 */

import { t } from "../../i18n"
import { getMainMenuKeyboard, getSettingsKeyboard } from "../../i18n/keyboards"
import * as menus from "../../menus-i18n"
import type { MessageHandler } from "./types"

/**
 * Handle Back button
 */
export const handleBack: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  const state = wizardManager.getState(userId)
  const returnTo = state?.returnTo

  // Clear wizard state
  wizardManager.clearState(userId)

  // Return to appropriate menu based on returnTo
  switch (returnTo) {
    case "balances":
      await menus.showBalancesMenu(wizardManager, chatId, userId, lang)
      break

    case "debts":
      await menus.showDebtsMenu(bot, chatId, userId, lang)
      break

    case "goals":
      await menus.showGoalsMenu(bot, chatId, userId, lang)
      break

    case "settings": {
      const currentCurrency = await context.db.getDefaultCurrency(userId)
      await bot.sendMessage(
        chatId,
        `${t(lang, "settings.title")}\n\n${t(lang, "settings.currentCurrency")} ${currentCurrency}\n\n${t(lang, "settings.manageConfig")}`,
        {
          parse_mode: "Markdown",
          reply_markup: getSettingsKeyboard(lang),
        }
      )
      break
    }

    case "automation":
      await menus.showAutomationMenu(wizardManager, chatId, userId, lang)
      break

    case "advanced":
      await menus.showAdvancedMenu(wizardManager, chatId, userId, lang)
      break
    default:
      await bot.sendMessage(
        chatId,
        t(lang, "mainMenu.welcomeBack"),
        getMainMenuKeyboard(lang)
      )
      break
  }
  return true
}

/**
 * Handle Cancel button
 */
export const handleCancel: MessageHandler = async (context) => {
  const { bot, chatId, lang } = context

  await bot.sendMessage(chatId, t(lang, "common.cancelled"), {
    reply_markup: getSettingsKeyboard(lang),
  })
  return true
}

/**
 * Handle "No, Cancel" button
 */
export const handleNoCancel: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  await bot.sendMessage(chatId, t(lang, "common.cancelled"))
  await menus.showAdvancedMenu(wizardManager, chatId, userId, lang)
  return true
}

/**
 * Handle Main Menu button
 */
export const handleMainMenu: MessageHandler = async (context) => {
  const { bot, chatId, lang, wizardManager, userId } = context

  // Clear wizard state
  wizardManager.clearState(userId)

  await bot.sendMessage(
    chatId,
    t(lang, "mainMenu.welcomeBack"),
    getMainMenuKeyboard(lang)
  )
  return true
}
