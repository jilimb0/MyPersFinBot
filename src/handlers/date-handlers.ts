import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { showDebtsMenu, showGoalsMenu, showIncomeSourcesMenu } from "../menus-i18n"
import { reminderManager } from "../services/reminder-manager"
import { AppDataSource } from "../database/data-source"
import { Debt as DebtEntity } from "../database/entities/Debt"
import { Goal as GoalEntity } from "../database/entities/Goal"
import { IncomeSource as IncomeSourceEntity } from "../database/entities/IncomeSource"
import { formatMoney } from "../utils"
import { randomUUID } from "crypto"
import dayjs from "dayjs"
import { t } from "../i18n"

// Helper function to parse DD.MM.YYYY format
function parseDateDDMMYYYY(text: string): Date | null {
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) return null

  const [, day, month, year] = match
  const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)

  if (isNaN(date.getTime())) return null
  return date
}

export async function handleDebtDueDate(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const { name, amount, currency, type: debtType, lang } = state.data

  if (!name || !amount || !currency || !debtType) {
    await wizard.sendMessage(chatId, t(lang, 'errors.missingDebtData'))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  let dueDate: Date | undefined

  // Check if user wants to skip
  if (text === t(lang, 'common.skip')) {
    dueDate = undefined
  } else {
    // Parse date DD.MM.YYYY
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (!match) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'errors.invalidDateFormat'),
        {
          reply_markup: {
            keyboard: [
              [{ text: "⏩ Skip" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }

    const [, day, month, year] = match
    dueDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)

    if (isNaN(dueDate.getTime())) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'errors.invalidDateShort'),
        wizard.getBackButton(lang)
      )
      return true
    }

    // Check if date is in the past
    if (dueDate < new Date()) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'errors.pastDateWarning'),
        {
          reply_markup: {
            keyboard: [
              [{ text: t(lang, 'common.yes') }, { text: t(lang, 'common.no') }],
              [{ text: "⬅️ Back" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      await wizard.goToStep(userId, "DEBT_CONFIRM_PAST_DATE", { ...state.data, dueDate })
      return true
    }
  }

  // Create debt
  const debtId = randomUUID()
  await db.addDebt(userId, {
    id: debtId,
    name,
    amount,
    currency,
    counterparty: name,
    type: debtType,
    paidAmount: 0,
    isPaid: false,
  })

  // Update debt with dueDate if provided
  if (dueDate) {
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    await debtRepo.update({ id: debtId }, { dueDate })

    // Create reminder
    try {
      const debtEntity = await debtRepo.findOne({ where: { id: debtId, userId } })
      if (debtEntity) {
        await reminderManager.createDebtReminder(userId, debtEntity)
      }
    } catch (error) {
      console.error("Failed to create debt reminder:", error)
    }
  }

  const emoji = debtType === "I_OWE" ? "🔴" : "🟢"
  const action = debtType === "I_OWE" ? "owe to" : "are owed by"
  const dueDateText = dueDate
    ? `\nDue: ${dueDate.toLocaleDateString("en-GB")} 📅`
    : ""

  await wizard.sendMessage(
    chatId,
    `✅ ${emoji} Debt added!\n\n` +
    `You ${action} *${name}*: ${formatMoney(amount, currency)}${dueDateText}`,
    { parse_mode: "Markdown" }
  )

  wizard.clearState(userId)
  await showDebtsMenu(wizard.getBot(), chatId, userId, state.lang)
  return true
}

export async function handleDebtDueDateEdit(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt) return false

  const lang = state.lang || 'en';
  const debt = state.data.debt
  const parsed = parseDateDDMMYYYY(text)

  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      t(lang, 'dates.invalidFormatExample'),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (dayjs(parsed).isBefore(dayjs(), 'day')) {
    await wizard.sendMessage(
      chatId,
      t(lang, 'dates.pastDateWarningAlt'),
      {
        reply_markup: {
          keyboard: [
            [{ text: t(lang, 'common.yes') }, { text: t(lang, 'common.no') }],
          ],
          resize_keyboard: true,
        },
      }
    )
    wizard.setState(userId, {
      ...state,
      data: { ...state.data, newDueDate: parsed },
    })
    return true
  }

  await db.updateDebtDueDate(userId, debt.id, parsed)

  const debtEntity = await AppDataSource.getRepository(DebtEntity).findOne({
    where: { id: debt.id, userId }
  })
  if (debtEntity) {
    await reminderManager.createDebtReminder(userId, debtEntity)
  }

  await wizard.sendMessage(chatId, `✅ Due date updated to ${dayjs(parsed).format('DD.MM.YYYY')}!\n🔔 New reminders created.`)
  wizard.clearState(userId)
  await showDebtsMenu(wizard.getBot(), chatId, userId, state.lang)
  return true
}

export async function handleGoalDeadlineEdit(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false
  const lang = state.lang || 'en';
  const goal = state.data.goal
  const parsed = parseDateDDMMYYYY(text)

  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid date format. Use DD.MM.YYYY (e.g., 31.12.2026)",
      wizard.getBackButton(lang)
    )
    return true
  }

  if (dayjs(parsed).isBefore(dayjs(), 'day')) {
    await wizard.sendMessage(
      chatId,
      t(lang, 'dates.deadlineCannotBePast'),
      wizard.getBackButton(lang)
    )
    return true
  }

  await db.updateGoalDeadline(userId, goal.id, parsed)

  const goalEntity = await AppDataSource.getRepository(GoalEntity).findOne({
    where: { id: goal.id, userId }
  })
  if (goalEntity) {
    await reminderManager.createGoalReminder(userId, goalEntity)
  }

  await wizard.sendMessage(chatId, `✅ Deadline updated to ${dayjs(parsed).format('DD.MM.YYYY')}!\n🔔 New reminders created.`)
  wizard.clearState(userId)
  await showGoalsMenu(wizard.getBot(), chatId, userId, state.lang)
  return true
}

export async function handleGoalDeadline(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const { goalId, name, targetAmount, currency, lang } = state.data

  if (!goalId || !name || !targetAmount || !currency) {
    await wizard.sendMessage(chatId, t(lang, 'errors.missingGoalData'))
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  let deadline: Date | undefined

  if (text === "⏩ Skip") {
    deadline = undefined
  } else {
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (!match) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'dates.invalidFormatExampleShort'),
        {
          reply_markup: {
            keyboard: [
              [{ text: "⏩ Skip" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }

    const [, day, month, year] = match
    deadline = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)

    if (isNaN(deadline.getTime())) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'errors.invalidDateShort'),
        wizard.getBackButton(lang)
      )
      return true
    }

    if (deadline < new Date()) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'errors.deadlinePastWarning'),
        wizard.getBackButton(lang)
      )
      return true
    }
  }

  // Update goal with deadline
  if (deadline) {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    await goalRepo.update({ id: goalId }, { deadline })

    // Create reminder
    try {
      const goalEntity = await goalRepo.findOne({ where: { id: goalId, userId } })
      if (goalEntity) {
        await reminderManager.createGoalReminder(userId, goalEntity)
      }
    } catch (error) {
      console.error("Failed to create goal reminder:", error)
    }

    await wizard.sendMessage(
      chatId,
      `✅ Deadline set for *${name}*: ${deadline.toLocaleDateString("en-GB")} 🎯`,
      { parse_mode: "Markdown" }
    )
  } else {
    await wizard.sendMessage(
      chatId,
      `✅ Goal *${name}* created without deadline.`,
      { parse_mode: "Markdown" }
    )
  }

  wizard.clearState(userId)
  await showGoalsMenu(wizard.getBot(), chatId, userId, state.lang)
  return true
}

export async function handleIncomeExpectedDate(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const { incomeId, name, expectedAmount, currency, lang } = state.data

  if (!incomeId || !name || !expectedAmount || !currency) {
    await wizard.sendMessage(chatId, t(lang, 'errors.missingIncomeData'))
    wizard.clearState(userId)
    await showIncomeSourcesMenu(wizard.getBot(), chatId, userId, state.lang)
    return true
  }

  let expectedDate: number | undefined

  if (text === "⏩ Skip") {
    expectedDate = undefined
  } else {
    const day = parseInt(text)
    if (isNaN(day) || day < 1 || day > 31) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'dates.invalidDayWithSkip'),
        {
          reply_markup: {
            keyboard: [
              [{ text: "⏩ Skip" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }
    expectedDate = day
  }

  // Update income source
  if (expectedDate) {
    const incomeRepo = AppDataSource.getRepository(IncomeSourceEntity)
    await incomeRepo.update(
      { id: incomeId },
      { expectedDate, reminderEnabled: true }
    )

    // Create reminder
    try {
      const incomeEntity = await incomeRepo.findOne({ where: { id: incomeId, userId } })
      if (incomeEntity) {
        await reminderManager.createIncomeReminder(userId, incomeEntity)
      }
    } catch (error) {
      console.error("Failed to create income reminder:", error)
    }

    await wizard.sendMessage(
      chatId,
      `✅ Reminder set for *${name}*: day ${expectedDate} of each month 📅`,
      { parse_mode: "Markdown" }
    )
  } else {
    await wizard.sendMessage(
      chatId,
      `✅ Income source *${name}* created without reminder.`,
      { parse_mode: "Markdown" }
    )
  }

  wizard.clearState(userId)
  await showIncomeSourcesMenu(wizard.getBot(), chatId, userId, state.lang)
  return true
}
