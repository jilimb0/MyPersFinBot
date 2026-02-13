import { dbStorage as db } from "../database/storage-db"
import { resolveLanguage, t } from "../i18n"
import { showDebtsMenu, showGoalsMenu } from "../menus-i18n"
import type { Debt, Goal } from "../types"
import type { WizardManager } from "../wizards/wizards"

export async function handleDebtAdvancedMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)
  const debt = state?.data?.debt as Debt | undefined

  if (!debt) {
    await wizard.sendMessage(chatId, t(lang, "errors.debtNotFound"))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  if (
    text === t(lang, "debts.setDueDate") ||
    text === t(lang, "debts.changeDueDate")
  ) {
    await wizard.goToStep(userId, "DEBT_EDIT_DUE_DATE", state?.data)
    await wizard.sendMessage(
      chatId,
      t(lang, "wizard.debt.dueDatePrompt", {
        mode:
          text === t(lang, "debts.setDueDate")
            ? t(lang, "wizard.debt.dueDateSetTitle")
            : t(lang, "wizard.debt.dueDateChangeTitle"),
      }),
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === t(lang, "debts.changeDueDate")
              ? [{ text: t(lang, "common.removeDate") }]
              : [],
            [{ text: t(lang, "common.skip") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ].filter((row) => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === t(lang, "debts.disableReminders")) {
    // Логика отключения напоминаний
    await db.updateDebtDueDate(userId, debt.id, null)
    await wizard.sendMessage(chatId, t(lang, "wizard.debt.remindersRemoved"))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  if (
    text === t(lang, "autoFeatures.enableAutoPayment") ||
    text === t(lang, "autoFeatures.disableAutoPayment")
  ) {
    const enable = text === t(lang, "autoFeatures.enableAutoPayment")
    // TODO: Implement auto-payment logic
    await wizard.sendMessage(
      chatId,
      `${enable ? t(lang, "autoFeatures.autoPaymentEnabled") : t(lang, "autoFeatures.autoPaymentDisabled")} ${t(lang, "common.featureInDevelopmentSuffix")}`
    )
    return true
  }

  // По умолчанию возвращаемся к DEBT_MENU
  await wizard.goToStep(userId, "DEBT_MENU", state?.data)
  return false
}

/**
 * Обработчик для GOAL_ADVANCED_MENU
 */
export async function handleGoalAdvancedMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)
  const goal = state?.data?.goal as Goal | undefined

  if (!goal) {
    await wizard.sendMessage(chatId, t(lang, "errors.goalNotFound"))
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  // Обработка кнопок
  if (
    text === t(lang, "autoFeatures.setDeadline") ||
    text === t(lang, "autoFeatures.changeDeadline")
  ) {
    await wizard.goToStep(userId, "GOAL_EDIT_DEADLINE", state?.data)
    await wizard.sendMessage(
      chatId,
      t(lang, "wizard.goal.deadlinePrompt", {
        mode:
          text === t(lang, "autoFeatures.setDeadline")
            ? t(lang, "wizard.goal.deadlineSetTitle")
            : t(lang, "wizard.goal.deadlineChangeTitle"),
      }),
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === t(lang, "autoFeatures.changeDeadline")
              ? [{ text: t(lang, "common.removeDate") }]
              : [],
            [{ text: t(lang, "common.skip") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ].filter((row) => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === t(lang, "goals.disableReminders")) {
    // Логика отключения напоминаний
    await db.updateGoalDeadline(userId, goal.id, null)
    await wizard.sendMessage(chatId, t(lang, "wizard.goal.deadlineRemoved"))
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  if (
    text === t(lang, "autoFeatures.enableAutoDeposit") ||
    text === t(lang, "autoFeatures.disableAutoDeposit")
  ) {
    const enable = text === t(lang, "autoFeatures.enableAutoDeposit")
    // TODO: Implement auto-deposit logic
    await wizard.sendMessage(
      chatId,
      `${enable ? t(lang, "autoFeatures.autoDepositEnabled") : t(lang, "autoFeatures.autoDepositDisabled")} ${t(lang, "common.featureInDevelopmentSuffix")}`
    )
    return true
  }

  // По умолчанию возвращаемся к GOAL_MENU
  await wizard.goToStep(userId, "GOAL_MENU", state?.data)
  return false
}
