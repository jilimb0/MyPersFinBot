import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { Debt, Goal } from "../types"
import { showDebtsMenu, showGoalsMenu } from "../menus-i18n"
import { t } from "../i18n"

export async function handleDebtAdvancedMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  const debt = state?.data?.debt as Debt | undefined

  if (!debt) {
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "errors.debtNotFound")
    )
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  if (
    text === t(state?.lang || "en", "debts.setDueDate") ||
    text === t(state?.lang || "en", "debts.changeDueDate")
  ) {
    await wizard.goToStep(userId, "DEBT_EDIT_DUE_DATE", state?.data)
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "wizard.debt.dueDatePrompt", {
        mode:
          text === t(state?.lang || "en", "debts.setDueDate")
            ? t(state?.lang || "en", "wizard.debt.dueDateSetTitle")
            : t(state?.lang || "en", "wizard.debt.dueDateChangeTitle"),
      }),
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === t(state?.lang || "en", "debts.changeDueDate")
              ? [{ text: t(state?.lang || "en", "common.removeDate") }]
              : [],
            [{ text: t(state?.lang || "en", "common.skip") }],
            [
              { text: t(state?.lang || "en", "common.back") },
              { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
            ],
          ].filter((row) => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === t(state?.lang || "en", "debts.disableReminders")) {
    // Логика отключения напоминаний
    await db.updateDebtDueDate(userId, debt.id, null)
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "wizard.debt.remindersRemoved")
    )
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  if (
    text === t(state?.lang || "en", "autoFeatures.enableAutoPayment") ||
    text === t(state?.lang || "en", "autoFeatures.disableAutoPayment")
  ) {
    const enable =
      text === t(state?.lang || "en", "autoFeatures.enableAutoPayment")
    // TODO: Implement auto-payment logic
    await wizard.sendMessage(
      chatId,
      `${enable ? t(state?.lang || "en", "autoFeatures.autoPaymentEnabled") : t(state?.lang || "en", "autoFeatures.autoPaymentDisabled")} ${t(state?.lang || "en", "common.featureInDevelopmentSuffix")}`
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
  const goal = state?.data?.goal as Goal | undefined

  if (!goal) {
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "errors.goalNotFound")
    )
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  // Обработка кнопок
  if (
    text === t(state?.lang || "en", "autoFeatures.setDeadline") ||
    text === t(state?.lang || "en", "autoFeatures.changeDeadline")
  ) {
    await wizard.goToStep(userId, "GOAL_EDIT_DEADLINE", state?.data)
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "wizard.goal.deadlinePrompt", {
        mode:
          text === t(state?.lang || "en", "autoFeatures.setDeadline")
            ? t(state?.lang || "en", "wizard.goal.deadlineSetTitle")
            : t(state?.lang || "en", "wizard.goal.deadlineChangeTitle"),
      }),
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === t(state?.lang || "en", "autoFeatures.changeDeadline")
              ? [{ text: t(state?.lang || "en", "common.removeDate") }]
              : [],
            [{ text: t(state?.lang || "en", "common.skip") }],
            [
              { text: t(state?.lang || "en", "common.back") },
              { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
            ],
          ].filter((row) => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === t(state?.lang || "en", "goals.disableReminders")) {
    // Логика отключения напоминаний
    await db.updateGoalDeadline(userId, goal.id, null)
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "wizard.goal.deadlineRemoved")
    )
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  if (
    text === t(state?.lang || "en", "autoFeatures.enableAutoDeposit") ||
    text === t(state?.lang || "en", "autoFeatures.disableAutoDeposit")
  ) {
    const enable =
      text === t(state?.lang || "en", "autoFeatures.enableAutoDeposit")
    // TODO: Implement auto-deposit logic
    await wizard.sendMessage(
      chatId,
      `${enable ? t(state?.lang || "en", "autoFeatures.autoDepositEnabled") : t(state?.lang || "en", "autoFeatures.autoDepositDisabled")} ${t(state?.lang || "en", "common.featureInDevelopmentSuffix")}`
    )
    return true
  }

  // По умолчанию возвращаемся к GOAL_MENU
  await wizard.goToStep(userId, "GOAL_MENU", state?.data)
  return false
}
