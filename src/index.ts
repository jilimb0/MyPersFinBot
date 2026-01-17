import "reflect-metadata"
import TelegramBot from "node-telegram-bot-api"
import fs from "fs"
import path from "path"
import { TransactionType, Debt, Goal, Currency } from "./types"
import { dbStorage as db } from "./database/storage-db"
import { initializeDatabase, closeDatabase } from "./database/data-source"
import {
  formatMonthlyStats,
} from "./reports"
import { WizardManager } from "./wizards/wizards"
import { preloadRates, stopAutoRefresh } from "./fx"
import { MAIN_MENU_KEYBOARD, SETTINGS_KEYBOARD } from "./constants"
import * as menus from "./menus"
import { formatAmount, formatMoney, safeAnswerCallback } from "./utils"
import { registerCommands } from "./commands"
import * as templateHandlers from "./handlers"

// TODO: try to fix warning in future
process.env.NTBA_FIX_350 = "1"

// Load config securely
const configPath = path.resolve(__dirname, "../secure.json")
let token = ""

try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
  token = config.API
} catch (error) {
  console.error("Error reading secure.json:", error)
  process.exit(1)
}

if (!token) {
  console.error('Bot token not found in secure.json under key "API"')
  process.exit(1)
}

// ⚡ Инициализация БД
async function startBot() {
  try {
    // Подключаемся к SQLite
    await initializeDatabase()
    console.log("✅ Database connected")

    // Предзагрузка курсов валют
    await preloadRates()

    const bot = new TelegramBot(token, { polling: true })
    const wizardManager = new WizardManager(bot)

    registerCommands(bot)

    console.log("🚀 Bot is running...")

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n⏳ Shutting down gracefully...")
      await bot.stopPolling()
      stopAutoRefresh()
      await closeDatabase()
      console.log("✅ Bot stopped")
      process.exit(0)
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    // Handle Text Messages
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()
      const text = msg.text?.trim()

      if (!text) return

      // Check Wizard State First
      if (wizardManager.isInWizard(userId)) {
        const handled = await wizardManager.handleWizardInput(
          chatId,
          userId,
          text
        )
        if (handled) return
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

        case "↔️ Transfer": {
          const isInWizard = wizardManager.isInWizard(userId)

          if (isInWizard) {
            await wizardManager.goToStep(userId, "TX_AMOUNT", {
              txType: TransactionType.TRANSFER,
              returnTo: "balances",
            })
          } else {
            wizardManager.setState(userId, {
              step: "TX_AMOUNT",
              txType: TransactionType.TRANSFER,
              data: {},
              returnTo: "balances",
            })
          }

          const transferCurrency = await db.getDefaultCurrency(userId)
          bot.sendMessage(
            chatId,
            `Enter amount to transfer (e.g., 100 or 100 ${transferCurrency}):`,
            wizardManager.getBackButton()
          )
          break
        }

        // DEBTS
        case "📉 Debts":
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
              msg += `   Target: ${g.targetAmount} ${g.currency}\n`
              msg += `   Achieved: ${g.currentAmount} ${g.currency}\n\n`
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

        case "❓ Help & Info":
          //TODO?
          wizardManager.setState(userId, {
            step: "HELP_VIEW",
            data: {},
            returnTo: "settings",
          })

          bot.sendMessage(
            chatId,
            "❓ *Help & Info*\n\n" +
            "*How to use:*\n" +
            "• 💸 *Expense* and 💰 *Income* - Add expenses, income, or transfers\n" +
            "• 💰 *Balances* - View and manage your accounts\n" +
            "• 📋 *History* - Browse transaction history\n" +
            "• 📉 *Debts* - Track money you owe or are owed\n" +
            "• 🎯 *Goals* - Set and track savings goals\n" +
            "• 📊 *Analytics* - View stats and reports\n\n" +
            "*About this bot:*\n" +
            "Personal Finance Bot helps you track expenses, manage budgets, and achieve financial goals.\n\n" +
            "Version: 2.0\n" +
            "Multi-currency support with automatic conversion.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
                resize_keyboard: true,
              },
            }
          )
          break

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
          await menus.showHistoryMenu(bot, chatId, userId)
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

        case "❌ No, cancel":
        case "❌ Cancel": {
          bot.sendMessage(chatId, "✅ Cancelled.", {
            reply_markup: SETTINGS_KEYBOARD,
          })
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

        // BUDGET PLANNER
        case "🔮 Budget Planner": {
          wizardManager.setState(userId, {
            step: "BUDGET_MENU",
            data: {},
            returnTo: "settings",
          })
          await menus.showBudgetMenu(wizardManager, chatId, userId)
          break
        }

        // MAIN MENU
        case "🏠 Main Menu":
          wizardManager.clearState(userId)
          await menus.showMainMenu(bot, chatId)
          break

        default: {
          // CHANGE CURRENCY
          if (text.match(/^(USD|EUR|GEL|RUB|UAH|PLN) /)) {
            const currency = text.split(" ")[0] as Currency
            const oldCurrency = await db.getDefaultCurrency(userId)

            if (oldCurrency !== currency) {
              const balancesCount = (await db.getBalancesList(userId)).length

              //TODO?
              wizardManager.setState(userId, {
                step: "SETTINGS_CURRENCY_CONFIRM",
                data: { newCurrency: currency, balancesCount },
                returnTo: "settings",
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

          const goal = userData.goals.find(
            (g: Goal) => g.name === text && g.status === "ACTIVE"
          )
          if (goal) {
            //TODO?
            wizardManager.setState(userId, {
              step: "GOAL_MENU",
              data: { goal, goalId: goal.id },
              returnTo: "goals",
            })
            const remaining = goal.targetAmount - goal.currentAmount
            const progress = formatAmount(
              (goal.currentAmount / goal.targetAmount) * 100
            )

            bot.sendMessage(
              chatId,
              `🎯 *${goal.name}*\n\n` +
              `Target: ${formatMoney(goal.targetAmount, goal.currency)}\n` +
              `Current: ${formatMoney(goal.currentAmount, goal.currency)}\n` +
              `Remaining: ${formatMoney(remaining, goal.currency)}\n` +
              `Progress: ${progress}%\n\n` +
              `💡 Enter amount to deposit`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "✏️ Edit Target" }],
                    [{ text: "🗑 Delete Goal" }],
                    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return
          }

          const debt = userData.debts.find(
            (d: Debt) => d.name === text && !d.isPaid
          )
          if (debt) {
            //TODO?
            wizardManager.setState(userId, {
              step: "DEBT_MENU",
              data: { debt, debtId: debt.id },
              returnTo: "debts",
            })
            const remaining = debt.amount - debt.paidAmount
            const emoji =
              debt.type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
            const action = debt.type === "I_OWE" ? "pay" : "receive"

            bot.sendMessage(
              chatId,
              `${emoji} *${debt.name}*\n\n` +
              `Total: ${formatMoney(debt.amount, debt.currency)}\n` +
              `Paid: ${formatMoney(debt.paidAmount, debt.currency)}\n` +
              `Remaining: ${formatMoney(remaining, debt.currency)}\n\n` +
              `💡 Enter amount to ${action}`,
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
            return
          }

          break
        }
      }
    })

    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id
      if (!chatId) return
      const userId = chatId.toString()
      const data = query.data || ""

      // Сохранение шаблона
      if (data.startsWith("tmpl_save|")) {
        await templateHandlers.handleTemplateSave(bot, query, userId, data)
        return
      }

      // Использование шаблона
      if (data.startsWith("tmpl_use|")) {
        await templateHandlers.handleTemplateUse(bot, query, userId, chatId, data)
        return
      }

      // Управление шаблоном
      if (data.startsWith("tmpl_manage|")) {
        await templateHandlers.handleTemplateManage(bot, query, userId, chatId, data)
        return
      }

      // Удаление шаблона
      if (data.startsWith("tmpl_del|")) {
        await templateHandlers.handleTemplateDelete(bot, query, userId, chatId, data)
        return
      }

      // Редактирование суммы
      if (data.startsWith("tmpl_edit_amt|")) {
        await templateHandlers.handleTemplateEditAmount(bot, query, userId, chatId, data, wizardManager)
        return
      }

      // Редактирование счёта
      if (data.startsWith("tmpl_edit_acc|")) {
        await templateHandlers.handleTemplateEditAccount(bot, query, userId, chatId, data)
        return
      }

      // Установка счёта
      if (data.startsWith("tmpl_set_acc|")) {
        await templateHandlers.handleTemplateSetAccount(bot, query, userId, chatId, data)
        return
      }

      // Отмена редактирования
      if (data.startsWith("tmpl_cancel|")) {
        await templateHandlers.handleTemplateCancelEdit(bot, query, userId, chatId, data, wizardManager)
        return
      }

      // Показать список шаблонов
      if (data === "tmpl_list") {
        wizardManager.clearState(userId)
        await safeAnswerCallback(bot, { callback_query_id: query.id })
        await templateHandlers.showTemplatesList(bot, chatId, userId)
        return
      }

      // Смена счёта для транзакции
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

      // Установка нового счёта для транзакции
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
    })
  } catch (error) {
    console.error("❌ Failed to start bot:", error)
    process.exit(1)
  }
}

startBot()
