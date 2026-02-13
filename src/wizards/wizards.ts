import { randomUUID } from "node:crypto"
import type TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "../database/storage-db"
import * as handlers from "../handlers"
import {
  getCategoryLabel,
  getExpenseCategoryByLabel,
  getExpenseCategoryLabel,
  getIncomeCategoryLabel,
  type Language,
  resolveLanguage,
  t,
} from "../i18n"
import { getStatsKeyboard } from "../i18n/keyboards"
import {
  showAdvancedMenu,
  showAnalyticsReportsMenu,
  showAutomationMenu,
  showBalancesMenu,
  showBudgetMenu,
  showDebtsMenu,
  showGoalsMenu,
  showHistoryMenu,
  showIncomeSourcesMenu,
  showMainMenu,
  showNetWorthMenu,
  showSettingsMenu,
  showStatsMenu,
} from "../menus-i18n"
import {
  createProgressBar,
  formatTopExpenses,
  formatTrends,
  generateAnalyticsReport,
  generateCSV,
  getProgressEmoji,
} from "../reports"
import { reminderManager } from "../services/reminder-manager"
import {
  type Currency,
  type Debt,
  ExpenseCategory,
  type Goal,
  IncomeCategory,
  type IncomeSource,
  type Transaction,
  type TransactionCategory,
  TransactionType,
} from "../types"
import {
  createListButtons,
  escapeMarkdown,
  formatAmount,
  formatDateDisplay,
  formatMoney,
} from "../utils"
import * as validators from "../validators"
import * as helpers from "./helpers"

export type WizardData = Record<string, any>

export interface WizardState {
  step: string
  data?: WizardData
  txType?: TransactionType
  history?: string[]
  returnTo?: string
  lang: Language
}

export class WizardManager {
  private userStates: Record<string, WizardState> = {}

  private toTitleCase(s: string) {
    const t = s.trim()
    if (!t) return t
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  constructor(private bot: TelegramBot) {}

  private async resolveUserLang(userId: string): Promise<Language> {
    try {
      const lang = await db.getUserLanguage(userId)
      return resolveLanguage(lang)
    } catch {
      return "en"
    }
  }

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

  getBackButton(lang: Language = "en") {
    return {
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
    let state = this.getState(userId)

    // ✅ Save returnTo from current state BEFORE any modifications
    const savedReturnTo = state?.returnTo

    // ✅ If no state exists, create a new one
    if (!state) {
      const lang = await this.resolveUserLang(userId)
      state = {
        step: nextStep,
        data: data || {},
        history: [],
        lang,
      }
      this.setState(userId, state)
      return
    }

    if (state.step !== nextStep) {
      if (!state.history) {
        state.history = []
      }
      state.history.push(state.step)
    }

    state.step = nextStep

    if (state?.data && state.history && state.history.length > 0) {
      const prevStep = state.history[state.history.length - 1]
      if (!prevStep) return
      const oldFlow = prevStep.split("_")[0]
      const newFlow = nextStep.split("_")[0]

      if (oldFlow !== newFlow) {
        delete state?.data?.accountsShown
        delete state?.data?.topCategoriesShown
      }
    }

    if (data) {
      state.data = { ...state.data, ...data }
    }

    // ✅ Restore returnTo if it was lost during step transition
    if (savedReturnTo && !state.returnTo) {
      state.returnTo = savedReturnTo
    }

    this.setState(userId, state)
  }

  clearState(userId: string) {
    delete this.userStates[userId]
  }

  async returnToContext(chatId: number, userId: string, returnTo?: string) {
    const state = this.getState(userId)
    const stateLang = state?.lang || (await this.resolveUserLang(userId))
    if (state && state.lang !== stateLang) {
      state.lang = stateLang
      this.setState(userId, state)
    }
    switch (returnTo) {
      case "debts":
        await showDebtsMenu(this.bot, chatId, userId, stateLang)
        break
      case "goals":
        await showGoalsMenu(this.bot, chatId, userId, stateLang)
        break
      case "balances":
        await showBalancesMenu(this, chatId, userId, stateLang)
        break
      case "income":
        await showIncomeSourcesMenu(this.bot, chatId, userId, stateLang)
        break
      case "settings":
        await showSettingsMenu(this.bot, chatId, userId, stateLang)
        break
      case "history":
        await showHistoryMenu(this, chatId, userId, stateLang)
        break
      case "analytics":
        await showStatsMenu(this.bot, chatId, stateLang)
        break
      case "budgets":
        await showBudgetMenu(this, chatId, userId, stateLang)
        break
      case "reports":
        await showAnalyticsReportsMenu(this, chatId, userId, stateLang)
        break
      case "automation":
        await showAutomationMenu(this, chatId, userId, stateLang)
        break
      case "advanced":
        await showAdvancedMenu(this, chatId, userId, stateLang)
        break
      case "recurring":
        await handlers.handleRecurringMenu(this, chatId, userId, stateLang)
        break
      default:
        await showMainMenu(this.bot, chatId, stateLang)
    }
  }

  async handleWizardInput(
    chatId: number,
    userId: string,
    text: string
  ): Promise<boolean> {
    const state = this.getState(userId)
    const lang = resolveLanguage(
      state?.lang || (await this.resolveUserLang(userId))
    )
    if (text.startsWith("/")) {
      this.clearState(userId)
      if (/^\/(start|expense|income)(?:@\w+)?$/i.test(text)) {
        return false
      }
      return true
    }
    if (state && state.lang !== lang) {
      state.lang = lang
      this.setState(userId, state)
    }

    if (text === t(lang, "mainMenu.mainMenuButton")) {
      this.clearState(userId)
      await showMainMenu(this.bot, chatId, lang)

      return true
    }

    if (
      text === t(lang, "buttons.balances") ||
      text === t(lang, "buttons.goToBalances")
    ) {
      this.clearState(userId)
      await showBalancesMenu(this, chatId, userId, lang)

      return true
    }

    if (text === t(lang, "buttons.changeAmount")) {
      if (!state) {
        await showMainMenu(this.bot, chatId, lang)
        return true
      }

      await this.goToStep(userId, "TX_AMOUNT", state?.data)
      await helpers.resendCurrentStepPrompt(
        this,
        chatId,
        userId,
        this.getState(userId)!
      )
      return true
    }

    if (text === t(lang, "common.back")) {
      if (!state) {
        await showMainMenu(this.bot, chatId, lang)

        return true
      }

      // ✅ Special handling for DEBT_MENU and GOAL_MENU - return to their lists
      if (
        state.step === "DEBT_MENU" ||
        state.step === "GOAL_MENU" ||
        state.step === "RECURRING_MENU"
      ) {
        this.clearState(userId)
        await this.returnToContext(chatId, userId, state.returnTo)
        return true
      }

      if (!state.history || state.history.length === 0) {
        this.clearState(userId)

        await this.returnToContext(chatId, userId, state.returnTo)
        return true
      }

      if (state.step === "TX_CATEGORY" && state?.data?.showedAllCategories) {
        delete state?.data?.topCategoriesShown
        delete state?.data?.showedAllCategories
        this.setState(userId, state)
        await helpers.resendCurrentStepPrompt(this, chatId, userId, state)
        return true
      }

      const prevStep = state.history.pop()
      if (!prevStep) {
        this.clearState(userId)
        await this.returnToContext(chatId, userId, state.returnTo)
        return true
      }
      state.step = prevStep

      if (state.step === "TX_ACCOUNT" && state?.data?.accountsShown) {
        delete state?.data?.accountsShown
      }
      if (state.step === "TX_TO_ACCOUNT" && state?.data?.toAccountsShown) {
        delete state?.data?.toAccountsShown
      }

      this.setState(userId, state)
      await helpers.resendCurrentStepPrompt(this, chatId, userId, state)
      return true
    }

    if (!state) {
      return false
    }

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
          if (text === t(lang, "transactions.yesRefund")) {
            if (!state?.data) return false
            await this.goToStep(userId, "TX_ACCOUNT", {
              category: IncomeCategory.REFUND,
              amount: state?.data?.amount,
              currency: state?.data?.currency,
              isRefund: true,
            })
            await handlers.handleTxToAccount(
              this,
              chatId,
              userId,
              t(lang, "wizard.tx.selectRefundAccount")
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
              `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
            )
          })

          if (text === t(lang, "transactions.historyFilters")) {
            await this.goToStep(userId, "TX_VIEW_PERIOD")
            this.bot.sendMessage(
              chatId,
              `${t(lang, "transactions.historyTitle")}\n\n${t(
                lang,
                "wizard.tx.selectPeriod"
              )}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [
                      { text: t(lang, "buttons.last7Days") },
                      { text: t(lang, "buttons.last30Days") },
                    ],
                    [
                      { text: t(lang, "buttons.expensesOnly") },
                      { text: t(lang, "buttons.incomeOnly") },
                    ],
                    [
                      { text: t(lang, "buttons.customPeriod") },
                      { text: t(lang, "buttons.allTransactions") },
                    ],
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

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.selectTransactionFromList"),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "TX_EDIT_MENU", { transaction: selected })

          const account =
            selected.fromAccountId ||
            selected.toAccountId ||
            t(lang, "common.notAvailable")
          await this.bot.sendMessage(
            chatId,
            `${t(lang, "wizard.tx.detailsTitle")}\n\n` +
              `${t(lang, "wizard.tx.detailsType", {
                type:
                  selected.type === "EXPENSE"
                    ? t(lang, "transactions.expenseTitle")
                    : selected.type === "INCOME"
                      ? t(lang, "transactions.incomeTitle")
                      : t(lang, "transactions.transferTitle"),
              })}\n` +
              `${t(lang, "wizard.tx.detailsCategory", {
                category: selected.category,
              })}\n` +
              `${t(lang, "wizard.tx.detailsAmount", {
                amount: `${selected.amount} ${selected.currency}`,
              })}\n` +
              `${t(lang, "wizard.tx.detailsAccount", {
                account: escapeMarkdown(account),
              })}\n` +
              `${t(lang, "wizard.tx.detailsDate", {
                date: formatDateDisplay(new Date(selected.date)),
              })}\n\n` +
              `${t(lang, "wizard.tx.detailsPrompt")}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "buttons.editAmount") }],
                  [{ text: t(lang, "buttons.editCategory") }],
                  [{ text: t(lang, "buttons.editAccount") }],
                  [{ text: t(lang, "wizard.tx.deleteTransactionButton") }],
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
        case "TX_VIEW_PERIOD": {
          const allTransactions = await db.getAllTransactions(userId)
          let filtered = allTransactions

          if (text === t(lang, "buttons.last7Days")) {
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            filtered = filtered.filter((tx) => new Date(tx.date) >= weekAgo)
          } else if (text === t(lang, "buttons.last30Days")) {
            const monthAgo = new Date()
            monthAgo.setDate(monthAgo.getDate() - 30)
            filtered = filtered.filter((tx) => new Date(tx.date) >= monthAgo)
          } else if (text === t(lang, "buttons.expensesOnly")) {
            filtered = filtered.filter(
              (tx) => tx.type === TransactionType.EXPENSE
            )
          } else if (text === t(lang, "buttons.incomeOnly")) {
            filtered = filtered.filter(
              (tx) => tx.type === TransactionType.INCOME
            )
          } else if (text === t(lang, "buttons.customPeriod")) {
            await this.goToStep(userId, "CUSTOM_PERIOD_SINGLE")
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.customPeriodPrompt"),
              { parse_mode: "Markdown", ...this.getBackButton(lang) }
            )
            return true
          }

          if (filtered.length === 0) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.noTransactionsForFilter"),
              this.getBackButton(lang)
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
            return `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
          })

          const keyboard = createListButtons({
            items,
            lang,
            afterItemsButtons:
              filtered.length > 10 ? [t(lang, "buttons.viewMore")] : undefined,
          })

          let msg = `${t(lang, "transactions.historyTitle")} (${text})\n\n`
          msg += `${t(lang, "transactions.showing", {
            count: toShow.length,
            total: filtered.length,
          })}\n\n`
          msg += t(lang, "wizard.tx.selectTransactionToEdit")

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
              t(lang, "wizard.tx.customPeriodWrongFormat"),
              { parse_mode: "Markdown", ...this.getBackButton(lang) }
            )
            return true
          }

          const [, sd, sm, sy, ed, em, ey] = match
          if (!sd || !sm || !sy || !ed || !em || !ey) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.customPeriodInvalid"),
              this.getBackButton(lang)
            )
            return true
          }
          const startDateStr = `${sy}-${sm?.padStart(2, "0")}-${sd?.padStart(2, "0")}`
          const endDateStr = `${ey}-${em?.padStart(2, "0")}-${ed?.padStart(2, "0")}`

          const startDate = new Date(startDateStr)
          const endDate = new Date(endDateStr)

          if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
          ) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.customPeriodWrongDates"),
              this.getBackButton(lang)
            )
            return true
          }

          if (endDate < startDate) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.customPeriodEndBeforeStart"),
              this.getBackButton(lang)
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
              t(lang, "wizard.tx.customPeriodNoTransactions", { period: text }),
              this.getBackButton(lang)
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
            return `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))}\n${formatMoney(tx.amount, tx.currency)}`
          })

          await this.bot.sendMessage(
            chatId,
            `${t(lang, "wizard.tx.customPeriodTitle", { period: text })}\n\n` +
              `${t(lang, "wizard.tx.foundTransactions", {
                count: filtered.length,
              })}\n\n` +
              `${t(lang, "wizard.tx.selectTransactionToEdit")}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: createListButtons({
                  items,
                  lang,
                  afterItemsButtons:
                    filtered.length > 10 ? [t(lang, "buttons.viewMore")] : [],
                }),
                resize_keyboard: true,
              },
            }
          )

          return true
        }
        case "TX_VIEW_LIST": {
          if (!state?.data) return false
          const { transactions, offset, period } = state.data

          if (text === t(lang, "buttons.viewMore")) {
            const nextOffset = offset + 10
            const nextBatch = transactions.slice(nextOffset, nextOffset + 10)

            if (nextBatch.length === 0) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.tx.noMoreTransactions"),
                this.getBackButton(lang)
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
                tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
              return `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
            })

            await this.bot.sendMessage(
              chatId,
              `${t(lang, "wizard.tx.nextBatchTitle", { period })}\n\n${t(
                lang,
                "wizard.tx.showingRange",
                {
                  start: nextOffset + 1,
                  end: nextOffset + toShow.length,
                  total: transactions.length,
                }
              )}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: createListButtons({
                    items,
                    lang,
                    afterItemsButtons:
                      nextOffset + 10 < transactions.length
                        ? [
                            t(lang, "buttons.previousPage"),
                            t(lang, "buttons.viewMore"),
                          ]
                        : [t(lang, "buttons.previousPage")],
                  }),
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          if (text === t(lang, "buttons.previousPage")) {
            const prevOffset = Math.max(0, offset - 10)

            await this.goToStep(userId, "TX_VIEW_LIST", {
              transactions,
              period,
              offset: prevOffset,
            })

            const toShow = transactions.slice(prevOffset, prevOffset + 10)
            const items = toShow.map((tx: Transaction) => {
              const emoji =
                tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
              return `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
            })

            const afterButtons = []
            if (prevOffset > 0) {
              afterButtons.push(t(lang, "buttons.previousPage"))
            }
            if (prevOffset + 10 < transactions.length) {
              afterButtons.push(t(lang, "buttons.viewMore"))
            }

            await this.bot.sendMessage(
              chatId,
              `${t(lang, "wizard.tx.previousBatchTitle", {
                period,
              })}\n\n${t(lang, "wizard.tx.showingRange", {
                start: prevOffset + 1,
                end: prevOffset + toShow.length,
                total: transactions.length,
              })}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: createListButtons({
                    items,
                    lang,
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
              `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
            )
          })

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.selectTransactionFromList"),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "TX_EDIT_MENU", { transaction: selected })

          const account =
            selected.fromAccountId ||
            selected.toAccountId ||
            t(lang, "common.notAvailable")
          await this.bot.sendMessage(
            chatId,
            `${t(lang, "wizard.tx.detailsTitle")}\n\n` +
              `${t(lang, "wizard.tx.detailsType", {
                type:
                  selected.type === "EXPENSE"
                    ? t(lang, "transactions.expenseTitle")
                    : selected.type === "INCOME"
                      ? t(lang, "transactions.incomeTitle")
                      : t(lang, "transactions.transferTitle"),
              })}\n` +
              `${t(lang, "wizard.tx.detailsCategory", {
                category: selected.category,
              })}\n` +
              `${t(lang, "wizard.tx.detailsAmount", {
                amount: `${selected.amount} ${selected.currency}`,
              })}\n` +
              `${t(lang, "wizard.tx.detailsAccount", {
                account: escapeMarkdown(account),
              })}\n` +
              `${t(lang, "wizard.tx.detailsDate", {
                date: formatDateDisplay(new Date(selected.date)),
              })}\n\n` +
              `${t(lang, "wizard.tx.detailsPrompt")}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "buttons.editAmount") }],
                  [{ text: t(lang, "buttons.editCategory") }],
                  [{ text: t(lang, "buttons.editAccount") }],
                  [{ text: t(lang, "wizard.tx.deleteTransactionButton") }],
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
        case "TX_EDIT_MENU": {
          const tx = state?.data?.transaction
          if (!tx) return true

          if (text === t(lang, "buttons.editAmount")) {
            await this.goToStep(userId, "TX_EDIT_AMOUNT", { transaction: tx })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              `${t(lang, "wizard.tx.editAmountTitle")}\n\n${t(
                lang,
                "wizard.tx.currentAmount",
                { amount: formatMoney(tx.amount, tx.currency) }
              )}\n\n${t(lang, "wizard.tx.enterNewAmount", {
                currency: defaultCurrency,
              })}`,
              this.getBackButton(lang)
            )
          } else if (text === t(lang, "buttons.editCategory")) {
            await this.goToStep(userId, "TX_EDIT_CATEGORY", { transaction: tx })

            if (tx.type === TransactionType.EXPENSE) {
              const categories = Object.values(ExpenseCategory)
              const items = categories.map((c) =>
                getExpenseCategoryLabel(lang, c, "short")
              )
              const keyboard = createListButtons({ items, lang })

              await this.bot.sendMessage(
                chatId,
                `${t(lang, "wizard.tx.editCategoryExpenseTitle")}\n\n${t(
                  lang,
                  "wizard.tx.currentCategory",
                  { category: getExpenseCategoryLabel(lang, tx.category) }
                )}\n\n${t(lang, "wizard.tx.selectNewCategory")}`,
                {
                  parse_mode: "Markdown",
                  reply_markup: { keyboard, resize_keyboard: true },
                }
              )
            } else if (tx.type === TransactionType.INCOME) {
              const categories = Object.values(IncomeCategory)
              const items = categories.map((c) =>
                getIncomeCategoryLabel(lang, c, "short")
              )
              const keyboard = createListButtons({ items, lang })

              await this.bot.sendMessage(
                chatId,
                `${t(lang, "wizard.tx.editCategoryIncomeTitle")}\n\n${t(
                  lang,
                  "wizard.tx.currentCategory",
                  { category: getIncomeCategoryLabel(lang, tx.category) }
                )}\n\n${t(lang, "wizard.tx.selectNewCategory")}`,
                {
                  parse_mode: "Markdown",
                  reply_markup: { keyboard, resize_keyboard: true },
                }
              )
            }
          } else if (text === t(lang, "buttons.editAccount")) {
            await this.goToStep(userId, "TX_EDIT_ACCOUNT", { transaction: tx })
            const account =
              tx.fromAccountId ||
              tx.toAccountId ||
              t(lang, "common.notAvailable")
            await handlers.handleTxAccount(
              this,
              chatId,
              userId,
              `${t(lang, "wizard.tx.editAccountTitle")}\n\n${t(
                lang,
                "wizard.tx.currentAccount",
                { account }
              )}\n\n${t(lang, "wizard.tx.selectNewAccount")}`
            )
          } else if (text === t(lang, "wizard.tx.deleteTransactionButton")) {
            const success = await db.deleteTransaction(userId, tx.id)

            if (success) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.tx.transactionDeleted")
              )
            } else {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.tx.deleteError")
              )
              await showHistoryMenu(this, chatId, userId, lang)
              return true
            }

            const recentTxs = await db.getRecentTransactions(userId, 5)

            if (recentTxs.length === 0) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.tx.noMoreToEdit"),
                {
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
              await showHistoryMenu(this, chatId, userId, lang)
              return true
            }

            const items = recentTxs.map((tx) => {
              const emoji =
                tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
              return `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
            })

            const keyboard = createListButtons({ items, lang })

            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.editTransactionsTitle"),
              {
                parse_mode: "Markdown",
                reply_markup: { keyboard: keyboard, resize_keyboard: true },
              }
            )
          }

          return true
        }
        case "TX_EDIT_AMOUNT": {
          const tx = state?.data?.transaction
          if (!tx) return true

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.invalidAmount", { currency: defaultCurrency }),
              this.getBackButton(lang)
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
              t(lang, "wizard.tx.amountUpdated", {
                amount: parsed.amount,
                currency: parsed.currency,
              })
            )
          } else {
            await this.bot.sendMessage(chatId, t(lang, "wizard.tx.updateError"))
          }

          await showHistoryMenu(this, chatId, userId, lang)
          return true
        }
        case "TX_EDIT_CATEGORY": {
          const tx = state?.data?.transaction
          if (!tx) return true

          let isValid = false
          if (tx.type === TransactionType.EXPENSE) {
            isValid = !!validators.validateExpenseCategory(text)
          } else if (tx.type === TransactionType.INCOME) {
            isValid = !!validators.validateIncomeCategory(text)
          }

          if (!isValid) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.invalidCategory"),
              this.getBackButton(lang)
            )
            return true
          }

          // Обновляем категорию
          const normalizedCategory =
            tx.type === TransactionType.EXPENSE
              ? validators.validateExpenseCategory(text)
              : validators.validateIncomeCategory(text)
          const success = await db.updateTransaction(userId, tx.id, {
            category: (normalizedCategory || text) as TransactionCategory,
          })

          if (success) {
            const categoryLabel = getCategoryLabel(
              lang,
              normalizedCategory || text
            )
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.categoryUpdated", {
                category: categoryLabel,
              })
            )
          } else {
            await this.bot.sendMessage(chatId, t(lang, "wizard.tx.updateError"))
          }

          await showHistoryMenu(this, chatId, userId, lang)
          return true
        }
        case "TX_EDIT_ACCOUNT": {
          const tx = state?.data?.transaction
          if (!tx) return true

          const match = text.match(/^(.+?)\s+\([\d.]+\s+[A-Z]{3}\)$/)
          let newAccountId: string

          if (match) {
            newAccountId = match[1]?.trim() || text.trim()
          } else {
            newAccountId = text.trim()
          }

          if (!newAccountId) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.tx.invalidAccount"),
              this.getBackButton(lang)
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
              t(lang, "wizard.tx.accountUpdated", {
                account: escapeMarkdown(newAccountId),
              })
            )
          } else {
            await this.bot.sendMessage(chatId, t(lang, "wizard.tx.updateError"))
          }

          await showHistoryMenu(this, chatId, userId, lang)
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
          const type = text === t(lang, "buttons.iOwe") ? "I_OWE" : "OWES_ME"

          await this.goToStep(userId, "DEBT_CREATE_DETAILS", { type })

          const emoji = type === "I_OWE" ? "🔴" : "🟢"
          const action =
            type === "I_OWE"
              ? t(lang, "wizard.debt.actionOweTo")
              : t(lang, "wizard.debt.actionLentTo")
          const defaultCurrency = await db.getDefaultCurrency(userId)

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.debt.createDetails", {
              emoji,
              action,
              currency: defaultCurrency,
            }),
            {
              parse_mode: "Markdown",
              ...this.getBackButton(lang),
            }
          )
          return true
        }
        case "DEBT_EDIT_SELECT": {
          if (text === t(lang, "buttons.addDebt")) {
            await this.goToStep(userId, "DEBT_TYPE", {})
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.selectType"),
              {
                reply_markup: {
                  keyboard: [
                    [
                      { text: t(lang, "buttons.iOwe") },
                      { text: t(lang, "buttons.theyOweMe") },
                    ],
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

          const userData = await db.getUserData(userId)
          const debts = userData.debts.filter((d: Debt) => !d.isPaid)

          const selected = debts.find((d: Debt) => {
            return text === `${d?.name}`
          })

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.selectFromListError"),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "DEBT_MENU", { debt: selected })

          const {
            amount,
            paidAmount,
            type,
            dueDate,
            name,
            currency,
            autoPayment,
          } = selected
          let msg = ""
          const remaining = amount - paidAmount
          const progress = createProgressBar(paidAmount, amount)
          const emoji =
            type === "I_OWE"
              ? t(lang, "wizard.debt.payTo")
              : t(lang, "wizard.debt.getPaidFrom")
          const action =
            type === "I_OWE"
              ? t(lang, "wizard.debt.actionPay")
              : t(lang, "wizard.debt.actionReceive")

          msg += `${emoji} *${escapeMarkdown(name)}*\n`
          msg += `${progress}\n`

          if (paidAmount === 0) {
            msg += `${t(lang, "wizard.debt.totalLine", {
              amount: formatMoney(amount, currency),
            })}\n`
          } else if (remaining > 0) {
            msg += `${t(lang, "wizard.debt.remainingLine", {
              amount: formatMoney(remaining, currency),
            })}\n`
          } else {
            msg += `${t(lang, "wizard.debt.paidLabel")}\n`
          }

          if (dueDate) {
            const deadlineDate = new Date(dueDate)
            msg += `${t(lang, "wizard.debt.dueLine", {
              date: formatDateDisplay(deadlineDate),
            })}\n`
          }

          msg += `\n${t(lang, "wizard.debt.enterAmountTo", { action })}`

          const deadlineButtons = dueDate
            ? [
                [{ text: t(lang, "buttons.changeDeadline") }],
                [{ text: t(lang, "buttons.disableReminders") }],
                [
                  {
                    text: autoPayment?.enabled
                      ? t(lang, "wizard.debt.disableAutoPayment")
                      : t(lang, "wizard.debt.enableAutoPayment"),
                  },
                ],
              ]
            : [[{ text: t(lang, "buttons.setDeadline") }]]

          await this.bot.sendMessage(chatId, msg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "buttons.editAmount") }],
                ...deadlineButtons,
                [{ text: t(lang, "wizard.debt.deleteDebtButton") }],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ].filter((row) => row.length > 0),
              resize_keyboard: true,
            },
          })
          return true
        }
        case "DEBT_EDIT_AMOUNT": {
          const debt = state?.data?.debt
          if (!debt) {
            await this.bot.sendMessage(chatId, t(lang, "wizard.debt.notFound"))
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId, lang)
            return true
          }

          if (
            text === t(lang, "wizard.debt.enableAutoPayment") ||
            text === t(lang, "wizard.debt.disableAutoPayment")
          ) {
            return await handlers.handleAutoPaymentToggle(
              this,
              chatId,
              userId,
              text
            )
          }

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (!parsed || parsed.amount <= 0) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.invalidAmount", {
                currency: defaultCurrency,
              }),
              this.getBackButton(lang)
            )
            return true
          }

          if (parsed.amount < debt.paidAmount) {
            const remaining = debt.amount - debt.paidAmount
            if (remaining < 0) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.debt.fullySettledMessage", {
                  status:
                    debt.type === "I_OWE"
                      ? t(lang, "wizard.debt.fullyPaidLabel")
                      : t(lang, "wizard.debt.fullyReceivedLabel"),
                  total: formatMoney(debt.amount, debt.currency),
                  paid: formatMoney(debt.paidAmount, debt.currency),
                }),
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    keyboard: [
                      [{ text: t(lang, "buttons.editAmount") }],
                      [{ text: t(lang, "wizard.debt.deleteDebtButton") }],
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

            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.amountLessThanPaid", {
                amount: formatMoney(parsed.amount, debt.currency),
                paid: formatMoney(debt.paidAmount, debt.currency),
              }),
              this.getBackButton(lang)
            )
            return true
          }

          await db.updateDebtTotalAmount(
            userId,
            debt.id,
            parsed.amount,
            parsed.currency
          )

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.debt.amountUpdated")
          )

          const userData = await db.getUserData(userId)
          const updatedDebt = userData.debts.find((d: Debt) => d.id === debt.id)

          if (!updatedDebt) {
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId, lang)
            return true
          }

          await this.goToStep(userId, "DEBT_MENU", {
            debt: updatedDebt,
            debtId: debt.id,
          })

          const {
            amount,
            paidAmount,
            type,
            dueDate,
            name,
            currency,
            autoPayment,
          } = debt
          let msg = ""
          const remaining = amount - paidAmount
          const progress = createProgressBar(paidAmount, amount)
          const emoji =
            type === "I_OWE"
              ? t(lang, "wizard.debt.payTo")
              : t(lang, "wizard.debt.getPaidFrom")
          const action =
            type === "I_OWE"
              ? t(lang, "wizard.debt.actionPay")
              : t(lang, "wizard.debt.actionReceive")

          msg += `${emoji} *${escapeMarkdown(name)}*\n`
          msg += `${progress}\n`

          if (paidAmount === 0) {
            msg += `${t(lang, "wizard.debt.totalLine", {
              amount: formatMoney(amount, currency),
            })}\n`
          } else if (remaining > 0) {
            msg += `${t(lang, "wizard.debt.remainingLine", {
              amount: formatMoney(remaining, currency),
            })}\n`
          } else {
            msg += `${t(lang, "wizard.debt.paidLabel")}\n`
          }

          if (dueDate) {
            const deadlineDate = new Date(dueDate)
            msg += `${t(lang, "wizard.debt.dueLine", {
              date: formatDateDisplay(deadlineDate),
            })}\n`
          }

          msg += `\n${t(lang, "wizard.debt.enterAmountTo", { action })}`

          await this.bot.sendMessage(chatId, msg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "buttons.editAmount") }],
                [
                  {
                    text: dueDate
                      ? t(lang, "buttons.changeDeadline")
                      : t(lang, "buttons.setDeadline"),
                  },
                ],
                dueDate ? [{ text: t(lang, "buttons.disableReminders") }] : [],
                type === "I_OWE"
                  ? [
                      {
                        text: autoPayment?.enabled
                          ? t(lang, "wizard.debt.disableAutoPayment")
                          : t(lang, "wizard.debt.enableAutoPayment"),
                      },
                    ]
                  : [],
                [{ text: t(lang, "wizard.debt.deleteDebtButton") }],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ].filter((row) => row.length > 0),
              resize_keyboard: true,
            },
          })
          return true
        }
        case "DEBT_ADVANCED_MENU":
          return await handlers.handleDebtAdvancedMenu(
            this,
            chatId,
            userId,
            text
          )

        case "DEBT_MENU": {
          const debt = state?.data?.debt

          if (!debt) {
            return true
          }

          if (
            text === t(lang, "wizard.debt.enableAutoPayment") ||
            text === t(lang, "wizard.debt.disableAutoPayment")
          ) {
            return await handlers.handleAutoPaymentToggle(
              this,
              chatId,
              userId,
              text
            )
          }

          if (
            text === t(lang, "buttons.setDeadline") ||
            text === t(lang, "buttons.changeDeadline")
          ) {
            await this.goToStep(userId, "DEBT_EDIT_DUE_DATE", { debt })
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.dueDatePrompt", {
                mode:
                  text === t(lang, "buttons.setDeadline")
                    ? t(lang, "wizard.debt.dueDateSetTitle")
                    : t(lang, "wizard.debt.dueDateChangeTitle"),
              }),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    text === t(lang, "buttons.changeDeadline")
                      ? [{ text: t(lang, "buttons.removeDate") }]
                      : [],
                    [{ text: t(lang, "wizard.common.skip") }],
                    [
                      { text: t(lang, "common.back") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ].filter((row) => row.length > 0),
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          if (text === t(lang, "buttons.disableReminders")) {
            await db.updateDebtDueDate(userId, debt.id, null)
            await reminderManager.deleteRemindersForEntity(userId, debt.id)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.remindersRemoved")
            )
            await showDebtsMenu(this.bot, chatId, userId, lang)
            this.clearState(userId)
            return true
          }

          if (text === t(lang, "buttons.advanced")) {
            return await handlers.handleDebtAdvancedMenu(
              this,
              chatId,
              userId,
              text
            )
          }

          if (text === t(lang, "buttons.editAmount")) {
            await this.goToStep(userId, "DEBT_EDIT_AMOUNT", { debt })
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.editTotalPrompt", {
                current: formatMoney(debt.amount, debt.currency),
                paid: formatMoney(debt.paidAmount, debt.currency),
                currency: defaultCurrency,
              }),
              {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              }
            )
            return true
          }

          // Delete Debt
          if (text === t(lang, "wizard.debt.deleteDebtButton")) {
            await db.deleteDebt(userId, debt.id)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.deletedMessage", {
                name: escapeMarkdown(debt.name),
              })
            )
            this.clearState(userId)
            await showDebtsMenu(this.bot, chatId, userId, lang)
            return true
          }

          const defaultCurrency = await db.getDefaultCurrency(userId)
          const parsed = validators.parseAmountWithCurrency(
            text,
            defaultCurrency
          )

          if (parsed && parsed.amount > 0) {
            const remaining = debt.amount - debt.paidAmount

            if (parsed.amount > remaining) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.debt.amountExceedsRemaining", {
                  amount: formatMoney(parsed.amount, debt.currency),
                  remaining: formatMoney(remaining, debt.currency),
                }),
                this.getBackButton(lang)
              )
              return true
            }

            await this.goToStep(userId, "DEBT_PARTIAL_AMOUNT", {
              partialAmount: parsed.amount,
              partialCurrency: parsed.currency,
              debt,
            })

            await handlers.handleDebtPartialAmount(this, chatId, userId, text)
            return true
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
            (g: Goal) =>
              text ===
              t(lang, "wizard.goal.completedItem", {
                name: escapeMarkdown(g.name),
              })
          )

          if (!selected) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.selectFromListError"),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "GOAL_COMPLETED_DELETE", {
            goal: selected,
          })

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.goal.completedDeleteMessage", {
              name: escapeMarkdown(selected.name),
              target: `${selected.targetAmount} ${selected.currency}`,
              achieved: `${selected.currentAmount} ${selected.currency}`,
            }),
            {
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "wizard.goal.deleteGoalButton") }],
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
        case "GOAL_COMPLETED_DELETE": {
          if (text === t(lang, "wizard.goal.deleteGoalButton")) {
            const goal = state?.data?.goal
            if (goal) {
              await db.deleteGoal(userId, goal.id)
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.goal.completedDeleted", {
                  name: escapeMarkdown(goal.name),
                })
              )
            }
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId, lang)
            return true
          }
          return true
        }
        case "GOAL_ADVANCED_MENU":
          return await handlers.handleGoalAdvancedMenu(
            this,
            chatId,
            userId,
            text
          )

        case "GOAL_MENU": {
          const goal = state?.data?.goal
          if (!goal) return true

          // Auto-Deposit Toggle
          if (
            text === t(lang, "wizard.goal.enableAutoDeposit") ||
            text === t(lang, "wizard.goal.disableAutoDeposit")
          ) {
            return await handlers.handleAutoDepositToggle(
              this,
              chatId,
              userId,
              text
            )
          }

          // Set/Change Deadline
          if (
            text === t(lang, "buttons.setDeadline") ||
            text === t(lang, "buttons.changeDeadline")
          ) {
            await this.goToStep(userId, "GOAL_EDIT_DEADLINE", { goal })
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.deadlinePrompt", {
                mode:
                  text === t(lang, "buttons.setDeadline")
                    ? t(lang, "wizard.goal.deadlineSetTitle")
                    : t(lang, "wizard.goal.deadlineChangeTitle"),
              }),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    text === t(lang, "buttons.changeDeadline")
                      ? [{ text: t(lang, "buttons.removeDate") }]
                      : [],
                    [{ text: t(lang, "wizard.common.skip") }],
                    [
                      { text: t(lang, "common.back") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ].filter((row) => row.length > 0),
                  resize_keyboard: true,
                },
              }
            )
            return true
          }

          // Advanced Menu
          if (text === t(lang, "buttons.advanced")) {
            return await handlers.handleGoalAdvancedMenu(
              this,
              chatId,
              userId,
              text
            )
          }

          // Edit Target
          if (text === t(lang, "buttons.editTarget")) {
            await this.goToStep(userId, "GOAL_EDIT_AMOUNT", { goal })
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.editTargetPrompt", {
                current: formatMoney(goal.targetAmount, goal.currency),
              }),
              { parse_mode: "Markdown", ...this.getBackButton(lang) }
            )
            return true
          }

          // Delete Goal
          if (text === t(lang, "wizard.goal.deleteGoalButton")) {
            await db.deleteGoal(userId, goal.id)
            await this.bot.sendMessage(chatId, t(lang, "wizard.goal.deleted"))
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId, lang)
            return true
          }

          // Amount input - deposit
          const parsed = validators.parseAmountWithCurrency(text, goal.currency)

          if (parsed && parsed.amount > 0) {
            const remaining = goal.targetAmount - goal.currentAmount

            if (parsed.amount > remaining) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.goal.amountExceedsRemaining", {
                  amount: formatAmount(parsed.amount),
                  remaining: formatMoney(remaining, goal.currency),
                }),
                this.getBackButton(lang)
              )
              return true
            }

            const balanceCount = (await db.getBalancesList(userId)).length

            if (balanceCount === 0) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.goal.noBalances"),
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    keyboard: [
                      [{ text: t(lang, "buttons.goToBalances") }],
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

            await this.goToStep(userId, "GOAL_DEPOSIT_ACCOUNT", {
              payAmount: parsed.amount,
              goal,
              goalId: goal.id,
            })

            await handlers.handleTxAccount(
              this,
              chatId,
              userId,
              t(lang, "wizard.goal.selectDepositAccount")
            )
          }

          return true
        }

        case "GOAL_EDIT_AMOUNT": {
          const goal = state?.data?.goal
          if (!goal) {
            await this.bot.sendMessage(chatId, t(lang, "wizard.goal.notFound"))
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId, lang)
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
              t(lang, "wizard.goal.invalidAmount", {
                currency: defaultCurrency,
              }),
              this.getBackButton(lang)
            )
            return true
          }

          if (parsed.amount === goal.currentAmount) {
            await this.goToStep(userId, "GOAL_COMPLETE_CONFIRM", {
              goal,
              newTargetAmount: parsed.amount,
            })

            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.completeConfirmMessage", {
                amount: formatMoney(parsed.amount, parsed.currency),
              }),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "wizard.goal.confirmCompleteYes") }],
                    [{ text: t(lang, "wizard.goal.confirmCompleteNoAlt") }],
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

          if (parsed.amount < goal.currentAmount) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.targetLessThanProgress", {
                amount: formatMoney(parsed.amount, parsed.currency),
                progress: formatMoney(goal.currentAmount, goal.currency),
              }),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "buttons.tryAgainEdit") }],
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

          await db.updateGoalTargetAmount(userId, goal.id, parsed.amount)

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.goal.targetUpdated")
          )

          const userData = await db.getUserData(userId)
          const updatedGoal = userData.goals.find((g: Goal) => g.id === goal.id)

          if (!updatedGoal) {
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId, lang)
            return true
          }

          await this.goToStep(userId, "GOAL_MENU", {
            goal: updatedGoal,
            goalId: goal.id,
          })

          const {
            name,
            targetAmount,
            currentAmount,
            deadline,
            currency,
            autoDeposit,
          } = goal
          let msg = ""

          const remaining = targetAmount - currentAmount
          const progress = createProgressBar(currentAmount, targetAmount)
          const statusEmoji = getProgressEmoji(currentAmount, targetAmount)

          msg += `${statusEmoji} *${escapeMarkdown(name)}*\n`
          msg += `${progress}\n`

          if (currentAmount === 0) {
            msg += `${t(lang, "wizard.goal.targetLine", {
              amount: formatMoney(targetAmount, currency),
            })}\n`
          } else if (remaining > 0) {
            msg += `${t(lang, "wizard.goal.remainingLine", {
              amount: formatMoney(remaining, currency),
            })}\n`
          } else {
            msg += `${t(lang, "wizard.goal.achievedLine")}\n`
          }

          if (deadline) {
            const deadlineDate = new Date(deadline)
            msg += `${t(lang, "wizard.goal.deadlineLine", {
              date: formatDateDisplay(deadlineDate),
            })}\n`
          }

          msg += `\n${t(lang, "wizard.goal.enterDepositAmount")}`

          const deadlineButtons = deadline
            ? [
                [{ text: t(lang, "buttons.changeDeadline") }],
                [{ text: t(lang, "buttons.disableReminders") }],
                [
                  {
                    text: autoDeposit?.enabled
                      ? t(lang, "wizard.goal.disableAutoDeposit")
                      : t(lang, "wizard.goal.enableAutoDeposit"),
                  },
                ],
              ]
            : [[{ text: t(lang, "buttons.setDeadline") }]]

          await this.bot.sendMessage(chatId, msg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "buttons.editTarget") }],
                ...deadlineButtons,
                [{ text: t(lang, "wizard.goal.deleteGoalButton") }],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ].filter((row) => row.length > 0),
              resize_keyboard: true,
            },
          })
          return true
        }
        case "GOAL_COMPLETE_CONFIRM": {
          const goal = state?.data?.goal
          const newTargetAmount = state?.data?.newTargetAmount

          if (!goal || !newTargetAmount) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.dataNotFound")
            )
            this.clearState(userId)
            await showGoalsMenu(this.bot, chatId, userId, lang)
            return true
          }

          if (text === t(lang, "wizard.goal.confirmCompleteYes")) {
            await db.updateGoalTargetAmount(userId, goal.id, newTargetAmount)

            const balanceCount = (await db.getBalancesList(userId)).length
            if (balanceCount === 0) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.goal.noBalancesComplete"),
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    keyboard: [
                      [{ text: t(lang, "buttons.goToBalances") }],
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

            const updatedGoal = (await db.getUserData(userId)).goals.find(
              (g: Goal) => g.id === goal.id
            )

            if (!updatedGoal) {
              this.clearState(userId)
              await showGoalsMenu(this.bot, chatId, userId, lang)
              return true
            }

            const remaining =
              updatedGoal.targetAmount - updatedGoal.currentAmount

            if (remaining <= 0) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.goal.completedNow", {
                  name: updatedGoal.name,
                  amount: formatMoney(
                    updatedGoal.currentAmount,
                    updatedGoal.currency
                  ),
                }),
                {
                  parse_mode: "Markdown",
                }
              )
              this.clearState(userId)
              await showGoalsMenu(this.bot, chatId, userId, lang)
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
              t(lang, "wizard.goal.selectDepositRemainingAccount")
            )
            return true
          }

          if (text === t(lang, "wizard.goal.confirmCompleteNoAlt")) {
            await this.goToStep(userId, "GOAL_EDIT_AMOUNT", { goal })

            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.enterNewTargetPrompt", {
                name: escapeMarkdown(goal.name),
                target: formatMoney(goal.targetAmount, goal.currency),
                progress: formatMoney(goal.currentAmount, goal.currency),
              }),
              {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              }
            )
            return true
          }

          return false
        }

        // --- Balance Flow ---
        case "BALANCE_LIST": {
          if (text === t(lang, "buttons.addBalance")) {
            await this.goToStep(userId, "BALANCE_CREATE", {})
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.sendMessage(
              chatId,
              t(lang, "wizard.balance.addNewPrompt", {
                currency: defaultCurrency,
              }),
              {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              }
            )
            return true
          }

          return await handlers.handleBalanceSelection(
            this,
            chatId,
            userId,
            text
          )
        }

        case "BALANCE_CREATE":
          return await handlers.handleBalanceCreate(
            this,
            chatId,
            userId,
            text,
            lang
          )
        case "BALANCE_EDIT_MENU":
          return await handlers.handleBalanceEditMenu(
            this,
            chatId,
            userId,
            text
          )
        case "BALANCE_CONFIRM_AMOUNT":
          return await handlers.handleBalanceConfirmAmount(
            this,
            chatId,
            userId,
            text
          )
        case "BALANCE_CONFIRM_RENAME":
          return await handlers.handleBalanceConfirmRename(
            this,
            chatId,
            userId,
            text
          )
        case "BALANCE_SET_ZERO_CONFIRM":
          return await handlers.handleBalanceSetToZero(
            this,
            chatId,
            userId,
            text
          )
        case "BALANCE_DELETE_CONFIRM":
          return await handlers.handleBalanceDelete(this, chatId, userId, text)
        case "BALANCE_DELETE_SELECT_TARGET":
          return await handlers.handleBalanceDeleteSelectTarget(
            this,
            chatId,
            userId,
            text
          )
        case "BALANCE_ZERO_SELECT_TARGET":
          return await handlers.handleBalanceZeroSelectTarget(
            this,
            chatId,
            userId,
            text
          )

        case "BALANCE_NAME": {
          const accountIdRaw = text.trim()
          if (!accountIdRaw) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.balance.nameEmpty"),
              this.getBackButton(lang)
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
              t(lang, "wizard.balance.nameExists", {
                accountId: escapeMarkdown(accountId),
              }),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "BALANCE_AMOUNT", { accountIdRaw })

          const defaultCurrency = await db.getDefaultCurrency(userId)
          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.balance.enterAmount", {
              currency: defaultCurrency,
            }),
            {
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "buttons.emptyBalance") }],
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
        case "BALANCE_AMOUNT": {
          const defaultCurrency = await db.getDefaultCurrency(userId)

          let amount = 0
          let currency = defaultCurrency

          if (text === t(lang, "buttons.emptyBalance")) {
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
                t(lang, "wizard.balance.invalidAmount", {
                  currency: defaultCurrency,
                }),
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: t(lang, "buttons.emptyBalance") }],
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
            amount = parsed.amount
            currency = parsed.currency
          }

          const accountIdRaw = state?.data?.accountIdRaw || ""
          const accountId = this.toTitleCase(accountIdRaw)
          if (!accountId) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.balance.nameMissing")
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId, lang)

            return true
          }

          await db.addBalance(userId, {
            accountId,
            amount: amount,
            currency: currency,
            lastUpdated: new Date().toISOString(),
          })

          this.clearState(userId)
          await showBalancesMenu(this, chatId, userId, lang)
          return true
        }
        case "BALANCE_DELETE_TRANSFER": {
          if (!state?.data) return false
          const { accountId, currency, amount } = state.data

          if (text === t(lang, "wizard.balance.deleteAndClear")) {
            await db.deleteBalance(userId, accountId, currency)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.balance.deletedAndCleared", {
                accountId: escapeMarkdown(accountId),
                amount: formatMoney(amount, currency),
              })
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId, lang)
            return true
          } else if (text === t(lang, "buttons.transferToAnotherAccount")) {
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
            rows.push([
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ])

            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.balance.transferToPrompt", {
                amount: formatMoney(amount, currency),
              }),
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
            t(lang, "wizard.balance.selectOptionError"),
            this.getBackButton(lang)
          )
          return true
        }
        case "BALANCE_EDIT_CURRENCY_CHOICE": {
          const accountId = state?.data?.accountId
          const currentCurrency = state?.data?.currency
          const inputAmount = state?.data?.inputAmount
          const inputCurrency = state?.data?.inputCurrency
          const convertedAmount = state?.data?.convertedAmount

          if (text.startsWith("🔄")) {
            await db.convertBalanceAmount(
              userId,
              accountId,
              inputCurrency,
              inputAmount
            )
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.balance.converted", {
                accountId: escapeMarkdown(accountId),
                inputAmount,
                inputCurrency,
                converted: formatMoney(convertedAmount, currentCurrency),
              })
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId, lang)
          } else if (text.startsWith("💱")) {
            await db.setBalanceAmountWithCurrencyChange(
              userId,
              accountId,
              inputCurrency,
              inputAmount
            )
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.balance.changed", {
                accountId: escapeMarkdown(accountId),
                amount: formatMoney(inputAmount, inputCurrency),
              })
            )
            this.clearState(userId)
            await showBalancesMenu(this, chatId, userId, lang)
          }
          return true
        }

        // --- Income Flow ---
        case "INCOME_VIEW": {
          if (text === t(lang, "buttons.addIncomeSource")) {
            await this.goToStep(userId, "INCOME_INLINE", {})
            const defaultCurrency = await db.getDefaultCurrency(userId)

            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.addPrompt", { currency: defaultCurrency }),
              {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              }
            )
            return true
          }

          const userData = await db.getUserData(userId)
          const sources = userData.incomeSources
          const source = sources.find(
            (s: IncomeSource) => s.name === text.trim()
          )

          if (!source) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.selectFromListError"),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "INCOME_MENU", { source })

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.income.menuMessage", {
              name: escapeMarkdown(source.name),
              amount: formatMoney(source.expectedAmount!, source.currency),
            }),
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "buttons.editName") }],
                  [
                    {
                      text: source.autoCreate?.enabled
                        ? t(lang, "wizard.income.disableAutoIncome")
                        : t(lang, "wizard.income.enableAutoIncome"),
                    },
                  ],
                  [{ text: t(lang, "wizard.income.deleteIncomeButton") }],
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
        case "INCOME_DELETE_CONFIRM": {
          const source = state?.data?.source as
            | { name: string; amount: number; currency: Currency }
            | undefined

          if (text === t(lang, "wizard.income.confirmDeleteButton")) {
            if (source) {
              await db.deleteIncomeSource(userId, source.name)
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.income.deletedMessage", {
                  name: escapeMarkdown(source.name),
                })
              )
            } else {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.income.noSourceSelected"),
                this.getBackButton(lang)
              )
            }
          } else if (text !== t(lang, "common.back")) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.deleteCancelled")
            )
          }

          await this.goToStep(userId, "INCOME_VIEW", {})
          await showIncomeSourcesMenu(this.bot, chatId, userId, lang)
          return true
        }
        case "INCOME_INLINE": {
          const parts = text.trim().split(/\s+/)
          if (parts.length < 2) {
            const defaultCurrency = await db.getDefaultCurrency(userId)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.invalidFormat", {
                currency: defaultCurrency,
              }),
              this.getBackButton(lang)
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
              t(lang, "wizard.income.invalidAmount", {
                currency: defaultCurrency,
              }),
              this.getBackButton(lang)
            )
            return true
          }

          await db.addIncomeSource(userId, {
            id: randomUUID(),
            name: name || "",
            expectedAmount: parsed.amount,
            currency: parsed.currency,
            frequency: "MONTHLY",
          })

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.income.addedMessage", {
              name: escapeMarkdown(name || ""),
              amount: `${parsed.amount} ${parsed.currency}`,
            })
          )

          await this.goToStep(userId, "INCOME_VIEW", {})

          await showIncomeSourcesMenu(this.bot, chatId, userId, lang)
          return true
        }
        case "INCOME_EDIT_NAME": {
          const source = state?.data?.source as
            | { name: string; amount: number; currency: Currency }
            | undefined
          if (!source) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.notFound")
            )
            await showIncomeSourcesMenu(this.bot, chatId, userId, lang)
            return true
          }

          const newName = text.trim()
          if (!newName) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.nameEmpty"),
              this.getBackButton(lang)
            )
            return true
          }

          await db.updateIncomeSourceName(userId, source.name, newName)

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.income.renamedMessage", {
              from: escapeMarkdown(source.name),
              to: escapeMarkdown(newName),
            })
          )

          await this.goToStep(userId, "INCOME_VIEW", {})

          await showIncomeSourcesMenu(this.bot, chatId, userId, lang)
          return true
        }
        case "INCOME_MENU": {
          const source = state?.data?.source as
            | { name: string; amount: number; currency: Currency }
            | undefined
          if (!source) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.notFound")
            )
            await showIncomeSourcesMenu(this.bot, chatId, userId, lang)
            return true
          }

          // Auto-Income Toggle
          if (
            text === t(lang, "wizard.income.enableAutoIncome") ||
            text === t(lang, "wizard.income.disableAutoIncome")
          ) {
            return await handlers.handleAutoIncomeToggle(
              this,
              chatId,
              userId,
              text
            )
          }

          // 1) Edit Name
          if (text === t(lang, "buttons.editName")) {
            await this.goToStep(userId, "INCOME_EDIT_NAME", { source })
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.editNamePrompt", {
                name: escapeMarkdown(source.name),
              }),
              this.getBackButton(lang)
            )
            return true
          }

          // 2) Delete Income
          if (text === t(lang, "wizard.income.deleteIncomeButton")) {
            await this.goToStep(userId, "INCOME_DELETE_CONFIRM", { source })
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.income.deleteConfirm", {
                name: escapeMarkdown(source.name),
              }),
              {
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "wizard.income.confirmDeleteButton") }],
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
              t(lang, "wizard.income.amountUpdated", {
                name: escapeMarkdown(updatedSource.name),
                amount: formatMoney(
                  updatedSource.amount,
                  updatedSource.currency
                ),
              })
            )

            await this.goToStep(userId, "INCOME_VIEW", {})

            await showIncomeSourcesMenu(this.bot, chatId, userId, lang)
            return true
          }

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.income.selectOptionError"),
            this.getBackButton(lang)
          )
          return true
        }

        // ANALYTICS
        case "ANALYTICS_TRENDS": {
          const trendsMsg = await formatTrends(userId)
          await this.bot.sendMessage(chatId, trendsMsg, {
            parse_mode: "Markdown",
            ...this.getBackButton(lang),
          })
          return true
        }
        case "ANALYTICS_MENU": {
          if (
            text === t(lang, "analytics.reports") ||
            text === t(lang, "buttons.reports")
          ) {
            await showAnalyticsReportsMenu(this, chatId, userId, lang)
            return true
          }

          if (
            text === t(lang, "analytics.history") ||
            text === t(lang, "buttons.history")
          ) {
            await this.goToStep(userId, "HISTORY_LIST", {})
            await showHistoryMenu(this, chatId, userId, lang)
            return true
          }

          if (
            text === t(lang, "analytics.netWorth") ||
            text === t(lang, "buttons.netWorth")
          ) {
            await this.goToStep(userId, "NET_WORTH_VIEW", { view: "summary" })
            await showNetWorthMenu(this.bot, chatId, userId, lang, "summary")
            return true
          }

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.analytics.menuTitle"),
            {
              parse_mode: "Markdown",
              reply_markup: getStatsKeyboard(lang),
            }
          )
          return true
        }
        case "NET_WORTH_VIEW": {
          const view =
            text === t(lang, "netWorth.viewAssets")
              ? "assets"
              : text === t(lang, "netWorth.viewDebts")
                ? "debts"
                : text === t(lang, "netWorth.fullReport")
                  ? "full"
                  : "summary"

          await this.goToStep(userId, "NET_WORTH_VIEW", { view })
          await showNetWorthMenu(this.bot, chatId, userId, lang, view)
          return true
        }
        case "ANALYTICS_REPORTS_MENU": {
          if (text === t(lang, "buttons.filters")) {
            await this.goToStep(userId, "ANALYTICS_FILTERS", {})
            await this.bot.sendMessage(
              chatId,
              `${t(lang, "wizard.analytics.filtersTitle")}\n\n${t(
                lang,
                "wizard.analytics.selectPeriod"
              )}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [
                      { text: t(lang, "buttons.last7Days") },
                      { text: t(lang, "buttons.last30Days") },
                    ],
                    [{ text: t(lang, "buttons.customPeriod") }],
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
          } else if (text === t(lang, "buttons.exportCsv")) {
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
              this.bot.sendMessage(
                chatId,
                t(lang, "wizard.analytics.exportSuccess"),
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: t(lang, "buttons.reports") }],
                      [{ text: t(lang, "buttons.history") }],
                      [{ text: t(lang, "buttons.netWorth") }],
                      [{ text: t(lang, "mainMenu.mainMenuButton") }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
            } else {
              this.bot.sendMessage(
                chatId,
                t(lang, "wizard.analytics.exportNoTransactions"),
                {
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
            }
            this.setState(userId, {
              step: "EXPORT_VIEW",
              data: {},
              returnTo: "analytics",
              lang,
            })
            return true
          }
          if (text === t(lang, "buttons.trends")) {
            const trends = await formatTrends(userId)
            await this.bot.sendMessage(chatId, trends, {
              parse_mode: "Markdown",
              ...this.getBackButton(lang),
            })
            this.setState(userId, {
              step: "TRENDS_VIEW",
              returnTo: "reports",
              lang,
            })
            return true
          } else if (text === t(lang, "buttons.topCategories")) {
            const top = await formatTopExpenses(userId, 5)
            await this.bot.sendMessage(chatId, top, {
              parse_mode: "Markdown",
              ...this.getBackButton(lang),
            })
            this.setState(userId, {
              step: "TOP_CATEGORIES_VIEW",
              returnTo: "reports",
              lang,
            })
            return true
          }

          return true
        }
        case "ANALYTICS_FILTERS": {
          if (text === t(lang, "buttons.last7Days")) {
            try {
              const report = await generateAnalyticsReport(
                userId,
                {
                  preset: "LAST_7_DAYS",
                },
                lang
              )

              await this.bot.sendMessage(chatId, report, {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              })
            } catch (_error) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.analytics.reportError"),
                this.getBackButton(lang)
              )
            }
            return true
          }

          if (text === t(lang, "buttons.last30Days")) {
            try {
              const report = await generateAnalyticsReport(
                userId,
                {
                  preset: "LAST_30_DAYS",
                },
                lang
              )

              await this.bot.sendMessage(chatId, report, {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              })
            } catch (_error) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.analytics.reportError"),
                this.getBackButton(lang)
              )
            }
            return true
          }

          if (text === t(lang, "buttons.customPeriod")) {
            await this.goToStep(userId, "ANALYTICS_PERIOD_START", {})
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.analytics.startDatePrompt"),
              { parse_mode: "Markdown", ...this.getBackButton(lang) }
            )
            return true
          }

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.analytics.selectFilterError"),
            this.getBackButton(lang)
          )
          return true
        }
        case "ANALYTICS_PERIOD_START": {
          const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
          if (!match) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.analytics.dateFormatErrorStart"),
              this.getBackButton(lang)
            )
            return true
          }

          const [, d, m, y] = match
          const start = `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`

          await this.goToStep(userId, "ANALYTICS_PERIOD_END", {
            startDate: start,
          })
          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.analytics.endDatePrompt"),
            { parse_mode: "Markdown", ...this.getBackButton(lang) }
          )
          return true
        }
        case "ANALYTICS_PERIOD_END": {
          const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
          if (!match) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.analytics.dateFormatErrorEnd"),
              this.getBackButton(lang)
            )
            return true
          }

          const [, d, m, y] = match
          const end = `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`

          const start = state?.data?.startDate as string
          const startDate = new Date(start)
          const endDate = new Date(end)

          if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            endDate < startDate
          ) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.analytics.invalidPeriod"),
              this.getBackButton(lang)
            )
            return true
          }

          await this.goToStep(userId, "ANALYTICS_SHOW_REPORT", {
            startDate: start,
            endDate: end,
          })

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.analytics.periodSelected"),
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "buttons.showReport") }],
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
        case "ANALYTICS_SHOW_REPORT": {
          if (text === t(lang, "buttons.showReport")) {
            const { preset, startDate, endDate } = state?.data || {}

            try {
              const report = await generateAnalyticsReport(
                userId,
                {
                  preset,
                  startDate,
                  endDate,
                },
                lang
              )

              await this.bot.sendMessage(chatId, report, {
                parse_mode: "Markdown",
                ...this.getBackButton(lang),
              })
            } catch (_error) {
              await this.bot.sendMessage(
                chatId,
                t(lang, "wizard.analytics.reportError"),
                this.getBackButton(lang)
              )
            }

            return true
          }

          // If user didn't press button, show error
          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.analytics.tapShowReport"),
            this.getBackButton(lang)
          )
          return true
        }

        // BUDGET PLANNER
        case "BUDGET_MENU": {
          if (text === t(lang, "buttons.addEditBudget")) {
            await this.goToStep(userId, "BUDGET_SELECT_CATEGORY", {})
            const categories = Object.values(ExpenseCategory)
            const items = categories.map((c) =>
              getExpenseCategoryLabel(lang, c, "short")
            )
            const keyboard = createListButtons({ items, lang })

            await this.bot.sendMessage(
              chatId,
              `${t(lang, "wizard.budget.title")}\n\n${t(
                lang,
                "wizard.budget.selectCategory"
              )}`,
              {
                parse_mode: "Markdown",
                reply_markup: { keyboard, resize_keyboard: true },
              }
            )
            return true
          }

          const cat = getExpenseCategoryByLabel(text)
          if (cat) {
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
              `${t(lang, "wizard.budget.categoryTitle", {
                category: getExpenseCategoryLabel(lang, cat),
              })}\n\n` +
                `${t(lang, "wizard.budget.limitLine", {
                  amount: b.limit,
                  currency: b.currency || "USD",
                })}\n` +
                `${t(lang, "wizard.budget.spentLine", {
                  amount: b.spent,
                  currency: b.currency || "USD",
                })}\n` +
                `${bar}\n\n` +
                `${t(lang, "wizard.budget.editOrClearHint")}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "buttons.clearLimit") }],
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

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.budget.selectCategoryError"),
            this.getBackButton(lang)
          )
          return true
        }
        case "BUDGET_SELECT_CATEGORY": {
          const cat = getExpenseCategoryByLabel(text)
          if (!cat) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.budget.invalidCategory"),
              this.getBackButton(lang)
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
            `${t(lang, "wizard.budget.categoryTitle", {
              category: getExpenseCategoryLabel(lang, cat),
            })}\n\n` +
              `${t(lang, "wizard.budget.limitLine", {
                amount: b.limit,
                currency: b.currency || "USD",
              })}\n` +
              `${t(lang, "wizard.budget.spentLine", {
                amount: b.spent,
                currency: b.currency || "USD",
              })}\n` +
              `${bar}\n\n` +
              `${t(lang, "wizard.budget.enterNewLimit")}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "buttons.clearLimit") }],
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
        case "BUDGET_CATEGORY_MENU": {
          const category = state?.data?.category as ExpenseCategory | undefined
          if (!category) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.budget.categoryMissing")
            )
            this.clearState(userId)
            await showBudgetMenu(this, chatId, userId, lang)
            return true
          }

          if (text === t(lang, "buttons.clearLimit")) {
            await db.clearCategoryBudget(userId, category)
            await this.goToStep(userId, "BUDGET_MENU", {})
            await showBudgetMenu(this, chatId, userId, lang)
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
            await showBudgetMenu(this, chatId, userId, lang)
            return true
          }

          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.budget.invalidAmount"),
            this.getBackButton(lang)
          )
          return true
        }

        case "TEMPLATE_EDIT_AMOUNT": {
          const templateId = state?.data?.templateId as string | undefined
          if (!templateId) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.template.idMissing")
            )
            this.clearState(userId)
            return true
          }

          const templates = await db.getTemplates(userId)
          const template = templates.find((t) => t.id === templateId)

          if (!template) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.template.notFound")
            )
            this.clearState(userId)
            return true
          }

          const amount = parseFloat(text.replace(",", "."))

          if (Number.isNaN(amount) || amount <= 0) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.template.invalidAmount"),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: t(lang, "wizard.template.cancel"),
                        callback_data: `tmpl_cancel|${templateId}`,
                      },
                    ],
                  ],
                },
              }
            )
            return true
          }

          const success = await db.updateTemplateAmount(
            userId,
            templateId,
            amount
          )

          if (!success) {
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.template.updateFailed")
            )
            this.clearState(userId)
            return true
          }

          const formatted = formatMoney(amount, template.currency)
          await this.bot.sendMessage(
            chatId,
            t(lang, "wizard.template.amountUpdated", { amount: formatted }),
            {
              parse_mode: "Markdown",
            }
          )

          this.clearState(userId)

          await handlers.showTemplateManageMenu(
            this.bot,
            chatId,
            userId,
            templateId,
            this
          )
          return true
        }

        // --- Date Handlers ---
        case "DEBT_ASK_DUE_DATE":
          return await handlers.handleDebtDueDate(this, chatId, userId, text)

        case "GOAL_ASK_DEADLINE":
          return await handlers.handleGoalDeadline(this, chatId, userId, text)

        case "INCOME_ASK_EXPECTED_DATE":
          return await handlers.handleIncomeExpectedDate(
            this,
            chatId,
            userId,
            text
          )

        case "DEBT_EDIT_DUE_DATE": {
          if (text === t(lang, "buttons.removeDate")) {
            const debt = state?.data?.debt
            await db.updateDebtDueDate(userId, debt.id, null)
            await reminderManager.deleteRemindersForEntity(userId, debt.id)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.debt.dueDateRemoved")
            )
            await showDebtsMenu(this.bot, chatId, userId, lang)
            this.clearState(userId)
            return true
          }

          if (text === t(lang, "wizard.common.skip")) {
            await showDebtsMenu(this.bot, chatId, userId, lang)
            this.clearState(userId)
            return true
          }

          return await handlers.handleDebtDueDateEdit(
            this,
            chatId,
            userId,
            text
          )
        }

        case "GOAL_EDIT_DEADLINE": {
          if (text === t(lang, "buttons.removeDate")) {
            const goal = state?.data?.goal
            await db.updateGoalDeadline(userId, goal.id, null)
            await reminderManager.deleteRemindersForEntity(userId, goal.id)
            await this.bot.sendMessage(
              chatId,
              t(lang, "wizard.goal.deadlineRemoved")
            )
            await showGoalsMenu(this.bot, chatId, userId, lang)
            this.clearState(userId)
            return true
          }

          if (text === t(lang, "wizard.common.skip")) {
            await showGoalsMenu(this.bot, chatId, userId, lang)
            this.clearState(userId)
            return true
          }

          return await handlers.handleGoalDeadlineEdit(
            this,
            chatId,
            userId,
            text
          )
        }

        // --- Auto-Deposit Handlers ---
        case "AUTO_DEPOSIT_SELECT_ACCOUNT":
          return await handlers.handleAutoDepositAccountSelect(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_DEPOSIT_ENTER_AMOUNT":
          return await handlers.handleAutoDepositAmountInput(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_DEPOSIT_SELECT_FREQUENCY":
          return await handlers.handleAutoDepositFrequencySelect(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_DEPOSIT_SELECT_DAY_WEEKLY":
          return await handlers.handleAutoDepositDayWeeklySelect(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_DEPOSIT_SELECT_DAY_MONTHLY":
          return await handlers.handleAutoDepositDayMonthlySelect(
            this,
            chatId,
            userId,
            text
          )

        // --- Auto-Income Handlers ---
        case "AUTO_INCOME_SELECT_ACCOUNT":
          return await handlers.handleAutoIncomeAccountSelect(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_INCOME_ENTER_AMOUNT":
          return await handlers.handleAutoIncomeAmountInput(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_INCOME_SELECT_DAY":
          return await handlers.handleAutoIncomeDaySelect(
            this,
            chatId,
            userId,
            text
          )

        // --- Auto-Debt-Payment Handlers ---
        case "AUTO_PAYMENT_SELECT_ACCOUNT":
          return await handlers.handleAutoPaymentAccountSelect(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_PAYMENT_ENTER_AMOUNT":
          return await handlers.handleAutoPaymentAmountInput(
            this,
            chatId,
            userId,
            text
          )

        case "AUTO_PAYMENT_SELECT_DAY":
          return await handlers.handleAutoPaymentDaySelect(
            this,
            chatId,
            userId,
            text
          )

        // --- Reminder Settings Handlers ---
        case "NOTIFICATIONS_MENU": {
          // Handle button clicks within notifications menu
          if (
            text === t(lang, "wizard.notifications.enable") ||
            text === t(lang, "wizard.notifications.disable")
          ) {
            return await handlers.handleNotificationsToggle(
              this,
              chatId,
              userId,
              text
            )
          }

          if (text === t(lang, "wizard.notifications.changeTime")) {
            return await handlers.handleReminderTimeSelect(this, chatId, userId)
          }

          if (text === t(lang, "buttons.changeTimezone")) {
            return await handlers.handleTimezoneSelect(this, chatId, userId)
          }

          // Default: show menu again
          return await handlers.handleNotificationsMenu(this, chatId, userId)
        }

        case "REMINDER_TIME_SELECT":
          return await handlers.handleReminderTimeSave(
            this,
            chatId,
            userId,
            text
          )

        case "REMINDER_TIMEZONE_SELECT":
          return await handlers.handleTimezoneSave(this, chatId, userId, text)

        // --- Automation Menu ---
        case "AUTOMATION_MENU": {
          if (text === t(lang, "buttons.recurringPayments")) {
            await this.goToStep(userId, "RECURRING_MENU", {})
            return await handlers.handleRecurringMenu(
              this,
              chatId,
              userId,
              lang
            )
          }

          if (text === t(lang, "buttons.notifications")) {
            await this.goToStep(userId, "NOTIFICATIONS_MENU", {})
            return await handlers.handleNotificationsMenu(this, chatId, userId)
          }

          // Default: show automation menu again
          await showAutomationMenu(this, chatId, userId, lang)
          return true
        }

        // --- Recurring Transactions Handlers ---
        case "RECURRING_MENU": {
          // Handle button clicks
          if (text === t(lang, "buttons.addRecurring")) {
            return await handlers.handleRecurringCreateStart(
              this,
              chatId,
              userId
            )
          }

          // Check if selecting existing recurring
          const recurring = text.match(/^(💸|💰) /)
          if (recurring) {
            return await handlers.handleRecurringSelect(
              this,
              chatId,
              userId,
              text
            )
          }

          // Default: show menu
          return await handlers.handleRecurringMenu(this, chatId, userId, lang)
        }

        case "RECURRING_ITEM_MENU":
          return await handlers.handleRecurringItemAction(
            this,
            chatId,
            userId,
            text
          )

        case "RECURRING_DELETE_CONFIRM":
          return await handlers.handleRecurringDeleteConfirm(
            this,
            chatId,
            userId,
            text
          )

        case "RECURRING_CREATE_DESCRIPTION":
          return await handlers.handleRecurringDescription(
            this,
            chatId,
            userId,
            text
          )

        case "RECURRING_CREATE_TYPE":
          return await handlers.handleRecurringType(this, chatId, userId, text)

        case "RECURRING_CREATE_AMOUNT":
          return await handlers.handleRecurringAmount(
            this,
            chatId,
            userId,
            text
          )

        case "RECURRING_CREATE_ACCOUNT":
          return await handlers.handleRecurringAccount(
            this,
            chatId,
            userId,
            text
          )

        case "RECURRING_CREATE_CATEGORY":
          return await handlers.handleRecurringCategory(
            this,
            chatId,
            userId,
            text
          )

        case "RECURRING_CREATE_DAY":
          return await handlers.handleRecurringDay(this, chatId, userId, text)

        // --- Custom Message Handlers ---
        case "CUSTOM_MESSAGES_MENU":
          return await handlers.handleCustomMessagesAction(
            this,
            chatId,
            userId,
            text
          )

        case "CUSTOM_MESSAGE_EDIT":
          return await handlers.handleCustomMessageSave(
            this,
            chatId,
            userId,
            text
          )

        // --- Bank Statement Upload Handlers ---
        case "STATEMENT_PREVIEW":
          return await handlers.handleStatementPreviewAction(
            this,
            chatId,
            userId,
            text
          )
      }
    } catch (error) {
      console.error("Wizard Error:", error)
      await this.bot.sendMessage(chatId, t(lang, "wizard.common.error"))
      this.clearState(userId)
      await showMainMenu(this.bot, chatId, lang)
    }

    return false
  }
}
