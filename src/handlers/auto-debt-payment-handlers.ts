/**
 * Debt Auto-Payment Handlers
 */

import { AppDataSource } from "../database/data-source"
import { Debt as DebtEntity } from "../database/entities/Debt"
import { dbStorage as db } from "../database/storage-db"
import { resolveLanguage, t } from "../i18n"
import { showDebtsMenu } from "../menus-i18n"
import type { Debt } from "../types"
import { escapeMarkdown } from "../utils"
import type { WizardManager } from "../wizards/wizards"

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

  const lang = resolveLanguage(state?.lang)
  const debt = state?.data?.debt as Debt

  if (text === t(lang, "wizard.debt.enableAutoPayment")) {
    // Only for I_OWE debts
    if (debt.type !== "I_OWE") {
      await wizard.sendMessage(
        chatId,
        t(lang, "autoPayment.onlyOweWarning"),
        wizard.getBackButton(lang)
      )
      return true
    }

    // Start auto-payment setup wizard
    wizard.setState(userId, {
      ...state,
      lang: state.lang,
      step: "AUTO_PAYMENT_SELECT_ACCOUNT",
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
      `${t(lang, "autoPayment.setupTitle")}\n\n` +
        `${t(lang, "autoPayment.debtLine", {
          name: escapeMarkdown(debt.name),
          counterparty: escapeMarkdown(debt.counterparty || ""),
        })}\n\n` +
        `${t(lang, "autoPayment.selectAccountPrompt")}`,
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

  if (text === t(lang, "wizard.debt.disableAutoPayment")) {
    // Disable auto-payment
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    await debtRepo.update(
      { id: debt.id, userId },
      { autoPayment: undefined as any }
    )

    await wizard.sendMessage(
      chatId,
      t(lang, "autoPayment.disabledMessage", {
        name: escapeMarkdown(debt.name),
      }),
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
  const lang = resolveLanguage(state?.lang)
  const debt = state?.data?.debt as Debt

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
    lang: state.lang,
    step: "AUTO_PAYMENT_ENTER_AMOUNT",
    data: {
      ...state?.data,
      autoPaymentAccountId: accountId?.trim() || "",
    },
  })

  const remaining = debt.amount - debt.paidAmount

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoPayment.amountTitle")}\n\n` +
      `${t(lang, "autoPayment.debtLine", {
        name: escapeMarkdown(debt.name),
        counterparty: escapeMarkdown(debt.counterparty || ""),
      })}\n` +
      `${t(lang, "autoPayment.fromLine", {
        account: escapeMarkdown(
          accountId?.trim() || t(lang, "common.notAvailable")
        ),
      })}\n` +
      `${t(lang, "autoPayment.remainingLine", {
        remaining: `${remaining} ${debt.currency}`,
      })}\n\n` +
      `${t(lang, "autoPayment.amountPrompt")}`,
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
 * Handle amount input for auto-payment
 */
export async function handleAutoPaymentAmountInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt || !state?.data?.autoPaymentAccountId) return false

  const debt = state?.data?.debt as Debt
  // const accountId = state?.data?.autoPaymentAccountId as string
  const lang = resolveLanguage(state?.lang)

  const amount = parseFloat(text)
  if (Number.isNaN(amount) || amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidAmount"),
      wizard.getBackButton(lang)
    )
    return true
  }

  const remaining = debt.amount - debt.paidAmount
  if (amount > remaining) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.debtAmountExceedsRemaining", {
        remaining: `${remaining} ${debt.currency}`,
      }),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Store amount and ask for day of month
  wizard.setState(userId, {
    ...state,
    lang: state.lang,
    step: "AUTO_PAYMENT_SELECT_DAY",
    data: {
      ...state?.data,
      autoPaymentAmount: amount,
    },
  })

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoPayment.selectDayTitle")}\n\n` +
      `${t(lang, "autoPayment.debtLine", {
        name: escapeMarkdown(debt.name),
        counterparty: escapeMarkdown(debt.counterparty || ""),
      })}\n` +
      `${t(lang, "autoPayment.amountLine", {
        amount,
        currency: debt.currency,
      })}\n\n` +
      `${t(lang, "autoPayment.selectDayPrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "1" }, { text: "5" }, { text: "10" }],
          [{ text: "15" }, { text: "20" }, { text: "25" }],
          [{ text: "28" }],
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
export async function handleAutoPaymentDaySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.debt) return false

  const lang = resolveLanguage(state?.lang)
  const debt = state?.data?.debt as Debt
  const accountId = state?.data?.autoPaymentAccountId as string
  const amount = state?.data?.autoPaymentAmount as number

  const dayOfMonth = parseInt(text, 10)
  if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidDay"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Save auto-payment configuration
  await saveAutoPaymentConfig(userId, debt.id, accountId, amount, dayOfMonth)

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoPayment.enabledTitle")}\n\n` +
      `${t(lang, "autoPayment.debtLine", {
        name: escapeMarkdown(debt.name),
        counterparty: escapeMarkdown(debt.counterparty || ""),
      })}\n` +
      `${t(lang, "autoPayment.amountLine", {
        amount,
        currency: debt.currency,
      })}\n` +
      `${t(lang, "autoPayment.fromLine", {
        account: escapeMarkdown(accountId),
      })}\n` +
      `${t(lang, "autoPayment.dayLine", {
        day: t(lang, "autoPayment.dayOfMonth", { day: dayOfMonth }),
      })}\n\n` +
      `${t(lang, "autoPayment.noteMonthly", { day: dayOfMonth })}`,
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
