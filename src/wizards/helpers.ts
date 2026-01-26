import { dbStorage as db } from "../database/storage-db"

import { WizardManager, WizardState } from "./wizards"
import {
  Debt,
  ExpenseCategory,
  Goal,
  IncomeCategory,
  Transaction,
  TransactionType,
} from "../types"
import { createListButtons, formatMoney } from "../utils"
import {
  showActiveRemindersMenu,
  showAnalyticsReportsMenu,
  showBalancesMenu,
  showBudgetMenu,
  showHistoryMenu,
  showIncomeSourcesMenu,
  showMainMenu,
} from "../menus-i18n"

import * as handlers from "../handlers"
import { createProgressBar, getProgressEmoji } from "../reports"

export async function resendCurrentStepPrompt(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  state: WizardState
): Promise<void> {
  const { step, data, txType } = state
  const defaultCurrency = await db.getDefaultCurrency(userId)

  switch (step) {
    // --- Transaction Flow ---
    case "TX_AMOUNT": {
      const currency = await db.getDefaultCurrency(userId)
      const denominations = db.getCurrencyDenominations(currency)

      const items = denominations.map(
        (v: number) => `${formatMoney(v, currency, true)}`
      )

      const listButtons = createListButtons({
        items,
        withoutBack: true,
        itemsPerRowCustom: 3,
      })

      const titleWithEmoji =
        state.txType === TransactionType.EXPENSE
          ? "💸 *Expense*"
          : state.txType === TransactionType.INCOME
            ? "💰 *Income*"
            : "↔️ *Transfer*"
      await wizard.sendMessage(
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
    case "TX_CATEGORY": {
      await handlers.QuickActionsHandlers.handleQuickCategory(
        wizard.getBot(),
        chatId,
        userId,
        "",
        state
      )
      break
    }
    case "TX_ACCOUNT": {
      const accountMsg =
        txType === TransactionType.EXPENSE
          ? "💳 Select payment account:"
          : txType === TransactionType.INCOME
            ? "📥 Select account to deposit to:"
            : "📤 Select source account:"
      await handlers.handleTxAccount(wizard, chatId, userId, accountMsg)
      break
    }

    case "TX_TO_ACCOUNT":
      await handlers.handleTxToAccount(
        wizard,
        chatId,
        userId,
        "📥 Select destination account:"
      )
      break

    case "TX_CONFIRM_REFUND": {
      if (!data) break
      if (data.amount !== undefined && data.currency) {
        await wizard.sendMessage(
          chatId,
          `⚠️ Negative amount detected: -${data.amount} ${data.currency}\n\n` +
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
      }
      break
    }
    case "TX_VIEW_PERIOD": {
      await wizard.sendMessage(
        chatId,
        "📋 *Transaction History*\n\nSelect period:",
        {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "📅 Last 7 days" }, { text: "📅 Last 30 days" }],
              [{ text: "💸 Expenses only" }, { text: "💰 Income only" }],
              [{ text: "📅 Custom Period" }, { text: "🔍 All transactions" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      break
    }
    case "TX_VIEW_LIST": {
      const transactions = state?.data?.transactions || []
      const period = state?.data?.period || "All Time"
      const toShow = transactions.slice(0, 10)

      const items = toShow.map((tx: Transaction) => {
        const emoji =
          tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
        return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
      })

      const listButtons = createListButtons({
        items,
      })

      await wizard.sendMessage(
        chatId,
        `📋 *Transaction History*\n\n${period}\n\nShowing ${toShow.length} of ${transactions.length} transaction(s)\n\nSelect transaction to edit:`,
        {
          parse_mode: "Markdown",
          reply_markup: { keyboard: listButtons, resize_keyboard: true },
        }
      )
      break
    }
    case "TX_EDIT_MENU": {
      const tx = state?.data?.transaction
      if (!tx) break
      const account = tx.fromAccountId || tx.toAccountId || "N/A"
      await wizard.sendMessage(
        chatId,
        `📋 *Transaction Details*\n\nType: ${tx.type}\nCategory: ${tx.category}\nAmount: \n${formatMoney(tx.amount, tx.currency)}\nAccount: ${account}\nDate: ${new Date(tx.date).toLocaleDateString("en-GB")}\n\nWhat would you like to do?`,
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
      break
    }
    case "TX_EDIT_AMOUNT": {
      const tx = state?.data?.transaction
      if (!tx) break
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        `✏️ *Edit Amount*\n\nCurrent: \n${formatMoney(tx.amount, tx.currency)}\n\nEnter new amount (e.g. 100 or 100 ${defaultCurrency}):`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(state?.lang || "en"),
        }
      )
      break
    }
    case "TX_EDIT_CATEGORY": {
      const tx = state?.data?.transaction
      if (!tx) break
      let categories, title
      if (tx.type === "EXPENSE") {
        categories = Object.values(ExpenseCategory)
        title = "📝 *Edit Category (Expense)*\n\nCurrent: " + tx.category
      } else {
        categories = Object.values(IncomeCategory)
        title = "📝 *Edit Category (Income)*\n\nCurrent: " + tx.category
      }

      const items = categories.map((c) => c)
      const keyboard = createListButtons({ items })

      await wizard.sendMessage(chatId, title + "\n\nSelect new category:", {
        parse_mode: "Markdown",
        reply_markup: { keyboard, resize_keyboard: true },
      })
      break
    }
    case "TX_EDIT_ACCOUNT": {
      const tx = state?.data?.transaction
      if (!tx) break
      const account = tx.fromAccountId || tx.toAccountId || "N/A"
      const msg = `💳 *Edit Account*\n\nCurrent: ${account}\n\nSelect new account:`
      await handlers.handleTxAccount(wizard, chatId, userId, msg)
      break
    }

    // --- Debt Flow ---
    case "DEBT_TYPE":
      await wizard.sendMessage(chatId, "Select debt type:", {
        reply_markup: {
          keyboard: [
            [{ text: "🔴 I Owe" }, { text: "🟢 They Owe Me" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      })
      break

    case "DEBT_AMOUNT":
      await wizard.sendMessage(
        chatId,
        `💰 Enter amount (e.g. 100 or 100 ${defaultCurrency}):`,
        wizard.getBackButton(state?.lang || "en")
      )
      break

    case "DEBT_PARTIAL_AMOUNT": {
      if (!data) break
      if (data.debt) {
        const remaining = data.debt.amount - data.debt.paidAmount
        await wizard.sendMessage(
          chatId,
          `📉 Paying "${data.debt.name}"\nRemaining: ${remaining}\n\nEnter amount to pay:`,
          wizard.getBackButton(state?.lang || "en")
        )
      }
      break
    }

    case "DEBT_PARTIAL_ACCOUNT":
      await handlers.handleTxAccount(
        wizard,
        chatId,
        userId,
        "💳 Select account for payment:"
      )
      break

    case "DEBT_EDIT_SELECT": {
      const userData = await db.getUserData(userId)
      const debts = userData.debts.filter((d: Debt) => !d.isPaid)

      const items = debts.map((d: Debt) => {
        return `${d?.name}`
      })

      const listButtons = createListButtons({
        items,
        beforeItemsButtons: [[{ text: "✨ Add Debt" }]],
      })

      await wizard.sendMessage(chatId, "Select debt to edit:", {
        reply_markup: { keyboard: listButtons, resize_keyboard: true },
      })
      break
    }
    case "DEBT_EDIT_AMOUNT": {
      if (!data) break
      const debt = data.debt
      if (!debt) break
      await wizard.sendMessage(
        chatId,
        `💰 Current: ${formatMoney(debt.amount, debt.currency)}\nPaid: ${formatMoney(debt.paidAmount, debt.currency)}\n\n✏️ Enter new total amount:`,
        wizard.getBackButton(state?.lang || "en")
      )
      break
    }
    case "DEBT_MENU": {
      if (!data) break
      const debt = data.debt

      if (debt) {
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
        const emoji = type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
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
          msg += `Due: ${deadlineDate.toLocaleDateString("en-GB")}\n`
        }

        msg += `\n💡 Enter amount to ${action}`

        const deadlineButtons = dueDate
          ? [
              [{ text: "📅 Change Deadline" }],
              [{ text: "🔕 Disable Reminders" }],
              [
                {
                  text: autoPayment?.enabled
                    ? "❌ Disable Auto-Payment"
                    : "✅ Enable Auto-Payment",
                },
              ],
            ]
          : [[{ text: "📅 Set Deadline" }]]

        wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "✏️ Edit Amount" }],
              ...deadlineButtons,
              [{ text: "🗑 Delete Debt" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ].filter((row) => row.length > 0),
            resize_keyboard: true,
          },
        })
      }
      break
    }
    case "DEBT_CREATE_DETAILS": {
      const type = state?.data?.type || ""
      const emoji = type === "I_OWE" ? "🔴" : "🟢"
      const action = type === "I_OWE" ? "owe to" : "lent to"
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        `${emoji} Enter person's name and amount you ${action}:\n\n💡 *Format:* Name Amount [Currency]\n\n*Examples:*\n• John 1000\n• Maria 5000 USD\n• Alex 50000 ${defaultCurrency}`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(state?.lang || "en"),
        }
      )
      break
    }

    // --- Goal Flow ---
    case "GOAL_INPUT":
      await wizard.sendMessage(
        chatId,
        `🎯 *Add Goal*\n\n` +
          `Enter goal in format:\n` +
          `\`GoalName amount CURRENCY\`\n\n` +
          `*Examples:*\n` +
          `• \`Laptop 2000 ${defaultCurrency}\`\n` +
          `• \`Vacation 5000 USD\`\n` +
          `• \`Emergency Fund 10000\` (uses ${defaultCurrency})`,
        wizard.getBackButton(state?.lang || "en")
      )
      break

    case "GOAL_DEPOSIT_AMOUNT": {
      if (!data) break
      if (data.goal) {
        await wizard.sendMessage(
          chatId,
          `🎯 "${data.goal.name}"\nTarget: ${data.goal.targetAmount}\nCurrent: ${data.goal.currentAmount}\n\nEnter deposit amount:`,
          wizard.getBackButton(state?.lang || "en")
        )
      }
      break
    }

    case "GOAL_DEPOSIT_ACCOUNT":
      await handlers.handleTxAccount(
        wizard,
        chatId,
        userId,
        "💳 Select account to withdraw from:"
      )
      break

    case "GOAL_MENU": {
      if (!data) break
      const goal = data.goal
      if (goal) {
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

        msg += `\n💡 Enter amount to deposit:`

        const deadlineButtons = deadline
          ? [
              [{ text: "📅 Change Deadline" }],
              [{ text: "🔕 Disable Reminders" }],
              [
                {
                  text: autoDeposit?.enabled
                    ? "❌ Disable Auto-Deposit"
                    : "✅ Enable Auto-Deposit",
                },
              ],
            ]
          : [[{ text: "📅 Set Deadline" }]]

        wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "✏️ Edit Target" }],
              ...deadlineButtons,
              [{ text: "🗑 Delete Goal" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ].filter((row) => row.length > 0),
            resize_keyboard: true,
          },
        })
      }
      break
    }
    case "GOAL_COMPLETED_SELECT": {
      const userData = await db.getUserData(userId)
      const completedGoals = userData.goals.filter(
        (g: Goal) => g.status === "COMPLETED"
      )
      const items = completedGoals.map((g: Goal) => `✅ Goal: ${g.name}`)
      const keyboard = createListButtons({ items })
      await wizard.sendMessage(chatId, "🎉 *Completed Goals*\n\nSelect goal:", {
        parse_mode: "Markdown",
        reply_markup: { keyboard, resize_keyboard: true },
      })
      break
    }
    case "GOAL_COMPLETED_DELETE": {
      const goal = state?.data?.goal
      if (!goal) break
      await wizard.sendMessage(
        chatId,
        `✅ Completed Goal: "${goal.name}"\n\nTarget: ${goal.targetAmount} ${goal.currency}\nAchieved: ${goal.currentAmount} ${goal.currency}\n\n🎉 Congratulations on reaching this goal!`,
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
      break
    }
    case "GOAL_EDIT_AMOUNT": {
      const goal = state?.data?.goal
      if (!goal) break
      await wizard.sendMessage(
        chatId,
        `✏️ *Edit Goal Target*\n\nCurrent: ${formatMoney(goal.targetAmount, goal.currency)}\n\nEnter new target amount:`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(state?.lang || "en"),
        }
      )
      break
    }
    case "GOAL_COMPLETE_CONFIRM": {
      if (!state?.data || !state?.data?.goal || !state?.data?.newTargetAmount)
        break
      const { goal, newTargetAmount } = state.data
      await wizard.sendMessage(
        chatId,
        `🎯 New target amount *${formatMoney(newTargetAmount, goal.currency)}* equals your current progress.\n\n` +
          `Would you like to update the target and mark this goal as completed?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "✅ Yes, Complete Goal" }],
              [{ text: "❌ No, другой amount" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      break
    }

    // --- Income Flow ---
    case "INCOME_AMOUNT": {
      if (!data) break
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        `💰 Enter expected monthly amount for "${data.name}":\n\nExample: 1000 or 1000 ${defaultCurrency}`,
        wizard.getBackButton(state?.lang || "en")
      )
      break
    }
    case "INCOME_VIEW":
      await showIncomeSourcesMenu(
        wizard.getBot(),
        chatId,
        userId,
        state?.lang || "en"
      )
      break

    case "INCOME_NAME":
      wizard.sendMessage(
        chatId,
        "💼 Enter income source name:\n\nExample:  Salary, Freelance",
        wizard.getBackButton(state?.lang || "en")
      )
      break

    case "INCOME_DELETE": {
      if (!state?.data) break
      const incomeName = state?.data?.name
      if (incomeName) {
        wizard.setState(userId, {
          step: "INCOME_DELETE_CONFIRM",
          data: { incomeName },
          returnTo: "income",
        })
        await wizard.sendMessage(
          chatId,
          `🗑 Delete income source "${incomeName}"?`,
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
      }
      break
    }

    // --- Balance Flow ---
    case "BALANCE_NAME":
      await wizard.sendMessage(
        chatId,
        "Enter account name (e.g., 'Cash' or 'Bank Card'):",
        wizard.getBackButton(state?.lang || "en")
      )
      break

    case "BALANCE_AMOUNT":
      await wizard.sendMessage(
        chatId,
        `Enter amount (e.g. 100 or 100 ${defaultCurrency}):`,
        wizard.getBackButton(state?.lang || "en")
      )
      break

    case "BALANCE_DELETE_TRANSFER": {
      if (!data) break
      if (data.accountId && data.currency && data.amount !== undefined) {
        await wizard.sendMessage(
          chatId,
          `⚠️ Balance "${data.accountId}" has ${formatMoney(
            data.amount,
            data.currency
          )}.\n\nWhat would you like to do?`,
          {
            reply_markup: {
              keyboard: [
                [{ text: "↔️ Transfer to another account" }],
                [{ text: "🗑️ Delete and clear everything" }],
                [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          }
        )
      }
      break
    }
    case "BALANCE_DELETE_SELECT_TARGET": {
      if (!data) break
      if (data.accountId && data.currency && data.amount !== undefined) {
        const balanceList = await db.getBalancesList(userId)
        const otherBalances = balanceList.filter(
          (b) =>
            !(b.accountId === data.accountId && b.currency === data.currency)
        )

        const items = otherBalances.map((b) => `${b.accountId} (${b.currency})`)

        const listButtons = createListButtons({
          items,
        })

        await wizard.sendMessage(
          chatId,
          `↔️ Transfer ${formatMoney(data.amount, data.currency)} to:`,
          {
            reply_markup: {
              keyboard: listButtons,
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        )
      }
      break
    }
    case "BALANCE_EDIT_CURRENCY_CHOICE": {
      if (!data) break
      if (
        data.inputAmount &&
        data.inputCurrency &&
        data.convertedAmount &&
        data.currency
      ) {
        await wizard.sendMessage(
          chatId,
          `💱 You entered ${data.inputAmount} ${data.inputCurrency}, but balance is in ${data.currency}.\n\n` +
            `Choose what to do:`,
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: `🔄 Convert to ${formatMoney(
                      data.convertedAmount,
                      data.currency
                    )}`,
                  },
                ],
                [
                  {
                    text: `💱 Change to ${data.inputAmount} ${data.inputCurrency}`,
                  },
                ],
                [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          }
        )
      }
      break
    }
    case "BALANCE_LIST": {
      await showBalancesMenu(wizard, chatId, userId, state?.lang || "en")
      break
    }
    case "BALANCE_EDIT_MENU": {
      const state = wizard.getState(userId)
      if (state?.data) {
        const { accountId, currency } = state.data
        const balance = await db.getBalance(userId, accountId, currency)

        if (balance) {
          const keyboard = []

          if (balance.amount > 0) {
            keyboard.push([{ text: "🅰️ Set to Zero" }])
          }

          keyboard.push(
            [{ text: "🗑️ Delete Balance" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]
          )

          await wizard.sendMessage(
            chatId,
            `✏️ *${accountId}* (${currency})\n\n` +
              `Balance: ${formatMoney(balance.amount, currency)}\n\n` +
              `💡 *Quick edit:*\n` +
              `• Enter number → update amount\n` +
              `• Enter text → rename account`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard,
                resize_keyboard: true,
              },
            }
          )
        }
      }
      break
    }

    // --- History & Reports ---
    case "HISTORY_LIST": {
      await showHistoryMenu(wizard, chatId, userId, state?.lang || "en")
      break
    }
    case "ANALYTICS_REPORTS_MENU": {
      await showAnalyticsReportsMenu(
        wizard,
        chatId,
        userId,
        state?.lang || "en"
      )
      break
    }
    case "ANALYTICS_FILTERS": {
      await wizard.sendMessage(
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
      break
    }

    // --- Notifications ---
    case "NOTIFICATIONS_MENU": {
      await handlers.handleNotificationsMenu(wizard, chatId, userId)
      break
    }
    case "NOTIFICATIONS_MANAGE_REMINDERS": {
      await showActiveRemindersMenu(wizard, chatId, userId, state?.lang || "en")
      break
    }

    case "GOAL_ADVANCED_MENU": {
      const goal = state?.data?.goal as Goal | undefined
      if (goal) {
        await wizard.goToStep(userId, "GOAL_MENU", state?.data)

        const {
          name,
          targetAmount,
          currentAmount,
          deadline,
          currency,
          autoDeposit,
        } = goal
        const remaining = targetAmount - currentAmount
        const progress = createProgressBar(currentAmount, targetAmount)
        const statusEmoji = getProgressEmoji(currentAmount, targetAmount)

        let msg = `${statusEmoji} *${name}*\n${progress}\n`

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

        await wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "✏️ Edit Target" }],
              [{ text: "⚙️ Advanced" }],
              [{ text: "🗑 Delete Goal" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        })
      }
      break
    }

    case "DEBT_ADVANCED_MENU": {
      const debt = state?.data?.debt as Debt | undefined
      if (debt) {
        await wizard.goToStep(userId, "DEBT_MENU", state?.data)

        const { amount, paidAmount, type, dueDate, name, currency } = debt
        const remaining = amount - paidAmount
        const progress = createProgressBar(paidAmount, amount)
        const emoji = type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
        const action = type === "I_OWE" ? "pay" : "receive"

        let msg = `${emoji} *${name}*\n${progress}\n`

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

        await wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "✏️ Edit Amount" }],
              [{ text: "⚙️ Advanced" }],
              [{ text: "🗑 Delete Debt" }],
              [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        })
      }
      break
    }

    // --- Budget Planner ---
    case "BUDGET_MENU": {
      await showBudgetMenu(wizard, chatId, userId, state?.lang || "en")
      break
    }
    case "BUDGET_SELECT_CATEGORY": {
      const categories = Object.values(ExpenseCategory)
      const items = categories.map((c) => c)
      const keyboard = createListButtons({ items })

      await wizard.sendMessage(
        chatId,
        "🔮 *Budget Planner*\n\nSelect category to set limit:",
        {
          parse_mode: "Markdown",
          reply_markup: { keyboard, resize_keyboard: true },
        }
      )
      break
    }
    case "BUDGET_CATEGORY_MENU": {
      const category = state?.data?.category as ExpenseCategory | undefined
      if (category) {
        const budgets = await db.getCategoryBudgets(userId)
        const b = budgets[category] || {
          limit: 0,
          spent: 0,
          currency: await db.getDefaultCurrency(userId),
        }

        const ratio = b.limit > 0 ? Math.min(1, b.spent / b.limit) : 0
        const blocks = 10
        const filled = Math.round(ratio * blocks)
        const bar = "█".repeat(filled) + "░".repeat(blocks - filled)

        await wizard.sendMessage(
          chatId,
          `💳 *${category}*\n\n` +
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
      }
      break
    }

    // --- Recurring Transactions Handlers ---
    case "RECURRING_MENU": {
      if (!state?.data) break
      // Handle button clicks
      if (state?.data?.text === "✨ Add Recurring") {
        await handlers.handleRecurringCreateStart(wizard, chatId, userId)
        break
      }

      // Check if selecting existing recurring
      const recurring = state?.data?.text.match(/^(💸|💰) /)
      if (recurring) {
        await handlers.handleRecurringSelect(
          wizard,
          chatId,
          userId,
          state?.data?.text
        )
        break
      }

      // Default: show menu
      await handlers.handleRecurringMenu(
        wizard,
        chatId,
        userId,
        state?.lang || "en"
      )
      break
    }

    case "RECURRING_ITEM_MENU":
      if (!state?.data) break
      await handlers.handleRecurringItemAction(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_DELETE_CONFIRM":
      if (!state?.data) break
      await handlers.handleRecurringDeleteConfirm(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_CREATE_DESCRIPTION":
      if (!state?.data) break
      await handlers.handleRecurringDescription(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_CREATE_TYPE":
      if (!state?.data) break
      await handlers.handleRecurringType(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_CREATE_AMOUNT":
      if (!state?.data) break
      await handlers.handleRecurringAmount(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_CREATE_ACCOUNT":
      if (!state?.data) break
      await handlers.handleRecurringAccount(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_CREATE_CATEGORY":
      if (!state?.data) break
      await handlers.handleRecurringCategory(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    case "RECURRING_CREATE_DAY":
      if (!state?.data) break
      await handlers.handleRecurringDay(
        wizard,
        chatId,
        userId,
        state?.data?.text
      )
      break

    default:
      wizard.clearState(userId)
      await showMainMenu(wizard.getBot(), chatId, state?.lang || "en")
  }
}
