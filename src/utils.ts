import TelegramBot, { AnswerCallbackQueryOptions } from "node-telegram-bot-api"
import { Transaction, TransactionType } from "./types"

// Безопасный ответ на callback query (игнорирует устаревшие запросы)
export async function safeAnswerCallback(
  bot: TelegramBot,
  options?: AnswerCallbackQueryOptions
) {
  if (!options) return

  try {
    await bot.answerCallbackQuery(options.callback_query_id, options)
  } catch (err: unknown) {
    // Игнорируем ошибки устаревших callback queries
    const error = err as {
      response?: { body?: { description?: string } }
      message?: string
    }
    if (
      error?.response?.body?.description?.includes("query is too old") ||
      error?.response?.body?.description?.includes("query ID is invalid")
    ) {
      return
    }
    console.error("Error answering callback:", error.message || err)
  }
}

export function formatAmount(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return "0.00"
  return Number(amount) % 1 === 0
    ? Number(amount).toString()
    : Number(amount).toFixed(2)
}

export function formatMoney(
  amount: number,
  currency?: string,
  withoutSpace?: boolean
): string {
  if (!currency) {
    return formatAmount(amount)
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  })
  const parts = formatter.formatToParts(amount)
  const symbol =
    parts.find((part) => part.type === "currency")?.value || currency
  return `${formatAmount(amount)}${withoutSpace ? "" : " "}${symbol}`
}

export function matchTransaction(
  tx: Transaction,
  type?: TransactionType,
  accountId?: string,
  category?: string
): boolean {
  if (type && tx.type !== type) return false

  if (accountId) {
    const isMatch =
      tx.fromAccountId === accountId || tx.toAccountId === accountId
    if (!isMatch) return false
  }

  if (category && tx.category !== category) return false

  return true
}

export function handleInsufficientFunds(
  accountName: string,
  accountBalance: number,
  accountCurrency: string,
  requiredAmount: number,
  requiredCurrency?: string
): string {
  const shortage = requiredAmount - accountBalance
  const message =
    `❌ Insufficient funds!\n\n` +
    `Account: ${accountName}\n` +
    `Available: ${formatMoney(accountBalance, accountCurrency)}\n` +
    `Required: ${formatMoney(requiredAmount, requiredCurrency || accountCurrency)}\n\n` +
    `Shortage: ${formatMoney(shortage, requiredCurrency || accountCurrency)}` +
    "\n\n💡 You can change the amount or add funds to your account."

  return message
}

export function createListButtons(options: {
  items: string[]
  withoutBack?: boolean
  beforeItemsButtons?: TelegramBot.KeyboardButton[][]
  afterItemsButtons?: string[]
  itemsPerRowCustom?: number
}): TelegramBot.KeyboardButton[][] {
  const {
    items,
    withoutBack,
    beforeItemsButtons = [],
    afterItemsButtons = [],
    itemsPerRowCustom = 2,
  } = options

  const buttons: TelegramBot.KeyboardButton[][] = beforeItemsButtons

  if (afterItemsButtons) items.push(...afterItemsButtons)
  const itemsPerRow = items.length >= 4 ? itemsPerRowCustom : 1

  for (let i = 0; i < items.length; i += itemsPerRow) {
    const row: TelegramBot.KeyboardButton[] = []
    for (let j = 0; j < itemsPerRow && i + j < items.length; j++) {
      const text = items[i + j]
      if (text) {
        row.push({ text })
      }
    }
    if (row.length > 0) {
      buttons.push(row)
    }
  }

  if (withoutBack) buttons.push([{ text: "🏠 Main Menu" }])
  else buttons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

  return buttons
}

export const formatDate = (date: Date): string => {
  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}`
}

export const getTransactionSign = (type: TransactionType): string => {
  return type === TransactionType.EXPENSE
    ? "-"
    : type === TransactionType.INCOME
      ? "+"
      : "↔"
}

export const getTransactionLabel = (tx: Transaction): string => {
  if (
    tx.category === "Goal 🎯" &&
    tx.description?.startsWith("Goal Deposit:")
  ) {
    const goalName = tx.description.replace("Goal Deposit: ", "").trim()
    return `Goal: ${goalName}`
  }

  if (
    tx.category === "Debt 📉" &&
    tx.description?.startsWith("Debt repayment:")
  ) {
    const debtName = tx.description.replace("Debt repayment: ", "").trim()
    return `Debt: ${debtName}`
  }

  return tx.category as unknown as string
}
