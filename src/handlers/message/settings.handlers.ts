/**
 * Settings message handlers
 */

import { MessageHandler } from "./types"
import { t } from "../../i18n"
import { getSettingsKeyboard } from "../../i18n/keyboards"
import { Debt, Goal } from "../../types"

/**
 * Handle settings menu button
 */
export const handleSettingsMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context

  const currentCurrency = await db.getDefaultCurrency(userId)
  const state = wizardManager.getState(userId)

  // Special handling for Goal advanced settings
  if (state?.step === "GOAL_MENU" && state?.data?.goal) {
    const goal = state.data.goal as Goal
    const { deadline, autoDeposit } = goal

    await wizardManager.goToStep(userId, "GOAL_ADVANCED_MENU", state.data)

    await bot.sendMessage(
      chatId,
      `${t(lang, "advanced.title")}\n\n${goal.name}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: deadline
            ? [
                [{ text: t(lang, "goals.changeDeadlineBtn") }],
                [{ text: t(lang, "debts.disableReminders") }],
                [
                  {
                    text: autoDeposit?.enabled
                      ? t(lang, "goals.disableAutoDeposit")
                      : t(lang, "goals.enableAutoDeposit"),
                  },
                ],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ]
            : [
                [{ text: t(lang, "goals.setDeadlineBtn") }],
                [
                  {
                    text: autoDeposit?.enabled
                      ? t(lang, "goals.disableAutoDeposit")
                      : t(lang, "goals.enableAutoDeposit"),
                  },
                ],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ],
          resize_keyboard: true,
        },
      }
    )
    return
  }

  // Special handling for Debt advanced settings
  if (state?.step === "DEBT_MENU" && state?.data?.debt) {
    const debt = state.data.debt as Debt
    const { dueDate, autoPayment } = debt

    await wizardManager.goToStep(userId, "DEBT_ADVANCED_MENU", state.data)

    await bot.sendMessage(
      chatId,
      `${t(lang, "advanced.title")}\n\n${debt.name}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: dueDate
            ? [
                [{ text: `${t(lang, "debts.changeDueDate")}` }],
                [{ text: t(lang, "debts.disableReminders") }],
                [
                  {
                    text: autoPayment?.enabled
                      ? t(lang, "debts.disableAutoPayment")
                      : t(lang, "debts.enableAutoPayment"),
                  },
                ],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ]
            : [
                [{ text: `${t(lang, "debts.setDueDate")}` }],
                [
                  {
                    text: autoPayment?.enabled
                      ? t(lang, "debts.disableAutoPayment")
                      : t(lang, "debts.enableAutoPayment"),
                  },
                ],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ],
          resize_keyboard: true,
        },
      }
    )
    return
  }

  // Default settings menu
  await bot.sendMessage(
    chatId,
    `${t(lang, "settings.title")}\n\n${t(lang, "settings.currentCurrency")} ${currentCurrency}\n\n${t(lang, "settings.manageConfig")}`,
    {
      parse_mode: "Markdown",
      reply_markup: getSettingsKeyboard(lang),
    }
  )
}
