import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import { formatMoney, handleInsufficientFunds } from "../utils"
import { showDebtsMenu } from "../menus-i18n"
import * as handlers from "./index"
import { t } from "../i18n"

export async function handleDebtCreateDetails(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  const debtType = state?.data?.type
  if (!debtType) {
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "debts.typeNotFound")
    )
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  const parts = text.trim().split(/\s+/)

  if (parts.length < 2) {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    await wizard.sendMessage(
      chatId,
      t(lang, "debts.invalidCreateFormat", { currency: defaultCurrency }),
      {
        parse_mode: "Markdown",
        ...wizard.getBackButton(lang),
      }
    )
    return true
  }

  // ✅ Parse: all words except last are name, last word(s) are amount
  const name = parts.slice(0, -1).join(" ").trim()
  const amountText = parts[parts.length - 1] || ""
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(amountText, defaultCurrency)

  if (!parsed || parsed.amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, "debts.invalidCreateAmountTry", {
        name,
        currency: defaultCurrency,
      }),
      wizard.getBackButton(lang)
    )
    return true
  }

  // ✅ Check for duplicate debt name
  const userData = await db.getUserData(userId)
  const existingDebt = userData.debts.find((d) => d.name === name && !d.isPaid)

  if (existingDebt) {
    await wizard.sendMessage(chatId, t(lang, "debts.duplicateName", { name }), {
      parse_mode: "Markdown",
      ...wizard.getBackButton(lang),
    })
    return true
  }

  // Store debt details and ask about due date
  await wizard.goToStep(userId, "DEBT_ASK_DUE_DATE", {
    name,
    amount: parsed.amount,
    currency: parsed.currency,
    type: debtType,
  })

  await wizard.sendMessage(
    chatId,
    t(lang, "debts.dueDateCreatePrompt", {
      name,
      amount: formatMoney(parsed.amount, parsed.currency),
    }),
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: t(state?.lang || "en", "common.skip") }],
          [
            { text: t(state?.lang || "en", "common.back") },
            { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
          ],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

export async function handleDebtPartialAmount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  const debt = state?.data?.debt
  if (!debt) {
    await wizard.sendMessage(chatId, t(lang, "errors.missingDebtData"))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      t(lang, "debts.invalidPaymentFormat", { currency: defaultCurrency }),
      wizard.getBackButton(lang)
    )
    return true
  }

  const remaining = debt.amount - debt.paidAmount

  if (parsed.amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.amountMustBePositive"),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (parsed.amount > remaining) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.debtAmountExceedsRemaining", {
        remaining: formatMoney(remaining, debt.currency),
      }),
      wizard.getBackButton(lang)
    )
    return true
  }

  const balanceCount = (await db.getBalancesList(userId)).length
  if (balanceCount === 0) {
    await wizard.sendMessage(
      chatId,
      `${t(lang, "debts.noBalancesForPayment")}\n\n` +
        `${t(lang, "debts.quickStartTitle")}\n` +
        `${t(lang, "debts.quickStartStep1")}\n` +
        `${t(lang, "debts.quickStartStep2")}\n` +
        `${t(lang, "debts.quickStartStep3")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(state?.lang || "en", "transactions.goToBalances") }],
            [
              { text: t(state?.lang || "en", "common.back") },
              { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
            ],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  await wizard.goToStep(userId, "DEBT_PARTIAL_ACCOUNT", {
    payAmount: parsed.amount,
  })

  const promptText =
    debt.type === "I_OWE"
      ? t(state?.lang || "en", "debts.selectPayAccount")
      : t(state?.lang || "en", "debts.selectReceiveAccount")

  await handlers.handleTxAccount(wizard, chatId, userId, promptText)
  return true
}

export async function handleDebtPartialAccount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const lang = state?.lang || "en"
  let cleanText = text
  if (text.startsWith("⭐ ")) {
    cleanText = text.substring(2)
  }

  const accountName = cleanText.split(" (")[0]?.trim() || ""
  const debt = state?.data?.debt
  const payAmount = state?.data?.payAmount

  if (!debt || !payAmount) {
    await wizard.sendMessage(chatId, t(lang, "errors.missingDebtData"))
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  if (debt.type === "I_OWE") {
    const balances = await db.getBalancesList(userId)
    const balance = balances.find((b) => b.accountId === accountName)

    if (!balance) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.accountNotFound", { account: accountName }),
        wizard.getBackButton(lang)
      )
      return true
    }

    if (balance.amount < payAmount) {
      await wizard.sendMessage(
        chatId,
        handleInsufficientFunds(
          lang,
          accountName,
          balance.amount,
          balance.currency,
          payAmount,
          state?.data?.currency
        ),
        {
          reply_markup: {
            keyboard: [
              [{ text: t(state?.lang || "en", "transactions.goToBalances") }],
              [
                { text: t(state?.lang || "en", "debts.changeAmount") },
                { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
              ],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }
  }

  const result = await db.updateDebtAmount(
    userId,
    debt.id,
    payAmount,
    accountName,
    debt.currency
  )

  if (!result.success) {
    await wizard.sendMessage(
      chatId,
      result.message || t(lang, "common.error"),
      wizard.getBackButton(lang)
    )
    return true
  }

  const updatedDebt = await db.getDebtById(userId, debt.id)
  if (updatedDebt?.isPaid) {
    const closeMsg =
      debt.type === "I_OWE"
        ? t(state?.lang || "en", "debts.fullyPaidClosed")
        : t(state?.lang || "en", "debts.fullyReceivedClosed")
    await wizard.sendMessage(chatId, closeMsg)
  } else {
    const emoji = debt.type === "I_OWE" ? "💸" : "💰"
    const action =
      debt.type === "I_OWE"
        ? t(lang, "debts.paymentActionPaid")
        : t(lang, "debts.paymentActionReceived")
    const remaining = updatedDebt
      ? updatedDebt.amount - updatedDebt.paidAmount
      : 0
    await wizard.sendMessage(
      chatId,
      t(lang, "debts.paymentRecordedWithRemaining", {
        emoji,
        action,
        amount: formatMoney(payAmount, debt.currency),
        remaining: formatMoney(remaining, debt.currency),
      })
    )
  }

  wizard.clearState(userId)
  await showDebtsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")

  return true
}
