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
    await wizard.sendMessage(chatId, t(state.lang, 'errors.debtNotFound'))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  if (text === t(state.lang, 'debts.setDueDate') || text === t(state.lang, 'debts.changeDueDate')) {
    await wizard.goToStep(userId, "DEBT_EDIT_DUE_DATE", state.data)
    await wizard.sendMessage(
      chatId,
      `📅 ${text === t(state.lang, 'debts.setDueDate') ? "Set" : "Change"} Due Date\n\n` +
      `Enter new due date (DD.MM.YYYY)\n\n` +
      `Example: 31.12.2026\n\n` +
      (text === t(state.lang, 'debts.changeDueDate') ? "Or tap 🗑 Remove to delete due date.\n\n" : "") +
      "Or tap ⏭ Skip to cancel.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === t(state.lang, 'debts.changeDueDate') ? [{ text: t(state.lang, 'common.removeDate') }] : [],
            [{ text: "⏭ Skip" }],
            [{ text: t(state.lang, 'common.back') }, { text: t(state.lang, 'mainMenu.mainMenuButton') }],
          ].filter(row => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === t(state.lang, 'autoFeatures.disableReminders')) {
    // Логика отключения напоминаний
    await db.updateDebtDueDate(userId, debt.id, null)
    await wizard.sendMessage(
      chatId,
      t(state.lang, 'autoFeatures.remindersDisabled')
    )
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  if (text === t(state.lang, 'autoFeatures.enableAutoPayment') || text === t(state.lang, 'autoFeatures.disableAutoPayment')) {
    const enable = text === t(state.lang, 'autoFeatures.enableAutoPayment')
    // TODO: Implement auto-payment logic
    await wizard.sendMessage(
      chatId,
      `${enable ? t(state.lang, 'autoFeatures.autoPaymentEnabled') : t(state.lang, 'autoFeatures.autoPaymentDisabled')} (feature in development)`
    )
    return true
  }

  // По умолчанию возвращаемся к DEBT_MENU
  await wizard.goToStep(userId, "DEBT_MENU", state.data)
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
    await wizard.sendMessage(chatId, t(state.lang, 'errors.goalNotFound'))
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  // Обработка кнопок
  if (text === t(state.lang, 'autoFeatures.setDeadline') || text === t(state.lang, 'autoFeatures.changeDeadline')) {
    await wizard.goToStep(userId, "GOAL_EDIT_DEADLINE", state.data)
    await wizard.sendMessage(
      chatId,
      `📅 ${text === t(state.lang, 'autoFeatures.setDeadline') ? "Set" : "Change"} Deadline\n\n` +
      `Enter new deadline (DD.MM.YYYY)\n\n` +
      `Example: 31.12.2026\n\n` +
      (text === t(state.lang, 'autoFeatures.changeDeadline') ? "Or tap 🗑 Remove to delete deadline.\n\n" : "") +
      "Or tap ⏭ Skip to cancel.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === t(state.lang, 'autoFeatures.changeDeadline') ? [{ text: t(state.lang, 'common.removeDate') }] : [],
            [{ text: "⏭ Skip" }],
            [{ text: t(state.lang, 'common.back') }, { text: t(state.lang, 'mainMenu.mainMenuButton') }],
          ].filter(row => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === "🔕 Disable Reminders") {
    // Логика отключения напоминаний
    await db.updateGoalDeadline(userId, goal.id, null)
    await wizard.sendMessage(
      chatId,
      "✅ Reminders disabled and deadline removed."
    )
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  if (text === t(state.lang, 'autoFeatures.enableAutoDeposit') || text === t(state.lang, 'autoFeatures.disableAutoDeposit')) {
    const enable = text === t(state.lang, 'autoFeatures.enableAutoDeposit')
    // TODO: Implement auto-deposit logic
    await wizard.sendMessage(
      chatId,
      `${enable ? t(state.lang, 'autoFeatures.autoDepositEnabled') : t(state.lang, 'autoFeatures.autoDepositDisabled')} (feature in development)`
    )
    return true
  }

  // По умолчанию возвращаемся к GOAL_MENU
  await wizard.goToStep(userId, "GOAL_MENU", state.data)
  return false
}
