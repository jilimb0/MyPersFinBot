/**
 * Income Source Auto-Create Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { showIncomeSourcesMenu } from "../menus"
import { AppDataSource } from "../database/data-source"
import { IncomeSource as IncomeSourceEntity } from "../database/entities/IncomeSource"
import { IncomeSource } from "../types"

/**
 * Handle auto-income enable/disable toggle
 */
export async function handleAutoIncomeToggle(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.source) return false

  const income = state.data.source as IncomeSource

  if (text === "✅ Enable Auto-Income") {
    // Start auto-income setup wizard
    wizard.setState(userId, {
      ...state,
      step: "AUTO_INCOME_SELECT_ACCOUNT",
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
      `🤖 *Auto-Income Setup*\n\n` +
      `Source: *${income.name}*\n\n` +
      `Select the account to receive income:`,
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

  if (text === "❌ Disable Auto-Income") {
    // Disable auto-income
    const incomeRepo = AppDataSource.getRepository(IncomeSourceEntity)
    await incomeRepo.update(
      { id: income.id, userId },
      { autoCreate: null }
    )

    await wizard.sendMessage(
      chatId,
      `✅ Auto-income disabled for *${income.name}*.`,
      { parse_mode: "Markdown" }
    )

    await showIncomeSourcesMenu(wizard.getBot(), chatId, userId)
    wizard.clearState(userId)
    return true
  }

  return false
}

/**
 * Handle account selection for auto-income
 */
export async function handleAutoIncomeAccountSelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.source) return false

  const income = state.data.source as IncomeSource

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
    step: "AUTO_INCOME_ENTER_AMOUNT",
    data: {
      ...state.data,
      autoIncomeAccountId: accountId.trim(),
    },
  })

  await wizard.sendMessage(
    chatId,
    `💰 *Auto-Income Amount*\n\n` +
    `Source: *${income.name}*\n` +
    `To: *${accountId.trim()}*\n\n` +
    `Enter the income amount:\n` +
    `Example: 5000`,
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
 * Handle amount input for auto-income
 */
export async function handleAutoIncomeAmountInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.source || !state.data.autoIncomeAccountId) return false

  const income = state.data.source as IncomeSource
  const accountId = state.data.autoIncomeAccountId as string

  const amount = parseFloat(text)
  if (isNaN(amount) || amount <= 0) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid amount. Please enter a positive number.",
      wizard.getBackButton()
    )
    return true
  }

  // Store amount and ask for day of month
  wizard.setState(userId, {
    ...state,
    step: "AUTO_INCOME_SELECT_DAY",
    data: {
      ...state.data,
      autoIncomeAmount: amount,
    },
  })

  await wizard.sendMessage(
    chatId,
    `📅 *Select Day of Month*\n\n` +
    `Source: *${income.name}*\n` +
    `Amount: *${amount} ${income.currency || 'USD'}*\n\n` +
    `Enter the day (1-31) for automatic income:\n` +
    `Example: 25 (for 25th of each month)`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "1" }, { text: "5" }, { text: "10" }],
          [{ text: "15" }, { text: "20" }, { text: "25" }],
          [{ text: "28" }, { text: "Last day" }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

/**
 * Handle day of month selection
 */
export async function handleAutoIncomeDaySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.source) return false

  const income = state.data.source as IncomeSource
  const accountId = state.data.autoIncomeAccountId as string
  const amount = state.data.autoIncomeAmount as number

  let dayOfMonth = parseInt(text)

  if (text === "Last day") {
    dayOfMonth = 31 // Will be handled in manager
  }

  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid day. Please enter a number between 1-31.",
      wizard.getBackButton()
    )
    return true
  }

  // Save auto-income configuration
  await saveAutoIncomeConfig(
    userId,
    income.id,
    accountId,
    amount,
    dayOfMonth
  )

  await wizard.sendMessage(
    chatId,
    `✅ *Auto-Income Enabled!*\n\n` +
    `Source: *${income.name}*\n` +
    `Amount: *${amount} ${income.currency || 'USD'}*\n` +
    `To: *${accountId}*\n` +
    `Day: *${text === "Last day" ? "Last day of month" : `${dayOfMonth}th`}*\n\n` +
    `🤖 The bot will automatically add this income on day ${dayOfMonth} of each month.`,
    { parse_mode: "Markdown" }
  )

  await showIncomeSourcesMenu(wizard.getBot(), chatId, userId)
  wizard.clearState(userId)
  return true
}

/**
 * Save auto-income configuration to database
 */
async function saveAutoIncomeConfig(
  userId: string,
  incomeId: string,
  accountId: string,
  amount: number,
  dayOfMonth: number
): Promise<void> {
  const incomeRepo = AppDataSource.getRepository(IncomeSourceEntity)

  await incomeRepo.update(
    { id: incomeId, userId },
    {
      autoCreate: {
        enabled: true,
        amount,
        accountId,
        frequency: "MONTHLY",
        dayOfMonth,
      },
    }
  )
}
