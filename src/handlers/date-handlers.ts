import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import {
  showDebtsMenu,
  showGoalsMenu,
  showIncomeSourcesMenu,
} from "../menus-i18n"
import { reminderManager } from "../services/reminder-manager"
import { AppDataSource } from "../database/data-source"
import { Debt as DebtEntity } from "../database/entities/Debt"
import { Goal as GoalEntity } from "../database/entities/Goal"
import { IncomeSource as IncomeSourceEntity } from "../database/entities/IncomeSource"
import { formatDateDisplay, formatMoney } from "../utils"
import { randomUUID } from "crypto"
import dayjs from "dayjs"
import { resolveLanguage, t } from "../i18n"

// Helper function to parse DD.MM.YYYY format
function parseDateDDMMYYYY(text: string): Date | null {
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) return null

  const [, day, month, year] = match
  if (!day || !month || !year) return null
  const date = new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  )

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

  if (!state.data) return true
  const lang = resolveLanguage(state?.lang)
  const { name, amount, currency, type: debtType } = state.data

  if (!name || !amount || !currency || !debtType) {
    await wizard.sendMessage(chatId, t(lang, "errors.missingDebtData"))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  let dueDate: Date | undefined

  // Check if user wants to skip
  if (text === t(lang, "common.skip")) {
    dueDate = undefined
  } else {
    // Parse date DD.MM.YYYY
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (!match) {
      await wizard.sendMessage(chatId, t(lang, "errors.invalidDateFormat"), {
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "common.skip") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ],
          resize_keyboard: true,
        },
      })
      return true
    }

    const [, day, month, year] = match
    if (!day || !month || !year) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.invalidDateFormat"),
        wizard.getBackButton(lang)
      )
      return true
    }
    dueDate = new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    )

    if (isNaN(dueDate.getTime())) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.invalidDateFormat"),
        wizard.getBackButton(lang)
      )
      return true
    }

    // Check if date is in the past
    if (dueDate < new Date()) {
      await wizard.sendMessage(chatId, t(lang, "dates.pastDateConfirm"), {
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "common.yes") }, { text: t(lang, "common.no") }],
            [{ text: t(lang, "common.back") }],
          ],
          resize_keyboard: true,
        },
      })
      await wizard.goToStep(userId, "DEBT_CONFIRM_PAST_DATE", {
        ...state?.data,
        dueDate,
      })
      const updated = wizard.getState(userId)
      if (updated) {
        wizard.setState(userId, { ...updated, lang })
      }
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
      const debtEntity = await debtRepo.findOne({
        where: { id: debtId, userId },
      })
      if (debtEntity) {
        await reminderManager.createDebtReminder(userId, debtEntity)
      }
    } catch (error) {
      console.error("Failed to create debt reminder:", error)
    }
  }

  const emoji = debtType === "I_OWE" ? "🔴" : "🟢"
  const action =
    debtType === "I_OWE"
      ? t(lang, "debts.actionOweTo")
      : t(lang, "debts.actionOwedBy")
  const dueDateText = dueDate
    ? `\n${t(lang, "debts.dueDateLine", {
        date: formatDateDisplay(dueDate),
      })}`
    : ""

  await wizard.sendMessage(
    chatId,
    t(lang, "debts.createdMessage", {
      emoji,
      action,
      name,
      amount: formatMoney(amount, currency),
      dueDateLine: dueDateText,
    }),
    { parse_mode: "Markdown" }
  )

  wizard.clearState(userId)
  await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
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

  const lang = state?.lang || "en"
  const debt = state?.data?.debt
  const parsed = parseDateDDMMYYYY(text)

  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      t(lang, "dates.invalidFormatExample"),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (dayjs(parsed).isBefore(dayjs(), "day")) {
    await wizard.sendMessage(chatId, t(lang, "dates.pastDateConfirm"), {
      reply_markup: {
        keyboard: [
          [{ text: t(lang, "common.yes") }, { text: t(lang, "common.no") }],
        ],
        resize_keyboard: true,
      },
    })
    wizard.setState(userId, {
      ...state,
      lang: state.lang,
      data: { ...state?.data, newDueDate: parsed },
    })
    return true
  }

  await db.updateDebtDueDate(userId, debt.id, parsed)

  const debtEntity = await AppDataSource.getRepository(DebtEntity).findOne({
    where: { id: debt.id, userId },
  })
  if (debtEntity) {
    await reminderManager.createDebtReminder(userId, debtEntity)
  }

  await wizard.sendMessage(
    chatId,
    t(lang, "debts.dueDateUpdated", {
      date: formatDateDisplay(parsed),
    })
  )
  wizard.clearState(userId)
  await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
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
  const lang = state?.lang || "en"
  const goal = state?.data?.goal
  const parsed = parseDateDDMMYYYY(text)

  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      t(lang, "dates.invalidFormatExample"),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (dayjs(parsed).isBefore(dayjs(), "day")) {
    await wizard.sendMessage(
      chatId,
      t(lang, "dates.deadlineCannotBePast"),
      wizard.getBackButton(lang)
    )
    return true
  }

  await db.updateGoalDeadline(userId, goal.id, parsed)

  const goalEntity = await AppDataSource.getRepository(GoalEntity).findOne({
    where: { id: goal.id, userId },
  })
  if (goalEntity) {
    await reminderManager.createGoalReminder(userId, goalEntity)
  }

  await wizard.sendMessage(
    chatId,
    t(lang, "goals.deadlineUpdated", {
      date: formatDateDisplay(parsed),
    })
  )
  wizard.clearState(userId)
  await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
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

  if (!state.data) return true
  const lang = resolveLanguage(state?.lang)
  const { goalId, name, targetAmount, currency } = state.data

  if (!goalId || !name || !targetAmount || !currency) {
    await wizard.sendMessage(chatId, t(lang, "errors.missingGoalData"))
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  let deadline: Date | undefined

  if (text === t(lang, "common.skip")) {
    deadline = undefined
  } else {
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (!match) {
      await wizard.sendMessage(
        chatId,
        t(lang, "dates.invalidFormatExampleShort"),
        {
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "common.skip") }],
              [
                { text: t(lang, "common.back") },
                { text: t(lang, "mainMenu.mainMenuButton") },
              ],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }

    const [, day, month, year] = match
    if (!day || !month || !year) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.invalidDateFormat"),
        wizard.getBackButton(lang)
      )
      return true
    }
    deadline = new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    )

    if (isNaN(deadline.getTime())) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.invalidDateFormat"),
        wizard.getBackButton(lang)
      )
      return true
    }

    if (deadline < new Date()) {
      await wizard.sendMessage(
        chatId,
        t(lang, "dates.deadlineCannotBePast"),
        wizard.getBackButton(lang)
      )
      return true
    }
  }

  const updatedGoalState = wizard.getState(userId)
  if (updatedGoalState) {
    wizard.setState(userId, { ...updatedGoalState, lang })
  }

  // Update goal with deadline
  if (deadline) {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    await goalRepo.update({ id: goalId }, { deadline })

    // Create reminder
    try {
      const goalEntity = await goalRepo.findOne({
        where: { id: goalId, userId },
      })
      if (goalEntity) {
        await reminderManager.createGoalReminder(userId, goalEntity)
      }
    } catch (error) {
      console.error("Failed to create goal reminder:", error)
    }

    await wizard.sendMessage(
      chatId,
      t(lang, "goals.deadlineSetMessage", {
        name,
        date: formatDateDisplay(deadline),
      }),
      { parse_mode: "Markdown" }
    )
  } else {
    await wizard.sendMessage(
      chatId,
      t(lang, "goals.createdWithoutDeadline", { name }),
      { parse_mode: "Markdown" }
    )
  }

  wizard.clearState(userId)
  await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
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

  if (!state.data) return true
  const lang = resolveLanguage(state?.lang)
  const { incomeId, name, expectedAmount, currency } = state.data

  if (!incomeId || !name || !expectedAmount || !currency) {
    await wizard.sendMessage(chatId, t(lang, "errors.missingIncomeData"))
    wizard.clearState(userId)
    await showIncomeSourcesMenu(wizard.getBot(), chatId, userId, lang)
    return true
  }

  let expectedDate: number | undefined

  if (text === t(lang, "common.skip")) {
    expectedDate = undefined
  } else {
    const day = parseInt(text)
    if (isNaN(day) || day < 1 || day > 31) {
      await wizard.sendMessage(chatId, t(lang, "dates.invalidDayWithSkip"), {
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "common.skip") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ],
          resize_keyboard: true,
        },
      })
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
      const incomeEntity = await incomeRepo.findOne({
        where: { id: incomeId, userId },
      })
      if (incomeEntity) {
        await reminderManager.createIncomeReminder(userId, incomeEntity)
      }
    } catch (error) {
      console.error("Failed to create income reminder:", error)
    }

    await wizard.sendMessage(
      chatId,
      t(lang, "incomeSources.reminderSet", {
        name,
        day: expectedDate,
      }),
      { parse_mode: "Markdown" }
    )
  } else {
    await wizard.sendMessage(
      chatId,
      t(lang, "incomeSources.createdWithoutReminder", { name }),
      { parse_mode: "Markdown" }
    )
  }

  wizard.clearState(userId)
  await showIncomeSourcesMenu(
    wizard.getBot(),
    chatId,
    userId,
    state?.lang || "en"
  )
  return true
}
