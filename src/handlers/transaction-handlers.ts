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
import { showMainMenu, showBalancesMenu } from "../menus"
import { QuickActionsHandlers } from "./quick-actions-handlers"
import * as helpers from "../wizards/helpers"
import { randomUUID } from "crypto"

export async function handleTxCategory(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const txType = (state.data?.txType || state.txType) as TransactionType

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
      txType
    )
    state.data.showedAllCategories = true
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
      "❌ Invalid category. Please select from the list.",
      wizard.getBackButton()
    )
    state.data.showedAllCategories = true
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
    updatedState,
    wizard.clearState.bind(wizard)
  )
  if (!quickHandled) {
    await handleTxAccount(
      wizard,
      chatId,
      userId,
      txType === TransactionType.EXPENSE
        ? "💸 Select account to deduct from:"
        : "💰 Select account to add to:"
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
  const cleanText = text.replace(/^[^\d\s]+\s*/, '').trim()

  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(cleanText.trim(), defaultCurrency)
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`
    )
    return true
  }

  const state = wizard.getState(userId)
  if (!state) return false

  const txType = (state.data?.txType || state.txType) as TransactionType

  if (parsed.amount < 0) {
    if (txType === TransactionType.EXPENSE) {
      await wizard.sendMessage(
        chatId,
        `⚠️ Negative amount detected: ${parsed.amount} ${parsed.currency}\n\n` +
        `This means a REFUND (money returned to you).\n\n` +
        `This will increase your balance. Proceed?`,
        {
          reply_markup: {
            keyboard: [
              [{ text: "✅ Yes, it's a refund" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
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
        `❌ Negative income doesn't make sense. Please enter a positive amount.`,
        wizard.getBackButton()
      )
      return true
    } else if (txType === TransactionType.TRANSFER) {
      await wizard.sendMessage(
        chatId,
        `❌ Transfer amount must be positive.`,
        wizard.getBackButton()
      )
      return true
    }
  }

  state.data = {
    ...state.data,
    amount: parsed.amount,
    currency: parsed.currency,
  }
  delete state.data.topCategoriesShown
  delete state.data.accountsShown
  delete state.data.toAccountsShown
  delete state.data.showedAllCategories

  console.log("[TX_AMOUNT] after delete flags:", JSON.stringify({ txType, step: state.step, data: state.data }, null, 2))

  wizard.setState(userId, state)

  if (txType === TransactionType.TRANSFER) {
    console.log("[TX_AMOUNT] ✅ Transfer detected, going to TX_ACCOUNT")
    await wizard.goToStep(userId, "TX_ACCOUNT", {
      amount: parsed.amount,
      currency: parsed.currency,
      category: InternalCategory.TRANSFER,
    })
    const stateAfterGoTo = wizard.getState(userId)
    console.log("[TX_AMOUNT] After goToStep:", JSON.stringify({ step: stateAfterGoTo?.step, txType: stateAfterGoTo?.txType, dataTxType: stateAfterGoTo?.data?.txType, data: stateAfterGoTo?.data }, null, 2))
    await helpers.resendCurrentStepPrompt(
      wizard,
      chatId,
      userId,
      wizard.getState(userId)!
    )
  } else {
    console.log("[TX_AMOUNT] Not transfer, going to TX_CATEGORY")
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

  const txType = (state.data?.txType || state.txType) as TransactionType
  console.log("[TX_ACCOUNT] entered:", JSON.stringify({ txType, step: state.step, data: state.data, text }, null, 2))

  // Show accounts list if not shown yet
  if (!state.data.accountsShown) {
    console.log("[TX_ACCOUNT] Showing accounts list")
    state.data.accountsShown = true
    wizard.setState(userId, state)

    const balances = await db.getBalancesList(userId)

    // For Transfer: only show accounts with positive balance
    let filteredBalances = balances
    if (txType === TransactionType.TRANSFER) {
      filteredBalances = balances.filter((b) => b.amount > 0)

      if (filteredBalances.length === 0) {
        await wizard.sendMessage(
          chatId,
          "❌ No accounts with positive balance available for transfer.",
          {
            reply_markup: {
              keyboard: [
                [{ text: "💳 Balances" }],
                [{ text: "🏠 Main Menu" }],
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
    if (txType !== TransactionType.TRANSFER && state.data.category) {
      lastUsed = await QuickActionsHandlers.getLastUsedAccount(
        userId,
        state.data.category
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
    buttons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

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

  const accountName = cleanText.split(" (")[0].trim()

  const balanceInfo = await db.getBalanceAmount(userId, accountName)

  if (!balanceInfo) {
    await wizard.sendMessage(
      chatId,
      `❌ Error: Account "${accountName}" not found.`,
      wizard.getBackButton()
    )
    return true
  }

  const { amount: balanceAmount, currency: balanceCurrency } = balanceInfo

  if (txType === TransactionType.EXPENSE) {
    if (balanceCurrency !== state.data.currency) {
      await wizard.sendMessage(
        chatId,
        `❌ Currency mismatch. Account "${accountName}" is in ${balanceCurrency}, but expense is in ${state.data.currency}.`,
        wizard.getBackButton()
      )
      return true
    }

    if (balanceAmount < state.data.amount) {
      await wizard.sendMessage(
        chatId,
        handleInsufficientFunds(
          accountName,
          balanceAmount,
          balanceCurrency,
          state.data.amount,
          state.data.currency
        ),
        {
          reply_markup: {
            keyboard: [
              [{ text: "💳 Go to Balances" }],
              [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }
  }

  if (state.data.isRefund || state.data.category === IncomeCategory.REFUND) {
    const transaction: Transaction = {
      id: randomUUID(),
      date: new Date(),
      amount: state.data.amount,
      currency: state.data.currency,
      type: TransactionType.INCOME,
      category: IncomeCategory.REFUND,
      description: "Refund",
      toAccountId: accountName,
    }
    await db.addTransaction(userId, transaction)

    await wizard.sendMessage(
      chatId,
      `✅ Refund of ${state.data.amount} ${state.data.currency} added to "${accountName}"!`
    )
    wizard.clearState(userId)
    await showMainMenu(wizard.getBot(), chatId)

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

  if (txType === TransactionType.EXPENSE && state.data.category) {
    const res = await db.applyExpenseToBudgets(
      userId,
      state.data.category as ExpenseCategory,
      state.data.amount,
      state.data.currency
    )

    if (
      res.overLimit &&
      res.limit !== undefined &&
      res.remaining !== undefined
    ) {
      await wizard.sendMessage(
        chatId,
        `⚠️ Budget exceeded for ${state.data.category}!\n` +
        `Limit: ${res.limit} ${state.data.currency}\n` +
        `Overspent: ${Math.abs(res.remaining)} ${state.data.currency}`,
        wizard.getBackButton()
      )
    }
  }

  const transaction: Transaction = {
    id: randomUUID(),
    date: new Date(),
    amount: state.data.amount,
    currency: state.data.currency,
    type: txType!,
    category: state.data.category,
    fromAccountId:
      txType === TransactionType.EXPENSE ? accountName : undefined,
    toAccountId:
      txType === TransactionType.INCOME ? accountName : undefined,
    description: state.data.category,
  }

  await db.addTransaction(userId, transaction)

  if (state.data.category && accountName) {
    await db.setCategoryPreferredAccount(
      userId,
      state.data.category,
      accountName
    )
  }

  const emoji = txType === TransactionType.EXPENSE ? "💸" : "💰"
  await wizard.sendMessage(
    chatId,
    `✅ ${emoji} Added: ${formatMoney(state.data.amount, state.data.currency)}\n` +
    `Category: ${state.data.category}\n` +
    `Account: ${accountName}`,
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: `✨ Add Another${txType === TransactionType.EXPENSE ? " Expense" : " Income"}`,
            },
          ],
          [{ text: "🏠 Main Menu" }],
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

  // Show accounts list if not shown yet
  if (!state.data.toAccountsShown) {
    state.data.toAccountsShown = true
    wizard.setState(userId, state)

    const balances = await db.getBalancesList(userId)

    // Filter out the source account
    const filteredBalances = balances.filter(
      (b) => b.accountId !== state.data.fromAccountId
    )

    const buttons = filteredBalances.map((b) => {
      return [
        {
          text: `${b.accountId} (${formatMoney(b.amount, b.currency)})`,
        },
      ]
    })
    buttons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

    await wizard.sendMessage(chatId, text, {
      reply_markup: { keyboard: buttons, resize_keyboard: true },
    })

    return true
  }

  const accountName = text.split(" (")[0].trim()

  if (accountName === state.data.fromAccountId) {
    await wizard.sendMessage(
      chatId,
      "❌ Cannot transfer to the same account. Please select a different destination.",
      wizard.getBackButton()
    )
    return true
  }

  const transaction: Transaction = {
    id: randomUUID(),
    date: new Date(),
    amount: state.data.amount,
    currency: state.data.currency,
    type: TransactionType.TRANSFER,
    category: InternalCategory.TRANSFER,
    fromAccountId: state.data.fromAccountId,
    toAccountId: accountName,
    description: "Transfer",
  }

  await db.addTransaction(userId, transaction)
  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId)

  return true
}
