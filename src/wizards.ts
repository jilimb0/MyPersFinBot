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
} from "./types"
import { dbStorage as db } from "./storage-db"
import * as validators from "./validators"
import {
  showBalancesMenu,
  showDebtsMenu,
  showEditTransactionsMenu,
  showGoalsMenu,
  showHistoryMenu,
  showIncomeMenu,
  showMainMenu,
  showSettingsMenu,
  showStatsMenu,
} from "./menus"

/**
 * Менеджер wizard-состояний
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WizardData = Record<string, any>

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

  constructor(private bot: TelegramBot) {}

  /**
   * Кнопка "Назад" + "Главное меню" для всех wizard'ов
   */
  getBackButton() {
    return {
      reply_markup: {
        keyboard: [[{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]],
        resize_keyboard: true,
      },
    }
  }

  /**
   * Проверяет, находится ли пользователь в wizard'е
   */
  isInWizard(userId: string): boolean {
    return !!this.userStates[userId]
  }

  /**
   * Получить состояние пользователя
   */
  getState(userId: string): WizardState | undefined {
    return this.userStates[userId]
  }

  /**
   * Установить состояние пользователя
   */
  setState(userId: string, state: WizardState) {
    // Ensure history exists
    if (!state.history) {
      state.history = []
    }
    // Don't add duplicate steps to history
    this.userStates[userId] = state as Required<WizardState>
  }

  /**
   * Перейти к следующему шагу с сохранением истории
   */
  async goToStep(userId: string, nextStep: string, data?: WizardData) {
    const state = this.getState(userId)
    if (!state) return

    // Добавляем текущий шаг в историю только если он отличается от следующего
    if (state.step !== nextStep) {
      if (!state.history) {
        state.history = []
      }
      state.history.push(state.step)
    }

    state.step = nextStep
    if (data) {
      state.data = { ...state.data, ...data }
    }
    this.setState(userId, state)
  }

  /**
   * Очистить состояние пользователя
   */
  clearState(userId: string) {
    delete this.userStates[userId]
  }

  /**
   * Возврат в контекстное меню в зависимости от returnTo
   */
  async returnToContext(chatId: number, userId: string, returnTo?: string) {
    switch (returnTo) {
      case "debts":
        await showDebtsMenu(this.bot, chatId, userId)
        break
      case "goals":
        await showGoalsMenu(this.bot, chatId, userId)
        break
      case "balances":
        await showBalancesMenu(this.bot, chatId, userId)
        break
      case "income":
        await showIncomeMenu(this.bot, chatId, userId)
        break
      case "settings":
        await showSettingsMenu(this.bot, chatId, userId)
        break
      case "history":
        await showHistoryMenu(this.bot, chatId, userId)
        break
      case "analytics":
        await showStatsMenu(this.bot, chatId)
        break
      case "edit_transactions":
        await showEditTransactionsMenu(this.bot, chatId, userId)
        break

      default:
        await showMainMenu(this.bot, chatId)
    }
  }

  /**
   * Обрабатывает ввод текста в wizard'е
   */
  async handleWizardInput(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)

    // Обработка кнопки "Main Menu"
    if (text === "🏠 Main Menu") {
      this.clearState(userId)
      await showMainMenu(this.bot, chatId)

      return true
    }

    // Обработка кнопки "Назад"
    if (text === "🔙 Back") {
      if (!state) {
        await showMainMenu(this.bot, chatId)

        return true
      }

      // Если история пуста, возвращаемся в контекстное меню
      if (!state.history || state.history.length === 0) {
        this.clearState(userId)
        await this.returnToContext(chatId, userId, state.returnTo)
        return true
      }

      // Есть история - возвращаемся на предыдущий шаг
      const prevStep = state.history.pop()!
      state.step = prevStep
      this.setState(userId, state)
      await this.resendCurrentStepPrompt(chatId, userId, state)
      return true
    }

    if (!state) return false

    try {
      switch (state.step) {
        // --- Transaction Flow ---
        case "TX_AMOUNT":
          return await this.handleTxAmount(chatId, userId, text)
        case "TX_CATEGORY":
          return await this.handleTxCategory(chatId, userId, text)
        case "TX_ACCOUNT":
          return await this.handleTxAccount(chatId, userId, text)
        case "TX_TO_ACCOUNT":
          return await this.handleTxToAccount(chatId, userId, text)

        case "TX_CONFIRM_REFUND": {
          if (text === "✅ Yes, it's a refund") {
            await this.goToStep(userId, "TX_ACCOUNT", {
              category: IncomeCategory.REFUND,
              amount: state.data.amount,
              currency: state.data.currency,
              isRefund: true,
            })
            await this.askForAccount(
              chatId,
              "📥 Select account to receive refund:",
              state.data.currency
            )
          }
          return true
        }

        case "TX_EDIT_SELECT": {
          // Парсим выбранную транзакцию из текста кнопки
          const recentTxs = await db.getRecentTransactions(userId, 5)

          const selected = recentTxs.find((tx) => {
            const emoji =
              tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
            const date = new Date(tx.date).toLocaleDateString("en-GB")
            return (
              text ===
              `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`
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

          // Переходим в меню редактирования
          await this.goToStep(userId, "TX_EDIT_MENU", { transaction: selected })

          const account =
            selected.fromAccountId || selected.toAccountId || "N/A"
          await this.bot.sendMessage(
            chatId,
            `📊 *Transaction Details*\n\n` +
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
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
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
          }

          if (text === "💸 Expenses only") {
            filtered = filtered.filter(
              (tx) => tx.type === TransactionType.EXPENSE
            )
          } else if (text === "💰 Income only") {
            filtered = filtered.filter(
              (tx) => tx.type === TransactionType.INCOME
            )
          }

          if (filtered.length === 0) {
            await this.bot.sendMessage(
              chatId,
              "📬 No transactions match this filter.",
              this.getBackButton()
            )
            return true
          }

          // Сохраняем транзакции в state
          await this.goToStep(userId, "TX_VIEW_LIST", {
            transactions: filtered,
            period: text,
          })

          const toShow = filtered.slice(0, 10)
          const txButtons: TelegramBot.KeyboardButton[][] = []

          toShow.forEach((tx) => {
            const emoji =
              tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
            const date = new Date(tx.date).toLocaleDateString("en-GB")
            txButtons.push([
              {
                text: `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`,
              },
            ])
          })
          txButtons.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

          let msg = `📊 *Transaction History* (${text})\n\n`
          msg += `Showing ${toShow.length} of ${filtered.length} transaction(s)\n\n`
          msg += `Select transaction to edit:`

          await this.bot.sendMessage(chatId, msg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: txButtons,
              resize_keyboard: true,
            },
          })
          return true
        }

        case "TX_VIEW_LIST": {
          const transactions = state.data?.transactions || []

          const selected = transactions.find((tx: Transaction) => {
            const emoji =
              tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
            const date = new Date(tx.date).toLocaleDateString("en-GB")
            return (
              text ===
              `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`
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
            `📊 *Transaction Details*\n\n` +
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
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
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
              `✏️ *Edit Amount*\n\nCurrent: ${tx.amount} ${tx.currency}\n\nEnter new amount (e.g. 100 or 100 ${defaultCurrency}):`,
              this.getBackButton()
            )
          } else if (text === "📝 Edit Category") {
            await this.goToStep(userId, "TX_EDIT_CATEGORY", { transaction: tx })

            // Показываем категории в зависимости от типа
            if (tx.type === TransactionType.EXPENSE) {
              const categories = Object.values(ExpenseCategory)
              const keyboard: TelegramBot.KeyboardButton[][] = []
              for (let i = 0; i < categories.length; i += 2) {
                const row = [{ text: categories[i] }]
                if (categories[i + 1]) row.push({ text: categories[i + 1] })
                keyboard.push(row)
              }
              keyboard.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

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
              const keyboard: TelegramBot.KeyboardButton[][] = []
              for (let i = 0; i < categories.length; i += 2) {
                const row = [{ text: categories[i] }]
                if (categories[i + 1]) row.push({ text: categories[i + 1] })
                keyboard.push(row)
              }
              keyboard.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

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
            await this.askForAccount(
              chatId,
              `💳 *Edit Account*\n\nCurrent: ${account}\n\nSelect new account:`,
              tx.currency
            )
          } else if (text === "🗑️ Delete Transaction") {
            // Удаляем транзакцию и откатываем баланс
            const success = await db.deleteTransaction(userId, tx.id)
            if (success) {
              await this.bot.sendMessage(
                chatId,
                "✅ Transaction deleted and balance rolled back!"
              )
            } else {
              await this.bot.sendMessage(
                chatId,
                "❌ Error deleting transaction."
              )
            }

            // Возвращаемся в TX_EDIT_SELECT
            this.clearState(userId)
            this.setState(userId, {
              step: "TX_EDIT_SELECT",
              data: {},
              returnTo: "history",
            })

            const recentTxs = await db.getRecentTransactions(userId, 5)
            if (recentTxs.length === 0) {
              await this.bot.sendMessage(
                chatId,
                "💭 No more transactions to edit.",
                {
                  reply_markup: {
                    keyboard: [[{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]],
                    resize_keyboard: true,
                  },
                }
              )
              this.clearState(userId)
              await showHistoryMenu(this.bot, chatId, userId)
              return true
            }

            const txButtons: TelegramBot.KeyboardButton[][] = []
            recentTxs.forEach((tx) => {
              const emoji =
                tx.type === "EXPENSE"
                  ? "💸"
                  : tx.type === "INCOME"
                    ? "💰"
                    : "↔️"
              const date = new Date(tx.date).toLocaleDateString("en-GB")
              txButtons.push([
                {
                  text: `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`,
                },
              ])
            })
            txButtons.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

            await this.bot.sendMessage(
              chatId,
              "✏️ *Edit Transactions*\n\nSelect transaction to edit:",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: txButtons,
                  resize_keyboard: true,
                },
              }
            )
          }

          this.clearState(userId)
          await showEditTransactionsMenu(this.bot, chatId, userId)
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

          this.clearState(userId)
          await showHistoryMenu(this.bot, chatId, userId)
          return true
        }

        case "TX_EDIT_CATEGORY": {
          const tx = state.data?.transaction
          if (!tx) return true

          // Проверяем что категория валидна
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

          this.clearState(userId)
          await showHistoryMenu(this.bot, chatId, userId)
          return true
        }

        case "TX_EDIT_ACCOUNT": {
          const tx = state.data?.transaction
          if (!tx) return true

          // Парсим аккаунт из текста кнопки
          const match = text.match(/^(.+?)\s+\([\d.]+\s+[A-Z]{3}\)$/)
          let newAccountId: string

          if (match) {
            newAccountId = match[1].trim()
          } else {
            // Если не совпадает с паттерном - это произвольный ввод
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

          // Обновляем аккаунт
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

          this.clearState(userId)
          await showHistoryMenu(this.bot, chatId, userId)
          return true
        }

        // --- Debt Flow ---
        case "DEBT_NAME":
          return await this.handleDebtName(chatId, userId, text)
        case "DEBT_AMOUNT":
          return await this.handleDebtAmount(chatId, userId, text)
        case "DEBT_PARTIAL_AMOUNT":
          return await this.handleDebtPartialAmount(chatId, userId, text)
        case "DEBT_PARTIAL_ACCOUNT":
          return await this.handleDebtPartialAccount(chatId, userId, text)
        case "DEBT_TYPE": {
          const type = text === "🔴 I Owe" ? "I_OWE" : "OWES_ME"

          await this.goToStep(userId, "DEBT_NAME", { type })

          await this.bot.sendMessage(
            chatId,
            "👤 Enter person's name:",
            this.getBackButton()
          )
          return true
        }

        case "DEBT_EDIT_SELECT": {
          if (text === "➕ Add Debt") {
            await this.goToStep(userId, "DEBT_TYPE", {})
            await this.bot.sendMessage(chatId, "Select debt type:", {
              reply_markup: {
                keyboard: [
                  [{ text: "🔴 I Owe" }, { text: "🟢 They Owe Me" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            })
            return true
          }

          const userData = await db.getUserData(userId)
          const debts = userData.debts.filter((d: Debt) => !d.isPaid)

          const selected = debts.find((d: Debt) => {
            const prefix = d.type === "I_OWE" ? "💸 Pay to" : "💰 Receive from"
            return text === `${prefix}: ${d.name}`
          })

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a debt from the list.",
              this.getBackButton()
            )
            return true
          }

          // 🆕 Показываем меню редактирования
          await this.goToStep(userId, "DEBT_EDIT_MENU", { debt: selected })

          await this.bot.sendMessage(
            chatId,
            `💰 Debt: "${selected.name}"\n\n` +
              `Total: ${selected.amount} ${selected.currency}\n` +
              `Paid: ${selected.paidAmount} ${selected.currency}\n` +
              `Remaining: ${(selected.amount - selected.paidAmount).toFixed(2)} ${selected.currency}\n\n` +
              `What would you like to do?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "💵 Partial Payment" }],
                  [{ text: "✅ Mark Completed" }],
                  [{ text: "✏️ Edit Amount" }],
                  [{ text: "🗑️ Delete Debt" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        case "DEBT_EDIT_AMOUNT": {
          const state = this.getState(userId)
          const debt = state?.data.debt
          if (!debt) return true

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )
          if (!parsed) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          const result = await db.updateDebtTotalAmount(
            userId,
            debt.id,
            parsed.amount,
            parsed.currency
          )

          if (!result.success) {
            await this.bot.sendMessage(
              chatId,
              result.message || "❌ Error updating debt",
              this.getBackButton()
            )
            return true
          }

          await this.bot.sendMessage(
            chatId,
            `✅ Debt "${debt.name}" updated to ${parsed.amount} ${parsed.currency}.`
          )
          this.clearState(userId)
          await showDebtsMenu(this.bot, chatId, userId)
          return true
        }

        case "DEBT_EDIT_MENU": {
          const debt = state.data?.debt
          if (!debt) return true

          if (text === "💵 Partial Payment") {
            // Переход к частичной оплате
            await this.goToStep(userId, "DEBT_PARTIAL_AMOUNT", {
              debt,
              debtId: debt.id,
            })
            await this.bot.sendMessage(
              chatId,
              `💵 *Partial Payment* for "${debt.name}"\n\n` +
                `Remaining: ${(debt.amount - debt.paidAmount).toFixed(2)} ${debt.currency}\n\n` +
                `Enter amount to pay:`,
              this.getBackButton()
            )
          } else if (text === "✅ Mark Completed") {
            await db.updateDebt(userId, debt.id, {
              isPaid: true,
              paidAmount: debt.amount,
            })
            await this.bot.sendMessage(
              chatId,
              `✅ Debt "${debt.name}" marked as completed!`
            )
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId)
          } else if (text === "✏️ Edit Amount") {
            await this.goToStep(userId, "DEBT_EDIT_AMOUNT", { debt })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `✏️ *Edit Total Amount* for "${debt.name}"\n\n` +
                `Current: ${debt.amount} ${debt.currency}\n\n` +
                `Enter new total amount (e.g. 500 or 500 ${defaultCurrency}):`,
              this.getBackButton()
            )
          } else if (text === "🗑️ Delete Debt") {
            await db.deleteDebt(userId, debt.id)
            await this.bot.sendMessage(
              chatId,
              `🗑️ Debt "${debt.name}" deleted.`
            )
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId)
          }
          return true
        }

        // --- Goal Flow ---
        case "GOAL_NAME":
          return await this.handleGoalInput(chatId, userId, text)
        case "GOAL_DEPOSIT_AMOUNT":
          return await this.handleGoalDepositAmount(chatId, userId, text)
        case "GOAL_DEPOSIT_ACCOUNT":
          return await this.handleGoalDepositAccount(chatId, userId, text)

        // --- Balance Flow ---
        case "BALANCE_EDIT_NEW_AMOUNT": {
          const accountId = state.data?.accountId
          const currentCurrency = state.data?.currency
          const currentAmount = state.data?.currentAmount

          if (text === "🗑️ Delete Balance") {
            if (currentAmount > 0) {
              // Если есть деньги - переход к BALANCE_DELETE_TRANSFER
              await this.goToStep(userId, "BALANCE_DELETE_TRANSFER", {
                accountId,
                currency: currentCurrency,
                amount: currentAmount,
              })
              await this.bot.sendMessage(
                chatId,
                `⚠️ Balance "${accountId}" has ${currentAmount.toFixed(2)} ${currentCurrency}.\n\nWhat would you like to do?`,
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: "↔️ Transfer to another account" }],
                      [{ text: "🗑️ Delete and clear everything" }],
                      [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
            } else {
              // Баланс = 0, просто удаляем
              await db.deleteBalance(userId, accountId, currentCurrency)
              await this.bot.sendMessage(
                chatId,
                `✅ Balance "${accountId}" deleted.`
              )
              this.clearState(userId)
              await showBalancesMenu(this.bot, chatId, userId)
            }
            return true
          }

          if (text === "🅰️ Set to Zero") {
            // Установить в 0 (оставляем валюту)
            await db.convertBalanceAmount(userId, accountId, currentCurrency, 0)
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" set to 0 ${currentCurrency}!`
            )
            this.clearState(userId)
            await showBalancesMenu(this.bot, chatId, userId)
            return true
          }

          // Парсим ввод
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

          // ✅ КЛЮЧЕВОЙ МОМЕНТ: Валюта отличается?
          if (parsed.currency !== currentCurrency) {
            // Показываем выбор
            const convertedAmount = db.calculateConvertedAmount(
              parsed.amount,
              parsed.currency,
              currentCurrency
            )

            await this.goToStep(userId, "BALANCE_EDIT_CURRENCY_CHOICE", {
              inputAmount: parsed.amount,
              inputCurrency: parsed.currency,
              convertedAmount,
            })

            await this.bot.sendMessage(
              chatId,
              `💱 You entered ${parsed.amount} ${parsed.currency}, but balance is in ${currentCurrency}.\n\n` +
                `Choose what to do:`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: `🔄 Convert to ${convertedAmount.toFixed(
                          2
                        )} ${currentCurrency}`,
                      },
                    ],
                    [
                      {
                        text: `💱 Change to ${parsed.amount} ${parsed.currency}`,
                      },
                    ],
                    [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          } else {
            // Валюта совпадает - просто обновляем
            await db.convertBalanceAmount(
              userId,
              accountId,
              parsed.currency,
              parsed.amount
            )
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" updated to ${parsed.amount.toFixed(
                2
              )} ${parsed.currency}!`
            )
            this.clearState(userId)
            await showBalancesMenu(this.bot, chatId, userId)
            return true
          }
        }

        case "BALANCE_ENTER_NEW_AMOUNT": {
          const { accountId, currency } = state.data
          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          await db.convertBalanceAmount(
            userId,
            accountId,
            currency,
            parsed.amount
          )
          await this.bot.sendMessage(
            chatId,
            `✅ Balance "${accountId}" updated to ${parsed.amount} ${currency}.`
          )
          this.clearState(userId)
          await showBalancesMenu(this.bot, chatId, userId)
          return true
        }

        case "BALANCE_DELETE_TRANSFER": {
          const { accountId, currency, amount } = state.data

          if (text === "🗑️ Delete and clear everything") {
            // Просто удаляем баланс
            await db.deleteBalance(userId, accountId, currency)
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" deleted and ${amount.toFixed(
                2
              )} ${currency} cleared.`
            )
            this.clearState(userId)
            await showBalancesMenu(this.bot, chatId, userId)
            return true
          } else if (text === "↔️ Transfer to another account") {
            // Показать список других аккаунтов
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
            rows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

            await this.bot.sendMessage(
              chatId,
              `↔️ Transfer ${amount.toFixed(2)} ${currency} to:`,
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

          // Неправильный ввод
          await this.bot.sendMessage(
            chatId,
            "❌ Please select an option from the buttons.",
            this.getBackButton()
          )
          return true
        }

        case "BALANCE_DELETE_SELECT_TARGET": {
          // text пример: "Bank Card (USD)"
          const m = text.match(/^(.+?)\s+\(([A-Z]{3})\)$/)
          if (!m) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a balance from buttons.",
              this.getBackButton()
            )
            return true
          }
          const targetAccountId = m[1].trim()
          const targetCurrency = m[2] as Currency

          const { accountId, currency, amount } = state.data

          // Создать Transfer транзакцию
          const transaction: Transaction = {
            id: Date.now().toString(),
            date: new Date(),
            amount: amount,
            currency: currency,
            type: TransactionType.TRANSFER,
            category: InternalCategory.TRANSFER,
            description: `Transfer before deleting "${accountId}"`,
            fromAccountId: accountId,
            toAccountId: targetAccountId,
          }
          await db.addTransaction(userId, transaction)

          // Обновить балансы
          await db.updateBalance(userId, accountId, -amount, currency)
          await db.updateBalance(
            userId,
            targetAccountId,
            amount,
            targetCurrency
          )

          // Удалить исходный баланс
          await db.deleteBalance(userId, accountId, currency)

          await this.bot.sendMessage(
            chatId,
            `✅ Transferred ${amount.toFixed(
              2
            )} ${currency} to "${targetAccountId}" and deleted "${accountId}".`
          )
          this.clearState(userId)
          await showBalancesMenu(this.bot, chatId, userId)
          return true
        }

        case "GOAL_EDIT_SELECT": {
          // ✅ Обработка кнопки Add Goal
          if (text === "➕ Add Goal") {
            await this.goToStep(userId, "GOAL_NAME", {})
            await this.bot.sendMessage(
              chatId,
              "Enter goal name and target amount:\n\n" +
                "Format: Name | Amount\n" +
                "Example: Car | 10000 USD",
              this.getBackButton()
            )
            return true
          }

          // 🆕 Обработка кнопки Completed Goals
          if (text.startsWith("✅ Completed Goals")) {
            const userData = await db.getUserData(userId)
            const completedGoals = userData.goals.filter(
              (g: Goal) => g.status === "COMPLETED"
            )

            if (completedGoals.length === 0) {
              await this.bot.sendMessage(
                chatId,
                "📭 No completed goals yet.",
                this.getBackButton()
              )
              return true
            }

            // Переключаемся на шаг GOAL_COMPLETED_SELECT
            await this.goToStep(userId, "GOAL_COMPLETED_SELECT", {})

            const keyboard: TelegramBot.KeyboardButton[][] = []
            completedGoals.forEach((g: Goal) => {
              keyboard.push([{ text: `✅ Goal: ${g.name}` }])
            })
            keyboard.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

            await this.bot.sendMessage(
              chatId,
              `✅ *Completed Goals* (${completedGoals.length})\n\nSelect a goal to view:`,
              {
                parse_mode: "Markdown",
                reply_markup: { keyboard, resize_keyboard: true },
              }
            )
            return true
          }

          // Находим выбранную цель
          const userData = await db.getUserData(userId)
          const goals = userData.goals.filter(
            (g: Goal) => g.status === "ACTIVE"
          )

          const selected = goals.find((g: Goal) => text === `Goal: ${g.name}`)

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a goal from the list.",
              this.getBackButton()
            )
            return true
          }

          // Показываем меню редактирования
          await this.goToStep(userId, "GOAL_EDIT_MENU", { goal: selected })

          const progress =
            (selected.currentAmount / selected.targetAmount) * 100

          await this.bot.sendMessage(
            chatId,
            `🎯 Goal: "${selected.name}"\n\n` +
              `Target: ${selected.targetAmount} ${selected.currency}\n` +
              `Current: ${selected.currentAmount} ${selected.currency}\n` +
              `Progress: ${progress.toFixed(1)}%\n` +
              `Remaining: ${(selected.targetAmount - selected.currentAmount).toFixed(2)} ${selected.currency}\n\n` +
              `What would you like to do?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "💰 Deposit" }],
                  [{ text: "✏️ Edit Target" }],
                  [{ text: "✅ Mark Complete" }],
                  [{ text: "🗑️ Delete Goal" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        case "GOAL_EDIT_MENU": {
          const goal = state.data?.goal
          if (!goal) return true

          if (text === "💰 Deposit") {
            await this.goToStep(userId, "GOAL_DEPOSIT_AMOUNT", { goal })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `💰 Deposit to "${goal.name}"\n\n` +
                `Remaining: ${(goal.targetAmount - goal.currentAmount).toFixed(2)} ${goal.currency}\n\n` +
                `Enter amount to deposit (e.g. 100 or 100 ${defaultCurrency}):`,
              this.getBackButton()
            )
          } else if (text === "✏️ Edit Target") {
            await this.goToStep(userId, "GOAL_EDIT_TARGET", { goal })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `✏️ Edit Target for "${goal.name}"\n\n` +
                `Current target: ${goal.targetAmount} ${goal.currency}\n\n` +
                `Enter new target amount (e.g. 5000 or 5000 ${defaultCurrency}):`,
              this.getBackButton()
            )
          } else if (text === "✅ Mark Complete") {
            await db.updateGoal(userId, goal.id, { status: "COMPLETED" })
            await this.bot.sendMessage(
              chatId,
              `🎉 Goal "${goal.name}" marked as complete!`
            )
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
          } else if (text === "🗑️ Delete Goal") {
            await db.deleteGoal(userId, goal.id)
            await this.bot.sendMessage(
              chatId,
              `🗑️ Goal "${goal.name}" deleted.`
            )
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId)
          }
          return true
        }

        case "GOAL_EDIT_TARGET": {
          const goal = state.data?.goal
          if (!goal) return true

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed) {
            await this.bot.sendMessage(
              chatId,
              `❌ Invalid amount. Try: 5000 or 5000 ${defaultCurrency}`,
              this.getBackButton()
            )
            return true
          }

          if (parsed.amount < goal.currentAmount) {
            await this.bot.sendMessage(
              chatId,
              `❌ New target (${parsed.amount}) cannot be less than current amount (${goal.currentAmount}).`,
              this.getBackButton()
            )
            return true
          }

          await db.updateGoalTarget(
            userId,
            goal.id,
            parsed.amount,
            parsed.currency
          )
          await this.bot.sendMessage(
            chatId,
            `✅ Goal "${goal.name}" target updated to ${parsed.amount} ${parsed.currency}!`
          )
          this.clearState(userId)
          await showGoalsMenu(this.bot, chatId, userId)
          return true
        }

        case "GOAL_COMPLETED_SELECT": {
          // Обработка кликов по завершенным целям
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

          // Переходим в режим удаления
          await this.goToStep(userId, "GOAL_COMPLETED_DELETE", {
            goal: selected,
          })

          // Показываем информацию о завершенной цели
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
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
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

        // --- Income Flow ---
        case "INCOME_NAME": {
          const name = text.trim()
          if (!name) {
            await this.bot.sendMessage(
              chatId,
              "❌ Name cannot be empty.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "INCOME_AMOUNT", { name })

          await this.bot.sendMessage(
            chatId,
            "Enter expected monthly amount (e.g. 1000 or 1000 USD):",
            this.getBackButton()
          )
          return true
        }

        case "INCOME_DELETE_CONFIRM": {
          if (text === "✅ Confirm delete") {
            const name = state.data?.name
            if (name) {
              await db.deleteIncomeSource(userId, name)
              await this.bot.sendMessage(
                chatId,
                `🗑 Income source "${name}" deleted.`
              )
            } else {
              await this.bot.sendMessage(
                chatId,
                "❌ No income source selected.",
                this.getBackButton()
              )
            }
          } else {
            await this.bot.sendMessage(chatId, "❌ Deletion cancelled.")
          }

          this.clearState(userId)
          await showIncomeMenu(this.bot, chatId, userId)
          return true
        }

        case "INCOME_AMOUNT":
          return await this.handleIncomeInput(chatId, userId, text)

        // --- Balance Flow ---
        case "BALANCE_EDIT_SELECT": {
          // Обработка кнопки Add Balance
          if (text === "➕ Add Balance") {
            await this.goToStep(userId, "BALANCE_NAME")
            await this.bot.sendMessage(
              chatId,
              "Enter account name (e.g., 'Cash' or 'Bank Card'):",
              this.getBackButton()
            )
            return true
          }

          const m = text.match(/^(.+?)\s*\(([A-Z]{3})\)$/)
          if (!m) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a balance from buttons or click ➕ Add Balance.",
              this.getBackButton()
            )
            return true
          }
          const accountId = m[1].trim()

          const balance = await db.getBalanceAmount(userId, accountId)
          if (!balance) {
            await this.bot.sendMessage(
              chatId,
              "❌ Balance not found.",
              this.getBackButton()
            )
            return true
          }

          await this.goToStep(userId, "BALANCE_EDIT_NEW_AMOUNT", {
            accountId,
            currency: balance.currency,
            currentAmount: balance.amount,
          })

          const defaultCurrency = await db.getDefaultCurrency(userId)
          await this.bot.sendMessage(
            chatId,
            `✏️ Editing "${accountId}"\nCurrent: ${balance.amount.toFixed(2)} ${
              balance.currency
            }\n\nEnter new amount (e.g., 100 or 100 ${defaultCurrency}):`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "🅰️ Set to Zero" }],
                  [{ text: "🗑️ Delete Balance" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        case "BALANCE_EDIT_MENU": {
          if (text === "✏️ Edit Amount") {
            await this.goToStep(userId, "BALANCE_EDIT_NEW_AMOUNT")
            await this.resendCurrentStepPrompt(chatId, userId, state)
          } else if (text === "🗑️ Delete Balance") {
            const balance = await db.getBalance(
              userId,
              state.data.accountId,
              state.data.currency
            )

            if (balance && balance.amount !== 0) {
              await this.goToStep(userId, "BALANCE_DELETE_TRANSFER", {
                amount: balance.amount,
              })
              await this.resendCurrentStepPrompt(chatId, userId, state)
            } else {
              await db.deleteBalance(
                userId,
                state.data.accountId,
                state.data.currency
              )
              await this.bot.sendMessage(
                chatId,
                `✅ Balance "${state.data.accountId}" deleted.`
              )
              this.clearState(userId)
              await showBalancesMenu(this.bot, chatId, userId)
            }
          }
          return true
        }

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

          // Проверка на дубликат
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
                  [{ text: "🅰️ Empty Balance" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        case "BALANCE_AMOUNT": {
          const defaultCurrency = await db.getDefaultCurrency(userId)

          // Обработка кнопки "🅰️ Empty Balance"
          let amount = 0
          let currency = defaultCurrency

          if (text === "🅰️ Empty Balance") {
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
                      [{ text: "🅰️ Empty Balance" }],
                      [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
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
              "❌ Account name missing. Start again.",
              this.getBackButton()
            )
            this.clearState(userId)
            await showMainMenu(this.bot, chatId)

            return true
          }

          await db.addBalance(userId, {
            accountId,
            amount: amount,
            currency: currency,
            lastUpdated: new Date().toISOString(),
          })

          await this.bot.sendMessage(
            chatId,
            `✅ Balance "${accountId}" saved with ${amount} ${currency}!`
          )
          this.clearState(userId)
          await showBalancesMenu(this.bot, chatId, userId)
          return true
        }

        case "BALANCE_DELETE_SELECT": {
          // text пример: "Cash (USD)"
          const m = text.match(/^(.+?)\s+\(([A-Z]{3})\)$/)
          if (!m) {
            await this.bot.sendMessage(
              chatId,
              "❌ Select a balance from buttons.",
              this.getBackButton()
            )
            return true
          }
          const accountId = m[1].trim()
          const currency = m[2] as Currency

          // Найти баланс для проверки суммы
          const balanceList = await db.getBalancesList(userId)
          const balance = balanceList.find(
            (b) => b.accountId === accountId && b.currency === currency
          )

          if (!balance) {
            await this.bot.sendMessage(
              chatId,
              "❌ Balance not found.",
              this.getBackButton()
            )
            return true
          }

          // Если баланс НЕ пустой, спрашиваем про перенос
          if (balance.amount > 0) {
            const balanceList = await db.getBalancesList(userId)
            const otherBalances = balanceList.filter(
              (b) => !(b.accountId === accountId && b.currency === currency)
            )

            if (otherBalances.length > 0) {
              // Есть другие аккаунты - предложить перенос
              await this.goToStep(userId, "BALANCE_DELETE_TRANSFER", {
                accountId,
                currency,
                amount: balance.amount,
              })

              await this.bot.sendMessage(
                chatId,
                `⚠️ Balance "${accountId}" has ${balance.amount.toFixed(
                  2
                )} ${currency}.\n\nWhat would you like to do?`,
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: "↔️ Transfer to another account" }],
                      [{ text: "🗑️ Delete and clear everything" }],
                      [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
              return true
            }
          }

          // Баланс пустой или нет других аккаунтов - просто удаляем
          await db.deleteBalance(userId, accountId, currency)
          await this.bot.sendMessage(chatId, "🗑️ Balance deleted.")
          this.clearState(userId)
          await showBalancesMenu(this.bot, chatId, userId)
          return true
        }

        case "BALANCE_EDIT_CURRENCY_CHOICE": {
          const accountId = state.data?.accountId
          const currentCurrency = state.data?.currency
          const inputAmount = state.data?.inputAmount
          const inputCurrency = state.data?.inputCurrency
          const convertedAmount = state.data?.convertedAmount

          if (text.startsWith("🔄 Convert to")) {
            // Вариант 1: КОНВЕРТИРОВАТЬ
            await db.convertBalanceAmount(
              userId,
              accountId,
              inputCurrency,
              inputAmount
            )
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" converted: ${inputAmount} ${inputCurrency} → ${convertedAmount.toFixed(
                2
              )} ${currentCurrency}!`
            )
            this.clearState(userId)
            await showBalancesMenu(this.bot, chatId, userId)
          } else if (text.startsWith("💱 Change to")) {
            // Вариант 2: СМЕНИТЬ ВАЛЮТУ
            await db.setBalanceAmountWithCurrencyChange(
              userId,
              accountId,
              inputCurrency,
              inputAmount
            )
            await this.bot.sendMessage(
              chatId,
              `✅ Balance "${accountId}" changed to ${inputAmount.toFixed(
                2
              )} ${inputCurrency}!`
            )
            this.clearState(userId)
            await showBalancesMenu(this.bot, chatId, userId)
          }
          // 🔧 Кнопка "Назад" обработается автоматически
          return true
        }
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

  // --- Transaction Handlers ---

  private async handleTxAmount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
    if (!parsed) {
      await this.bot.sendMessage(
        chatId,
        `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`
      )
      return true
    }

    const state = this.getState(userId)
    if (!state) return false

    // =====================================
    // ОБРАБОТКА ОТРИЦАТЕЛЬНЫХ ЗНАЧЕНИЙ
    // =====================================
    if (parsed.amount < 0) {
      // Отрицательные значения имеют смысл только для Expense (возврат)
      if (state.txType === TransactionType.EXPENSE) {
        await this.bot.sendMessage(
          chatId,
          `⚠️ Negative amount detected: ${parsed.amount} ${parsed.currency}\n\n` +
            `This means a REFUND (money returned to you).\n\n` +
            `This will increase your balance. Proceed?`,
          {
            reply_markup: {
              keyboard: [
                [{ text: "✅ Yes, it's a refund" }],
                [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          }
        )

        await this.goToStep(userId, "TX_CONFIRM_REFUND", {
          amount: Math.abs(parsed.amount),
          currency: parsed.currency,
        })
        return true
      } else if (state.txType === TransactionType.INCOME) {
        await this.bot.sendMessage(
          chatId,
          `❌ Negative income doesn't make sense. Please enter a positive amount.`,
          this.getBackButton()
        )
        return true
      } else if (state.txType === TransactionType.TRANSFER) {
        await this.bot.sendMessage(
          chatId,
          `❌ Transfer amount must be positive.`,
          this.getBackButton()
        )
        return true
      }
    }

    // =====================================
    // ОБЫЧНАЯ ЛОГИКА (положительные суммы)
    // =====================================
    state.data = {
      ...state.data,
      amount: parsed.amount,
      currency: parsed.currency,
    }

    if (state.txType === TransactionType.EXPENSE) {
      // Show EXPENSE categories
      const categories = Object.values(ExpenseCategory)
      const rows = []
      for (let i = 0; i < categories.length; i += 2) {
        rows.push(categories.slice(i, i + 2).map((c) => ({ text: c })))
      }
      rows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

      await this.goToStep(userId, "TX_CATEGORY", {
        amount: parsed.amount,
        currency: parsed.currency,
      })
      await this.bot.sendMessage(chatId, "📋 Select Expense Category:", {
        reply_markup: { keyboard: rows, resize_keyboard: true },
      })
    } else if (state.txType === TransactionType.INCOME) {
      // Show INCOME categories (ИСПРАВЛЕНО!)
      const categories = Object.values(IncomeCategory)
      const rows = []
      for (let i = 0; i < categories.length; i += 2) {
        rows.push(categories.slice(i, i + 2).map((c) => ({ text: c })))
      }
      rows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

      await this.goToStep(userId, "TX_CATEGORY", {
        amount: parsed.amount,
        currency: parsed.currency,
      })
      await this.bot.sendMessage(chatId, "💰 Select Income Category:", {
        reply_markup: { keyboard: rows, resize_keyboard: true },
      })
    } else if (state.txType === TransactionType.TRANSFER) {
      // Transfer без категории
      await this.goToStep(userId, "TX_ACCOUNT", {
        amount: parsed.amount,
        currency: parsed.currency,
        category: InternalCategory.TRANSFER,
      })
      await this.askForAccount(
        chatId,
        "📤 Select source account:",
        parsed.currency
      )
    }

    return true
  }

  private async handleTxCategory(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    if (!state) return false

    await this.goToStep(userId, "TX_ACCOUNT", { category: text })

    await this.askForAccount(
      chatId,
      "💳 Select payment account:",
      state.data.currency
    )
    return true
  }

  private async handleTxAccount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    if (!state) return false

    // Parse account from button text "Name (100 USD)" -> "Name"
    const accountName = text.split(" (")[0].trim()

    // =====================================
    // ОБРАБОТКА REFUND (возврат)
    // =====================================
    if (state.data.isRefund || state.data.category === IncomeCategory.REFUND) {
      const transaction: Transaction = {
        id: Date.now().toString(),
        date: new Date(),
        amount: state.data.amount,
        currency: state.data.currency,
        type: TransactionType.INCOME, // Важно! Refund = Income
        category: IncomeCategory.REFUND,
        description: "Refund",
        toAccountId: accountName,
      }
      await db.addTransaction(userId, transaction)

      await this.bot.sendMessage(
        chatId,
        `✅ Refund of ${state.data.amount} ${state.data.currency} added to "${accountName}"!`
      )
      this.clearState(userId)
      await showMainMenu(this.bot, chatId)

      return true
    }

    // =====================================
    // ОБРАБОТКА TRANSFER
    // =====================================
    if (state.txType === TransactionType.TRANSFER) {
      await this.goToStep(userId, "TX_TO_ACCOUNT", {
        fromAccountId: accountName,
      })
      // Исключаем исходный аккаунт из списка
      await this.askForAccount(
        chatId,
        "📥 Select destination account:",
        state.data.currency,
        accountName
      )
      return true
    }

    // =====================================
    // ОБЫЧНЫЕ INCOME/EXPENSE
    // =====================================

    // ⚠️ ПРОВЕРКА БАЛАНСА ПРИ EXPENSE
    if (state.txType === TransactionType.EXPENSE) {
      const balances = await db.getBalancesList(userId)
      const balance = balances.find((b) => b.accountId === accountName)

      if (!balance) {
        await this.bot.sendMessage(
          chatId,
          `❌ Error: Account "${accountName}" not found.`,
          this.getBackButton()
        )
        return true
      }

      // Проверяем достаточно ли денег
      if (balance.amount < state.data.amount) {
        await this.bot.sendMessage(
          chatId,
          `❌ Insufficient funds!\n\n` +
            `Account: ${accountName}\n` +
            `Available: ${balance.amount.toFixed(2)} ${balance.currency}\n` +
            `Required: ${state.data.amount.toFixed(2)} ${state.data.currency}\n\n` +
            `Shortage: ${(state.data.amount - balance.amount).toFixed(2)} ${state.data.currency}`,
          this.getBackButton()
        )
        return true
      }
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
      date: new Date(),
      amount: state.data.amount,
      currency: state.data.currency,
      type: state.txType!,
      category: state.data.category,
      fromAccountId:
        state.txType === TransactionType.EXPENSE ? accountName : undefined,
      toAccountId:
        state.txType === TransactionType.INCOME ? accountName : undefined,
      description: state.data.category,
    }

    await db.addTransaction(userId, transaction)
    await this.bot.sendMessage(chatId, "✅ Transaction saved!")
    this.clearState(userId)
    await showMainMenu(this.bot, chatId)

    return true
  }

  private async handleTxToAccount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    if (!state) return false

    const accountName = text.split(" (")[0].trim()

    // Проверяем что не переводим на тот же аккаунт
    if (accountName === state.data.fromAccountId) {
      await this.bot.sendMessage(
        chatId,
        "❌ Cannot transfer to the same account. Please select a different destination.",
        this.getBackButton()
      )
      return true
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
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
    await this.bot.sendMessage(chatId, "✅ Transfer completed!")
    this.clearState(userId)
    await showMainMenu(this.bot, chatId)

    return true
  }

  // --- Debt Handlers ---

  private async handleDebtName(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    if (!state) return false

    await this.goToStep(userId, "DEBT_AMOUNT", { name: text })
    await this.bot.sendMessage(
      chatId,
      "💰 Enter amount (e.g. 100 or 100 USD):",
      this.getBackButton()
    )
    return true
  }

  private async handleDebtAmount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
    if (!parsed) {
      await this.bot.sendMessage(
        chatId,
        `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`
      )
      return true
    }

    const state = this.getState(userId)
    if (!state) return false

    await db.addDebt(userId, {
      id: Date.now().toString(),
      name: state.data.name,
      amount: parsed.amount,
      currency: parsed.currency,
      counterparty: state.data.name,
      type: state.data.type,
      paidAmount: 0,
      isPaid: false,
    })

    await this.bot.sendMessage(chatId, "✅ Debt added!")
    this.clearState(userId)
    await showDebtsMenu(this.bot, chatId, userId)
    return true
  }

  private async handleDebtPartialAmount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
    if (!parsed) {
      await this.bot.sendMessage(
        chatId,
        `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`
      )
      return true
    }

    const state = this.getState(userId)
    const debt = state?.data.debt
    const remaining = debt.amount - debt.paidAmount

    if (parsed.amount > remaining) {
      await this.bot.sendMessage(
        chatId,
        `❌ Error: Amount (${parsed.amount}) exceeds remaining debt (${remaining}).`,
        this.getBackButton()
      )
      return true
    }

    await this.goToStep(userId, "DEBT_PARTIAL_ACCOUNT", {
      payAmount: parsed.amount,
    })

    await this.askForAccount(
      chatId,
      "💳 Select account to pay from:",
      debt.currency
    )
    return true
  }

  private async handleDebtPartialAccount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    if (!state) return false

    const accountName = text.split(" (")[0].trim()
    const debt = state.data.debt
    const payAmount = state.data.payAmount

    const result = await db.updateDebtAmount(
      userId,
      debt.id,
      payAmount,
      accountName,
      state.data.currency
    )

    if (!result.success) {
      await this.bot.sendMessage(
        chatId,
        result.message || "❌ Error",
        this.getBackButton()
      )
      return true
    }

    // 3. Check for Full Payment
    const updatedDebt = await db.getDebtById(userId, debt.id)
    if (updatedDebt?.isPaid) {
      await this.bot.sendMessage(chatId, "🎉 Debt fully paid and closed!")
    } else {
      await this.bot.sendMessage(
        chatId,
        `✅ Paid ${payAmount}. Remaining: ${
          updatedDebt ? updatedDebt.amount - updatedDebt.paidAmount : 0
        }`
      )
    }

    this.clearState(userId)
    await showMainMenu(this.bot, chatId)

    return true
  }

  // --- Goal Handlers ---

  private async handleGoalInput(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const parsed = validators.parseGoalInput(text, defaultCurrency)
    if (!parsed) {
      await this.bot.sendMessage(
        chatId,
        validators.getValidationErrorMessage("goal"),
        this.getBackButton()
      )
      return true
    }

    await db.addGoal(userId, {
      id: Date.now().toString(),
      name: parsed.name,
      targetAmount: parsed.targetAmount,
      currentAmount: 0,
      currency: parsed.currency,
      status: "ACTIVE",
    })

    await this.bot.sendMessage(chatId, "✅ Goal added!")
    this.clearState(userId)
    await showGoalsMenu(this.bot, chatId, userId)
    return true
  }

  private async handleGoalDepositAmount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
    if (!parsed) {
      await this.bot.sendMessage(
        chatId,
        `❌ Invalid amount. Try: 100 or 100 ${defaultCurrency}`,
        this.getBackButton()
      )
      return true
    }

    const state = this.getState(userId)
    const goal = state?.data.goal
    const remaining = goal.targetAmount - goal.currentAmount

    if (parsed.amount > remaining) {
      await this.bot.sendMessage(
        chatId,
        `❌ Error: Amount exceeds remaining goal target (${remaining}).`,
        this.getBackButton()
      )
      return true
    }

    await this.goToStep(userId, "GOAL_DEPOSIT_ACCOUNT", {
      depositAmount: parsed.amount,
    })

    await this.askForAccount(chatId, "💳 Select source account:", goal.currency)
    return true
  }

  private async handleGoalDepositAccount(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    if (!state) return false

    const accountName = text.split(" (")[0].trim()
    const goal = state.data.goal
    const amount = state.data.depositAmount

    const result = await db.depositToGoal(
      userId,
      goal.id,
      amount,
      accountName,
      goal.currency
    )

    if (!result.success) {
      await this.bot.sendMessage(
        chatId,
        result.message || "❌ Error",
        this.getBackButton()
      )
      return true
    }

    await this.bot.sendMessage(
      chatId,
      `✅ Deposited ${amount} to goal "${goal.name}" from ${accountName}!`
    )
    this.clearState(userId)
    await showMainMenu(this.bot, chatId)

    return true
  }

  // --- Income Handler ---
  private async handleIncomeInput(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
    if (!parsed) {
      await this.bot.sendMessage(
        chatId,
        `❌ Invalid amount. Try: 100 or 100 ${defaultCurrency}`,
        this.getBackButton()
      )
      return true
    }
    const state = this.getState(userId)
    await db.addIncomeSource(userId, {
      id: Date.now().toString(),
      name: state?.data?.name || "Income",
      expectedAmount: parsed.amount,
      currency: parsed.currency,
      frequency: "MONTHLY",
    })
    await this.bot.sendMessage(chatId, "✅ Income source added!")
    this.clearState(userId)
    await showIncomeMenu(this.bot, chatId, userId)
    return true
  }

  // --- Helpers ---

  private async resendCurrentStepPrompt(
    chatId: number,
    userId: string,
    state: WizardState
  ): Promise<void> {
    const { step, data, txType } = state
    const defaultCurrency = await db.getDefaultCurrency(userId)

    switch (step) {
      // --- Transaction Flow ---
      case "TX_AMOUNT": {
        const msg =
          txType === TransactionType.EXPENSE
            ? `Enter amount (e.g., 50 or 50 ${defaultCurrency}):`
            : txType === TransactionType.INCOME
              ? `Enter amount (e.g., 1500 or 1500 ${defaultCurrency}):`
              : `Enter amount to transfer (e.g., 100 or 100 ${defaultCurrency}):`
        await this.bot.sendMessage(chatId, msg, this.getBackButton())
        break
      }

      case "TX_CATEGORY": {
        const categories =
          txType === TransactionType.EXPENSE
            ? Object.values(ExpenseCategory)
            : txType === TransactionType.INCOME
              ? Object.values(IncomeCategory)
              : Object.values(InternalCategory)
        const rows = []
        for (let i = 0; i < categories.length; i += 2) {
          rows.push(categories.slice(i, i + 2).map((c) => ({ text: c })))
        }
        rows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])
        await this.bot.sendMessage(chatId, "📂 Select Category:", {
          reply_markup: { keyboard: rows, resize_keyboard: true },
        })
        break
      }

      case "TX_ACCOUNT": {
        const accountMsg =
          txType === TransactionType.EXPENSE
            ? "💳 Select payment account:"
            : txType === TransactionType.INCOME
              ? "📥 Select account to deposit to:"
              : "📤 Select source account:"
        await this.askForAccount(chatId, accountMsg, data.currency)
        break
      }

      case "TX_TO_ACCOUNT":
        // Исключаем исходный аккаунт при возврате
        await this.askForAccount(
          chatId,
          "📥 Select destination account:",
          data.currency,
          data.fromAccountId
        )
        break

      case "TX_CONFIRM_REFUND":
        if (data.amount !== undefined && data.currency) {
          await this.bot.sendMessage(
            chatId,
            `⚠️ Negative amount detected: -${data.amount} ${data.currency}\n\n` +
              `This means a REFUND (money returned to you).\n\n` +
              `This will increase your balance. Proceed?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "✅ Yes, it's a refund" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
        }
        break

      case "TX_EDIT_SELECT": {
        // Показываем список последних транзакций снова
        const recentTxs = await db.getRecentTransactions(userId, 5)
        const txButtons: TelegramBot.KeyboardButton[][] = []

        recentTxs.forEach((tx) => {
          const emoji =
            tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
          const date = new Date(tx.date).toLocaleDateString("en-GB")
          txButtons.push([
            {
              text: `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`,
            },
          ])
        })
        txButtons.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

        await this.bot.sendMessage(
          chatId,
          "✏️ *Edit Transactions*\n\nSelect transaction to edit:",
          {
            parse_mode: "Markdown",
            reply_markup: { keyboard: txButtons, resize_keyboard: true },
          }
        )
        break
      }

      case "TX_VIEW_PERIOD": {
        await this.bot.sendMessage(
          chatId,
          "📊 *Transaction History*\n\nSelect period:",
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📅 Last 7 days" }, { text: "📅 Last 30 days" }],
                [{ text: "💸 Expenses only" }, { text: "💰 Income only" }],
                [{ text: "🔍 All transactions" }],
                [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          }
        )
        break
      }

      case "TX_VIEW_LIST": {
        const transactions = state.data?.transactions || []
        const period = state.data?.period || "All Time"
        const toShow = transactions.slice(0, 10)
        const txButtons: TelegramBot.KeyboardButton[][] = []

        toShow.forEach((tx: Transaction) => {
          const emoji =
            tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
          const date = new Date(tx.date).toLocaleDateString("en-GB")
          txButtons.push([
            {
              text: `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`,
            },
          ])
        })
        txButtons.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

        await this.bot.sendMessage(
          chatId,
          `📊 *Transaction History* (${period})\n\nShowing ${toShow.length} of ${transactions.length} transaction(s)\n\nSelect transaction to edit:`,
          {
            parse_mode: "Markdown",
            reply_markup: { keyboard: txButtons, resize_keyboard: true },
          }
        )
        break
      }

      // --- Debt Flow ---
      case "DEBT_TYPE":
        await this.bot.sendMessage(chatId, "Select debt type:", {
          reply_markup: {
            keyboard: [
              [{ text: "🔴 I Owe" }, { text: "🟢 They Owe Me" }],
              [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        })
        break

      case "DEBT_NAME":
        await this.bot.sendMessage(
          chatId,
          "👤 Enter person's name:",
          this.getBackButton()
        )
        break

      case "DEBT_AMOUNT":
        await this.bot.sendMessage(
          chatId,
          `💰 Enter amount (e.g. 100 or 100 ${defaultCurrency}):`,
          this.getBackButton()
        )
        break

      case "DEBT_PARTIAL_AMOUNT":
        if (data.debt) {
          const remaining = data.debt.amount - data.debt.paidAmount
          await this.bot.sendMessage(
            chatId,
            `📉 Paying "${data.debt.name}"\nRemaining: ${remaining}\n\nEnter amount to pay:`,
            this.getBackButton()
          )
        }
        break

      case "DEBT_PARTIAL_ACCOUNT":
        await this.askForAccount(
          chatId,
          "💳 Select account for payment:",
          data.currency
        )
        break

      // --- Goal Flow ---
      case "GOAL_NAME":
        await this.bot.sendMessage(
          chatId,
          "Enter goal name (e.g. Car):",
          this.getBackButton()
        )
        break

      case "GOAL_DEPOSIT_AMOUNT":
        if (data.goal) {
          await this.bot.sendMessage(
            chatId,
            `🎯 "${data.goal.name}"\nTarget: ${data.goal.targetAmount}\nCurrent: ${data.goal.currentAmount}\n\nEnter deposit amount:`,
            this.getBackButton()
          )
        }
        break

      case "GOAL_DEPOSIT_ACCOUNT":
        await this.askForAccount(
          chatId,
          "💳 Select account to withdraw from:",
          data.currency
        )
        break

      // --- Income Flow ---
      case "INCOME_NAME":
        await this.bot.sendMessage(
          chatId,
          "Enter income source name (e.g. Salary, Freelance):",
          this.getBackButton()
        )
        break

      case "INCOME_AMOUNT":
        await this.bot.sendMessage(
          chatId,
          `Enter expected monthly amount (e.g. 1000 or 1000 ${defaultCurrency}):`,
          this.getBackButton()
        )
        break

      case "INCOME_DELETE_CONFIRM":
        if (data.name) {
          await this.bot.sendMessage(
            chatId,
            `🗑 Delete income source "${data.name}"?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "✅ Confirm delete" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
        }
        break

      // --- Balance Flow ---
      case "BALANCE_NAME":
        await this.bot.sendMessage(
          chatId,
          "Enter account name (e.g., 'Cash' or 'Bank Card'):",
          this.getBackButton()
        )
        break

      case "BALANCE_AMOUNT":
        await this.bot.sendMessage(
          chatId,
          `Enter amount (e.g. 100 or 100 ${defaultCurrency}):`,
          this.getBackButton()
        )
        break

      case "BALANCE_DELETE_SELECT": {
        const balances = await db.getBalancesList(userId)
        if (balances.length > 0) {
          const balanceRows = []
          for (const b of balances) {
            balanceRows.push([{ text: `${b.accountId} (${b.currency})` }])
          }
          balanceRows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])
          await this.bot.sendMessage(chatId, "Select balance to delete:", {
            reply_markup: {
              keyboard: balanceRows,
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          })
        }
        break
      }

      case "BALANCE_EDIT_SELECT": {
        const editBalances = await db.getBalancesList(userId)
        if (editBalances.length > 0) {
          const editBalanceRows = [[{ text: "➕ Add Balance" }]]
          for (const b of editBalances) {
            editBalanceRows.push([{ text: `${b.accountId} (${b.currency})` }])
          }
          editBalanceRows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])
          await this.bot.sendMessage(chatId, "Select balance to edit:", {
            reply_markup: {
              keyboard: editBalanceRows,
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          })
        }
        break
      }

      case "BALANCE_EDIT_NEW_AMOUNT":
        if (
          data.accountId &&
          data.currency &&
          data.currentAmount !== undefined
        ) {
          await this.bot.sendMessage(
            chatId,
            `✏️ Editing "${
              data.accountId
            }"\nCurrent: ${data.currentAmount.toFixed(2)} ${
              data.currency
            }\n\nWhat would you like to do?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "✏️ Change Amount" }],
                  [{ text: "🅰️ Set to Zero" }],
                  [{ text: "🗑️ Delete Balance" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
        }
        break

      case "BALANCE_DELETE_TRANSFER":
        if (data.accountId && data.currency && data.amount !== undefined) {
          await this.bot.sendMessage(
            chatId,
            `⚠️ Balance "${data.accountId}" has ${data.amount.toFixed(2)} ${
              data.currency
            }.\n\nWhat would you like to do?`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "↔️ Transfer to another account" }],
                  [{ text: "🗑️ Delete and clear everything" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
        }
        break

      case "BALANCE_DELETE_SELECT_TARGET":
        if (data.accountId && data.currency && data.amount !== undefined) {
          const balanceList = await db.getBalancesList(userId)
          const otherBalances = balanceList.filter(
            (b) =>
              !(b.accountId === data.accountId && b.currency === data.currency)
          )

          const rows = otherBalances.map((b) => [
            { text: `${b.accountId} (${b.currency})` },
          ])
          rows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

          await this.bot.sendMessage(
            chatId,
            `↔️ Transfer ${data.amount.toFixed(2)} ${data.currency} to:`,
            {
              reply_markup: {
                keyboard: rows,
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }
          )
        }
        break

      case "BALANCE_EDIT_CURRENCY_CHOICE":
        if (
          data.inputAmount &&
          data.inputCurrency &&
          data.convertedAmount &&
          data.currency
        ) {
          await this.bot.sendMessage(
            chatId,
            `💱 You entered ${data.inputAmount} ${data.inputCurrency}, but balance is in ${data.currency}.\n\n` +
              `Choose what to do:`,
            {
              reply_markup: {
                keyboard: [
                  [
                    {
                      text: `🔄 Convert to ${data.convertedAmount.toFixed(2)} ${
                        data.currency
                      }`,
                    },
                  ],
                  [
                    {
                      text: `💱 Change to ${data.inputAmount} ${data.inputCurrency}`,
                    },
                  ],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
        }
        break

      case "DEBT_EDIT_SELECT": {
        const userData = await db.getUserData(userId)
        const debts = userData.debts.filter((d: Debt) => !d.isPaid)
        const keyboard = [[{ text: "➕ Add Debt" }]]
        const debtsButtons = debts.map((d: Debt) => {
          const prefix = d.type === "I_OWE" ? "💸 Pay to" : "💰 Receive from"
          return [{ text: `${prefix}: ${d.name}` }]
        })
        keyboard.push(...debtsButtons, [
          { text: "🔙 Back" },
          { text: "🏠 Main Menu" },
        ])

        await this.bot.sendMessage(chatId, "Select debt to edit:", {
          reply_markup: { keyboard, resize_keyboard: true },
        })
        break
      }

      case "DEBT_EDIT_AMOUNT": {
        const debt = data.debt
        await this.bot.sendMessage(
          chatId,
          `💰 Current: ${debt.amount} ${debt.currency}\nPaid: ${debt.paidAmount} ${debt.currency}\n\n✏️ Enter new total amount:`,
          this.getBackButton()
        )
        break
      }

      case "GOAL_EDIT_SELECT": {
        const userData = await db.getUserData(userId)
        const goals = userData.goals.filter((g: Goal) => g.status === "ACTIVE")
        const keyboard = [[{ text: "➕ Add Goal" }]]
        const goalsButtons = goals.map((g: Goal) => [
          { text: `Goal: ${g.name}` },
        ])
        keyboard.push(
          ...goalsButtons,
          [{ text: "✅ Completed Goals" }],
          [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]
        )
        await this.bot.sendMessage(chatId, "Select goal to edit:", {
          reply_markup: { keyboard, resize_keyboard: true },
        })
        break
      }

      case "GOAL_EDIT_TARGET": {
        const goal = data.goal
        await this.bot.sendMessage(
          chatId,
          `🎯 Current target: ${goal.targetAmount} ${goal.currency}\n\n✏️ Enter new target amount:`,
          this.getBackButton()
        )
        break
      }

      default:
        // Если шаг неизвестен, возвращаем в главное меню
        this.clearState(userId)
        await showMainMenu(this.bot, chatId)
    }
  }

  private async askForAccount(
    chatId: number,
    text: string,
    currency: string,
    excludeAccount?: string
  ) {
    // Show accounts with matching currency in ReplyKeyboard
    // Note: If exact currency match not found, maybe show all or just USD?
    // For now, let's show all balances to allow cross-currency (conversion happens in storage)
    // But user asked for simple flow. Let's just show all accounts.

    const balances = await db.getBalancesList(chatId.toString())
    const rows = []
    for (const b of balances) {
      // Исключаем аккаунт если указан (excludeAccount)
      if (excludeAccount && b.accountId === excludeAccount) {
        continue
      }
      rows.push([
        { text: `${b.accountId} (${b.amount.toFixed(2)} ${b.currency})` },
      ])
    }

    // Add "New Account" option if list is empty? Or just let them type.
    // If they type a new name, handleTxAccount handles it.

    rows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

    await this.bot.sendMessage(chatId, text, {
      reply_markup: {
        keyboard: rows,
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    })
  }
}
