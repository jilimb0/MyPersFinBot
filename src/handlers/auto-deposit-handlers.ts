/**
 * Goal Auto-Deposit Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { showGoalsMenu } from "../menus"
import { AppDataSource } from "../database/data-source"
import { Goal as GoalEntity } from "../database/entities/Goal"
import { Goal } from "../types"

/**
 * Handle auto-deposit enable/disable toggle
 */
export async function handleAutoDepositToggle(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false

  const goal = state.data.goal as Goal

  if (text === "✅ Enable Auto-Deposit") {
    // Start auto-deposit setup wizard
    wizard.setState(userId, {
      ...state,
      step: "AUTO_DEPOSIT_SELECT_ACCOUNT",
    })

    const balances = await db.getBalancesList(userId)

    if (balances.length === 0) {
      await wizard.sendMessage(
        chatId,
        "⚠️ No accounts found. Please add a balance account first.",
        wizard.getBackButton()
      )
      return true
    }

    const accountButtons = balances.map((b) => [{
      text: `${b.accountId} (${b.currency})`
    }])
    accountButtons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

    await wizard.sendMessage(
      chatId,
      `🤖 *Auto-Deposit Setup*\n\n` +
      `Goal: *${goal.name}*\n\n` +
      `Select the account to transfer from:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: accountButtons,
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === "❌ Disable Auto-Deposit") {
    // Disable auto-deposit
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    await goalRepo.update(
      { id: goal.id, userId },
      { autoDeposit: null }
    )

    await wizard.sendMessage(
      chatId,
      `✅ Auto-deposit disabled for *${goal.name}*.`,
      { parse_mode: "Markdown" }
    )

    await showGoalsMenu(wizard.getBot(), chatId, userId)
    wizard.clearState(userId)
    return true
  }

  return false
}

/**
 * Handle account selection for auto-deposit
 */
export async function handleAutoDepositAccountSelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false

  const goal = state.data.goal as Goal

  // Extract account name from "AccountName (CURRENCY)"
  const match = text.match(/^(.+?)\s*\(([A-Z]{3})\)$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid account format. Please select from the list.",
      wizard.getBackButton()
    )
    return true
  }

  const [, accountId] = match

  // Store selected account and ask for amount
  wizard.setState(userId, {
    ...state,
    step: "AUTO_DEPOSIT_ENTER_AMOUNT",
    data: {
      ...state.data,
      autoDepositAccountId: accountId.trim(),
    },
  })

  await wizard.sendMessage(
    chatId,
    `💰 *Auto-Deposit Amount*\n\n` +
    `Goal: *${goal.name}*\n` +
    `From: *${accountId.trim()}*\n\n` +
    `Enter the amount to deposit automatically:\n` +
    `Example: 100`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

/**
 * Handle amount input for auto-deposit
 */
export async function handleAutoDepositAmountInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal || !state.data.autoDepositAccountId) return false

  const goal = state.data.goal as Goal
  const accountId = state.data.autoDepositAccountId as string

  const amount = parseFloat(text)
  if (isNaN(amount) || amount <= 0) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid amount. Please enter a positive number.",
      wizard.getBackButton()
    )
    return true
  }

  // Store amount and ask for frequency
  wizard.setState(userId, {
    ...state,
    step: "AUTO_DEPOSIT_SELECT_FREQUENCY",
    data: {
      ...state.data,
      autoDepositAmount: amount,
    },
  })

  await wizard.sendMessage(
    chatId,
    `📅 *Auto-Deposit Frequency*\n\n` +
    `Goal: *${goal.name}*\n` +
    `From: *${accountId}*\n` +
    `Amount: *${amount} ${goal.currency}*\n\n` +
    `Choose frequency:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "📆 Weekly" }, { text: "📅 Monthly" }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

/**
 * Handle frequency selection for auto-deposit
 */
export async function handleAutoDepositFrequencySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal || !state.data.autoDepositAccountId || !state.data.autoDepositAmount) return false

  const goal = state.data.goal as Goal
  const accountId = state.data.autoDepositAccountId as string
  const amount = state.data.autoDepositAmount as number

  if (text === "📆 Weekly") {
    // Ask for day of week
    wizard.setState(userId, {
      ...state,
      step: "AUTO_DEPOSIT_SELECT_DAY_WEEKLY",
      data: {
        ...state.data,
        autoDepositFrequency: "WEEKLY",
      },
    })

    await wizard.sendMessage(
      chatId,
      `📆 *Select Day of Week*\n\n` +
      `Goal: *${goal.name}*\n` +
      `Amount: *${amount} ${goal.currency}*\n\n` +
      `Choose the day for automatic deposit:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "Monday" }, { text: "Tuesday" }],
            [{ text: "Wednesday" }, { text: "Thursday" }],
            [{ text: "Friday" }, { text: "Saturday" }],
            [{ text: "Sunday" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === "📅 Monthly") {
    // Ask for day of month
    wizard.setState(userId, {
      ...state,
      step: "AUTO_DEPOSIT_SELECT_DAY_MONTHLY",
      data: {
        ...state.data,
        autoDepositFrequency: "MONTHLY",
      },
    })

    await wizard.sendMessage(
      chatId,
      `📅 *Select Day of Month*\n\n` +
      `Goal: *${goal.name}*\n` +
      `Amount: *${amount} ${goal.currency}*\n\n` +
      `Enter the day (1-31) for automatic deposit:\n` +
      `Example: 25 (for 25th of each month)`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "1" }, { text: "5" }, { text: "10" }],
            [{ text: "15" }, { text: "20" }, { text: "25" }],
            [{ text: "28" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  return false
}

/**
 * Handle day of week selection
 */
export async function handleAutoDepositDayWeeklySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false

  const goal = state.data.goal as Goal
  const accountId = state.data.autoDepositAccountId as string
  const amount = state.data.autoDepositAmount as number

  const dayMap: Record<string, number> = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 0,
  }

  const dayOfWeek = dayMap[text]
  if (dayOfWeek === undefined) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid day. Please select from the list.",
      wizard.getBackButton()
    )
    return true
  }

  // Save auto-deposit configuration
  await saveAutoDepositConfig(
    userId,
    goal.id,
    accountId,
    amount,
    "WEEKLY",
    undefined,
    dayOfWeek
  )

  await wizard.sendMessage(
    chatId,
    `✅ *Auto-Deposit Enabled!*\n\n` +
    `Goal: *${goal.name}*\n` +
    `Amount: *${amount} ${goal.currency}*\n` +
    `From: *${accountId}*\n` +
    `Frequency: Every *${text}*\n\n` +
    `🤖 The bot will automatically deposit money to your goal every ${text}.`,
    { parse_mode: "Markdown" }
  )

  await showGoalsMenu(wizard.getBot(), chatId, userId)
  wizard.clearState(userId)
  return true
}

/**
 * Handle day of month selection
 */
export async function handleAutoDepositDayMonthlySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false

  const goal = state.data.goal as Goal
  const accountId = state.data.autoDepositAccountId as string
  const amount = state.data.autoDepositAmount as number

  const dayOfMonth = parseInt(text)
  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid day. Please enter a number between 1-31.",
      wizard.getBackButton()
    )
    return true
  }

  // Save auto-deposit configuration
  await saveAutoDepositConfig(
    userId,
    goal.id,
    accountId,
    amount,
    "MONTHLY",
    dayOfMonth,
    undefined
  )

  await wizard.sendMessage(
    chatId,
    `✅ *Auto-Deposit Enabled!*\n\n` +
    `Goal: *${goal.name}*\n` +
    `Amount: *${amount} ${goal.currency}*\n` +
    `From: *${accountId}*\n` +
    `Frequency: *${dayOfMonth}th of each month*\n\n` +
    `🤖 The bot will automatically deposit money to your goal on day ${dayOfMonth} of each month.`,
    { parse_mode: "Markdown" }
  )

  await showGoalsMenu(wizard.getBot(), chatId, userId)
  wizard.clearState(userId)
  return true
}

/**
 * Save auto-deposit configuration to database
 */
async function saveAutoDepositConfig(
  userId: string,
  goalId: string,
  accountId: string,
  amount: number,
  frequency: "WEEKLY" | "MONTHLY",
  dayOfMonth?: number,
  dayOfWeek?: number
): Promise<void> {
  const goalRepo = AppDataSource.getRepository(GoalEntity)

  await goalRepo.update(
    { id: goalId, userId },
    {
      autoDeposit: {
        enabled: true,
        amount,
        accountId,
        frequency,
        dayOfMonth,
        dayOfWeek,
      },
    }
  )
}
