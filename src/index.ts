import 'dotenv/config'
import "reflect-metadata"
import TelegramBot from "node-telegram-bot-api"
import { TransactionType, Debt, Goal, Currency } from "./types"
import { dbStorage as db } from "./database/storage-db"
import { initializeDatabase, closeDatabase } from "./database/data-source"
import { createProgressBar, formatMonthlyStats, getProgressEmoji } from "./reports"
import { WizardManager } from "./wizards/wizards"
import { preloadRates, stopAutoRefresh } from "./fx"
import { MAIN_MENU_KEYBOARD, SETTINGS_KEYBOARD } from "./constants"
import * as menus from "./menus"
import { createListButtons, formatMoney, safeAnswerCallback } from "./utils"
import { registerCommands } from "./commands"
import * as handlers from "./handlers"
import { handleAutoDepositToggle } from "./handlers/auto-deposit-handlers"
import { Scheduler } from "./services/scheduler"
import { reminderManager } from "./services/reminder-manager"
import { logConfig } from './config'
import { securityCheck } from './security'
import { setupGlobalErrorHandlers } from './error-handler'
import { log } from './logger'

setupGlobalErrorHandlers()

// TODO: try to fix warning in future
process.env.NTBA_FIX_350 = "1"

// Load bot token from environment
const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables')
  console.error('Please add TELEGRAM_BOT_TOKEN to your .env file')
  process.exit(1)
}

async function startBot() {
  try {
    await initializeDatabase()

    await preloadRates()

    const bot = new TelegramBot(token, { polling: true })
    const wizardManager = new WizardManager(bot)

    registerCommands(bot)

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
      log.info("✅ Bot stopped")
      process.exit(0)
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    // Handle Text Messages
    bot.on("message", async (msg) => {
      // Security check (whitelist + rate limiting)
      if (!securityCheck(bot, msg)) {
        return // Blocked
      }

      const chatId = msg.chat.id
      const userId = chatId.toString()
      const text = msg.text?.trim()

      if (!text) return

      if ((
        /^\d+\s+\w+/.test(text) ||  // "50 coffee"
        /потратил|витратив|spent|получил|отримав|received|зарплата/i.test(text)
      )) {
        await handlers.handleNLPInput(bot, chatId, userId, text)
        return
      }

      // Keyboard Menu Handlers
      switch (text) {
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
              "👋 Welcome back! Select an option:",
              MAIN_MENU_KEYBOARD
            )
          } else {
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
          }
          break
        }

        case "💰 Start tracking": {
          bot.sendMessage(
            chatId,
            "🎉 *Great! Let's get started!*\n\n" +
            "📄 *Quick Start Guide:*\n" +
            "1️⃣ Add your first account in 💰 *Balances*\n" +
            "2️⃣ Record transactions via 💸 *Expense* and 💰 *Income*\n" +
            "3️⃣ View your stats in 📈 *Stats*\n\n" +
            "You can start by adding a balance account!",
            {
              parse_mode: "Markdown",
              ...MAIN_MENU_KEYBOARD,
            }
          )
          break
        }

        // MAIN MENU
        // TRANSACTIONS
        case "✨ Add Another Expense":
        case "💸 Expense": {
          const balanceCount = (await db.getBalancesList(userId)).length

          if (balanceCount === 0) {
            bot.sendMessage(
              chatId,
              "⚠️ *No Balances Found*\n\n" +
              "Before adding transactions, you need at least one balance account.\n\n" +
              "💡 *Quick Start:*\n" +
              "1️⃣ Go to 💰 *Balances*\n" +
              "2️⃣ Tap ✨ *Add Balance*\n" +
              "3️⃣ Enter account name and amount",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "💳 Go to Balances" }],
                    [{ text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            break
          }

          wizardManager.setState(userId, {
            step: "TX_AMOUNT",
            txType: TransactionType.EXPENSE,
            data: {},
            returnTo: "main",
          })

          const currency = await db.getDefaultCurrency(userId)

          // Get top transaction amounts
          const topAmounts = await db.getTopTransactionAmounts(
            userId,
            TransactionType.EXPENSE,
            5
          )

          const denominations = db.getCurrencyDenominations(currency)

          const topValues = topAmounts.map(a => a.amount)
          const standardValues = denominations.filter(d => !topValues.includes(d))

          const allAmounts = [
            ...topAmounts.map(({ amount }) => amount),
            ...standardValues
          ].slice(0, 5)

          const buttons: TelegramBot.KeyboardButton[][] = []

          for (let i = 0; i < allAmounts.length; i += 3) {
            const row = allAmounts
              .slice(i, i + 3)
              .map((amount) => ({
                text: `${formatMoney(amount, currency, true)}`
              }))
            buttons.push(row)
          }
          buttons.push([{ text: "🏠 Main Menu" }])

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
          break
        }

        case "✨ Add Another Income":
        case "💰 Income": {
          const balanceCount = (await db.getBalancesList(userId)).length

          if (balanceCount === 0) {
            bot.sendMessage(
              chatId,
              "⚠️ *No Balances Found*\n\n" +
              "Before adding transactions, you need at least one balance account.\n\n" +
              "💡 *Quick Start:*\n" +
              "1️⃣ Go to 💰 *Balances*\n" +
              "2️⃣ Tap ✨ *Add Balance*\n" +
              "3️⃣ Enter account name and amount",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "💳 Go to Balances" }],
                    [{ text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            break
          }

          wizardManager.setState(userId, {
            step: "TX_AMOUNT",
            txType: TransactionType.INCOME,
            data: {},
            returnTo: "main",
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
          const topValues = topAmounts.map(a => a.amount)
          const standardValues = denominations.filter(d => !topValues.includes(d))

          const allAmounts = [
            ...topAmounts.map(({ amount }) => amount),
            ...standardValues
          ].slice(0, 5)

          const buttons: TelegramBot.KeyboardButton[][] = []

          for (let i = 0; i < allAmounts.length; i += 3) {
            const row = allAmounts
              .slice(i, i + 3)
              .map((amount) => ({
                text: `${formatMoney(amount, currency, true)}`
              }))
            buttons.push(row)
          }
          buttons.push([{ text: "🏠 Main Menu" }])

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
          break
        }

        // BALANCES
        case "💳 Balances":
        case "💳 Go to Balances":
          wizardManager.setState(userId, {
            step: "BALANCE_LIST",
            data: {},
            returnTo: "balances",
          })
          await menus.showBalancesMenu(wizardManager, chatId, userId)
          break

        case "✨ Add Balance": {
          wizardManager.setState(userId, {
            step: "BALANCE_NAME",
            data: {},
            returnTo: "balances",
          })
          bot.sendMessage(
            chatId,
            "💳 *Add Balance Account*\n\n" +
            "Enter account name (e.g., Main Card, Cash, Savings):",
            {
              parse_mode: "Markdown",
              ...wizardManager.getBackButton(),
            }
          )
          break
        }


        case "↔️ Transfer": {
          await wizardManager.goToStep(userId, "TX_AMOUNT", {
            txType: TransactionType.TRANSFER,
          })

          const currency = await db.getDefaultCurrency(userId)
          const denominations = db.getCurrencyDenominations(currency)
          const { txType } = wizardManager.getState(userId)

          const items = denominations.map((v: number) => `${formatMoney(v, currency, true)}`)

          const listButtons = createListButtons({
            items,
            itemsPerRowCustom: 3,
          })

          const titleWithEmoji =
            txType === TransactionType.EXPENSE
              ? "💸 *Expense*"
              : txType === TransactionType.INCOME
                ? "💰 *Income*"
                : "↔️ *Transfer*"
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
          break
        }

        // DEBTS
        case "📉 Debts":
          wizardManager.setState(userId, {
            step: "NONE",
            data: {},
            returnTo: "debts",
          })
          await menus.showDebtsMenu(bot, chatId, userId)
          break

        case "✨ Add Debt":
          // TODO?
          wizardManager.setState(userId, {
            step: "DEBT_TYPE",
            data: {},
            returnTo: "debts",
          })
          bot.sendMessage(chatId, "Select debt type:", {
            reply_markup: {
              keyboard: [
                [{ text: "🔴 I Owe" }, { text: "🟢 They Owe Me" }],
                [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          })
          break

        // GOALS
        case "🎯 Goals":
          wizardManager.setState(userId, {
            step: "NONE",
            data: {},
            returnTo: "goals",
          })
          await menus.showGoalsMenu(bot, chatId, userId)
          break

        case "✨ Add Goal": {
          // TODO?
          wizardManager.setState(userId, {
            step: "GOAL_INPUT",
            data: {},
            returnTo: "goals",
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
              ...wizardManager.getBackButton(),
            }
          )
          break
        }

        case "✅ Completed Goals": {
          const userData = await db.getUserData(userId)
          const completedGoals = userData.goals.filter(
            (g: Goal) => g.status === "COMPLETED"
          )

          let msg = "✅ *Completed Goals*\n\n"
          if (completedGoals.length === 0) {
            msg += "💭 No completed goals yet."
          } else {
            completedGoals.forEach((g: Goal, i) => {
              msg += `${i + 1}. *${g.name}*\n`
              msg += `Target: ${g.targetAmount} ${g.currency}\n`
              msg += `Achieved: ${g.currentAmount} ${g.currency}\n\n`
            })
          }

          const goalRows: TelegramBot.KeyboardButton[][] = []
          completedGoals.forEach((g: Goal) => {
            goalRows.push([{ text: `✅ Goal: ${g.name}` }])
          })
          goalRows.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

          // TODO?
          wizardManager.setState(userId, {
            step: "GOAL_COMPLETED_SELECT",
            data: {},
            returnTo: "goals",
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

        // ANALYTICS
        case "📊 Analytics":
          await menus.showStatsMenu(bot, chatId)
          break

        case "📈 Reports": {
          // TODO?
          wizardManager.setState(userId, {
            step: "ANALYTICS_REPORTS_MENU",
            data: {},
            returnTo: "analytics",
          })

          const statsMsg = await formatMonthlyStats(userId)

          bot.sendMessage(chatId, statsMsg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📅 Export CSV" }],
                [{ text: "🔍 Filters" }],
                [{ text: "📈 Trends" }],
                [{ text: "📉 Top Categories" }],
                [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          })
          break
        }
        case "💎 Net Worth": {
          //TODO?
          wizardManager.setState(userId, {
            step: "NET_WORTH_VIEW",
            data: { view: 'summary' },
            returnTo: "analytics",
          })
          await menus.showNetWorthMenu(bot, chatId, userId, 'summary')
          break
        }

        // Обработчики для табов Net Worth
        case "💳 Assets": {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, 'assets')
          }
          break
        }

        case "💰 Debts": {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, 'debts')
          }
          break
        }

        case "📋 Full Report":
        case "📋 Full": {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, 'full')
          }
          break
        }

        case "📊 Summary": {
          const state = wizardManager.getState(userId)
          if (state?.step === "NET_WORTH_VIEW") {
            await menus.showNetWorthMenu(bot, chatId, userId, 'summary')
          }
          break
        }


        // SETTINGS
        case "⚙️ Settings":
          await menus.showSettingsMenu(bot, chatId, userId)
          break

        case "🤖 Automation":
          await menus.showAutomationMenu(wizardManager, chatId, userId)
          break

        case "🛠️ Advanced":
          await menus.showAdvancedMenu(wizardManager, chatId, userId)
          break

        case "🌐 Change currency": {
          const currentCurr = await db.getDefaultCurrency(userId)

          //TODO?
          wizardManager.setState(userId, {
            step: "CURRENCY_SELECT",
            data: {},
            returnTo: "settings",
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
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          break
        }

        case "❓ Help & Info": {
          wizardManager.setState(userId, {
            step: "HELP_VIEW",
            data: {},
            returnTo: "settings",
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
            "• Natural language: \"50 coffee\"\n\n" +
            "💳 *Balances*\n" +
            "• Manage multiple accounts\n" +
            "• Format: \"Cash 1000 USD\" or just \"Cash\"\n" +
            "• Edit and transfer between accounts\n" +
            "• Auto currency conversion\n\n" +
            "📉 *Debts*\n" +
            "• Track money you owe or are owed\n" +
            "• Format: \"John 500 USD\"\n" +
            "• Set due dates and reminders\n" +
            "• Partial payments supported\n\n" +
            "🎯 *Goals*\n" +
            "• Set savings targets\n" +
            "• Format: \"Laptop 2000 USD\"\n" +
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
                keyboard: [[
                  { text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
                resize_keyboard: true,
              },
            }
          )
          break
        }


        case "💵 Income Sources":
          //TODO?
          wizardManager.setState(userId, {
            step: "INCOME_VIEW",
            data: {},
            returnTo: "settings",
          })
          await menus.showIncomeSourcesMenu(bot, chatId, userId)
          break

        // HISTORY
        case "📋 History":
          //TODO?
          wizardManager.setState(userId, {
            step: "HISTORY_LIST",
            data: {},
            returnTo: "main",
          })
          await menus.showHistoryMenu(wizardManager, chatId, userId)
          break

        case "🔍 Filters":
          //TODO?
          wizardManager.setState(userId, {
            step: "TX_VIEW_PERIOD",
            data: {},
            returnTo: "history",
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
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          break

        case "🗑️ Clear All Data": {
          wizardManager.setState(userId, {
            step: "CONFIRM_CLEAR_DATA",
            data: {},
            returnTo: "advanced"
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
                  [{ text: "✅ Yes, delete everything" }],
                  [{ text: "❌ No, cancel" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          break
        }

        case "✅ Yes, delete everything": {
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
            bot.sendMessage(
              chatId,
              "❌ Error clearing data. Please try again.",
              {
                reply_markup: SETTINGS_KEYBOARD,
              }
            )
          }
          break
        }

        case "❌ Cancel": {
          bot.sendMessage(chatId, "✅ Cancelled.", {
            reply_markup: SETTINGS_KEYBOARD,
          })
          break
        }

        case "❌ No, cancel": {
          bot.sendMessage(chatId, "✅ Cancelled.")
          await menus.showAdvancedMenu(wizardManager, chatId, userId)
          break
        }


        case "✅ Yes, change": {
          const state = wizardManager.getState(userId)
          if (state?.step === "SETTINGS_CURRENCY_CONFIRM") {
            const { newCurrency, balancesCount } = state.data

            await db.setDefaultCurrency(userId, newCurrency)

            if (balancesCount > 0) {
              await db.convertAllBalancesToCurrency(userId, newCurrency)
              bot.sendMessage(
                chatId,
                `✅ Default currency set to ${newCurrency}\n🔄 ${balancesCount} balance(s) converted to ${newCurrency}`,
                {
                  reply_markup: SETTINGS_KEYBOARD,
                }
              )
            } else {
              bot.sendMessage(
                chatId,
                `✅ Default currency set to ${newCurrency}`,
                {
                  reply_markup: SETTINGS_KEYBOARD,
                }
              )
            }

            wizardManager.clearState(userId)
          }
          break
        }

        case "🔁 Recurring Payments": {
          await handlers.handleRecurringMenu(wizardManager, chatId, userId)
          break
        }

        case "📝 Custom Messages": {
          await handlers.handleCustomMessagesMenu(wizardManager, chatId, userId)
          break
        }

        // UPLOAD STATEMENT
        case "📥 Upload Statement": {
          wizardManager.setState(userId, {
            step: "UPLOAD_STATEMENT",
            data: {},
            returnTo: "advanced",
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
                  [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          break
        }



        // BUDGET PLANNER
        case "🔮 Budget Planner": {
          await menus.showBudgetMenu(wizardManager, chatId, userId)
          break
        }

        // MAIN MENU
        case "🏠 Main Menu":
          wizardManager.clearState(userId)
          await menus.showMainMenu(bot, chatId)
          break

        // NOTIFICATIONS
        case "🔔 Notifications": {
          wizardManager.setState(userId, {
            step: "NOTIFICATIONS_MENU",
            data: {},
            returnTo: "automation",
          })
          await handlers.handleNotificationsMenu(wizardManager, chatId, userId)
          break
        }



        case "📅 Set Due Date":
        case "📅 Change Due Date": {
          const state = wizardManager.getState(userId)
          if ((state?.step === "DEBT_MENU" || state?.step === "DEBT_ADVANCED_MENU") && state.data?.debt) {
            await wizardManager.goToStep(userId, "DEBT_EDIT_DUE_DATE", state.data)
            bot.sendMessage(
              chatId,
              `📅 *${text === "📅 Set Due Date" ? "Set" : "Change"} Due Date*\n\n` +
              `Enter new due date (DD.MM.YYYY):\n` +
              `Example: 31.12.2026\n\n` +
              (text === "📅 Change Due Date" ? `Or tap 🗑 Remove to delete due date.` : `Or tap ⏩ Skip to cancel.`),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    text === "📅 Change Due Date" ? [{ text: "🗑 Remove Date" }] : [{ text: "⏩ Skip" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ].filter(row => row.length > 0),
                  resize_keyboard: true,
                },
              }
            )
          }
          break
        }

        case "📅 Set Deadline":
        case "📅 Change Deadline": {
          const state = wizardManager.getState(userId)
          if ((state?.step === "GOAL_MENU" || state?.step === "GOAL_ADVANCED_MENU") && state.data?.goal) {
            await wizardManager.goToStep(userId, "GOAL_EDIT_DEADLINE", state.data)
            bot.sendMessage(
              chatId,
              `📅 *${text === "📅 Set Deadline" ? "Set" : "Change"} Deadline*\n\n` +
              `Enter new deadline (DD.MM.YYYY):\n` +
              `Example: 31.12.2026\n\n` +
              (text === "📅 Change Deadline" ? `Or tap 🗑 Remove to delete deadline.` : `Or tap ⏩ Skip to cancel.`),
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    text === "📅 Change Deadline" ? [{ text: "🗑 Remove Date" }] : [{ text: "⏩ Skip" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ].filter(row => row.length > 0),
                  resize_keyboard: true,
                },
              }
            )
          }
          break
        }

        case "🔕 Disable Reminders": {
          const state = wizardManager.getState(userId)
          if ((state?.step === "DEBT_MENU" || state?.step === "DEBT_ADVANCED_MENU") && state.data?.debt) {
            const debt = state.data.debt as Debt
            await reminderManager.deleteRemindersForEntity(userId, debt.id)
            await db.updateDebtDueDate(userId, debt.id, null)
            bot.sendMessage(
              chatId,
              "✅ Reminders disabled and due date removed.",
              wizardManager.getBackButton()
            )
            await menus.showDebtsMenu(bot, chatId, userId)
            wizardManager.clearState(userId)
          } else if ((state?.step === "GOAL_MENU" || state?.step === "GOAL_ADVANCED_MENU") && state.data?.goal) {
            const goal = state.data.goal as Goal
            await reminderManager.deleteRemindersForEntity(userId, goal.id)
            await db.updateGoalDeadline(userId, goal.id, null)
            bot.sendMessage(
              chatId,
              "✅ Reminders disabled and deadline removed.",
              wizardManager.getBackButton()
            )
            await menus.showGoalsMenu(bot, chatId, userId)
            wizardManager.clearState(userId)
          }
          break
        }

        case "✅ Enable Auto-Deposit":
        case "❌ Disable Auto-Deposit": {
          const state = wizardManager.getState(userId)
          if ((state?.step === "GOAL_MENU" || state?.step === "GOAL_ADVANCED_MENU") && state.data?.goal) {
            await handleAutoDepositToggle(wizardManager, chatId, userId, text)
          }
          break
        }

        case "✅ Enable Auto-Payment":
        case "❌ Disable Auto-Payment": {
          const state = wizardManager.getState(userId)
          if ((state?.step === "DEBT_MENU" || state?.step === "DEBT_ADVANCED_MENU") && state.data?.debt) {
            // TODO: Implement auto-payment toggle similar to auto-deposit
            bot.sendMessage(
              chatId,
              "⚠️ Auto-payment feature is coming soon!",
              wizardManager.getBackButton()
            )
          }
          break
        }

        case "⚙️ Advanced": {
          const state = wizardManager.getState(userId)

          if (state?.step === "GOAL_MENU" && state.data?.goal) {
            const goal = state.data.goal as Goal
            const { deadline, autoDeposit } = goal

            await wizardManager.goToStep(userId, "GOAL_ADVANCED_MENU", state.data)

            bot.sendMessage(
              chatId,
              `⚙️ *Advanced Settings*\n\n${goal.name}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: deadline ? [
                    [{ text: "📅 Change Deadline" }],
                    [{ text: "🔕 Disable Reminders" }],
                    [{ text: autoDeposit?.enabled ? "❌ Disable Auto-Deposit" : "✅ Enable Auto-Deposit" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ] : [
                    [{ text: "📅 Set Deadline" }],
                    [{ text: autoDeposit?.enabled ? "❌ Disable Auto-Deposit" : "✅ Enable Auto-Deposit" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
          } else if (state?.step === "DEBT_MENU" && state.data?.debt) {
            const debt = state.data.debt as Debt
            const { dueDate, autoPayment } = debt

            await wizardManager.goToStep(userId, "DEBT_ADVANCED_MENU", state.data)

            bot.sendMessage(
              chatId,
              `⚙️ *Advanced Settings*\n\n${debt.name}`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: dueDate ? [
                    [{ text: "📅 Change Due Date" }],
                    [{ text: "🔕 Disable Reminders" }],
                    [{ text: autoPayment?.enabled ? "❌ Disable Auto-Payment" : "✅ Enable Auto-Payment" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ] : [
                    [{ text: "📅 Set Due Date" }],
                    [{ text: autoPayment?.enabled ? "❌ Disable Auto-Payment" : "✅ Enable Auto-Payment" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
          }
          break
        }

        default: {
          // CHANGE CURRENCY
          if (text.match(/^(USD|EUR|GEL|RUB|UAH|PLN) /)) {
            const currency = text.split(" ")[0] as Currency
            const oldCurrency = await db.getDefaultCurrency(userId)

            if (oldCurrency !== currency) {
              const balancesCount = (await db.getBalancesList(userId)).length

              await wizardManager.goToStep(userId, "SETTINGS_CURRENCY_CONFIRM", {
                newCurrency: currency,
                balancesCount,
              })

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
                      [{ text: "✅ Yes, change" }],
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
                  reply_markup: SETTINGS_KEYBOARD,
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
                msg += `🎉 Debt paid!\n`
              }

              if (dueDate) {
                const deadlineDate = new Date(dueDate)
                msg += `Due: ${deadlineDate.toLocaleDateString('en-GB')}\n`
              }

              msg += `\n💡 Enter amount to ${action}`

              const deadlineButtons = dueDate ?
                [
                  [{ text: "⚙️ Advanced" }]
                ]
                : [[{ text: "📅 Set Deadline" }]]

              bot.sendMessage(
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
                    ],
                    resize_keyboard: true,
                  },
                }
              )
              return
            }
          }

          const goal = userData.goals.find(
            (g: Goal) => g.name === text && g.status === "ACTIVE"
          )
          if (goal) {
            await wizardManager.goToStep(userId, "GOAL_MENU", {
              goal,
              goalId: goal.id,
            })

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

            if (autoDeposit?.enabled) {
              const { amount, accountId, frequency, dayOfWeek, dayOfMonth } = autoDeposit
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              const scheduleStr = frequency === 'WEEKLY'
                ? `every ${dayNames[dayOfWeek || 0]}`
                : `on day ${dayOfMonth} of each month`
              msg += `🤖 Auto-deposit: ${formatMoney(amount, currency)} from ${accountId} ${scheduleStr}\n`
            }

            msg += `\n💡 Enter amount to deposit:`

            const deadlineButtons = deadline ?
              [[{ text: "⚙️ Advanced" }]]
              : [[{ text: "📅 Set Deadline" }]]
            bot.sendMessage(
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
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return
          }

          // ✅ Check DEBTS as fallback if not from goals menu
          if (returnTo !== "goals") {
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
                msg += `🎉 Debt paid!\n`
              }

              if (dueDate) {
                const deadlineDate = new Date(dueDate)
                msg += `Due: ${deadlineDate.toLocaleDateString('en-GB')}\n`
              }

              msg += `\n💡 Enter amount to ${action}`

              const deadlineButtons = dueDate ?
                [
                  [{ text: "⚙️ Advanced" }]
                ]
                : [[{ text: "📅 Set Deadline" }]]

              bot.sendMessage(
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
                    ],
                    resize_keyboard: true,
                  },
                }
              )
              return
            }
          }

          break
        }
      }
    })

    // Handle document uploads
    bot.on("document", async (msg) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()

      // Check if user is in upload wizard
      const state = wizardManager.getState(userId)

      if (state?.step === "UPLOAD_STATEMENT") {
        await handlers.handleStatementUpload(bot, msg, userId)
      } else {
        await bot.sendMessage(
          chatId,
          "ℹ️ To upload a bank statement, go to:\n⚙️ Settings → 📥 Upload Statement"
        )
      }
    })

    // Handle voice messages
    bot.on("voice", async (msg) => {
      await handlers.handleVoiceMessage(bot, msg)
    })


    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id
      if (!chatId) return
      const userId = chatId.toString()
      const data = query.data || ""

      // NLP callbacks
      if (data.startsWith("nlp_")) {
        await handlers.handleNLPCallback(bot, query)
        return
      }

      if (data.startsWith("tmpl_save|")) {
        await handlers.handleTemplateSave(bot, query, userId, data)
        return
      }
      if (data.startsWith("tmpl_use|")) {
        await handlers.handleTemplateUse(bot, query, userId, chatId, data)
        return
      }
      if (data.startsWith("tmpl_manage|")) {
        await handlers.handleTemplateManage(bot, query, userId, chatId, data)
        return
      }
      if (data.startsWith("tmpl_del|")) {
        await handlers.handleTemplateDelete(bot, query, userId, chatId, data)
        return
      }
      if (data.startsWith("tmpl_edit_amt|")) {
        await handlers.handleTemplateEditAmount(bot, query, userId, chatId, data, wizardManager)
        return
      }
      if (data.startsWith("tmpl_edit_acc|")) {
        await handlers.handleTemplateEditAccount(bot, query, userId, chatId, data)
        return
      }
      if (data.startsWith("tmpl_set_acc|")) {
        await handlers.handleTemplateSetAccount(bot, query, userId, chatId, data)
        return
      }
      if (data.startsWith("tmpl_cancel|")) {
        await handlers.handleTemplateCancelEdit(bot, query, userId, chatId, data, wizardManager)
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
          await safeAnswerCallback(bot, { callback_query_id: query.id, text: "⚠️ No balances found", show_alert: true })
          return
        }

        const buttons: TelegramBot.InlineKeyboardButton[][] = balances.map((bal) => [
          {
            text: `💳 ${bal.accountId} — ${formatMoney(bal.amount, bal.currency)}`,
            callback_data: `acc_set|${txId}|${bal.accountId}`,
          },
        ])

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

        const result = await db.changeTransactionAccount(userId, txId, newAccountId)

        if (result.success) {
          await safeAnswerCallback(bot, { callback_query_id: query.id, text: "✅ Account updated", show_alert: false })
          await bot.sendMessage(
            chatId,
            `✅ Transaction account changed to *${newAccountId}*`,
            { parse_mode: "Markdown" }
          )
        } else {
          await safeAnswerCallback(bot, { callback_query_id: query.id, text: `❌ ${result.message || "Failed to update"}`, show_alert: true })
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

      // Reminder snooze/done handlers
      if (data.startsWith("reminder_snooze|")) {
        const parts = data.split("|")
        const reminderId = parts[1]
        const duration = parts[2] as '1h' | '1d'

        const success = await reminderManager.snoozeReminder(reminderId, duration)

        if (success) {
          const durationText = duration === '1h' ? '1 hour' : '1 day'
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
