/**
 * Income Source Auto-Create Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { showIncomeSourcesMenu } from "../menus-i18n"
import { AppDataSource } from "../database/data-source"
import { IncomeSource as IncomeSourceEntity } from "../database/entities/IncomeSource"
import { IncomeSource } from "../types"
import { t } from "../i18n"

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
  const lang = state?.lang || "en"

  const income = state?.data?.source as IncomeSource

  if (text === t(lang, "wizard.income.enableAutoIncome")) {
    // Start auto-income setup wizard
    wizard.setState(userId, {
      ...state,
      step: "AUTO_INCOME_SELECT_ACCOUNT",
    })

    const balances = await db.getBalancesList(userId)

    if (balances.length === 0) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.noAccountsFound"),
        wizard.getBackButton(lang)
      )
      return true
    }

    const accountButtons = balances.map((b) => [
      {
        text: `${b.accountId} (${b.currency})`,
      },
    ])
    accountButtons.push([
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ])

    await wizard.sendMessage(
      chatId,
      `${t(lang, "autoIncome.setupTitle")}\n\n` +
        `${t(lang, "autoIncome.sourceLine", { name: income.name })}\n\n` +
        `${t(lang, "autoIncome.selectAccountPrompt")}`,
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

  if (text === t(lang, "wizard.income.disableAutoIncome")) {
    // Disable auto-income
    const incomeRepo = AppDataSource.getRepository(IncomeSourceEntity)
    await incomeRepo.update(
      { id: income.id, userId },
      { autoCreate: undefined as any }
    )

    await wizard.sendMessage(
      chatId,
      t(lang, "autoIncome.disabledMessage", { name: income.name }),
      { parse_mode: "Markdown" }
    )

    await showIncomeSourcesMenu(wizard.getBot(), chatId, userId, lang)
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
  const lang = state?.lang || "en"
  const income = state?.data?.source as IncomeSource

  // Extract account name from "AccountName (CURRENCY)"
  const match = text.match(/^(.+?)\s*\(([A-Z]{3})\)$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidAccountFormat"),
      wizard.getBackButton(lang)
    )
    return true
  }

  const [, accountId] = match

  // Store selected account and ask for amount
  wizard.setState(userId, {
    ...state,
    step: "AUTO_INCOME_ENTER_AMOUNT",
    data: {
      ...state?.data,
      autoIncomeAccountId: accountId?.trim() || "",
    },
  })

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoIncome.amountTitle")}\n\n` +
      `${t(lang, "autoIncome.sourceLine", { name: income.name })}\n` +
      `${t(lang, "autoIncome.toLine", {
        account: accountId?.trim() || t(lang, "common.notAvailable"),
      })}\n\n` +
      `${t(lang, "autoIncome.amountPrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
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
  if (!state?.data?.source || !state?.data?.autoIncomeAccountId) return false
  const lang = state?.lang || "en"

  const income = state?.data?.source as IncomeSource
  // const accountId = state?.data?.autoIncomeAccountId as string

  const amount = parseFloat(text)
  if (isNaN(amount) || amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidAmount"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Store amount and ask for day of month
  wizard.setState(userId, {
    ...state,
    step: "AUTO_INCOME_SELECT_DAY",
    data: {
      ...state?.data,
      autoIncomeAmount: amount,
    },
  })

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoIncome.selectDayTitle")}\n\n` +
      `${t(lang, "autoIncome.sourceLine", { name: income.name })}\n` +
      `${t(lang, "autoIncome.amountLine", {
        amount,
        currency: income.currency || "USD",
      })}\n\n` +
      `${t(lang, "autoIncome.selectDayPrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "1" }, { text: "5" }, { text: "10" }],
          [{ text: "15" }, { text: "20" }, { text: "25" }],
          [{ text: "28" }, { text: t(lang, "autoIncome.lastDay") }],
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
  const lang = state?.lang || "en"

  const income = state?.data?.source as IncomeSource
  const accountId = state?.data?.autoIncomeAccountId as string
  const amount = state?.data?.autoIncomeAmount as number

  let dayOfMonth = parseInt(text)

  if (text === t(lang, "autoIncome.lastDay")) {
    dayOfMonth = 31 // Will be handled in manager
  }

  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidDay"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Save auto-income configuration
  await saveAutoIncomeConfig(userId, income.id, accountId, amount, dayOfMonth)

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoIncome.enabledTitle")}\n\n` +
      `${t(lang, "autoIncome.sourceLine", { name: income.name })}\n` +
      `${t(lang, "autoIncome.amountLine", {
        amount,
        currency: income.currency || "USD",
      })}\n` +
      `${t(lang, "autoIncome.toLine", { account: accountId })}\n` +
      `${t(lang, "autoIncome.dayLine", {
        day:
          text === t(lang, "autoIncome.lastDay")
            ? t(lang, "autoIncome.lastDayOfMonth")
            : t(lang, "autoIncome.dayOfMonth", { day: dayOfMonth }),
      })}\n\n` +
      `${t(lang, "autoIncome.noteMonthly", { day: dayOfMonth })}`,
    { parse_mode: "Markdown" }
  )

  await showIncomeSourcesMenu(wizard.getBot(), chatId, userId, lang)
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
