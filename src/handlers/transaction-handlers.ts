import type { WizardManager } from "../wizards/wizards"
import {
  TransactionType,
  IncomeCategory,
  Transaction,
  InternalCategory,
  TransactionCategory,
  ExpenseCategory,
} from "../types"
import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import { formatMoney, handleInsufficientFunds } from "../utils"
import { showMainMenu, showBalancesMenu } from "../menus-i18n"
import { QuickActionsHandlers } from "./quick-actions-handlers"
import * as helpers from "../wizards/helpers"
import { randomUUID } from "crypto"
import { t } from "../i18n"

export async function handleTxCategory(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const lang = state?.lang || "en"
  const txType = (state?.data?.txType || state.txType) as TransactionType

  const quickResult = await QuickActionsHandlers.handleQuickCategory(
    wizard.getBot(),
    chatId,
    userId,
    text,
    state
  )

  if (quickResult.showAllCategories) {
    await QuickActionsHandlers.showAllCategories(
      wizard.getBot(),
      chatId,
      txType,
      lang
    )
    if (state.data) {
      state.data.showedAllCategories = true
    }
    wizard.setState(userId, state)
    return true
  }

  if (quickResult.handled) {
    return true
  }

  let validCategory: TransactionCategory | null = null

  if (txType === TransactionType.EXPENSE) {
    validCategory = validators.validateExpenseCategory(text)
  } else if (txType === TransactionType.INCOME) {
    validCategory = validators.validateIncomeCategory(text)
  }

  if (!validCategory) {
    await wizard.sendMessage(
      chatId,
      t(lang, "transactions.invalidCategory"),
      wizard.getBackButton(lang)
    )
    if (state.data) {
      state.data.showedAllCategories = true
    }
    wizard.setState(userId, state)
    return true
  }

  await wizard.goToStep(userId, "TX_ACCOUNT", { category: validCategory })

  const stateAfterGoTo = wizard.getState(userId)
  if (stateAfterGoTo?.data?.showedAllCategories) {
    delete stateAfterGoTo.data.showedAllCategories
    wizard.setState(userId, stateAfterGoTo)
  }

  const updatedState = wizard.getState(userId)

  const quickHandled = await QuickActionsHandlers.handleQuickAccount(
    wizard.getBot(),
    chatId,
    userId,
    updatedState!,
    wizard.clearState.bind(wizard)
  )
  if (!quickHandled) {
    await handleTxAccount(
      wizard,
      chatId,
      userId,
      txType === TransactionType.EXPENSE
        ? t(lang, "transactions.selectDeductAccount")
        : t(lang, "transactions.selectAddAccount")
    )
  }
  return true
}

export async function handleTxAmount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"

  const cleanText = text.replace(/^[^\d\s]+\s*/, "").trim()

  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(
    cleanText.trim(),
    defaultCurrency
  )
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      t(lang, "wizard.tx.invalidAmount", { currency: defaultCurrency })
    )
    return true
  }
  const txType = (state?.data?.txType || state.txType) as TransactionType

  if (parsed.amount < 0) {
    if (txType === TransactionType.EXPENSE) {
      await wizard.sendMessage(
        chatId,
        t(lang, "wizard.tx.refundConfirmMessage", {
          amount: Math.abs(parsed.amount),
          currency: parsed.currency,
        }),
        {
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "transactions.yesRefund") }],
              [
                { text: t(lang, "common.back") },
                { text: t(lang, "mainMenu.mainMenuButton") },
              ],
            ],
            resize_keyboard: true,
          },
        }
      )

      await wizard.goToStep(userId, "TX_CONFIRM_REFUND", {
        amount: Math.abs(parsed.amount),
        currency: parsed.currency,
      })
      return true
    } else if (txType === TransactionType.INCOME) {
      await wizard.sendMessage(
        chatId,
        t(lang, "transactions.negativeIncomeNotAllowed"),
        wizard.getBackButton(lang)
      )
      return true
    } else if (txType === TransactionType.TRANSFER) {
      await wizard.sendMessage(
        chatId,
        t(lang, "transactions.transferAmountPositive"),
        wizard.getBackButton(lang)
      )
      return true
    }
  }

  if (!state) return false
  state.data = {
    ...state.data,
    amount: parsed.amount,
    currency: parsed.currency,
  }
  if (state.data) {
    delete state.data.topCategoriesShown
    delete state.data!.accountsShown
    delete state.data!.toAccountsShown
    delete state.data.showedAllCategories
  }

  wizard.setState(userId, state)

  if (txType === TransactionType.TRANSFER) {
    await wizard.goToStep(userId, "TX_ACCOUNT", {
      amount: parsed.amount,
      currency: parsed.currency,
      category: InternalCategory.TRANSFER,
    })
    await helpers.resendCurrentStepPrompt(
      wizard,
      chatId,
      userId,
      wizard.getState(userId)!
    )
  } else {
    await wizard.goToStep(userId, "TX_CATEGORY", {
      amount: parsed.amount,
      currency: parsed.currency,
    })

    await helpers.resendCurrentStepPrompt(
      wizard,
      chatId,
      userId,
      wizard.getState(userId)!
    )
  }

  return true
}

export async function handleTxAccount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  const txType = (state?.data?.txType || state.txType) as TransactionType

  if (!state?.data?.accountsShown) {
    state.data!.accountsShown = true
    wizard.setState(userId, state)

    const balances = await db.getBalancesList(userId)

    let filteredBalances = balances
    if (txType === TransactionType.TRANSFER) {
      filteredBalances = balances.filter((b) => b.amount > 0)

      if (filteredBalances.length === 0) {
        await wizard.sendMessage(
          chatId,
          t(lang, "transactions.noPositiveBalance"),
          {
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "buttons.balances") }],
                [{ text: t(lang, "mainMenu.mainMenuButton") }],
              ],
              resize_keyboard: true,
            },
          }
        )
        wizard.clearState(userId)
        return true
      }
    }

    // For non-transfer transactions, show last used account
    let lastUsed: string | null = null
    if (txType !== TransactionType.TRANSFER && state?.data?.category) {
      lastUsed = await QuickActionsHandlers.getLastUsedAccount(
        userId,
        state?.data?.category
      )
    }

    const buttons = filteredBalances.map((b) => {
      const isLastUsed = lastUsed && b.accountId === lastUsed
      const prefix = isLastUsed ? "⭐ " : ""
      return [
        {
          text: `${prefix}${b.accountId} (${formatMoney(b.amount, b.currency)})`,
        },
      ]
    })
    buttons.push([
      { text: t(state?.lang || "en", "common.back") },
      { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
    ])

    await wizard.sendMessage(chatId, text, {
      reply_markup: { keyboard: buttons, resize_keyboard: true },
    })

    return true
  }

  // Process selected account
  let cleanText = text
  if (text.startsWith("⭐ ")) {
    cleanText = text.substring(2)
  }

  const accountName = cleanText.split(" (")[0]?.trim() || ""

  const balanceInfo = await db.getBalanceAmount(userId, accountName)

  if (!balanceInfo) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.accountNotFound", { account: accountName }),
      wizard.getBackButton(lang)
    )
    return true
  }

  const { amount: balanceAmount, currency: balanceCurrency } = balanceInfo

  if (txType === TransactionType.EXPENSE) {
    if (balanceCurrency !== state?.data?.currency) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.currencyMismatchAccount", {
          account: accountName,
          accountCurrency: balanceCurrency,
          transactionCurrency: state?.data?.currency || "",
        }),
        wizard.getBackButton(lang)
      )
      return true
    }

    if (balanceAmount < state?.data?.amount) {
      await wizard.sendMessage(
        chatId,
        handleInsufficientFunds(
          lang,
          accountName,
          balanceAmount,
          balanceCurrency,
          state?.data?.amount,
          state?.data?.currency
        ),
        {
          reply_markup: {
            keyboard: [
              [{ text: t(state?.lang || "en", "common.goToBalances") }],
              [
                { text: t(lang, "buttons.changeAmount") },
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

  if (
    state?.data?.isRefund ||
    state?.data?.category === IncomeCategory.REFUND
  ) {
    const transaction: Transaction = {
      id: randomUUID(),
      date: new Date(),
      amount: state?.data?.amount,
      currency: state?.data?.currency,
      type: TransactionType.INCOME,
      category: IncomeCategory.REFUND,
      description: t(lang, "transactions.refundDescription"),
      toAccountId: accountName,
    }
    await db.addTransaction(userId, transaction)

    await wizard.sendMessage(
      chatId,
      t(lang, "transactions.refundAdded", {
        amount: formatMoney(state?.data?.amount, state?.data?.currency),
        account: accountName,
      })
    )
    wizard.clearState(userId)
    await showMainMenu(wizard.getBot(), chatId, state?.lang || "en")

    return true
  }

  if (txType === TransactionType.TRANSFER) {
    await wizard.goToStep(userId, "TX_TO_ACCOUNT", {
      fromAccountId: accountName,
    })
    await helpers.resendCurrentStepPrompt(
      wizard,
      chatId,
      userId,
      wizard.getState(userId)!
    )
    return true
  }

  if (txType === TransactionType.EXPENSE && state?.data?.category) {
    const res = await db.applyExpenseToBudgets(
      userId,
      state?.data?.category as ExpenseCategory,
      state?.data?.amount,
      state?.data?.currency
    )

    if (
      res.overLimit &&
      res.limit !== undefined &&
      res.remaining !== undefined
    ) {
      await wizard.sendMessage(
        chatId,
        t(lang, "transactions.budgetExceeded", {
          category: state?.data?.category,
          limit: res.limit,
          overspent: Math.abs(res.remaining),
          currency: state?.data?.currency,
        }),
        wizard.getBackButton(lang)
      )
    }
  }

  const transaction: Transaction = {
    id: randomUUID(),
    date: new Date(),
    amount: state?.data?.amount,
    currency: state?.data?.currency,
    type: txType!,
    category: state?.data?.category,
    fromAccountId: txType === TransactionType.EXPENSE ? accountName : undefined,
    toAccountId: txType === TransactionType.INCOME ? accountName : undefined,
    description: state?.data?.category,
  }

  await db.addTransaction(userId, transaction)

  if (state?.data?.category && accountName) {
    await db.setCategoryPreferredAccount(
      userId,
      state?.data?.category,
      accountName
    )
  }

  const emoji = txType === TransactionType.EXPENSE ? "💸" : "💰"
  await wizard.sendMessage(
    chatId,
    t(lang, "transactions.addedDetails", {
      emoji,
      amount: formatMoney(state?.data?.amount, state?.data?.currency),
      category: state?.data?.category,
      account: accountName,
    }),
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: t(
                lang,
                txType === TransactionType.EXPENSE
                  ? "transactions.addAnotherExpense"
                  : "transactions.addAnotherIncome"
              ),
            },
          ],
          [{ text: t(state?.lang || "en", "mainMenu.mainMenuButton") }],
        ],
        resize_keyboard: true,
      },
    }
  )

  wizard.clearState(userId)
  return true
}

export async function handleTxToAccount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  // Show accounts list if not shown yet
  if (!state?.data?.toAccountsShown) {
    state.data!.toAccountsShown = true
    wizard.setState(userId, state)

    const balances = await db.getBalancesList(userId)

    // Filter out the source account
    const filteredBalances = balances.filter(
      (b) => b.accountId !== state?.data?.fromAccountId
    )

    const buttons = filteredBalances.map((b) => {
      return [
        {
          text: `${b.accountId} (${formatMoney(b.amount, b.currency)})`,
        },
      ]
    })
    buttons.push([
      { text: t(state?.lang || "en", "common.back") },
      { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
    ])

    await wizard.sendMessage(chatId, text, {
      reply_markup: { keyboard: buttons, resize_keyboard: true },
    })

    return true
  }

  const accountName = text.split(" (")[0]?.trim() || ""

  if (accountName === state?.data?.fromAccountId) {
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "errors.cannotTransferSameAccount"),
      wizard.getBackButton(lang)
    )
    return true
  }

  const transaction: Transaction = {
    id: randomUUID(),
    date: new Date(),
    amount: state?.data?.amount,
    currency: state?.data?.currency,
    type: TransactionType.TRANSFER,
    category: InternalCategory.TRANSFER,
    fromAccountId: state?.data?.fromAccountId,
    toAccountId: accountName,
    description: t(lang, "transactions.transferDescription"),
  }

  await db.addTransaction(userId, transaction)
  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId, state?.lang || "en")

  return true
}
