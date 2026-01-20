import TelegramBot from "node-telegram-bot-api"

import {
  TransactionType,
  IncomeCategory,
  ExpenseCategory,
  InternalCategory,
  Currency,
  Transaction,
  Debt,
  Goal,
  TransactionCategory,
} from "../types"
import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import {
  showAnalyticsReportsMenu,
  showBalancesMenu,
  showBudgetMenu,
  showDebtsMenu,
  showGoalsMenu,
  showHistoryMenu,
  showIncomeSourcesMenu,
  showMainMenu,
  showSettingsMenu,
  showStatsMenu,
} from "../menus"
import { createListButtons, formatAmount, formatMoney } from "../utils"

import * as handlers from "../handlers"
import * as helpers from "./helpers"
import { createProgressBar, formatTopExpenses, formatTrends, generateCSV, getProgressEmoji } from "../reports"
import { randomUUID } from "crypto"
import { reminderManager } from "../services/reminder-manager"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WizardData = Record<string, any>

export interface WizardState {
  step: string
  data?: WizardData
  txType?: TransactionType
  history?: string[]
  returnTo?: string // Контекст возврата: 'debts', 'goals', 'balances', 'income', 'transaction_menu'
}

export class WizardManager {
  private userStates: Record<string, WizardState> = {}

  private toTitleCase(s: string) {
    const t = s.trim()
    if (!t) return t
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  constructor(private bot: TelegramBot) { }

  async sendMessage(
    chatId: number,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    return await this.bot.sendMessage(chatId, text, options)
  }

  getBot(): TelegramBot {
    return this.bot
  }

  getBackButton() {
    return {
      reply_markup: {
        keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
        resize_keyboard: true,
      },
    }
  }

  isInWizard(userId: string): boolean {
    return !!this.userStates[userId]
  }

  getState(userId: string): WizardState | undefined {
    return this.userStates[userId]
  }

  setState(userId: string, state: WizardState) {
    if (!state.history) {
      state.history = []
    }
    this.userStates[userId] = state as Required<WizardState>
  }

  async goToStep(userId: string, nextStep: string, data?: WizardData) {
    const state = this.getState(userId)
    if (!state) return

    if (state.step !== nextStep) {
      if (!state.history) {
        state.history = []
      }
      state.history.push(state.step)
    }

    state.step = nextStep

    if (state.data && state.history.length > 0) {
      const prevStep = state.history[state.history.length - 1]
      const oldFlow = prevStep.split("_")[0]
      const newFlow = nextStep.split("_")[0]

      if (oldFlow !== newFlow) {
        delete state.data.accountsShown
        delete state.data.topCategoriesShown
      }
    }

    if (data) {
      state.data = { ...state.data, ...data }
    }
    this.setState(userId, state)
  }

  clearState(userId: string) {
    delete this.userStates[userId]
  }

  async returnToContext(chatId: number, userId: string, returnTo?: string) {
    switch (returnTo) {
      case "debts":
        await showDebtsMenu(this.bot, chatId, userId)
        break
      case "goals":
        await showGoalsMenu(this.bot, chatId, userId)
        break
      case "balances":
        await showBalancesMenu(this, chatId, userId)
        break
      case "income":
        await showIncomeSourcesMenu(this.bot, chatId, userId)
        break
      case "settings":
        await showSettingsMenu(this.bot, chatId, userId)
        break
      case "history":
        await showHistoryMenu(this, chatId, userId)
        break
      case "analytics":
        await showStatsMenu(this.bot, chatId)
        break
      case "budgets":
        await showBudgetMenu(this, chatId, userId)
        break
      case "reports":
        await showAnalyticsReportsMenu(this, chatId, userId)
        break

      default:
        await showMainMenu(this.bot, chatId)
    }
  }

  async handleWizardInput(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)

    if (text === "🏠 Main Menu") {
      this.clearState(userId)
      await showMainMenu(this.bot, chatId)

      return true
    }

    if (text === "💳 Balances" || text === "💳 Go to Balances") {
      this.clearState(userId)
      await showBalancesMenu(this, chatId, userId)

      return true
    }

    if (text === "💫 Change Amount") {
      if (!state) {
        await showMainMenu(this.bot, chatId)
        return true
      }

      await this.goToStep(userId, "TX_AMOUNT", state.data)
      await helpers.resendCurrentStepPrompt(this, chatId, userId, this.getState(userId)!)
      return true
    }

    if (text === "⬅️ Back") {
      if (!state) {
        await showMainMenu(this.bot, chatId)

        return true
      }

      if (!state.history || state.history.length === 0) {
        this.clearState(userId)

        await this.returnToContext(chatId, userId, state.returnTo)
        return true
      }

      if (state.step === "TX_CATEGORY" && state.data?.showedAllCategories) {
        delete state.data.topCategoriesShown
        delete state.data.showedAllCategories
        this.setState(userId, state)
        await helpers.resendCurrentStepPrompt(this, chatId, userId, state)
        return true
      }

      const prevStep = state.history.pop()
      state.step = prevStep

      if (state.step === "TX_ACCOUNT" && state.data?.accountsShown) {
        delete state.data.accountsShown
      }
      if (state.step === "TX_TO_ACCOUNT" && state.data?.toAccountsShown) {
        delete state.data.toAccountsShown
      }

      this.setState(userId, state)
      await helpers.resendCurrentStepPrompt(this, chatId, userId, state)
      return true
    }

    if (!state) return false

    try {
      switch (state.step) {
        // --- Transaction Flow ---
        case "TX_AMOUNT":
          return await handlers.handleTxAmount(this, chatId, userId, text)
        case "TX_CATEGORY":
          return await handlers.handleTxCategory(this, chatId, userId, text)
        case "TX_ACCOUNT":
          return await handlers.handleTxAccount(this, chatId, userId, text)
        case "TX_TO_ACCOUNT":
          return await handlers.handleTxToAccount(this, chatId, userId, text)

        case "TX_CONFIRM_REFUND": {
          if (text === "✅ Yes, it's a refund") {
            await this.goToStep(userId, "TX_ACCOUNT", {
              category: IncomeCategory.REFUND,
              amount: state.data.amount,
              currency: state.data.currency,
              isRefund: true,
            })
            await handlers.handleTxToAccount(
              this,
              chatId,
              userId,
              "📥 Select account to receive refund:"
            )
            return true
          }
          return false
        }
        case "HISTORY_LIST": {
          const recentTxs = await db.getRecentTransactions(userId, 5)

          const selected = recentTxs.find((tx) => {
            const emoji =
              tx.type === "EXPENSE" ? "📉" : tx.type === "INCOME" ? "📈" : "↔️"
            return text.includes(
              `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
            )
          })

          if (text === "🔍 Filters") {
            await this.goToStep(userId, "TX_VIEW_PERIOD")
            this.bot.sendMessage(
              chatId,
              "📋 *Transaction History*\n\nSelect filter:",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "📅 Last 7 days" }, { text: "📅 Last 30 days" }],
                    [{ text: "💸 Expenses only" }, { text: "💰 Income only" }],
                    [
                      { text: "📅 Custom Period" },
                      { text: "🔍 All transactions" },
                    ],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )

            return true
          }

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a transaction from the list.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "TX_EDIT_MENU", { transaction: selected })

          const account =
            selected.fromAccountId || selected.toAccountId || "N/A"
          await this.bot.sendMessage(
            chatId,
            `📋 *Transaction Details*\n\n` +
            `Type: ${selected.type}\n` +
            `Category: ${selected.category}\n` +
            `Amount: ${selected.amount} ${selected.currency}\n` +
            `Account: ${account}\n` +
            `Date: ${new Date(selected.date).toLocaleDateString("en-GB")}\n\n` +
            `What would you like to do?`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Edit Amount" }],
                  [{ text: "📝 Edit Category" }],
                  [{ text: "💳 Edit Account" }],
                  [{ text: "🗑️ Delete Transaction" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "TX_VIEW_PERIOD": {
          const allTransactions = await db.getAllTransactions(userId)
          let filtered = allTransactions

          if (text === "📅 Last 7 days") {
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            filtered = filtered.filter((tx) => new Date(tx.date) >= weekAgo)
          } else if (text === "📅 Last 30 days") {
            const monthAgo = new Date()
            monthAgo.setDate(monthAgo.getDate() - 30)
            filtered = filtered.filter((tx) => new Date(tx.date) >= monthAgo)
          } else if (text === "💸 Expenses only") {
            filtered = filtered.filter(
              (tx) => tx.type === TransactionType.EXPENSE
            )
          } else if (text === "💰 Income only") {
            filtered = filtered.filter(
              (tx) => tx.type === TransactionType.INCOME
            )
          } else if (text === "📅 Custom Period") {
            await this.goToStep(userId, "CUSTOM_PERIOD_SINGLE")
            await this.bot.sendMessage(
              chatId,
              `📅 *Period*\n\n1️⃣ DD.MM.YYYY-DD.MM.YYYY\n` +
              `Example: \`01.01.2026-13.01.2026\``,
              { parse_mode: "Markdown", ...this.getBackButton() }
            )
            return true
          }

          if (filtered.length === 0) {
            await this.bot.sendMessage(
              chatId,
              "📬 No transactions match this filter.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "TX_VIEW_LIST", {
            transactions: filtered,
            period: text,
            offset: 0,
          })

          const toShow = filtered.slice(0, 10)

          const items = toShow.map((tx) => {
            const emoji =
              tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
            return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
          })

          const keyboard = createListButtons({
            items,
            afterItemsButtons: filtered.length > 10 && ["🔍 View More"],
          })

          let msg = `📋 *Transaction History* (${text})\n\n`
          msg += `Showing ${toShow.length} of ${filtered.length} transaction(s)\n\n`
          msg += `Select transaction to edit:`

          await this.bot.sendMessage(chatId, msg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard,
              resize_keyboard: true,
            },
          })
          return true
        }
        case "CUSTOM_PERIOD_SINGLE": {
          const match = text.match(
            /(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{4})/
          )

          if (!match) {
            await this.bot.sendMessage(
              chatId,
              `❌ *Wrong format!*\n\n` +
              `✅ Example: \`01.01.2026-13.01.2026\`\n\n` +
              `📋 Day: 01-31, Month: 01-12, Year: 2026`,
              { parse_mode: "Markdown", ...this.getBackButton() }
            )
            return true
          }

          const [, sd, sm, sy, ed, em, ey] = match
          const startDateStr = `${sy}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}`
          const endDateStr = `${ey}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}`

          const startDate = new Date(startDateStr)
          const endDate = new Date(endDateStr)

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            await this.bot.sendMessage(
              chatId,
              "❌ Wrong dates!",
              this.getBackButton()
            )
            return true
          }

          if (endDate < startDate) {
            await this.bot.sendMessage(
              chatId,
              "❌ End date before Start!",
              this.getBackButton()
            )
            return true
          }

          const allTransactions = await db.getAllTransactions(userId)
          const filtered = allTransactions.filter((tx: Transaction) => {
            const txDate = new Date(tx.date)
            return txDate >= startDate && txDate <= endDate
          })

          if (filtered.length === 0) {
            await this.bot.sendMessage(
              chatId,
              `📭 *No transactions*\n\nFor period ${text}`,
              this.getBackButton()
            )
            return true
          }

          // ✅ ПОКАЗЫВАЕМ СПИСОК
          await this.goToStep(userId, "TX_VIEW_LIST", {
            transactions: filtered,
            period: `${text} (${filtered.length} transactions)`,
            offset: 0,
          })

          const toShow = filtered.slice(0, 10)
          const items = toShow.map((tx: Transaction) => {
            const emoji =
              tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
            return `${emoji} ${tx.category}\n${formatMoney(tx.amount, tx.currency)}`
          })

          await this.bot.sendMessage(
            chatId,
            `📋 *Custom Period: ${text}*\n\n` +
            `Found ${filtered.length} transaction${filtered.length > 1 ? "s" : ""}\n\n` +
            `Choose for editing:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: createListButtons({
                  items,
                  afterItemsButtons:
                    filtered.length > 10 ? ["🔍 View More"] : [],
                }),
                resize_keyboard: true,
              },
            }
          )

          return true
        }
        case "TX_VIEW_LIST": {
          const { transactions, offset, period } = state.data

          if (text === "🔍 View More") {
            const nextOffset = offset + 10
            const nextBatch = transactions.slice(nextOffset, nextOffset + 10)

            if (nextBatch.length === 0) {
              await this.bot.sendMessage(
                chatId,
                "📭 No more transactions",
                this.getBackButton()
              )
              return true
            }

            await this.goToStep(userId, "TX_VIEW_LIST", {
              transactions,
              period,
              offset: nextOffset,
            })

            const toShow = nextBatch
            const items = toShow.map((tx: Transaction) => {
              const emoji =
                tx.type === "EXPENSE"
                  ? "💸"
                  : tx.type === "INCOME"
                    ? "💰"
                    : "↔️"
              return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
            })

            await this.bot.sendMessage(
              chatId,
              `📋 *Next batch* (${period})\n\nShowing ${nextOffset + 1}-${nextOffset + toShow.length} of ${transactions.length}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: createListButtons({
                    items,
                    afterItemsButtons:
                      nextOffset + 10 < transactions.length
                        ? ["🔙 Previous Page", "🔍 View More"]
                        : ["🔙 Previous Page"],
                  }),
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          if (text === "🔙 Previous Page") {
            const prevOffset = Math.max(0, offset - 10)

            await this.goToStep(userId, "TX_VIEW_LIST", {
              transactions,
              period,
              offset: prevOffset,
            })

            const toShow = transactions.slice(prevOffset, prevOffset + 10)
            const items = toShow.map((tx: Transaction) => {
              const emoji =
                tx.type === "EXPENSE"
                  ? "💸"
                  : tx.type === "INCOME"
                    ? "💰"
                    : "↔️"
              return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
            })

            const afterButtons = []
            if (prevOffset > 0) {
              afterButtons.push("🔙 Previous Page")
            }
            if (prevOffset + 10 < transactions.length) {
              afterButtons.push("🔍 View More")
            }

            await this.bot.sendMessage(
              chatId,
              `📋 *Previous batch* (${period})\n\nShowing ${prevOffset + 1}-${prevOffset + toShow.length} of ${transactions.length}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: createListButtons({
                    items,
                    afterItemsButtons: afterButtons,
                  }),
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          const selected = transactions.find((tx: Transaction) => {
            const emoji =
              tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
            return (
              text ===
              `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
            )
          })

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a transaction from the list.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "TX_EDIT_MENU", { transaction: selected })

          const account =
            selected.fromAccountId || selected.toAccountId || "N/A"
          await this.bot.sendMessage(
            chatId,
            `📋 *Transaction Details*\n\n` +
            `Type: ${selected.type}\n` +
            `Category: ${selected.category}\n` +
            `Amount: ${selected.amount} ${selected.currency}\n` +
            `Account: ${account}\n` +
            `Date: ${new Date(selected.date).toLocaleDateString("en-GB")}\n\n` +
            `What would you like to do?`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Edit Amount" }],
                  [{ text: "📝 Edit Category" }],
                  [{ text: "💳 Edit Account" }],
                  [{ text: "🗑️ Delete Transaction" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "TX_EDIT_MENU": {
          const tx = state.data?.transaction
          if (!tx) return true

          if (text === "✏️ Edit Amount") {
            await this.goToStep(userId, "TX_EDIT_AMOUNT", { transaction: tx })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `✏️ *Edit Amount*\n\nCurrent: \n${formatMoney(tx.amount, tx.currency)}\n\nEnter new amount (e.g. 100 or 100 ${defaultCurrency}):`,
              this.getBackButton()
            )
          } else if (text === "📝 Edit Category") {
            await this.goToStep(userId, "TX_EDIT_CATEGORY", { transaction: tx })

            if (tx.type === TransactionType.EXPENSE) {
              const categories = Object.values(ExpenseCategory)
              const items = categories.map((c) => c)
              const keyboard = createListButtons({ items })

              await this.bot.sendMessage(
                chatId,
                `📝 *Edit Category*\n\nCurrent: ${tx.category}\n\nSelect new category:`,
                {
                  parse_mode: "Markdown",
                  reply_markup: { keyboard, resize_keyboard: true },
                }
              )
            } else if (tx.type === TransactionType.INCOME) {
              const categories = Object.values(IncomeCategory)
              const items = categories.map((c) => c)
              const keyboard = createListButtons({ items })

              await this.bot.sendMessage(
                chatId,
                `📝 *Edit Category*\n\nCurrent: ${tx.category}\n\nSelect new category:`,
                {
                  parse_mode: "Markdown",
                  reply_markup: { keyboard, resize_keyboard: true },
                }
              )
            }
          } else if (text === "💳 Edit Account") {
            await this.goToStep(userId, "TX_EDIT_ACCOUNT", { transaction: tx })
            const account = tx.fromAccountId || tx.toAccountId || "N/A"
            await handlers.handleTxAccount(
              this,
              chatId,
              userId,
              `💳 *Edit Account*\n\nCurrent: ${account}\n\nSelect new account:`
            )
          } else if (text === "🗑️ Delete Transaction") {
            const success = await db.deleteTransaction(userId, tx.id)

            if (success) {
              await this.bot.sendMessage(chatId, "✅ Transaction deleted!")
            } else {
              await this.bot.sendMessage(
                chatId,
                "❌ Error deleting transaction"
              )
              await showHistoryMenu(this, chatId, userId)
              return true
            }

            const recentTxs = await db.getRecentTransactions(userId, 5)

            if (recentTxs.length === 0) {
              await this.bot.sendMessage(
                chatId,
                "💭 No more transactions to edit.",
                {
                  reply_markup: {
                    keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
                    resize_keyboard: true,
                  },
                }
              )
              await showHistoryMenu(this, chatId, userId)
              return true
            }

            const items = recentTxs.map((tx) => {
              const emoji =
                tx.type === "EXPENSE"
                  ? "💸"
                  : tx.type === "INCOME"
                    ? "💰"
                    : "↔️"
              return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
            })

            const keyboard = createListButtons({ items })

            await this.bot.sendMessage(
              chatId,
              "✏️ *Edit Transactions*\n\nSelect another transaction to edit:",
              {
                parse_mode: "Markdown",
                reply_markup: { keyboard: keyboard, resize_keyboard: true },
              }
            )
          }

          return true
        }
        case "TX_EDIT_AMOUNT": {
          const tx = state.data?.transaction
          if (!tx) return true

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid amount. Try: 100 or 100 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          // Обновляем транзакцию в БД
          const success = await db.updateTransaction(userId, tx.id, {
            amount: parsed.amount,
            currency: parsed.currency,
          })

          if (success) {
            await this.bot.sendMessage(
              chatId,
              `✅ Amount updated to ${parsed.amount} ${parsed.currency}!`
            )
          } else {
            await this.bot.sendMessage(chatId, "❌ Error updating transaction.")
          }

          await showHistoryMenu(this, chatId, userId)
          return true
        }
        case "TX_EDIT_CATEGORY": {
          const tx = state.data?.transaction
          if (!tx) return true

          let isValid = false
          if (tx.type === TransactionType.EXPENSE) {
            isValid = Object.values(ExpenseCategory).includes(
              text as ExpenseCategory
            )
          } else if (tx.type === TransactionType.INCOME) {
            isValid = Object.values(IncomeCategory).includes(
              text as IncomeCategory
            )
          }

          if (!isValid) {
            await this.bot.sendMessage(
              chatId,
              "❌ Please select a category from the list.",
              this.getBackButton()
            )
            return true
          }

          // Обновляем категорию
          const success = await db.updateTransaction(userId, tx.id, {
            category: text as TransactionCategory,
          })

          if (success) {
            await this.bot.sendMessage(
              chatId,
              `✅ Category updated to "${text}"!`
            )
          } else {
            await this.bot.sendMessage(chatId, "❌ Error updating transaction.")
          }

          await showHistoryMenu(this, chatId, userId)
          return true
        }
        case "TX_EDIT_ACCOUNT": {
          const tx = state.data?.transaction
          if (!tx) return true

          const match = text.match(/^(.+?)\s+\([\d.]+\s+[A-Z]{3}\)$/)
          let newAccountId: string

          if (match) {
            newAccountId = match[1].trim()
          } else {
            newAccountId = text.trim()
          }

          if (!newAccountId) {
            await this.bot.sendMessage(
              chatId,
              "❌ Invalid account name.",
              this.getBackButton()
            )
            return true
          }

          const updateData: { fromAccountId?: string; toAccountId?: string } =
            {}
          if (tx.fromAccountId) {
            updateData.fromAccountId = newAccountId
          }
          if (tx.toAccountId) {
            updateData.toAccountId = newAccountId
          }

          const success = await db.updateTransaction(userId, tx.id, updateData)

          if (success) {
            await this.bot.sendMessage(
              chatId,
              `✅ Account updated to "${newAccountId}"!`
            )
          } else {
            await this.bot.sendMessage(chatId, "❌ Error updating transaction.")
          }

          await showHistoryMenu(this, chatId, userId)
          return true
        }

        // --- Debt Flow ---
        case "DEBT_CREATE_DETAILS":
          return await handlers.handleDebtCreateDetails(
            this,
            chatId,
            userId,
            text
          )
        case "DEBT_PARTIAL_AMOUNT":
          return await handlers.handleDebtPartialAmount(
            this,
            chatId,
            userId,
            text
          )
        case "DEBT_PARTIAL_ACCOUNT":
          return await handlers.handleDebtPartialAccount(
            this,
            chatId,
            userId,
            text
          )
        case "DEBT_TYPE": {
          const type = text === "🔴 I Owe" ? "I_OWE" : "OWES_ME"

          await this.goToStep(userId, "DEBT_CREATE_DETAILS", { type })

          const emoji = type === "I_OWE" ? "🔴" : "🟢"
          const action = type === "I_OWE" ? "owe to" : "lent to"
          const defaultCurrency = await db.getDefaultCurrency(userId)

          await this.bot.sendMessage(
            chatId,
            `${emoji} Enter person's name and amount you ${action}:\n\n` +
            `💡 *Format:* Name Amount [Currency]\n\n` +
            `*Examples:*\n` +
            `• John 1000\n` +
            `• Maria 5000 USD\n` +
            `• Alex 50000 ${defaultCurrency}`,
            {
              parse_mode: "Markdown",
              ...this.getBackButton(),
            }
          )
          return true
        }
        case "DEBT_EDIT_SELECT": {
          if (text === "✨ Add Debt") {
            await this.goToStep(userId, "DEBT_TYPE", {})
            await this.bot.sendMessage(chatId, "Select debt type:", {
              reply_markup: {
                keyboard: [
                  [{ text: "🔴 I Owe" }, { text: "🟢 They Owe Me" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            })
            return true
          }


          const userData = await db.getUserData(userId)
          const debts = userData.debts.filter((d: Debt) => !d.isPaid)

          const selected = debts.find((d: Debt) => {
            return text === `${d.name}`
          })

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a debt from the list.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "DEBT_MENU", { debt: selected })

          const { amount, paidAmount, type, dueDate, name, currency, autoPayment } = selected
          let msg = ""
          const remaining = amount - paidAmount
          const progress = createProgressBar(paidAmount, amount)
          const emoji =
            type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
          const action = type === "I_OWE" ? "pay" : "receive"

          msg += `${emoji} *${name}*\n`
          msg += `${progress}\n`

          if (paidAmount === 0) {
            msg += `Total: ${formatMoney(amount, currency)}\n`
          } else if (remaining > 0) {
            msg += `Remaining: ${formatMoney(remaining, currency)}\n`
          } else {
            msg += `🎉 Goal achieved!\n`
          }

          if (dueDate) {
            const deadlineDate = new Date(dueDate)
            msg += `Due: ${deadlineDate.toLocaleDateString('en-GB')}\n`
          }

          msg += `\n💡 Enter amount to ${action}`

          const deadlineButtons = dueDate ?
            [
              [{ text: "📅 Change Deadline" }],
              [{ text: "🔕 Disable Reminders" }],
              [{ text: autoPayment?.enabled ? "❌ Disable Auto-Payment" : "✅ Enable Auto-Payment" }]
            ]
            : [[{ text: "📅 Set Deadline" }]]

          await this.bot.sendMessage(
            chatId,
            msg,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Edit Amount" }],
                  ...deadlineButtons,
                  [{ text: "🗑 Delete Debt" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ].filter(row => row.length > 0),
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "DEBT_EDIT_AMOUNT": {
          const debt = state.data?.debt
          if (!debt) {
            await this.bot.sendMessage(chatId, "❌ Debt not found.")
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId)
            return true
          }

          if (text === "✅ Enable Auto-Payment" || text === "❌ Disable Auto-Payment") {
            return await handlers.handleAutoPaymentToggle(this, chatId, userId, text)
          }

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed || parsed.amount <= 0) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid amount. Try: 500 or 500 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          if (parsed.amount < debt.paidAmount) {
            const remaining = debt.amount - debt.paidAmount
            if (remaining < 0) {
              await this.bot.sendMessage(
                chatId,
                `✅ ${debt.type === "I_OWE" ? "💸 Debt fully paid!" : "💰 Debt fully received!"}\n\n` +
                `Total: ${formatMoney(debt.amount, debt.currency)}\n` +
                `Paid: ${formatMoney(debt.paidAmount, debt.currency)}`,
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    keyboard: [
                      [{ text: "✏️ Edit Amount" }],
                      [{ text: "🗑 Delete Debt" }],
                      [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
              return true
            }

            await this.bot.sendMessage(
              chatId,
              `❌ New debt amount ${formatMoney(parsed.amount, debt.currency)} cannot be less than already paid amount ${formatMoney(debt.paidAmount, debt.currency)}.`,
              this.getBackButton()
            )
            return true
          }

          await db.updateDebtTotalAmount(
            userId,
            debt.id,
            parsed.amount,
            parsed.currency
          )

          await this.bot.sendMessage(chatId, "✅ Debt amount updated!")

          const userData = await db.getUserData(userId)
          const updatedDebt = userData.debts.find((d: Debt) => d.id === debt.id)

          if (!updatedDebt) {
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId)
            return true
          }

          await this.goToStep(userId, "DEBT_MENU", {
            debt: updatedDebt,
            debtId: debt.id,
          })

          const { amount, paidAmount, type, dueDate, name, currency, autoPayment } = debt
          let msg = ""
          const remaining = amount - paidAmount
          const progress = createProgressBar(paidAmount, amount)
          const emoji =
            type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
          const action = type === "I_OWE" ? "pay" : "receive"

          msg += `${emoji} *${name}*\n`
          msg += `${progress}\n`

          if (paidAmount === 0) {
            msg += `Total: ${formatMoney(amount, currency)}\n`
          } else if (remaining > 0) {
            msg += `Remaining: ${formatMoney(remaining, currency)}\n`
          } else {
            msg += `🎉 Goal achieved!\n`
          }

          if (dueDate) {
            const deadlineDate = new Date(dueDate)
            msg += `Due: ${deadlineDate.toLocaleDateString('en-GB')}\n`
          }

          msg += `\n💡 Enter amount to ${action}`

          await this.bot.sendMessage(
            chatId,
            msg,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Edit Amount" }],
                  [{ text: dueDate ? "📅 Change Due Date" : "📅 Set Due Date" }],
                  dueDate ? [{ text: "🔕 Disable Reminders" }] : [],
                  type === "I_OWE"
                    ? [{ text: autoPayment?.enabled ? "❌ Disable Auto-Payment" : "✅ Enable Auto-Payment" }]
                    : [],
                  [{ text: "🗑 Delete Debt" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ].filter(row => row.length > 0),
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "DEBT_MENU": {
          const debt = state.data?.debt
          if (!debt) return true

          if (text === "✅ Enable Auto-Payment" || text === "❌ Disable Auto-Payment") {
            return await handlers.handleAutoPaymentToggle(this, chatId, userId, text)
          }

          if (text === "✏️ Edit Amount") {
            await this.goToStep(userId, "DEBT_EDIT_AMOUNT", { debt })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `✏️ *Edit Total Debt Amount*\n\n` +
              `Current: ${formatMoney(debt.amount, debt.currency)}\n` +
              `Already Paid: ${formatMoney(debt.paidAmount, debt.currency)}\n\n` +
              `Enter new total amount (e.g. 1000 or 1000 ${defaultCurrency}):`,
              {
                parse_mode: "Markdown",
                ...this.getBackButton(),
              }
            )
            return true
          } else if (text === "🗑 Delete Debt") {
            await db.deleteDebt(userId, debt.id)
            await this.bot.sendMessage(
              chatId,
              `✅ Debt "${debt.name}" deleted.`
            )
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId)
            return true
          } else {
            const defaultCurrency = await db.getDefaultCurrency(userId)
            const parsed = validators.parseAmountWithCurrency(
              text,
              defaultCurrency
            )

            if (!parsed || parsed.amount < 0) {
              await this.bot.sendMessage(
                chatId,
                `❌ Invalid amount. Try: 100 or 100 ${defaultCurrency}`,
                this.getBackButton()
              )
              return true
            }

            const remaining = debt.amount - debt.paidAmount

            if (parsed.amount > remaining) {
              await this.bot.sendMessage(
                chatId,
                `❌ Amount ${formatMoney(parsed.amount, debt.currency)} exceeds remaining debt ${formatMoney(remaining, debt.currency)}.`,
                this.getBackButton()
              )
              return true
            }

            await this.goToStep(userId, "DEBT_PARTIAL_AMOUNT", {
              partialAmount: parsed.amount,
              partialCurrency: parsed.currency,
              debt,
            })

            await handlers.handleDebtPartialAmount(this, chatId, userId, text)
          }
          return true
        }

        // --- Goal Flow ---
        case "GOAL_INPUT":
          return await handlers.handleGoalInput(this, chatId, userId, text)
        case "GOAL_DEPOSIT_AMOUNT":
          return await handlers.handleGoalDepositAmount(
            this,
            chatId,
            userId,
            text
          )
        case "GOAL_DEPOSIT_ACCOUNT":
          return await handlers.handleGoalDepositAccount(
            this,
            chatId,
            userId,
            text
          )
        case "GOAL_COMPLETED_SELECT": {
          const userData = await db.getUserData(userId)
          const completedGoals = userData.goals.filter(
            (g: Goal) => g.status === "COMPLETED"
          )

          const selected = completedGoals.find(
            (g: Goal) => text === `✅ Goal: ${g.name}`
          )

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a goal from the list.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "GOAL_COMPLETED_DELETE", {
            goal: selected,
          })

          await this.bot.sendMessage(
            chatId,
            `✅ Completed Goal: "${selected.name}"\n\n` +
            `Target: ${selected.targetAmount} ${selected.currency}\n` +
            `Achieved: ${selected.currentAmount} ${selected.currency}\n\n` +
            `🎉 Congratulations on reaching this goal!`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "🗑️ Delete Goal" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "GOAL_COMPLETED_DELETE": {
          if (text === "🗑️ Delete Goal") {
            const goal = state.data?.goal
            if (goal) {
              await db.deleteGoal(userId, goal.id)
              await this.bot.sendMessage(
                chatId,
                `✅ Completed goal "${goal.name}" deleted.`
              )
            }
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
            return true
          }
          return true
        }
        case "GOAL_MENU": {
          const goal = state.data?.goal
          if (!goal) return true

          if (text === "✅ Enable Auto-Deposit" || text === "❌ Disable Auto-Deposit") {
            return await handlers.handleAutoDepositToggle(this, chatId, userId, text)
          }

          if (text === "✏️ Edit Target") {
            await this.goToStep(userId, "GOAL_EDIT_AMOUNT", { goal })
            await this.bot.sendMessage(
              chatId,
              `✏️ *Edit Goal Target*\n\nCurrent: ${formatMoney(goal.targetAmount, goal.currency)}\n\nEnter new target amount:`,
              { parse_mode: "Markdown", ...this.getBackButton() }
            )
          } else if (text === "🗑 Delete Goal") {
            await db.deleteGoal(userId, goal.id)
            await this.bot.sendMessage(chatId, "✅ Goal deleted.")
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
          } else {
            const parsed = validators.parseAmountWithCurrency(
              text,
              goal.currency
            )
            if (parsed && parsed.amount > 0) {
              const remaining = goal.targetAmount - goal.currentAmount

              if (parsed.amount > remaining) {
                await this.bot.sendMessage(
                  chatId,
                  `❌ Error: Amount (${formatAmount(parsed.amount)}) exceeds remaining goal target (${formatMoney(remaining, goal.currency)}).`,
                  this.getBackButton()
                )
                return true
              }

              const balanceCount = (await db.getBalancesList(userId)).length

              if (balanceCount === 0) {
                await this.bot.sendMessage(
                  chatId,
                  "⚠️ *No Balances Found*\n\n" +
                  "Before depositing to goals, you need at least one balance account.\n\n" +
                  "💡 *Quick Start:*\n" +
                  "1️⃣ Go to 💰 *Balances*\n" +
                  "2️⃣ Tap ✨ *Add Balance*\n" +
                  "3️⃣ Enter account name and amount",
                  {
                    parse_mode: "Markdown",
                    reply_markup: {
                      keyboard: [
                        [{ text: "💳 Go to Balances" }],
                        [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                      ],
                      resize_keyboard: true,
                    },
                  }
                )
                return true
              }

              await this.goToStep(userId, "GOAL_DEPOSIT_ACCOUNT", {
                payAmount: parsed.amount,
                goal,
                goalId: goal.id,
              })
              await handlers.handleTxAccount(
                this,
                chatId,
                userId,
                "💳 Select account to deposit from:"
              )
            }
          }
          return true
        }
        case "GOAL_EDIT_AMOUNT": {
          const goal = state.data?.goal
          if (!goal) {
            await this.bot.sendMessage(chatId, "❌ Goal not found.")
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
            return true
          }

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed || parsed.amount <= 0) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid amount. Try: 2000 or 2000 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          if (parsed.amount === goal.currentAmount) {
            await this.goToStep(userId, "GOAL_COMPLETE_CONFIRM", { goal, newTargetAmount: parsed.amount })

            await this.bot.sendMessage(
              chatId,
              `🎯 New target amount *${formatMoney(parsed.amount, parsed.currency)}* equals your current progress.\n\n` +
              `Would you like to update the target and mark this goal as completed?`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "✅ Yes, Complete Goal" }],
                    [{ text: "❌ No, Enter Different Amount" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          if (parsed.amount < goal.currentAmount) {
            await this.bot.sendMessage(
              chatId,
              `❌ New target amount *${formatMoney(parsed.amount, parsed.currency)}* is less than current progress *${formatMoney(goal.currentAmount, goal.currency)}*.\n\n` +
              `💡 You can mark this goal as completed instead.`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "✏️ Try Again" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          await db.updateGoalTargetAmount(userId, goal.id, parsed.amount)

          await this.bot.sendMessage(chatId, "✅ Goal target updated!")

          const userData = await db.getUserData(userId)
          const updatedGoal = userData.goals.find((g: Goal) => g.id === goal.id)

          if (!updatedGoal) {
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
            return true
          }

          await this.goToStep(userId, "GOAL_MENU", { goal: updatedGoal, goalId: goal.id })

          const { name, targetAmount, currentAmount, deadline, currency, autoDeposit } = goal
          let msg = ""

          const remaining = targetAmount - currentAmount
          const progress = createProgressBar(currentAmount, targetAmount)
          const statusEmoji = getProgressEmoji(currentAmount, targetAmount)

          msg += `${statusEmoji} *${name}*\n`
          msg += `${progress}\n`

          if (currentAmount === 0) {
            msg += `Target: ${formatMoney(targetAmount, currency)}\n`
          } else if (remaining > 0) {
            msg += `📈 Remaining: ${formatMoney(remaining, currency)}\n`
          } else {
            msg += `🎉 Goal achieved!\n`
          }

          if (deadline) {
            const deadlineDate = new Date(deadline)
            msg += `Deadline: ${deadlineDate.toLocaleDateString('en-GB')}\n`
          }

          msg += `\n💡 Enter amount to deposit:`


          const deadlineButtons = deadline ?
            [
              [{ text: "📅 Change Deadline" }],
              [{ text: "🔕 Disable Reminders" }],
              [{ text: autoDeposit?.enabled ? "❌ Disable Auto-Deposit" : "✅ Enable Auto-Deposit" }]
            ]
            : [[{ text: "📅 Set Deadline" }]]

          await this.bot.sendMessage(
            chatId,
            msg,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Edit Target" }],
                  ...deadlineButtons,
                  [{ text: "🗑 Delete Goal" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ].filter(row => row.length > 0),
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "GOAL_COMPLETE_CONFIRM": {
          const goal = state.data?.goal
          const newTargetAmount = state.data?.newTargetAmount

          if (!goal || !newTargetAmount) {
            await this.bot.sendMessage(chatId, "❌ Goal data not found.")
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
            return true
          }

          if (text === "✅ Yes, Complete Goal") {
            await db.updateGoalTargetAmount(userId, goal.id, newTargetAmount)

            const balanceCount = (await db.getBalancesList(userId)).length
            if (balanceCount === 0) {
              await this.bot.sendMessage(
                chatId,
                "⚠️ *No Balances Found*\n\n" +
                "Before completing goals, you need at least one balance account.\n\n" +
                "💡 *Quick Start:*\n" +
                "1️⃣ Go to 💰 *Balances*\n" +
                "2️⃣ Tap ✨ *Add Balance*\n" +
                "3️⃣ Enter account name and amount",
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    keyboard: [
                      [{ text: "💳 Go to Balances" }],
                      [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
              return true
            }

            const updatedGoal = (await db.getUserData(userId)).goals.find(
              (g: Goal) => g.id === goal.id
            )

            if (!updatedGoal) {
              this.clearState(userId)
              await showGoalsMenu(this.bot, chatId, userId)
              return true
            }

            const remaining =
              updatedGoal.targetAmount - updatedGoal.currentAmount

            if (remaining <= 0) {
              await this.bot.sendMessage(
                chatId,
                `🎉 *Goal "${updatedGoal.name}" is now completed!*\n\n` +
                `Final amount: ${formatMoney(updatedGoal.currentAmount, updatedGoal.currency)}`,
                {
                  parse_mode: "Markdown",
                }
              )
              this.clearState(userId)
              await showGoalsMenu(this.bot, chatId, userId)
              return true
            }

            await this.goToStep(userId, "GOAL_DEPOSIT_ACCOUNT", {
              goal: updatedGoal,
              goalId: updatedGoal.id,
              markCompleted: true,
              payAmount: remaining,
            })
            await handlers.handleTxToAccount(
              this,
              chatId,
              userId,
              "💳 Select account to deposit remaining amount:"
            )
            return true
          }

          if (text === "❌ No, Enter Different Amount") {
            await this.goToStep(userId, "GOAL_EDIT_AMOUNT", { goal })

            await this.bot.sendMessage(
              chatId,
              `Enter new target amount for *${goal.name}*:\n\n` +
              `Current target: ${formatMoney(goal.targetAmount, goal.currency)}\n` +
              `Current progress: ${formatMoney(goal.currentAmount, goal.currency)}`,
              {
                parse_mode: "Markdown",
                ...this.getBackButton(),
              }
            )
            return true
          }

          return false
        }

        // --- Balance Flow ---
        case "BALANCE_LIST":
          return await handlers.handleBalanceSelection(this, chatId, userId, text)
        case "BALANCE_EDIT_MENU":
          return await handlers.handleBalanceEditMenu(this, chatId, userId, text)
        case "BALANCE_CONFIRM_AMOUNT":
          return await handlers.handleBalanceConfirmAmount(this, chatId, userId, text)
        case "BALANCE_CONFIRM_RENAME":
          return await handlers.handleBalanceConfirmRename(this, chatId, userId, text)
        case "BALANCE_SET_ZERO_CONFIRM":
          return await handlers.handleBalanceSetToZero(this, chatId, userId, text)
        case "BALANCE_DELETE_CONFIRM":
          return await handlers.handleBalanceDelete(this, chatId, userId, text)
        case "BALANCE_DELETE_SELECT_TARGET":
          return await handlers.handleBalanceDeleteSelectTarget(this, chatId, userId, text)
        case "BALANCE_ZERO_SELECT_TARGET":
          return await handlers.handleBalanceZeroSelectTarget(this, chatId, userId, text)

        case "BALANCE_NAME": {
          const accountIdRaw = text.trim()
          if (!accountIdRaw) {
            await this.bot.sendMessage(
              chatId,
              "❌ Account name can't be empty.",
              this.getBackButton()
            )
            return true
          }

          const accountId = this.toTitleCase(accountIdRaw)
          const existingBalances = await db.getBalancesList(userId)
          const exists = existingBalances.some(
            (b) => b.accountId.toLowerCase() === accountId.toLowerCase()
          )

          if (exists) {
            await this.bot.sendMessage(
              chatId,
              `❌ Account "${accountId}" already exists. Please choose a different name.`,
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "BALANCE_AMOUNT", { accountIdRaw })

          const defaultCurrency = await db.getDefaultCurrency(userId)
          await this.bot.sendMessage(
            chatId,
            `Enter amount (e.g. 100 or 100 ${defaultCurrency}):`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "⚪ Empty Balance" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "BALANCE_AMOUNT": {
          const defaultCurrency = await db.getDefaultCurrency(userId)

          let amount = 0
          let currency = defaultCurrency

          if (text === "⚪ Empty Balance") {
            amount = 0
            currency = defaultCurrency
          } else {
            const parsed = validators.parseAmountWithCurrency(
              text,
              defaultCurrency
            )
            if (!parsed) {
              await this.bot.sendMessage(
                chatId,
                `❌ Invalid amount. Try: 100 or 100 ${defaultCurrency}`,
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: "⚪ Empty Balance" }],
                      [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
              return true
            }
            amount = parsed.amount
            currency = parsed.currency
          }

          const accountIdRaw = state.data?.accountIdRaw || ""
          const accountId = this.toTitleCase(accountIdRaw)
          if (!accountId) {
            await this.bot.sendMessage(
              chatId,
              "❌ Account name missing. Start again."
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId)

            return true
          }

          await db.addBalance(userId, {
            accountId,
            amount: amount,
            currency: currency,
            lastUpdated: new Date().toISOString(),
          })

          this.clearState(userId)
          await showBalancesMenu(this, chatId, userId)
          return true
        }
        case "BALANCE_DELETE_TRANSFER": {
          const { accountId, currency, amount } = state.data

          if (text === "🗑️ Delete and clear everything") {
            await db.deleteBalance(userId, accountId, currency)
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" deleted and ${formatMoney(amount, currency)} cleared.`
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId)
            return true
          } else if (text === "↔️ Transfer to another account") {
            await this.goToStep(userId, "BALANCE_DELETE_SELECT_TARGET", {
              accountId,
              currency,
              amount,
            })

            const balanceList = await db.getBalancesList(userId)
            const otherBalances = balanceList.filter(
              (b) => !(b.accountId === accountId && b.currency === currency)
            )

            const rows = otherBalances.map((b) => [
              { text: `${b.accountId} (${b.currency})` },
            ])
            rows.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

            await this.bot.sendMessage(
              chatId,
              `↔️ Transfer ${formatMoney(amount, currency)} to:`,
              {
                reply_markup: {
                  keyboard: rows,
                  resize_keyboard: true,
                  one_time_keyboard: true,
                },
              }
            )
            return true
          }

          await this.bot.sendMessage(
            chatId,
            "❌ Please select an option from the buttons.",
            this.getBackButton()
          )
          return true
        }
        case "BALANCE_EDIT_CURRENCY_CHOICE": {
          const accountId = state.data?.accountId
          const currentCurrency = state.data?.currency
          const inputAmount = state.data?.inputAmount
          const inputCurrency = state.data?.inputCurrency
          const convertedAmount = state.data?.convertedAmount

          if (text.startsWith("🔄 Convert to")) {
            await db.convertBalanceAmount(
              userId,
              accountId,
              inputCurrency,
              inputAmount
            )
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" converted: ${inputAmount} ${inputCurrency} → ${formatMoney(convertedAmount, currentCurrency)}!`
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId)
          } else if (text.startsWith("💱 Change to")) {
            await db.setBalanceAmountWithCurrencyChange(
              userId,
              accountId,
              inputCurrency,
              inputAmount
            )
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" changed to ${formatMoney(inputAmount, inputCurrency)}!`
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId)
          }
          return true
        }

        // --- Income Flow ---
        case "INCOME_VIEW": {
          if (text === "✨ Add Income Source") {
            await this.goToStep(userId, "INCOME_INLINE", {})
            const defaultCurrency = await db.getDefaultCurrency(userId)

            await this.bot.sendMessage(
              chatId,
              "💼 *Add Income Source*\n\n" +
              "Format: `Name Amount [Currency]`\n\n" +
              "*Examples:*\n" +
              `• Salary 1500\n` +
              `• Freelance 800 ${defaultCurrency}`,
              {
                parse_mode: "Markdown",
                ...this.getBackButton(),
              }
            )
            return true
          }

          const userData = await db.getUserData(userId)
          const sources = userData.incomeSources
          const source = sources.find((s) => s.name === text.trim())

          if (!source) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select an income source from the list or use ✨ Add Income Source.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "INCOME_MENU", { source })

          await this.bot.sendMessage(
            chatId,
            `💼 *Income Source:* ${source.name}\n\n` +
            `Expected: ${formatMoney(source.expectedAmount, source.currency)}\n\n` +
            `You can edit name, delete or enter a new amount to update.`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Edit Name" }],
                  [{ text: source.autoCreate?.enabled ? "❌ Disable Auto-Income" : "✅ Enable Auto-Income" }],
                  [{ text: "🗑️ Delete Income" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )

          return true
        }
        case "INCOME_DELETE_CONFIRM": {
          const source = state.data?.source as
            | { name: string; amount: number; currency: Currency }
            | undefined

          if (text === "✅ Confirm delete") {
            if (source) {
              await db.deleteIncomeSource(userId, source.name)
              await this.bot.sendMessage(
                chatId,
                `✅ Income source "${source.name}" deleted.`
              )
            } else {
              await this.bot.sendMessage(
                chatId,
                "❌ No income source selected.",
                this.getBackButton()
              )
            }
          } else if (text !== "⬅️ Back") {
            await this.bot.sendMessage(chatId, "❌ Deletion cancelled.")
          }

          await this.goToStep(userId, "INCOME_VIEW", {})
          await showIncomeSourcesMenu(this.bot, chatId, userId)
          return true
        }
        case "INCOME_INLINE": {
          const parts = text.trim().split(/\s+/)
          if (parts.length < 2) {
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid format.\n\nUse: Name Amount [Currency]\n` +
              `Example: Salary 1500 or Salary 1500 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          const name = parts[0]
          const amountText = parts.slice(1).join(" ")
          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            amountText,
            defaultCurrency
          )

          if (!parsed || parsed.amount <= 0) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid amount. Try: 1000 or 1000 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          await db.addIncomeSource(userId, {
            id: randomUUID(),
            name,
            expectedAmount: parsed.amount,
            currency: parsed.currency,
            frequency: "MONTHLY",
          })

          await this.bot.sendMessage(
            chatId,
            `✅ Income source "${name}" added: ${parsed.amount} ${parsed.currency}.`
          )

          await this.goToStep(userId, "INCOME_VIEW", {})

          await showIncomeSourcesMenu(this.bot, chatId, userId)
          return true
        }
        case "INCOME_EDIT_NAME": {
          const source = state.data?.source as
            | { name: string; amount: number; currency: Currency }
            | undefined
          if (!source) {
            await this.bot.sendMessage(chatId, "❌ Income source not found.")
            await showIncomeSourcesMenu(this.bot, chatId, userId)
            return true
          }

          const newName = text.trim()
          if (!newName) {
            await this.bot.sendMessage(
              chatId,
              "❌ Name cannot be empty.",
              this.getBackButton()
            )
            return true
          }

          await db.updateIncomeSourceName(userId, source.name, newName)

          await this.bot.sendMessage(
            chatId,
            `✅ Income source renamed from "${source.name}" to "${newName}".`
          )

          await this.goToStep(userId, "INCOME_VIEW", {})

          await showIncomeSourcesMenu(this.bot, chatId, userId)
          return true
        }
        case "INCOME_MENU": {
          const source = state.data?.source as
            | { name: string; amount: number; currency: Currency }
            | undefined
          if (!source) {
            await this.bot.sendMessage(chatId, "❌ Income source not found.")
            await showIncomeSourcesMenu(this.bot, chatId, userId)
            return true
          }

          // Auto-Income Toggle
          if (text === "✅ Enable Auto-Income" || text === "❌ Disable Auto-Income") {
            return await handlers.handleAutoIncomeToggle(this, chatId, userId, text)
          }

          // 1) Edit Name
          if (text === "✏️ Edit Name") {
            await this.goToStep(userId, "INCOME_EDIT_NAME", { source })
            await this.bot.sendMessage(
              chatId,
              `✏️ Enter new name for "${source.name}":`,
              this.getBackButton()
            )
            return true
          }

          // 2) Delete Income
          if (text === "🗑️ Delete Income") {
            await this.goToStep(userId, "INCOME_DELETE_CONFIRM", { source })
            await this.bot.sendMessage(
              chatId,
              `🗑️ Delete income source "${source.name}"?`,
              {
                reply_markup: {
                  keyboard: [
                    [{ text: "✅ Confirm delete" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          // 3) Ввод числа — изменить amount
          const defaultCurrency = source.currency
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )
          if (parsed && parsed.amount >= 0) {
            await db.updateIncomeSourceAmount(
              userId,
              source.name,
              parsed.amount,
              parsed.currency
            )

            // Обновляем локальный source
            const updatedSource = {
              ...source,
              amount: parsed.amount,
              currency: parsed.currency,
            }

            await this.bot.sendMessage(
              chatId,
              `✅ Updated amount for "${updatedSource.name}": ${formatMoney(updatedSource.amount, updatedSource.currency)}`
            )

            await this.goToStep(userId, "INCOME_VIEW", {})

            await showIncomeSourcesMenu(this.bot, chatId, userId)
            return true
          }

          await this.bot.sendMessage(
            chatId,
            "❌ Please select an option or enter a valid amount.",
            this.getBackButton()
          )
          return true
        }

        // ANALYTICS
        case "ANALYTICS_TRENDS": {
          const trendsMsg = await formatTrends(userId)
          await this.bot.sendMessage(chatId, trendsMsg, {
            parse_mode: "Markdown",
            ...this.getBackButton(),
          })
          return true
        }
        case "ANALYTICS_MENU": {
          await this.bot.sendMessage(
            chatId,
            "📊 *Analytics*\n\nSelect what you want to see:",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "📈 Reports" }],
                  [{ text: "📋 History" }],
                  [{ text: "💎 Net Worth" }],
                  [{ text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "ANALYTICS_REPORTS_MENU": {
          if (text === "🔍 Filters") {
            await this.goToStep(userId, "ANALYTICS_FILTERS", {})
            await this.bot.sendMessage(
              chatId,
              "📊 *Reports Filters*\n\nSelect period:",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "📅 Last 7 days" }, { text: "📅 Last 30 days" }],
                    [{ text: "📅 Custom Period" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )

            return true
          } else if (text === "📅 Export CSV") {
            const csvData = await generateCSV(userId)

            if (csvData) {
              const buffer = Buffer.from(csvData, "utf-8")
              this.bot.sendDocument(
                chatId,
                buffer,
                {},
                {
                  filename: `finance_export_${new Date().toISOString().split("T")[0]}.csv`,
                  contentType: "text/csv",
                }
              )
              this.bot.sendMessage(chatId, "✅ CSV exported successfully!", {
                reply_markup: {
                  keyboard: [
                    [{ text: "📈 Reports" }],
                    [{ text: "📋 History" }],
                    [{ text: "💎 Net Worth" }],
                    [{ text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              })
            } else {
              this.bot.sendMessage(chatId, "❌ No transactions to export.", {
                reply_markup: {
                  keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
                  resize_keyboard: true,
                },
              })
            }
            this.setState(userId, {
              step: "EXPORT_VIEW",
              data: {},
              returnTo: "analytics",
            })
            return true
          }
          if (text === "📈 Trends") {
            const trends = await formatTrends(userId)
            await this.bot.sendMessage(chatId, trends, {
              parse_mode: "Markdown",
              ...this.getBackButton(),
            })
            this.setState(userId, {
              step: "TRENDS_VIEW",
              returnTo: "reports",
            })
            return true
          } else if (text === "📉 Top Categories") {
            const top = await formatTopExpenses(userId, 5)
            await this.bot.sendMessage(chatId, top, {
              parse_mode: "Markdown",
              ...this.getBackButton(),
            })
            this.setState(userId, {
              step: "TOP_CATEGORIES_VIEW",
              returnTo: "reports",
            })
            return true
          }

          return true
        }
        case "ANALYTICS_FILTERS": {
          if (text === "📅 Last 7 days") {
            await this.goToStep(userId, "ANALYTICS_SHOW_REPORT", {
              preset: "LAST_7_DAYS",
            })
            await this.bot.sendMessage(
              chatId,
              "📊 Generating report for last 7 days..."
            )
            // TODO: вызвать отчёт по последним 7 дням
            return true
          }

          if (text === "📅 Last 30 days") {
            await this.goToStep(userId, "ANALYTICS_SHOW_REPORT", {
              preset: "LAST_30_DAYS",
            })
            await this.bot.sendMessage(
              chatId,
              "📊 Generating report for last 30 days..."
            )
            // TODO: отчёт за 30 дней
            return true
          }

          if (text === "📅 Custom Period") {
            await this.goToStep(userId, "ANALYTICS_PERIOD_START", {})
            await this.bot.sendMessage(
              chatId,
              "📅 *Start Date*\n\nEnter date in format DD.MM.YYYY\nExample: `01.01.2026`",
              { parse_mode: "Markdown", ...this.getBackButton() }
            )
            return true
          }

          await this.bot.sendMessage(
            chatId,
            "❌ Select one of the filters.",
            this.getBackButton()
          )
          return true
        }
        case "ANALYTICS_PERIOD_START": {
          const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
          if (!match) {
            await this.bot.sendMessage(
              chatId,
              "❌ Wrong format! Use DD.MM.YYYY (e.g. 01.01.2026)",
              this.getBackButton()
            )
            return true
          }

          const [, d, m, y] = match
          const start = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`

          await this.goToStep(userId, "ANALYTICS_PERIOD_END", {
            startDate: start,
          })
          await this.bot.sendMessage(
            chatId,
            "📅 *End Date*\n\nEnter date in format DD.MM.YYYY\nExample: `13.01.2026`",
            { parse_mode: "Markdown", ...this.getBackButton() }
          )
          return true
        }
        case "ANALYTICS_PERIOD_END": {
          const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
          if (!match) {
            await this.bot.sendMessage(
              chatId,
              "❌ Wrong format! Use DD.MM.YYYY (e.g. 13.01.2026)",
              this.getBackButton()
            )
            return true
          }

          const [, d, m, y] = match
          const end = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`

          const start = state.data?.startDate as string
          const startDate = new Date(start)
          const endDate = new Date(end)

          if (
            isNaN(startDate.getTime()) ||
            isNaN(endDate.getTime()) ||
            endDate < startDate
          ) {
            await this.bot.sendMessage(
              chatId,
              "❌ Invalid period (end before start or bad dates).",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "ANALYTICS_SHOW_REPORT", {
            startDate: start,
            endDate: end,
          })

          await this.bot.sendMessage(
            chatId,
            "📊 Period selected. Tap `📊 Show Report`.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "📊 Show Report" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "ANALYTICS_SHOW_REPORT": {
          // const { preset, startDate, endDate } = state.data || {}

          // Здесь вызываешь свой отчёт по транзакциям
          // Например: await db.getAnalyticsReport(userId, { preset, startDate, endDate })
          await this.bot.sendMessage(
            chatId,
            "📊 Report generation logic TODO (hook db.getAnalyticsReport)",
            this.getBackButton()
          )
          return true
        }

        // BUDGET PLANNER
        case "BUDGET_MENU": {
          if (text === "✨ Add / Edit Budget") {
            await this.goToStep(userId, "BUDGET_SELECT_CATEGORY", {})
            const categories = Object.values(ExpenseCategory)
            const items = categories.map((c) => c)
            const keyboard = createListButtons({ items })

            await this.bot.sendMessage(
              chatId,
              "🔮 *Budget Planner*\n\nSelect category to set limit:",
              {
                parse_mode: "Markdown",
                reply_markup: { keyboard, resize_keyboard: true },
              }
            )
            return true
          }

          const cat = text.trim() as ExpenseCategory
          if (Object.values(ExpenseCategory).includes(cat)) {
            await this.goToStep(userId, "BUDGET_CATEGORY_MENU", {
              category: cat,
            })
            const budgets = await db.getCategoryBudgets(userId)
            const b = budgets[cat] || {
              limit: 0,
              spent: 0,
              currency: await db.getDefaultCurrency(userId),
            }

            const ratio = b.limit > 0 ? Math.min(1, b.spent / b.limit) : 0
            const blocks = 10
            const filled = Math.round(ratio * blocks)
            const bar = "█".repeat(filled) + "░".repeat(blocks - filled)

            await this.bot.sendMessage(
              chatId,
              `💳 *${cat}*\n\n` +
              `Limit: ${b.limit} ${b.currency}\n` +
              `Spent: ${b.spent} ${b.currency}\n` +
              `${bar}\n\n` +
              "You can edit limit, clear it or enter a new limit directly.",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "🧹 Clear Limit" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          await this.bot.sendMessage(
            chatId,
            "❌ Select a category from the list or use ✨ Add / Edit Budget.",
            this.getBackButton()
          )
          return true
        }
        case "BUDGET_SELECT_CATEGORY": {
          const cat = text.trim() as ExpenseCategory
          if (!Object.values(ExpenseCategory).includes(cat)) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a category from the list.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "BUDGET_CATEGORY_MENU", { category: cat })
          // Далее отработает логика BUDGET_CATEGORY_MENU (см. выше)
          const budgets = await db.getCategoryBudgets(userId)
          const b = budgets[cat] || {
            limit: 0,
            spent: 0,
            currency: await db.getDefaultCurrency(userId),
          }

          const ratio = b.limit > 0 ? Math.min(1, b.spent / b.limit) : 0
          const blocks = 10
          const filled = Math.round(ratio * blocks)
          const bar = "█".repeat(filled) + "░".repeat(blocks - filled)

          await this.bot.sendMessage(
            chatId,
            `💳 *${cat}*\n\n` +
            `Limit: ${b.limit} ${b.currency}\n` +
            `Spent: ${b.spent} ${b.currency}\n` +
            `${bar}\n\n` +
            "Enter new limit (e.g. 500 or 500 USD), or use buttons.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "🧹 Clear Limit" }],
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }
        case "BUDGET_CATEGORY_MENU": {
          const category = state.data?.category as ExpenseCategory | undefined
          if (!category) {
            await this.bot.sendMessage(chatId, "❌ Category missing.")
            this.clearState(userId)
            await showBudgetMenu(this, chatId, userId)
            return true
          }

          if (text === "🧹 Clear Limit") {
            await db.clearCategoryBudget(userId, category)
            await this.goToStep(userId, "BUDGET_MENU", {})
            await showBudgetMenu(this, chatId, userId)
            return true
          }

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )
          if (parsed && parsed.amount > 0) {
            await db.setCategoryBudget(
              userId,
              category,
              parsed.amount,
              parsed.currency
            )
            await this.goToStep(userId, "BUDGET_MENU", {})
            await showBudgetMenu(this, chatId, userId)
            return true
          }

          await this.bot.sendMessage(
            chatId,
            "❌ Enter a valid amount or use buttons.",
            this.getBackButton()
          )
          return true
        }

        case "TEMPLATE_EDIT_AMOUNT": {
          const templateId = state.data?.templateId as string | undefined
          if (!templateId) {
            await this.bot.sendMessage(chatId, "❌ Template ID missing.")
            this.clearState(userId)
            return true
          }

          const templates = await db.getTemplates(userId)
          const template = templates.find((t) => t.id === templateId)

          if (!template) {
            await this.bot.sendMessage(chatId, "❌ Template not found.")
            this.clearState(userId)
            return true
          }

          const amount = parseFloat(text.replace(",", "."))

          if (isNaN(amount) || amount <= 0) {
            await this.bot.sendMessage(
              chatId,
              "❌ Invalid amount. Please enter a valid number.",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: `tmpl_cancel|${templateId}` }],
                  ],
                },
              }
            )
            return true
          }

          const success = await db.updateTemplateAmount(userId, templateId, amount)

          if (!success) {
            await this.bot.sendMessage(chatId, "❌ Failed to update template.")
            this.clearState(userId)
            return true
          }

          const formatted = formatMoney(amount, template.currency)
          await this.bot.sendMessage(chatId, `✅ Amount updated to ${formatted}`, {
            parse_mode: "Markdown",
          })

          this.clearState(userId)

          await handlers.showTemplateManageMenu(this.bot, chatId, userId, templateId)
          return true
        }

        // --- Date Handlers ---
        case "DEBT_ASK_DUE_DATE":
          return await handlers.handleDebtDueDate(this, chatId, userId, text)

        case "GOAL_ASK_DEADLINE":
          return await handlers.handleGoalDeadline(this, chatId, userId, text)

        case "INCOME_ASK_EXPECTED_DATE":
          return await handlers.handleIncomeExpectedDate(this, chatId, userId, text)

        case "DEBT_EDIT_DUE_DATE": {
          if (text === "🗑 Remove Date") {
            const debt = state.data.debt
            await db.updateDebtDueDate(userId, debt.id, null)
            await reminderManager.deleteRemindersForEntity(userId, debt.id)
            await this.bot.sendMessage(chatId, "✅ Due date and reminders removed.")
            await showDebtsMenu(this.bot, chatId, userId)
            this.clearState(userId)
            return true
          }

          if (text === "⏩ Skip") {
            await showDebtsMenu(this.bot, chatId, userId)
            this.clearState(userId)
            return true
          }

          return await handlers.handleDebtDueDateEdit(this, chatId, userId, text)
        }

        case "GOAL_EDIT_DEADLINE": {
          if (text === "🗑 Remove Date") {
            const goal = state.data.goal
            await db.updateGoalDeadline(userId, goal.id, null)
            await reminderManager.deleteRemindersForEntity(userId, goal.id)
            await this.bot.sendMessage(chatId, "✅ Deadline and reminders removed.")
            await showGoalsMenu(this.bot, chatId, userId)
            this.clearState(userId)
            return true
          }

          if (text === "⏩ Skip") {
            await showGoalsMenu(this.bot, chatId, userId)
            this.clearState(userId)
            return true
          }

          return await handlers.handleGoalDeadlineEdit(this, chatId, userId, text)
        }

        // --- Auto-Deposit Handlers ---
        case "AUTO_DEPOSIT_SELECT_ACCOUNT":
          return await handlers.handleAutoDepositAccountSelect(this, chatId, userId, text)

        case "AUTO_DEPOSIT_ENTER_AMOUNT":
          return await handlers.handleAutoDepositAmountInput(this, chatId, userId, text)

        case "AUTO_DEPOSIT_SELECT_FREQUENCY":
          return await handlers.handleAutoDepositFrequencySelect(this, chatId, userId, text)

        case "AUTO_DEPOSIT_SELECT_DAY_WEEKLY":
          return await handlers.handleAutoDepositDayWeeklySelect(this, chatId, userId, text)

        case "AUTO_DEPOSIT_SELECT_DAY_MONTHLY":
          return await handlers.handleAutoDepositDayMonthlySelect(this, chatId, userId, text)

        // --- Auto-Income Handlers ---
        case "AUTO_INCOME_SELECT_ACCOUNT":
          return await handlers.handleAutoIncomeAccountSelect(this, chatId, userId, text)

        case "AUTO_INCOME_ENTER_AMOUNT":
          return await handlers.handleAutoIncomeAmountInput(this, chatId, userId, text)

        case "AUTO_INCOME_SELECT_DAY":
          return await handlers.handleAutoIncomeDaySelect(this, chatId, userId, text)

        // --- Auto-Debt-Payment Handlers ---
        case "AUTO_PAYMENT_SELECT_ACCOUNT":
          return await handlers.handleAutoPaymentAccountSelect(this, chatId, userId, text)

        case "AUTO_PAYMENT_ENTER_AMOUNT":
          return await handlers.handleAutoPaymentAmountInput(this, chatId, userId, text)

        case "AUTO_PAYMENT_SELECT_DAY":
          return await handlers.handleAutoPaymentDaySelect(this, chatId, userId, text)

        // --- Reminder Settings Handlers ---
        case "NOTIFICATIONS_MENU": {
          // Handle button clicks within notifications menu
          if (text === "✅ Enable Notifications" || text === "❌ Disable Notifications") {
            return await handlers.handleNotificationsToggle(this, chatId, userId, text)
          }

          if (text === "⏰ Change Time") {
            return await handlers.handleReminderTimeSelect(this, chatId, userId)
          }

          if (text === "🌍 Change Timezone") {
            return await handlers.handleTimezoneSelect(this, chatId, userId)
          }

          // Default: show menu again
          return await handlers.handleNotificationsMenu(this, chatId, userId)
        }

        case "REMINDER_TIME_SELECT":
          return await handlers.handleReminderTimeSave(this, chatId, userId, text)

        case "REMINDER_TIMEZONE_SELECT":
          return await handlers.handleTimezoneSave(this, chatId, userId, text)

        // --- Recurring Transactions Handlers ---
        case "RECURRING_MENU": {
          // Handle button clicks
          if (text === "✨ Add Recurring") {
            return await handlers.handleRecurringCreateStart(this, chatId, userId)
          }

          // Check if selecting existing recurring
          const recurring = text.match(/^(💸|💰) /)
          if (recurring) {
            return await handlers.handleRecurringSelect(this, chatId, userId, text)
          }

          // Default: show menu
          return await handlers.handleRecurringMenu(this, chatId, userId)
        }

        case "RECURRING_ITEM_MENU":
          return await handlers.handleRecurringItemAction(this, chatId, userId, text)

        case "RECURRING_DELETE_CONFIRM":
          return await handlers.handleRecurringDeleteConfirm(this, chatId, userId, text)

        case "RECURRING_CREATE_DESCRIPTION":
          return await handlers.handleRecurringDescription(this, chatId, userId, text)

        case "RECURRING_CREATE_TYPE":
          return await handlers.handleRecurringType(this, chatId, userId, text)

        case "RECURRING_CREATE_AMOUNT":
          return await handlers.handleRecurringAmount(this, chatId, userId, text)

        case "RECURRING_CREATE_ACCOUNT":
          return await handlers.handleRecurringAccount(this, chatId, userId, text)

        case "RECURRING_CREATE_CATEGORY":
          return await handlers.handleRecurringCategory(this, chatId, userId, text)

        case "RECURRING_CREATE_DAY":
          return await handlers.handleRecurringDay(this, chatId, userId, text)

        // --- Custom Message Handlers ---
        case "CUSTOM_MESSAGES_MENU":
          return await handlers.handleCustomMessagesAction(this, chatId, userId, text)

        case "CUSTOM_MESSAGE_EDIT":
          return await handlers.handleCustomMessageSave(this, chatId, userId, text)

        // --- Bank Statement Upload Handlers ---
        case "STATEMENT_PREVIEW":
          return await handlers.handleStatementPreviewAction(this, chatId, userId, text)

      }
    } catch (error) {
      console.error("Wizard Error:", error)
      await this.bot.sendMessage(
        chatId,
        "⚠️ An error occurred. Please try again."
      )
      this.clearState(userId)
      await showMainMenu(this.bot, chatId)
    }

    return false
  }
}
