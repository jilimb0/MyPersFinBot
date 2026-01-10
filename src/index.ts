import "reflect-metadata"
import TelegramBot from "node-telegram-bot-api"
import fs from "fs"
import path from "path"
import { TransactionType, Debt, Goal, Currency } from "./types"
import { dbStorage as db } from "./storage-db"
import { initializeDatabase, closeDatabase } from "./database/data-source"
import { formatMonthlyStats, generateCSV, formatNetWorth } from "./reports"
import { WizardManager } from "./wizards"
import { preloadRates, stopAutoRefresh } from "./fx"
import { MAIN_MENU_KEYBOARD, SETTINGS_KEYBOARD } from "./constants"
import * as menus from "./menus"

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
          // Проверяем есть ли у пользователя данные
          const userData = await db.getUserData(userId)
          const hasData =
            userData.balances.length > 0 ||
            userData.transactions.length > 0 ||
            userData.debts.length > 0 ||
            userData.goals.length > 0

          if (hasData) {
            // Пользователь уже использует бот
            bot.sendMessage(
              chatId,
              "👋 Welcome back! Select an option:",
              MAIN_MENU_KEYBOARD
            )
          } else {
            // Новый пользователь
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
          // Одноразовая кнопка для новых пользователей
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
        case "💸 Expense": {
          const balanceCount = (await db.getBalancesList(userId)).length

          if (balanceCount === 0) {
            bot.sendMessage(
              chatId,
              "⚠️ *No Balances Found*\n\n" +
                "Before adding transactions, you need at least one balance account.\n\n" +
                "💡 *Quick Start:*\n" +
                "1️⃣ Go to 💰 *Balances*\n" +
                "2️⃣ Tap ➕ *Add Balance*\n" +
                "3️⃣ Enter account name and amount",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "💰 Go to Balances" }],
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
            data: { isQuickMode: true },
            returnTo: "main",
          })

          const currency = await db.getDefaultCurrency(userId)
          bot.sendMessage(
            chatId,
            `💸 *Expense*\n\nEnter amount (e.g., 50 or 50 ${currency}):`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [[{ text: "🏠 Main Menu" }]],
                resize_keyboard: true,
              },
            }
          )
          break
        }

        case "💰 Income": {
          const balanceCount = (await db.getBalancesList(userId)).length

          if (balanceCount === 0) {
            bot.sendMessage(
              chatId,
              "⚠️ *No Balances Found*\n\n" +
                "Before adding transactions, you need at least one balance account.\n\n" +
                "💡 *Quick Start:*\n" +
                "1️⃣ Go to 💰 *Balances*\n" +
                "2️⃣ Tap ➕ *Add Balance*\n" +
                "3️⃣ Enter account name and amount",
              {
                parse_mode: "Markdown",
                reply_markup: {
                  keyboard: [
                    [{ text: "💰 Go to Balances" }],
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
            data: { isQuickMode: true },
            returnTo: "main",
          })

          const currency = await db.getDefaultCurrency(userId)
          bot.sendMessage(
            chatId,
            `💰 *Quick Income*\n\nEnter amount (e.g., 1500 or 1500 ${currency}):`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [[{ text: "🏠 Main Menu" }]],
                resize_keyboard: true,
              },
            }
          )
          break
        }

        // BALANCES
        case "💰 Go to Balances":
        case "💰 Balances":
          await menus.showBalancesMenu(bot, chatId, userId)
          break

        case "➕ Add Balance": {
          wizardManager.setState(userId, {
            step: "BALANCE_NAME",
            data: {},
            returnTo: "balances",
          })
          bot.sendMessage(
            chatId,
            "Enter account name (e.g., 'Cash' or 'Bank Card'):",
            wizardManager.getBackButton()
          )
          break
        }

        case "✏️ Edit Balances": {
          const editBalances = await db.getBalancesList(userId)

          const editBalanceRows = [[{ text: "➕ Add Balance" }]]

          editBalances.forEach((b) => {
            editBalanceRows.push([{ text: `${b.accountId} (${b.currency})` }])
          })

          editBalanceRows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

          wizardManager.setState(userId, {
            step: "BALANCE_EDIT_SELECT",
            data: {},
            returnTo: "balances",
          })

          bot.sendMessage(chatId, "✏️ Edit Balances - select an action:", {
            reply_markup: {
              keyboard: editBalanceRows,
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          })
          break
        }

        case "↔ Transfer": {
          wizardManager.setState(userId, {
            step: "TX_AMOUNT",
            txType: TransactionType.TRANSFER,
            data: {},
            returnTo: "balances",
          })
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

        case "➕ Add Debt":
          wizardManager.setState(userId, {
            step: "DEBT_TYPE",
            data: {},
            returnTo: "debts",
          })
          bot.sendMessage(chatId, "Select debt type:", {
            reply_markup: {
              keyboard: [
                [{ text: "🔴 I Owe" }, { text: "🟢 They Owe Me" }],
                [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          })
          break

        case "✏️ Edit Debts": {
          const userData = await db.getUserData(userId)
          const activeDebts = userData.debts.filter((d: Debt) => !d.isPaid)

          const debtRows = [[{ text: "➕ Add Debt" }]]

          activeDebts.forEach((d: Debt) => {
            const prefix = d.type === "I_OWE" ? "💸 Pay to" : "💰 Receive from"
            debtRows.push([{ text: `${prefix}: ${d.name}` }])
          })
          debtRows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

          wizardManager.setState(userId, {
            step: "DEBT_EDIT_SELECT",
            data: {},
            returnTo: "debts",
          })
          bot.sendMessage(chatId, "✏️ Edit Debts - select an action:", {
            reply_markup: {
              keyboard: debtRows,
              resize_keyboard: true,
            },
          })
          break
        }

        // GOALS
        case "🎯 Goals":
          await menus.showGoalsMenu(bot, chatId, userId)
          break

        case "➕ Add Goal":
          wizardManager.setState(userId, {
            step: "GOAL_NAME",
            data: {},
            returnTo: "goals",
          })
          bot.sendMessage(
            chatId,
            "Enter goal name (e.g. Car):",
            wizardManager.getBackButton()
          )
          break

        case "✏️ Edit Goals": {
          const userData = await db.getUserData(userId)
          const activeGoals = userData.goals.filter(
            (g: Goal) => g.status === "ACTIVE"
          )
          const completedGoals = userData.goals.filter(
            (g: Goal) => g.status === "COMPLETED"
          )

          const goalRows = [[{ text: "➕ Add Goal" }]]

          activeGoals.forEach((g: Goal) => {
            goalRows.push([{ text: `Goal: ${g.name}` }])
          })

          if (completedGoals.length > 0) {
            goalRows.push([{ text: `✅ Completed Goals` }])
          }

          goalRows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

          wizardManager.setState(userId, {
            step: "GOAL_EDIT_SELECT",
            data: {},
            returnTo: "goals",
          })
          bot.sendMessage(chatId, "✏️ Edit Goals - select an action:", {
            reply_markup: {
              keyboard: goalRows,
              resize_keyboard: true,
            },
          })
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
          goalRows.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

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

        case "📈 Monthly Stats": {
          const statsMsg = await formatMonthlyStats(userId)

          wizardManager.setState(userId, {
            step: "STATS_VIEW",
            data: {},
            returnTo: "analytics",
          })

          bot.sendMessage(chatId, statsMsg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📅 Export CSV" }],
                [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          })
          break
        }

        case "🔄 Net Worth": {
          const netWorthMsg = await formatNetWorth(userId)

          wizardManager.setState(userId, {
            step: "NETWORTH_VIEW",
            data: {},
            returnTo: "analytics",
          })

          bot.sendMessage(chatId, netWorthMsg, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [[{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]],
              resize_keyboard: true,
            },
          })
          break
        }

        case "📅 Export CSV": {
          const csvData = await generateCSV(userId)

          wizardManager.setState(userId, {
            step: "EXPORT_VIEW",
            data: {},
            returnTo: "analytics",
          })

          if (csvData) {
            const buffer = Buffer.from(csvData, "utf-8")
            bot.sendDocument(
              chatId,
              buffer,
              {},
              {
                filename: `finance_export_${new Date().toISOString().split("T")[0]}.csv`,
                contentType: "text/csv",
              }
            )
            bot.sendMessage(chatId, "✅ CSV exported successfully!", {
              reply_markup: {
                keyboard: [
                  [{ text: "📈 Monthly Stats" }],
                  [{ text: "🔄 Net Worth" }],
                  [{ text: "📅 Export CSV" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            })
          } else {
            bot.sendMessage(chatId, "❌ No transactions to export.", {
              reply_markup: {
                keyboard: [[{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]],
                resize_keyboard: true,
              },
            })
          }
          break
        }

        // SETTINGS
        case "⚙️ Settings":
          await menus.showSettingsMenu(bot, chatId, userId)
          break

        case "💱 Change Currency": {
          const currentCurr = await db.getDefaultCurrency(userId)

          // Устанавливаем контекст для Back
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
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          break
        }

        case "❓ Help & Info":
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
              "• 📊 *History* - Browse transaction history\n" +
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
                keyboard: [[{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]],
                resize_keyboard: true,
              },
            }
          )
          break

        case "💵 Income Sources":
          wizardManager.setState(userId, {
            step: "INCOME_VIEW",
            data: {},
            returnTo: "settings",
          })
          await menus.showIncomeMenu(bot, chatId, userId)
          break

        case "➕ Add Income Source":
          wizardManager.setState(userId, {
            step: "INCOME_NAME",
            data: {},
            returnTo: "income",
          })
          bot.sendMessage(
            chatId,
            "Enter income source name (e.g. Salary, Freelance):",
            wizardManager.getBackButton()
          )
          break

        case "📊 History":
          await menus.showHistoryMenu(bot, chatId, userId)
          break

        case "✏️ Edit Transactions": {
          wizardManager.setState(userId, {
            step: "TX_EDIT_SELECT",
            data: {},
            returnTo: "history",
          })

          await menus.showEditTransactionsMenu(bot, chatId, userId)

          break
        }

        case "🔍 View More":
          wizardManager.setState(userId, {
            step: "TX_VIEW_PERIOD",
            data: {},
            returnTo: "history",
          })

          bot.sendMessage(
            chatId,
            "📊 *Transaction History*\n\nSelect filter:",
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

        // MAIN MENU & BACK
        case "🏠 Main Menu":
          wizardManager.clearState(userId)
          await menus.showMainMenu(bot, chatId)
          break

        default:
          // CHANGE CURRENCY
          if (text.match(/^(USD|EUR|GEL|RUB|UAH|PLN) /)) {
            const currency = text.split(" ")[0] as Currency
            const oldCurrency = await db.getDefaultCurrency(userId)

            if (oldCurrency !== currency) {
              // ✅ Баг #7: Добавить шаг подтверждения
              const balancesCount = (await db.getBalancesList(userId)).length

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
              // ✅ Баг #6: Уведомление при выборе текущей валюты
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

          // DELETE INCOME
          if (text.startsWith("🗑 Delete Income: ")) {
            const name = text.replace("🗑 Delete Income: ", "").trim()
            wizardManager.setState(userId, {
              step: "INCOME_DELETE_CONFIRM",
              data: { name },
              returnTo: "income",
            })
            bot.sendMessage(chatId, `🗑 Delete income source "${name}"?`, {
              reply_markup: {
                keyboard: [
                  [{ text: "✅ Confirm delete" }],
                  [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            })
            return
          }

          // PAY DEBTS
          if (
            text.startsWith("💸 Pay to: ") ||
            text.startsWith("💰 Receive from: ")
          ) {
            const debtName = text.replace(/^(💸 Pay to|💰 Receive from): /, "")
            const userData = await db.getUserData(userId)
            const debt = userData.debts.find(
              (d: Debt) => d.name === debtName && !d.isPaid
            )
            if (debt) {
              wizardManager.setState(userId, {
                step: "DEBT_PARTIAL_AMOUNT",
                data: { debt, debtId: debt.id },
                returnTo: "debts",
              })
              bot.sendMessage(
                chatId,
                `📉 Paying "${debt.name}"\nRemaining: ${
                  debt.amount - debt.paidAmount
                }\n\nEnter amount to pay:`,
                wizardManager.getBackButton()
              )
            } else {
              bot.sendMessage(chatId, "❌ Debt not found or already paid.")
            }
            return
          }

          break
      }
    })

    // Inline Handler (Only for Delete now)
    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id
      if (!chatId) return
      const userId = chatId.toString()
      const data = query.data || ""

      if (data.startsWith("tx_del_")) {
        const txId = data.replace("tx_del_", "")
        const success = await await db.deleteTransaction(userId, txId)
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

// 🚀 Запуск бота
startBot()
