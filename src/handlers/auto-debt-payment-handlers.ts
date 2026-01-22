/**
 * Debt Auto-Payment Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { showDebtsMenu } from "../menus-i18n"
import { AppDataSource } from "../database/data-source"
import { Debt as DebtEntity } from "../database/entities/Debt"
import { Debt } from "../types"
import { t } from "../i18n"

/**
 * Handle auto-payment enable/disable toggle
 */
export async function handleAutoPaymentToggle(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt) return false

  const lang = state.lang || 'en';
  const debt = state.data.debt as Debt

  if (text === "✅ Enable Auto-Payment") {
    // Only for I_OWE debts
    if (debt.type !== "I_OWE") {
      await wizard.sendMessage(
        chatId,
        "⚠️ Auto-payment only available for debts you owe.",
        wizard.getBackButton(lang)
      )
      return true
    }

    // Start auto-payment setup wizard
    wizard.setState(userId, {
      ...state,
      step: "AUTO_PAYMENT_SELECT_ACCOUNT",
    })

    const balances = await db.getBalancesList(userId)

    if (balances.length === 0) {
      await wizard.sendMessage(
        chatId,
        t(lang, 'errors.noAccountsFound'),
        wizard.getBackButton(lang)
      )
      return true
    }

    const accountButtons = balances.map((b) => [{
      text: `${b.accountId} (${b.currency})`
    }])
    accountButtons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

    await wizard.sendMessage(
      chatId,
      `🤖 *Auto-Payment Setup*\n\n` +
      `Debt: *${debt.name}* (${debt.counterparty})\n\n` +
      `Select the account to pay from:`,
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

  if (text === "❌ Disable Auto-Payment") {
    // Disable auto-payment
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    await debtRepo.update(
      { id: debt.id, userId },
      { autoPayment: null }
    )

    await wizard.sendMessage(
      chatId,
      `✅ Auto-payment disabled for *${debt.name}*.`,
      { parse_mode: "Markdown" }
    )

    await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
    wizard.clearState(userId)
    return true
  }

  return false
}

/**
 * Handle account selection for auto-payment
 */
export async function handleAutoPaymentAccountSelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt) return false
  const lang = state.lang || 'en';
  const debt = state.data.debt as Debt

  // Extract account name from "AccountName (CURRENCY)"
  const match = text.match(/^(.+?)\s*\(([A-Z]{3})\)$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid account format. Please select from the list.",
      wizard.getBackButton(lang)
    )
    return true
  }

  const [, accountId] = match

  // Store selected account and ask for amount
  wizard.setState(userId, {
    ...state,
    step: "AUTO_PAYMENT_ENTER_AMOUNT",
    data: {
      ...state.data,
      autoPaymentAccountId: accountId.trim(),
    },
  })

  const remaining = debt.amount - debt.paidAmount

  await wizard.sendMessage(
    chatId,
    `💸 *Auto-Payment Amount*\n\n` +
    `Debt: *${debt.name}* (${debt.counterparty})\n` +
    `From: *${accountId.trim()}*\n` +
    `Remaining: *${remaining} ${debt.currency}*\n\n` +
    `Enter the monthly payment amount:\n` +
    `Example: 1000`,
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
 * Handle amount input for auto-payment
 */
export async function handleAutoPaymentAmountInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt || !state.data.autoPaymentAccountId) return false

  const debt = state.data.debt as Debt
  const accountId = state.data.autoPaymentAccountId as string
  const lang = state.lang || 'en';

  const amount = parseFloat(text)
  if (isNaN(amount) || amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, 'errors.invalidAmountPositive'),
      wizard.getBackButton(lang)
    )
    return true
  }

  const remaining = debt.amount - debt.paidAmount
  if (amount > remaining) {
    await wizard.sendMessage(
      chatId,
      `⚠️ Amount exceeds remaining debt (${remaining} ${debt.currency}). Please enter a smaller amount.`,
      wizard.getBackButton(lang)
    )
    return true
  }

  // Store amount and ask for day of month
  wizard.setState(userId, {
    ...state,
    step: "AUTO_PAYMENT_SELECT_DAY",
    data: {
      ...state.data,
      autoPaymentAmount: amount,
    },
  })

  await wizard.sendMessage(
    chatId,
    `📅 *Select Payment Day*\n\n` +
    `Debt: *${debt.name}*\n` +
    `Amount: *${amount} ${debt.currency}*\n\n` +
    `Enter the day (1-31) for monthly payment:\n` +
    `Example: 15 (for 15th of each month)`,
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

/**
 * Handle day of month selection
 */
export async function handleAutoPaymentDaySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt) return false

  const lang = state.lang || 'en';
  const debt = state.data.debt as Debt
  const accountId = state.data.autoPaymentAccountId as string
  const amount = state.data.autoPaymentAmount as number

  const dayOfMonth = parseInt(text)
  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    await wizard.sendMessage(
      chatId,
      t(lang, 'errors.invalidDay'),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Save auto-payment configuration
  await saveAutoPaymentConfig(
    userId,
    debt.id,
    accountId,
    amount,
    dayOfMonth
  )

  await wizard.sendMessage(
    chatId,
    `✅ *Auto-Payment Enabled!*\n\n` +
    `Debt: *${debt.name}* (${debt.counterparty})\n` +
    `Amount: *${amount} ${debt.currency}*\n` +
    `From: *${accountId}*\n` +
    `Day: *${dayOfMonth}th of each month*\n\n` +
    `🤖 The bot will automatically pay this debt on day ${dayOfMonth} of each month.`,
    { parse_mode: "Markdown" }
  )

  await showDebtsMenu(wizard.getBot(), chatId, userId, lang)
  wizard.clearState(userId)
  return true
}

/**
 * Save auto-payment configuration to database
 */
async function saveAutoPaymentConfig(
  userId: string,
  debtId: string,
  accountId: string,
  amount: number,
  dayOfMonth: number
): Promise<void> {
  const debtRepo = AppDataSource.getRepository(DebtEntity)

  await debtRepo.update(
    { id: debtId, userId },
    {
      autoPayment: {
        enabled: true,
        amount,
        accountId,
        frequency: "MONTHLY",
        dayOfMonth,
      },
    }
  )
}
