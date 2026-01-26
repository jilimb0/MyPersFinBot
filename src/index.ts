import "dotenv/config"
import "reflect-metadata"
import TelegramBot from "node-telegram-bot-api"
import { TransactionType, Debt, Goal, Currency } from "./types"
import { dbStorage as db } from "./database/storage-db"
import { initializeDatabase, closeDatabase } from "./database/data-source"
import {
  createProgressBar,
  formatMonthlyStats,
  getProgressEmoji,
} from "./reports"
import { WizardManager } from "./wizards/wizards"
import {
  getCacheHitRate,
  getCacheStatus,
  preloadRates,
  stopAutoRefresh,
} from "./fx"
import * as menus from "./menus-i18n"
import { createListButtons, formatMoney, safeAnswerCallback } from "./utils"
import { registerCommands } from "./commands"
import * as handlers from "./handlers"
import { t, Language } from "./i18n"
import {
  getMainMenuKeyboard,
  getStartTrackingKeyboard,
  getGoToBalancesKeyboard,
  getSettingsKeyboard,
} from "./i18n/keyboards"
import {
  detectAndSetLanguage,
  showLanguageMenu,
  handleLanguageSelection,
} from "./handlers/language-handler"
import { handleAutoDepositToggle } from "./handlers/auto-deposit-handlers"
import { Scheduler } from "./services/scheduler"
import { reminderManager } from "./services/reminder-manager"
import { logConfig } from "./config"
import { securityCheck } from "./security"
import { setupGlobalErrorHandlers } from "./error-handler"
import { log } from "./logger"
import { initializeCache, closeCache } from "./cache"

setupGlobalErrorHandlers()

// TODO: try to fix warning in future
process.env.NTBA_FIX_350 = "1"

// Load bot token from environment
const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN not found in environment variables")
  console.error("Please add TELEGRAM_BOT_TOKEN to your .env file")
  process.exit(1)
}

// Create bot instance (will be initialized in startBot)
let bot: TelegramBot

async function startBot() {
  try {
    await initializeDatabase()

    await initializeCache({ namespace: "finbot", ttl: 3600 })

    await preloadRates()

    const status = getCacheStatus()
    if (status.isPersisted && status.cacheValid) {
      console.log("✅ Using persisted FX cache (no API call)")
    } else {
      console.log("🌐 Fetched fresh FX rates from API")
    }

    const hitRate = getCacheHitRate()
    console.log(`📊 FX Cache hit rate: ${hitRate}%`)

    // Initialize bot instance
    bot = new TelegramBot(token!, { polling: true })

    // Setup middleware
    const wizardManager = new WizardManager(bot)

    registerCommands(bot)
    handlers.registerPeriodReportHandlers(bot)

    const scheduler = new Scheduler(bot)
    scheduler.start()

    logConfig()

    log.info("🚀 Bot is running...")

    // Graceful shutdown
    const shutdown = async () => {
      log.info("\n⏳ Shutting down gracefully...")
      scheduler.stop()
      await bot.stopPolling()
      stopAutoRefresh()
      await closeDatabase()
      await closeCache()
      log.info("✅ Bot stopped")
      process.exit(0)
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    bot.on("message", async (msg) => {
      if (!securityCheck(bot, msg)) {
        return
      }

      const chatId = msg.chat.id
      const userId = chatId.toString()
      const text = msg.text?.trim()

      if (!text) return

      if (
        /^\d+\s+\w+/.test(text) ||
        /потратил|витратив|spent|получил|отримав|received|зарплата/i.test(text)
      ) {
        await handlers.handleNLPInput(bot, chatId, userId, text, wizardManager)
        return
      }

      const lang = (await db.getUserLanguage(userId)) as Language

      if (text === "/start") {
        await detectAndSetLanguage(userId, msg.from?.language_code)
      }

      const langHandled = await handleLanguageSelection(
        bot,
        chatId,
        userId,
        text
      )
      if (langHandled) return

      switch (text) {
        // START
        case "/start": {
          const userData = await db.getUserData(userId)
          const hasData =
            userData.balances.length > 0 ||
            userData.transactions.length > 0 ||
            userData.debts.length > 0 ||
            userData.goals.length > 0

          if (hasData) {
            bot.sendMessage(
              chatId,
              t(lang, "mainMenu.welcomeBack"),
              getMainMenuKeyboard(lang)
            )
          } else {
            bot.sendMessage(
              chatId,
              `${t(lang, "mainMenu.welcome")}\n\n${t(lang, "mainMenu.welcomeIntro")}`,
              {
                parse_mode: "Markdown",
                ...getStartTrackingKeyboard(lang),
              }
            )
          }
          return
        }
        case t(lang, "mainMenu.startTracking"):
          bot.sendMessage(
            chatId,
            `${t(lang, "mainMenu.quickStartTitle")}\n\n${t(lang, "mainMenu.quickStartGuide")}`,
            {
              parse_mode: "Markdown",
              ...getMainMenuKeyboard(lang),
            }
          )
          return

        // MAIN MENU
        // EXPENSES
        case t(lang, "transactions.addAnotherExpense"):
        case t(lang, "mainMenu.expense"): {
          const balanceCount = (await db.getBalancesList(userId)).length

          if (balanceCount === 0) {
            bot.sendMessage(chatId, t(lang, "transactions.noBalances"), {
              parse_mode: "Markdown",
              ...getGoToBalancesKeyboard(lang),
            })
            return
          }

          wizardManager.setState(userId, {
            step: "TX_AMOUNT",
            txType: TransactionType.EXPENSE,
            data: {},
            returnTo: "main",
            lang: lang,
          })

          const currency = await db.getDefaultCurrency(userId)

          // Get top transaction amounts
          const topAmounts = await db.getTopTransactionAmounts(
            userId,
            TransactionType.EXPENSE,
            5
          )

          const denominations = db.getCurrencyDenominations(currency)

          const topValues = topAmounts.map((a) => a.amount)
          const standardValues = denominations.filter(
            (d) => !topValues.includes(d)
          )

          const allAmounts = [
            ...topAmounts.map(({ amount }) => amount),
            ...standardValues,
          ].slice(0, 5)

          const buttons: TelegramBot.KeyboardButton[][] = []

          for (let i = 0; i < allAmounts.length; i += 3) {
            const row = allAmounts.slice(i, i + 3).map((amount) => ({
              text: `${formatMoney(amount, currency, true)}`,
            }))
            buttons.push(row)
          }
          buttons.push([{ text: t(lang, "mainMenu.mainMenuButton") }])

          bot.sendMessage(
            chatId,
            `💸 *Expense*\n\nSelect amount or enter custom:\n\nCurrency: ${currency}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: buttons,
                resize_keyboard: true,
              },
            }
          )
          return
        }

        // INCOME
        case t(lang, "transactions.addAnotherIncome"):
        case t(lang, "mainMenu.income"): {
          const balanceCount = (await db.getBalancesList(userId)).length

          if (balanceCount === 0) {
            bot.sendMessage(chatId, t(lang, "transactions.noBalances"), {
              parse_mode: "Markdown",
              ...getGoToBalancesKeyboard(lang),
            })
            return
          }

          wizardManager.setState(userId, {
            step: "TX_AMOUNT",
            txType: TransactionType.INCOME,
            data: {},
            returnTo: "main",
            lang: lang,
          })

          const currency = await db.getDefaultCurrency(userId)

          // Get top transaction amounts
          const topAmounts = await db.getTopTransactionAmounts(
            userId,
            TransactionType.INCOME,
            5
          )

          const denominations = db.getCurrencyDenominations(currency)

          // Combine top amounts with standard denominations to always show 5 buttons
          const topValues = topAmounts.map((a) => a.amount)
          const standardValues = denominations.filter(
            (d) => !topValues.includes(d)
          )

          const allAmounts = [
            ...topAmounts.map(({ amount }) => amount),
            ...standardValues,
          ].slice(0, 5)

          const buttons: TelegramBot.KeyboardButton[][] = []

          for (let i = 0; i < allAmounts.length; i += 3) {
            const row = allAmounts.slice(i, i + 3).map((amount) => ({
              text: `${formatMoney(amount, currency, true)}`,
            }))
            buttons.push(row)
          }
          buttons.push([{ text: t(lang, "mainMenu.mainMenuButton") }])

          bot.sendMessage(
            chatId,
            `💰 *Income*\n\nSelect amount or enter custom:\n\nCurrency: ${currency}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: buttons,
                resize_keyboard: true,
              },
            }
          )
          return
        }

        // BALANCES
        case t(lang, "transactions.goToBalances"):
        case t(lang, "mainMenu.balances"):
          wizardManager.setState(userId, {
            step: "BALANCE_LIST",
            data: {},
            returnTo: "balances",
            lang: lang,
          })
          await menus.showBalancesMenu(wizardManager, chatId, userId, lang)
          return

        // BUDGET PLANNER
        case t(lang, "mainMenu.budgetPlanner"):
          await menus.showBudgetMenu(wizardManager, chatId, userId, lang)
          return

        // DEBTS
        case t(lang, "mainMenu.debts"):
          wizardManager.setState(userId, {
            step: "NONE",
            data: {},
            returnTo: "debts",
            lang: lang,
          })
          await menus.showDebtsMenu(bot, chatId, userId, lang)
          return

        // GOALS
        case t(lang, "mainMenu.goals"):
          wizardManager.setState(userId, {
            step: "NONE",
            data: {},
            returnTo: "goals",
            lang: lang,
          })
          await menus.showGoalsMenu(bot, chatId, userId, lang)
          return

        // ANALYTICS
        case t(lang, "mainMenu.analytics"):
          await menus.showStatsMenu(bot, chatId, lang)
          return

        // SETTINGS
        case t(lang, "mainMenu.settings"): {
          const currentCurrency = await db.getDefaultCurrency(userId)
          const state = wizardManager.getState(userId)

          if (state?.step === "GOAL_MENU" && state?.data?.goal) {
            const goal = state?.data?.goal as Goal
            const { deadline, autoDeposit } = goal

            await wizardManager.goToStep(
              userId,
              "GOAL_ADVANCED_MENU",
              state?.data
            )

            bot.sendMessage(chatId, `⚙️ *Advanced Settings*\n\n${goal.name}`, {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: deadline
                  ? [
                      [{ text: t(lang, "goals.changeDeadlineBtn") }],
                      [{ text: t(lang, "debts.disableReminders") }],
                      [
                        {
                          text: autoDeposit?.enabled
                            ? t(lang, "goals.disableAutoDeposit")
                            : t(lang, "goals.enableAutoDeposit"),
                        },
                      ],
                      [
                        { text: t(lang, "common.back") },
                        { text: t(lang, "mainMenu.mainMenuButton") },
                      ],
                    ]
                  : [
                      [{ text: t(lang, "goals.setDeadlineBtn") }],
                      [
                        {
                          text: autoDeposit?.enabled
                            ? t(lang, "goals.disableAutoDeposit")
                            : t(lang, "goals.enableAutoDeposit"),
                        },
                      ],
                      [
                        { text: t(lang, "common.back") },
                        { text: t(lang, "mainMenu.mainMenuButton") },
                      ],
                    ],
                resize_keyboard: true,
              },
            })
          } else if (state?.step === "DEBT_MENU" && state?.data?.debt) {
            const debt = state?.data?.debt as Debt
            const { dueDate, autoPayment } = debt

            await wizardManager.goToStep(
              userId,
              "DEBT_ADVANCED_MENU",
              state?.data
            )

            bot.sendMessage(chatId, `⚙️ *Advanced Settings*\n\n${debt.name}`, {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: dueDate
                  ? [
                      [{ text: `${t(lang, "debts.changeDueDate")}` }],
                      [{ text: t(lang, "debts.disableReminders") }],
                      [
                        {
                          text: autoPayment?.enabled
                            ? t(lang, "debts.disableAutoPayment")
                            : t(lang, "debts.enableAutoPayment"),
                        },
                      ],
                      [
                        { text: t(lang, "common.back") },
                        { text: t(lang, "mainMenu.mainMenuButton") },
                      ],
                    ]
                  : [
                      [{ text: `${t(lang, "debts.setDueDate")}` }],
                      [
                        {
                          text: autoPayment?.enabled
                            ? t(lang, "debts.disableAutoPayment")
                            : t(lang, "debts.enableAutoPayment"),
                        },
                      ],
                      [
                        { text: t(lang, "common.back") },
                        { text: t(lang, "mainMenu.mainMenuButton") },
                      ],
                    ],
                resize_keyboard: true,
              },
            })
          }

          bot.sendMessage(
            chatId,
            `${t(lang, "settings.title")}\n\n${t(lang, "settings.currentCurrency")} ${currentCurrency}\n\n${t(lang, "settings.manageConfig")}`,
            {
              parse_mode: "Markdown",
              reply_markup: getSettingsKeyboard(lang),
            }
          )
          return
        }

        // SUB MENU
        // BALANCES
        case t(lang, "balances.addBalance"):
          wizardManager.setState(userId, {
            step: "BALANCE_NAME",
            data: {},
            returnTo: "balances",
            lang: lang,
          })
          bot.sendMessage(
            chatId,
            t(lang, "balances.addTitle") +
              "\n\n" +
              t(lang, "balances.enterName"),
            {
              parse_mode: "Markdown",
              ...wizardManager.getBackButton(lang),
            }
          )
          return

        case t(lang, "balances.transfer"): {
          await wizardManager.goToStep(userId, "TX_AMOUNT", {
            txType: TransactionType.TRANSFER,
          })

          const currency = await db.getDefaultCurrency(userId)
          const denominations = db.getCurrencyDenominations(currency)
          const state = wizardManager.getState(userId)
          if (!state) return
          const { txType } = state

          const items = denominations.map(
            (v: number) => `${formatMoney(v, currency, true)}`
          )

          const listButtons = createListButtons({
            items,
            itemsPerRowCustom: 3,
          })

          const titleWithEmoji =
            txType === TransactionType.EXPENSE
              ? t(lang, "transactions.expenseTitle")
              : txType === TransactionType.INCOME
                ? t(lang, "transactions.incomeTitle")
                : t(lang, "transactions.transferTitle")
          await wizardManager.sendMessage(
            chatId,
            `${titleWithEmoji}\n\nSelect amount or enter custom:\n\nCurrency: ${currency}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: listButtons,
                resize_keyboard: true,
              },
            }
          )
          return
        }

        // DEBTS
        case t(lang, "debts.addDebt"):
          // TODO?
          wizardManager.setState(userId, {
            step: "DEBT_TYPE",
            data: {},
            returnTo: "debts",
            lang: lang,
          })
          bot.sendMessage(chatId, t(lang, "debts.selectType"), {
            reply_markup: {
              keyboard: [
                [
                  { text: t(lang, "debts.iOwe") },
                  { text: t(lang, "debts.theyOweMe") },
                ],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ],
              resize_keyboard: true,
            },
          })
          return

        case t(lang, "debts.setDueDate"):
        case t(lang, "debts.changeDueDate"): {
          const state = wizardManager.getState(userId)
          if (
            (state?.step === "DEBT_MENU" ||
              state?.step === "DEBT_ADVANCED_MENU") &&
            state?.data?.debt
          ) {
            await wizardManager.goToStep(
              userId,
              "DEBT_EDIT_DUE_DATE",
              state?.data
            )
            bot.sendMessage(
              chatId,
              `📅 *${text === t(lang, "debts.setDueDate") ? "Set" : "Change"} Due Date*\n\n` +
                `Enter new due date (DD.MM.YYYY):\n` +
                `Example: 31.12.2026\n\n` +
                (text === t(lang, "debts.changeDueDate")
                  ? `Or tap 🗑 Remove to delete due date.`
                  : `Or tap ⏩ Skip to cancel.`),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    text === t(lang, "debts.changeDueDate")
                      ? [{ text: t(lang, "common.removeDate") }]
                      : [{ text: t(lang, "common.skip") }],
                    [
                      { text: t(lang, "common.back") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ].filter((row) => row.length > 0),
                  resize_keyboard: true,
                },
              }
            )
          }
          return
        }
        case t(lang, "debts.disableReminders"): {
          const state = wizardManager.getState(userId)
          if (
            (state?.step === "DEBT_MENU" ||
              state?.step === "DEBT_ADVANCED_MENU") &&
            state?.data?.debt
          ) {
            const debt = state?.data?.debt as Debt
            await reminderManager.deleteRemindersForEntity(userId, debt.id)
            await db.updateDebtDueDate(userId, debt.id, null)
            bot.sendMessage(
              chatId,
              t(lang, "debts.remindersDisabled"),
              wizardManager.getBackButton(lang)
            )
            await menus.showDebtsMenu(bot, chatId, userId, lang)
            wizardManager.clearState(userId)
          } else if (
            (state?.step === "GOAL_MENU" ||
              state?.step === "GOAL_ADVANCED_MENU") &&
            state?.data?.goal
          ) {
            const goal = state?.data?.goal as Goal
            await reminderManager.deleteRemindersForEntity(userId, goal.id)
            await db.updateGoalDeadline(userId, goal.id, null)
            bot.sendMessage(
              chatId,
              t(lang, "goals.remindersDisabled"),
              wizardManager.getBackButton(lang)
            )
            await menus.showGoalsMenu(bot, chatId, userId, lang)
            wizardManager.clearState(userId)
          }
          return
        }
        case t(lang, "debts.enableAutoPayment"):
        case t(lang, "debts.disableAutoPayment"): {
          const state = wizardManager.getState(userId)
          if (
            (state?.step === "DEBT_MENU" ||
              state?.step === "DEBT_ADVANCED_MENU") &&
            state?.data?.debt
          ) {
            // TODO: Implement auto-payment toggle similar to auto-deposit
            bot.sendMessage(
              chatId,
              t(lang, "debts.autoPaymentComingSoon"),
              wizardManager.getBackButton(lang)
            )
          }
          return
        }

        // GOALS
        case t(lang, "goals.addGoal"): {
          // TODO?
          wizardManager.setState(userId, {
            step: "GOAL_INPUT",
            data: {},
            returnTo: "goals",
            lang: lang,
          })
          const defaultCurrency = await db.getDefaultCurrency(userId)
          bot.sendMessage(
            chatId,
            `🎯 *Add Goal*\n\n` +
              `Enter goal in format:\n` +
              `\`GoalName amount CURRENCY\`\n\n` +
              `*Examples:*\n` +
              `• \`Laptop 2000 ${defaultCurrency}\`\n` +
              `• \`Vacation 5000 USD\`\n` +
              `• \`Emergency Fund 10000\` (uses ${defaultCurrency})`,
            {
              parse_mode: "Markdown",
              ...wizardManager.getBackButton(lang),
            }
          )
          return
        }
        case t(lang, "goals.completed"): {
          const userData = await db.getUserData(userId)
          const completedGoals = userData.goals.filter(
            (g: Goal) => g.status === "COMPLETED"
          )

          let msg = "✅ *Completed Goals*\n\n"
          if (completedGoals.length === 0) {
            msg += "💭 No completed goals yet."
          } else {
            completedGoals.forEach((g: Goal, i: number) => {
              msg += `${i + 1}. *${g.name}*\n`
              msg += `Target: ${g.targetAmount} ${g.currency}\n`
              msg += `Achieved: ${g.currentAmount} ${g.currency}\n\n`
            })
          }

          const goalRows: TelegramBot.KeyboardButton[][] = []
          completedGoals.forEach((g: Goal) => {
            goalRows.push([{ text: `✅ Goal: ${g.name}` }])
          })
          goalRows.push([
            { text: t(lang, "common.back") },
            { text: t(lang, "mainMenu.mainMenuButton") },
          ])

          // TODO?
          wizardManager.setState(userId, {
            step: "GOAL_COMPLETED_SELECT",
            data: {},
            returnTo: "goals",
            lang: lang,
          })

          bot.sendMessage(chatId, msg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: goalRows,
              resize_keyboard: true,
            },
          })
          return
        }
        case t(lang, "goals.setDeadlineBtn"):
        case t(lang, "goals.changeDeadlineBtn"): {
          const state = wizardManager.getState(userId)
          if (
            (state?.step === "GOAL_MENU" ||
              state?.step === "GOAL_ADVANCED_MENU") &&
            state?.data?.goal
          ) {
            await wizardManager.goToStep(
              userId,
              "GOAL_EDIT_DEADLINE",
              state?.data
            )
            bot.sendMessage(
              chatId,
              `📅 *${text === t(lang, "goals.setDeadlineBtn") ? "Set" : "Change"} Deadline*\n\n` +
                `Enter new deadline (DD.MM.YYYY):\n` +
                `Example: 31.12.2026\n\n` +
                (text === t(lang, "goals.changeDeadlineBtn")
                  ? `Or tap 🗑 Remove to delete deadline.`
                  : `Or tap ⏩ Skip to cancel.`),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    text === t(lang, "goals.changeDeadlineBtn")
                      ? [{ text: t(lang, "common.removeDate") }]
                      : [{ text: t(lang, "common.skip") }],
                    [
                      { text: t(lang, "common.back") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ].filter((row) => row.length > 0),
                  resize_keyboard: true,
                },
              }
            )
          }
          return
        }
        case t(lang, "goals.enableAutoDeposit"):
        case t(lang, "goals.disableAutoDeposit"): {
          const state = wizardManager.getState(userId)
          if (
            (state?.step === "GOAL_MENU" ||
              state?.step === "GOAL_ADVANCED_MENU") &&
            state?.data?.goal
          ) {
            await handleAutoDepositToggle(wizardManager, chatId, userId, text)
          }
          return
        }

        // MAIN MENU
        case t(lang, "mainMenu.mainMenuButton"):
          wizardManager.clearState(userId)
          bot.sendMessage(
            chatId,
            t(lang, "mainMenu.welcomeBack"),
            getMainMenuKeyboard(lang)
          )
          return

        // BACK
        case t(lang, "common.back"):
          bot.sendMessage(
            chatId,
            t(lang, "mainMenu.welcomeBack"),
            getMainMenuKeyboard(lang)
          )
          return

        // ANALYTICS
        case t(lang, "analytics.netWorth"):
          //TODO?
          wizardManager.setState(userId, {
            step: "NET_WORTH_VIEW",
            data: { view: "summary" },
            returnTo: "analytics",
            lang: lang,
          })
          await menus.showNetWorthMenu(bot, chatId, userId, lang, "summary")
          return

        case t(lang, "analytics.history"):
          //TODO?
          wizardManager.setState(userId, {
            step: "HISTORY_LIST",
            data: {},
            returnTo: "main",
            lang: lang,
          })
          await menus.showHistoryMenu(wizardManager, chatId, userId, lang)
          return

        case t(lang, "transactions.historyFilters"):
          //TODO?
          wizardManager.setState(userId, {
            step: "TX_VIEW_PERIOD",
            data: {},
            returnTo: "history",
            lang: lang,
          })

          bot.sendMessage(
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
                  [
                    { text: t(lang, "common.back") },
                    { text: t(lang, "mainMenu.mainMenuButton") },
                  ],
                ],
                resize_keyboard: true,
              },
            }
          )
          return

        case t(lang, "analytics.reports"): {
          // TODO?
          wizardManager.setState(userId, {
            step: "ANALYTICS_REPORTS_MENU",
            data: {},
            returnTo: "analytics",
            lang: lang,
          })

          const statsMsg = await formatMonthlyStats(userId)

          bot.sendMessage(chatId, statsMsg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📅 Export CSV" }],
                [{ text: "🔎 Filters" }],
                [{ text: "📈 Trends" }],
                [{ text: "📉 Top Categories" }],
                [
                  { text: t(lang, "common.back") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
              ],
              resize_keyboard: true,
            },
          })
          return
        }
        case t(lang, "netWorth.viewAssets"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, lang, "assets")
          }
          return
        }
        case t(lang, "netWorth.viewDebts"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, lang, "debts")
          }
          return
        }
        case t(lang, "netWorth.fullReport"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, lang, "full")
          }
          return
        }
        case t(lang, "netWorth.summary"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, lang, "summary")
          }
          return
        }
        case t(lang, "common.previous"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "HISTORY_LIST" && state?.data?.page) {
            const prevPage = Math.max(1, state?.data?.page - 1)
            await menus.showHistoryMenu(
              wizardManager,
              chatId,
              userId,
              lang,
              prevPage
            )
          }
          return
        }
        case t(lang, "common.next"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "HISTORY_LIST" && state?.data?.page) {
            const nextPage = state?.data?.page + 1
            await menus.showHistoryMenu(
              wizardManager,
              chatId,
              userId,
              lang,
              nextPage
            )
          }
          return
        }

        // SETTINGS
        case t(lang, "settings.language"):
          await showLanguageMenu(bot, chatId, userId)
          return

        case t(lang, "settings.automation"):
          await menus.showAutomationMenu(wizardManager, chatId, userId, lang)
          return

        case t(lang, "settings.advanced"):
          await menus.showAdvancedMenu(wizardManager, chatId, userId, lang)
          return

        case t(lang, "settings.help"):
          wizardManager.setState(userId, {
            step: "HELP_VIEW",
            data: {},
            returnTo: "settings",
            lang: lang,
          })

          bot.sendMessage(
            chatId,
            "❓ *Personal Finance Bot - User Guide*\n\n" +
              "===================\n\n" +
              "📊 *Core Features*\n\n" +
              "💸 *Expense & Income*\n" +
              "• Track expenses and income\n" +
              "• Quick entry with amount buttons\n" +
              "• Categorize transactions\n" +
              "• Multi-currency support\n" +
              '• Natural language: "50 coffee"\n\n' +
              "💳 *Balances*\n" +
              "• Manage multiple accounts\n" +
              '• Format: "Cash 1000 USD" or just "Cash"\n' +
              "• Edit and transfer between accounts\n" +
              "• Auto currency conversion\n\n" +
              "📉 *Debts*\n" +
              "• Track money you owe or are owed\n" +
              '• Format: "John 500 USD"\n' +
              "• Set due dates and reminders\n" +
              "• Partial payments supported\n\n" +
              "🎯 *Goals*\n" +
              "• Set savings targets\n" +
              '• Format: "Laptop 2000 USD"\n' +
              "• Track progress with visual bars\n" +
              "• Auto-deposit automation\n\n" +
              "📊 *Analytics*\n" +
              "• Monthly/weekly stats\n" +
              "• Trends and top categories\n" +
              "• Custom period reports\n" +
              "• CSV export\n" +
              "• Net worth tracking\n\n" +
              "===================\n\n" +
              "🤖 *Automation Features*\n\n" +
              "🔁 *Recurring Payments*\n" +
              "• Set up auto transactions\n" +
              "• Daily/weekly/monthly schedules\n" +
              "• Auto-categorization\n\n" +
              "🔔 *Notifications*\n" +
              "• Debt/goal reminders\n" +
              "• Custom timezone\n" +
              "• Snooze and mark as done\n\n" +
              "===================\n\n" +
              "👥 *Advanced*\n\n" +
              "📅 *History & Filters*\n" +
              "• Browse all transactions\n" +
              "• Filter by date/category/type\n" +
              "• Edit or delete past entries\n\n" +
              "📊 *Budget Planner*\n" +
              "• Set category limits\n" +
              "• Visual spending progress\n" +
              "• Budget alerts\n\n" +
              "💱 *Multi-Currency*\n" +
              "• USD, EUR, GEL, RUB, UAH, PLN\n" +
              "• Auto conversion\n" +
              "• Live exchange rates\n\n" +
              "📝 *Custom Messages*\n" +
              "• Personalize transaction confirmations\n" +
              "• Motivational messages for goals\n\n" +
              "📥 *Upload Bank Statements*\n" +
              "• Tinkoff, Monobank, Revolut, Wise\n" +
              "• Auto-import transactions\n\n" +
              "===================\n\n" +
              "💡 *Quick Tips*\n\n" +
              "• Use templates to save common transactions\n" +
              "• Set reminders for bills and payments\n" +
              "• Enable auto-deposit for consistent savings\n" +
              "• Check Analytics weekly for insights\n" +
              "• Export CSV for external analysis\n\n" +
              "===================\n\n" +
              "🆘 *Format Examples*\n\n" +
              "*Balances:* Cash 1000 | Wallet 500 USD\n" +
              "*Debts:* John 500 | Maria 200 EUR\n" +
              "*Goals:* Laptop 2000 | Vacation 5000 USD\n" +
              "*Natural:* 50 coffee | spent 100 lunch\n\n" +
              "Version: 0.2 | Multi-currency support\n" +
              "Built with ❤️ for personal finance management",
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
          return

        case t(lang, "settings.incomeSources"):
          //TODO?
          wizardManager.setState(userId, {
            step: "INCOME_VIEW",
            data: {},
            returnTo: "settings",
            lang: lang,
          })
          await menus.showIncomeSourcesMenu(bot, chatId, userId, lang)
          return

        case t(lang, "settings.clearData"):
          wizardManager.setState(userId, {
            step: "CONFIRM_CLEAR_DATA",
            data: {},
            returnTo: "advanced",
            lang: lang,
          })

          bot.sendMessage(
            chatId,
            "⚠️ *WARNING*\n\nThis will permanently delete:\n" +
              "• All transactions\n" +
              "• All balances\n" +
              "• All debts\n" +
              "• All goals\n" +
              "• All income sources\n" +
              "• All settings\n\n" +
              "❗ This action CANNOT be undone!\n\n" +
              "Are you sure you want to continue?",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "settings.yesDeleteEverything") }],
                  [{ text: t(lang, "common.noCancel") }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return

        case t(lang, "settings.notifications"):
          wizardManager.setState(userId, {
            step: "NOTIFICATIONS_MENU",
            data: {},
            returnTo: "automation",
            lang: lang,
          })
          await handlers.handleNotificationsMenu(wizardManager, chatId, userId)
          return

        case t(lang, "automation.recurringPayments"):
          await handlers.handleRecurringMenu(
            wizardManager,
            chatId,
            userId,
            lang
          )
          return

        case t(lang, "advanced.customMessages"):
          await handlers.handleCustomMessagesMenu(wizardManager, chatId, userId)
          return

        case t(lang, "advanced.uploadStatement"):
          wizardManager.setState(userId, {
            step: "UPLOAD_STATEMENT",
            data: {},
            returnTo: "advanced",
            lang: lang,
          })

          await bot.sendMessage(
            chatId,
            "📥 *Upload Bank Statement*\n\n" +
              "**Supported formats:**\n" +
              "• Tinkoff - CSV\n" +
              "• Monobank - CSV/JSON\n" +
              "• Revolut - CSV\n" +
              "• Wise - TXT\n\n" +
              "Please upload your statement file:",
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
          return

        case t(lang, "settings.changeCurrency"): {
          const currentCurr = await db.getDefaultCurrency(userId)

          //TODO?
          wizardManager.setState(userId, {
            step: "CURRENCY_SELECT",
            data: {},
            returnTo: "settings",
            lang: lang,
          })

          bot.sendMessage(
            chatId,
            `💱 *Currency Settings*\n\nCurrent: ${currentCurr}\n\nSelect your default currency:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [
                  [{ text: "USD 🇺🇸" }, { text: "EUR 🇪🇺" }],
                  [{ text: "GEL 🇬🇪" }, { text: "RUB 🇷🇺" }],
                  [{ text: "UAH 🇺🇦" }, { text: "PLN 🇵🇱" }],
                  [
                    { text: t(lang, "common.back") },
                    { text: t(lang, "mainMenu.mainMenuButton") },
                  ],
                ],
                resize_keyboard: true,
              },
            }
          )
          return
        }
        case t(lang, "settings.yesDeleteEverything"): {
          try {
            await db.clearAllUserData(userId)
            bot.sendMessage(
              chatId,
              "👋 *Welcome to Personal Finance Bot!*\n\n" +
                "📊 Track your money with ease:\n" +
                "• 💸 Record expenses and income\n" +
                "• 💰 Manage multiple accounts\n" +
                "• 📉 Track debts\n" +
                "• 🎯 Set financial goals\n" +
                "• 📈 View statistics\n\n" +
                "Ready to take control of your finances?",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [[{ text: "💰 Start tracking" }]],
                  resize_keyboard: true,
                },
              }
            )
          } catch (error) {
            console.error("Error clearing user ", error)
            bot.sendMessage(chatId, t(lang, "errors.clearingData"), {
              reply_markup: getSettingsKeyboard(lang),
            })
          }
          return
        }
        case t(lang, "settings.yesChange"): {
          const state = wizardManager.getState(userId)
          if (state?.step === "SETTINGS_CURRENCY_CONFIRM") {
            if (!state.data) return
            const { newCurrency, balancesCount } = state.data

            await db.setDefaultCurrency(userId, newCurrency)

            if (balancesCount > 0) {
              await db.convertAllBalancesToCurrency(userId, newCurrency)
              bot.sendMessage(
                chatId,
                `✅ Default currency set to ${newCurrency}\n🔄 ${balancesCount} balance(s) converted to ${newCurrency}`,
                {
                  reply_markup: getSettingsKeyboard(lang),
                }
              )
            } else {
              bot.sendMessage(
                chatId,
                `✅ Default currency set to ${newCurrency}`,
                {
                  reply_markup: getSettingsKeyboard(lang),
                }
              )
            }

            wizardManager.clearState(userId)
          }
          return
        }
        case t(lang, "common.cancel"): {
          bot.sendMessage(chatId, t(lang, "common.cancelled"), {
            reply_markup: getSettingsKeyboard(lang),
          })
          return
        }
        case t(lang, "common.noCancel"): {
          bot.sendMessage(chatId, t(lang, "common.cancelled"))
          await menus.showAdvancedMenu(wizardManager, chatId, userId, lang)
          return
        }

        default: {
          // CHANGE CURRENCY
          if (text.match(/^(USD|EUR|GEL|RUB|UAH|PLN) /)) {
            const currency = text.split(" ")[0] as Currency
            const oldCurrency = await db.getDefaultCurrency(userId)

            if (oldCurrency !== currency) {
              const balancesCount = (await db.getBalancesList(userId)).length

              await wizardManager.goToStep(
                userId,
                "SETTINGS_CURRENCY_CONFIRM",
                {
                  newCurrency: currency,
                  balancesCount,
                }
              )

              bot.sendMessage(
                chatId,
                `⚠️ *Currency Change Confirmation*\n\n` +
                  `Change from *${oldCurrency}* to *${currency}*?\n\n` +
                  `This will affect:\n` +
                  (balancesCount > 0
                    ? `• ${balancesCount} balance(s) will be converted to ${currency}\n`
                    : "") +
                  `• Statistics display\n\n` +
                  `Are you sure?`,
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    keyboard: [
                      [{ text: t(lang, "settings.yesChange") }],
                      [{ text: "❌ Cancel" }],
                    ],
                    resize_keyboard: true,
                  },
                }
              )
            } else {
              bot.sendMessage(
                chatId,
                `ℹ️ ${currency} is already your current currency.`,
                {
                  reply_markup: getSettingsKeyboard(lang),
                }
              )
            }
            return
          }

          const userData = await db.getUserData(userId)
          const currentState = wizardManager.getState(userId)
          const returnTo = currentState?.returnTo

          if (returnTo === "debts") {
            const debt = userData.debts.find(
              (d: Debt) => d.name === text && !d.isPaid
            )
            if (debt) {
              await wizardManager.goToStep(userId, "DEBT_MENU", {
                debt,
                debtId: debt.id,
              })

              const { amount, paidAmount, type, dueDate, name, currency } = debt
              let msg = ""
              const remaining = amount - paidAmount
              const progress = createProgressBar(paidAmount, amount)
              const emoji = type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
              const action = type === "I_OWE" ? "pay" : "receive"

              msg += `${emoji} *${name}*\n`
              msg += `${progress}\n`

              if (paidAmount === 0) {
                msg += `Total: ${formatMoney(amount, currency)}\n`
              } else if (remaining > 0) {
                msg += `Remaining: ${formatMoney(remaining, currency)}\n`
              } else {
                msg += `🎉 Debt paid!\n`
              }

              if (dueDate) {
                const deadlineDate = new Date(dueDate)
                msg += `Due: ${deadlineDate.toLocaleDateString("en-GB")}\n`
              }

              msg += `\n💡 Enter amount to ${action}`

              const deadlineButtons = dueDate
                ? [[{ text: "⚙️ Advanced" }]]
                : [[{ text: t(lang, "goals.setDeadlineBtn") }]]

              bot.sendMessage(chatId, msg, {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "✏️ Edit Amount" }],
                    ...deadlineButtons,
                    [{ text: "🗑 Delete Debt" }],
                    [
                      { text: t(lang, "common.back") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ],
                  resize_keyboard: true,
                },
              })
              return
            }
          }

          if (returnTo === "goals" || !returnTo) {
            const goal = userData.goals.find(
              (g: Goal) => g.name === text && g.status === "ACTIVE"
            )
            if (goal) {
              await wizardManager.goToStep(userId, "GOAL_MENU", {
                goal,
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
                msg += `Deadline: ${deadlineDate.toLocaleDateString("en-GB")}\n`
              }

              if (autoDeposit?.enabled) {
                const { amount, accountId, frequency, dayOfWeek, dayOfMonth } =
                  autoDeposit
                const dayNames = [
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ]
                const scheduleStr =
                  frequency === "WEEKLY"
                    ? `every ${dayNames[dayOfWeek || 0]}`
                    : `on day ${dayOfMonth} of each month`
                msg += `🤖 Auto-deposit: ${formatMoney(amount, currency)} from ${accountId} ${scheduleStr}\n`
              }

              msg += `\n💡 Enter amount to deposit:`

              const deadlineButtons = deadline
                ? [[{ text: "⚙️ Advanced" }]]
                : [[{ text: t(lang, "goals.setDeadlineBtn") }]]
              bot.sendMessage(chatId, msg, {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "✏️ Edit Target" }],
                    ...deadlineButtons,
                    [{ text: "🗑 Delete Goal" }],
                    [
                      { text: t(lang, "common.back") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ],
                  resize_keyboard: true,
                },
              })
              return
            }
          }

          break
        }
      }

      const userState = wizardManager.getState(userId)
      if (userState && userState.step !== "NONE") {
        await wizardManager.handleWizardInput(chatId, userId, text)
        return
      }
    })
    bot.on("document", async (msg) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()

      const state = wizardManager.getState(userId)

      if (state?.step === "UPLOAD_STATEMENT") {
        await handlers.handleStatementUpload(bot, msg, userId, wizardManager)
      } else {
        await bot.sendMessage(
          chatId,
          "ℹ️ To upload a bank statement, go to:\n⚙️ Settings → 📥 Upload Statement"
        )
      }
    })
    bot.on("voice", async (msg) => {
      await handlers.handleVoiceMessage(bot, msg, wizardManager)
    })
    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id
      if (!chatId) return
      const userId = chatId.toString()
      const data = query.data || ""

      if (data.startsWith("nlp_")) {
        await handlers.handleNLPCallback(bot, query, wizardManager)
        return
      }
      if (data.startsWith("tmpl_save|")) {
        await handlers.handleTemplateSave(
          bot,
          query,
          userId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_use|")) {
        await handlers.handleTemplateUse(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_manage|")) {
        await handlers.handleTemplateManage(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_del|")) {
        await handlers.handleTemplateDelete(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_edit_amt|")) {
        await handlers.handleTemplateEditAmount(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_edit_acc|")) {
        await handlers.handleTemplateEditAccount(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_set_acc|")) {
        await handlers.handleTemplateSetAccount(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data.startsWith("tmpl_cancel|")) {
        await handlers.handleTemplateCancelEdit(
          bot,
          query,
          userId,
          chatId,
          data,
          wizardManager
        )
        return
      }
      if (data === "tmpl_list") {
        wizardManager.clearState(userId)
        await safeAnswerCallback(bot, { callback_query_id: query.id })
        await handlers.showTemplatesList(bot, chatId, userId)
        return
      }
      if (data.startsWith("acc_change|")) {
        const txId = data.replace("acc_change|", "")
        const balances = await db.getBalancesList(userId)

        if (balances.length === 0) {
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: "⚠️ No balances found",
            show_alert: true,
          })
          return
        }

        const buttons: TelegramBot.InlineKeyboardButton[][] = balances.map(
          (bal) => [
            {
              text: `💳 ${bal.accountId} — ${formatMoney(bal.amount, bal.currency)}`,
              callback_data: `acc_set|${txId}|${bal.accountId}`,
            },
          ]
        )

        await safeAnswerCallback(bot, { callback_query_id: query.id })
        await bot.sendMessage(chatId, "💳 *Select account:*", {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: buttons,
          },
        })
        return
      }
      if (data.startsWith("acc_set|")) {
        const parts = data.split("|")
        const txId = parts[1]
        const newAccountId = parts[2]

        const result = await db.changeTransactionAccount(
          userId,
          txId!,
          newAccountId!
        )

        if (result.success) {
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: "✅ Account updated",
            show_alert: false,
          })
          await bot.sendMessage(
            chatId,
            `✅ Transaction account changed to *${newAccountId}*`,
            { parse_mode: "Markdown" }
          )
        } else {
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: `❌ ${result.message || "Failed to update"}`,
            show_alert: true,
          })
        }
        return
      }
      if (data.startsWith("tx_del_")) {
        const txId = data.replace("tx_del_", "")
        const success = await db.deleteTransaction(userId, txId)
        if (success) {
          bot.sendMessage(
            chatId,
            "✅ Transaction deleted and balance rolled back."
          )
        } else {
          bot.sendMessage(chatId, "❌ Could not delete transaction.")
        }
      }
      if (data.startsWith("reminder_snooze|")) {
        const parts = data.split("|")
        const reminderId = parts[1]
        const duration = parts[2] as "1h" | "1d"

        const success = await reminderManager.snoozeReminder(
          reminderId!,
          duration
        )

        if (success) {
          const durationText = duration === "1h" ? "1 hour" : "1 day"
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: `⏰ Reminder snoozed for ${durationText}`,
            show_alert: false,
          })

          // Edit message to remove buttons
          if (query.message) {
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              {
                chat_id: chatId,
                message_id: query.message.message_id,
              }
            )
          }
        } else {
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: "❌ Failed to snooze reminder",
            show_alert: true,
          })
        }
        return
      }
      if (data.startsWith("reminder_done|")) {
        const reminderId = data.replace("reminder_done|", "")

        const success = await reminderManager.completeReminder(reminderId)

        if (success) {
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: "✅ Reminder marked as done",
            show_alert: false,
          })

          // Edit message to remove buttons
          if (query.message) {
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              {
                chat_id: chatId,
                message_id: query.message.message_id,
              }
            )
          }
        } else {
          await safeAnswerCallback(bot, {
            callback_query_id: query.id,
            text: "❌ Failed to mark reminder as done",
            show_alert: true,
          })
        }
        return
      }
    })
  } catch (error) {
    console.error("❌ Failed to start bot:", error)
    process.exit(1)
  }
}

startBot()

export { bot }
