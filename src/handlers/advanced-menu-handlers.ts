import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { Debt, Goal } from "../types"
import { showDebtsMenu, showGoalsMenu } from "../menus"

export async function handleDebtAdvancedMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  const debt = state?.data?.debt as Debt | undefined

  if (!debt) {
    await wizard.sendMessage(chatId, "❌ Debt not found.")
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  if (text === "📅 Set Due Date" || text === "📅 Change Due Date") {
    await wizard.goToStep(userId, "DEBT_EDIT_DUE_DATE", state.data)
    await wizard.sendMessage(
      chatId,
      `📅 ${text === "📅 Set Due Date" ? "Set" : "Change"} Due Date\n\n` +
      `Enter new due date (DD.MM.YYYY)\n\n` +
      `Example: 31.12.2026\n\n` +
      (text === "📅 Change Due Date" ? "Or tap 🗑 Remove to delete due date.\n\n" : "") +
      "Or tap ⏭ Skip to cancel.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === "📅 Change Due Date" ? [{ text: "🗑 Remove Date" }] : [],
            [{ text: "⏭ Skip" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ].filter(row => row.length > 0),
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === "🔕 Disable Reminders") {
    // Логика отключения напоминаний
    await db.updateDebtDueDate(userId, debt.id, null)
    await wizard.sendMessage(
      chatId,
      "✅ Reminders disabled and due date removed."
    )
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  if (text === "✅ Enable Auto-Payment" || text === "❌ Disable Auto-Payment") {
    const enable = text === "✅ Enable Auto-Payment"
    // TODO: Implement auto-payment logic
    await wizard.sendMessage(
      chatId,
      `${enable ? "✅ Auto-payment enabled" : "❌ Auto-payment disabled"} (feature in development)`
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
    await wizard.sendMessage(chatId, "❌ Goal not found.")
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  // Обработка кнопок
  if (text === "📅 Set Deadline" || text === "📅 Change Deadline") {
    await wizard.goToStep(userId, "GOAL_EDIT_DEADLINE", state.data)
    await wizard.sendMessage(
      chatId,
      `📅 ${text === "📅 Set Deadline" ? "Set" : "Change"} Deadline\n\n` +
      `Enter new deadline (DD.MM.YYYY)\n\n` +
      `Example: 31.12.2026\n\n` +
      (text === "📅 Change Deadline" ? "Or tap 🗑 Remove to delete deadline.\n\n" : "") +
      "Or tap ⏭ Skip to cancel.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            text === "📅 Change Deadline" ? [{ text: "🗑 Remove Date" }] : [],
            [{ text: "⏭ Skip" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
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
    await showGoalsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  if (text === "✅ Enable Auto-Deposit" || text === "❌ Disable Auto-Deposit") {
    const enable = text === "✅ Enable Auto-Deposit"
    // TODO: Implement auto-deposit logic
    await wizard.sendMessage(
      chatId,
      `${enable ? "✅ Auto-deposit enabled" : "❌ Auto-deposit disabled"} (feature in development)`
    )
    return true
  }

  // По умолчанию возвращаемся к GOAL_MENU
  await wizard.goToStep(userId, "GOAL_MENU", state.data)
  return false
}
