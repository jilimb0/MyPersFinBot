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
import { createListButtons, formatAmount, formatMoney } from "../utils"
import { showBalancesMenu, showIncomeSourcesMenu, showMainMenu } from "../menus"

import * as handlers from "../handlers"

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

      const items = denominations.map((v: number) => `${v}`)

      const listButtons = createListButtons({
        items,
        withoutBack: true,
        itemsPerRowCustom: 3,
      })

      const titleWithEmoji =
        state.txType === TransactionType.EXPENSE
          ? "💸 *Expense*"
          : "💰 *Income*"
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

      wizard.setState(userId, state)
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

    case "TX_CONFIRM_REFUND":
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
      const transactions = state.data?.transactions || []
      const period = state.data?.period || "All Time"
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
    case "HISTORY_LIST": {
      const recentTxs = await db.getRecentTransactions(userId, 5)
      const items = recentTxs.map((tx) => {
        const emoji =
          tx.type === "EXPENSE" ? "📉" : tx.type === "INCOME" ? "📈" : "↔️"
        return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
      })
      const keyboard = createListButtons({
        items,
        afterItemsButtons: ["🔍 Filters"],
      })
      await wizard.sendMessage(
        chatId,
        "📋 *Recent Transactions*\n\nSelect transaction to edit:",
        {
          parse_mode: "Markdown",
          reply_markup: { keyboard, resize_keyboard: true },
        }
      )
      break
    }
    case "TX_EDIT_MENU": {
      const tx = state.data?.transaction
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
      const tx = state.data?.transaction
      if (!tx) break
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        `✏️ *Edit Amount*\n\nCurrent: \n${formatMoney(tx.amount, tx.currency)}\n\nEnter new amount (e.g. 100 or 100 ${defaultCurrency}):`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(),
        }
      )
      break
    }
    case "TX_EDIT_CATEGORY": {
      const tx = state.data?.transaction
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
      const tx = state.data?.transaction
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
        wizard.getBackButton()
      )
      break

    case "DEBT_PARTIAL_AMOUNT":
      if (data.debt) {
        const remaining = data.debt.amount - data.debt.paidAmount
        await wizard.sendMessage(
          chatId,
          `📉 Paying "${data.debt.name}"\nRemaining: ${remaining}\n\nEnter amount to pay:`,
          wizard.getBackButton()
        )
      }
      break

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
        return `${d.name}`
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
      const debt = data.debt
      await wizard.sendMessage(
        chatId,
        `💰 Current: ${formatMoney(debt.amount, debt.currency)}\nPaid: ${formatMoney(debt.paidAmount, debt.currency)}\n\n✏️ Enter new total amount:`,
        wizard.getBackButton()
      )
      break
    }
    case "DEBT_MENU": {
      const debt = data.debt
      if (debt) {
        const remaining = debt.amount - debt.paidAmount
        const emoji = debt.type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
        const action = debt.type === "I_OWE" ? "pay" : "receive"

        await wizard.sendMessage(
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
      }
      break
    }
    case "DEBT_CREATE_DETAILS": {
      const type = state.data?.type || ""
      const emoji = type === "I_OWE" ? "🔴" : "🟢"
      const action = type === "I_OWE" ? "owe to" : "lent to"
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        `${emoji} Enter person's name and amount you ${action}:\n\n💡 *Format:* Name Amount [Currency]\n\n*Examples:*\n• John 1000\n• Maria 5000 USD\n• Alex 50000 ${defaultCurrency}`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(),
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
        wizard.getBackButton()
      )
      break

    case "GOAL_DEPOSIT_AMOUNT":
      if (data.goal) {
        await wizard.sendMessage(
          chatId,
          `🎯 "${data.goal.name}"\nTarget: ${data.goal.targetAmount}\nCurrent: ${data.goal.currentAmount}\n\nEnter deposit amount:`,
          wizard.getBackButton()
        )
      }
      break

    case "GOAL_DEPOSIT_ACCOUNT":
      await handlers.handleTxAccount(
        wizard,
        chatId,
        userId,
        "💳 Select account to withdraw from:"
      )
      break

    case "GOAL_MENU": {
      const goal = data.goal
      if (goal) {
        const remaining = goal.targetAmount - goal.currentAmount
        const progress = formatAmount(
          (goal.currentAmount / goal.targetAmount) * 100
        )

        await wizard.sendMessage(
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
      const goal = state.data?.goal
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
      const goal = state.data?.goal
      if (!goal) break
      await wizard.sendMessage(
        chatId,
        `✏️ *Edit Goal Target*\n\nCurrent: ${formatMoney(goal.targetAmount, goal.currency)}\n\nEnter new target amount:`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(),
        }
      )
      break
    }
    case "GOAL_COMPLETE_CONFIRM": {
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
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        `💰 Enter expected monthly amount for "${data.name}":\n\nExample: 1000 or 1000 ${defaultCurrency}`,
        wizard.getBackButton()
      )
      break
    }
    case "INCOME_VIEW":
      await showIncomeSourcesMenu(wizard.getBot(), chatId, userId)
      break

    case "INCOME_NAME":
      wizard.sendMessage(
        chatId,
        "💼 Enter income source name:\n\nExample:  Salary, Freelance",
        wizard.getBackButton()
      )
      break

    case "INCOME_DELETE": {
      const incomeName = state.data.name
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
        wizard.getBackButton()
      )
      break

    case "BALANCE_AMOUNT":
      await wizard.sendMessage(
        chatId,
        `Enter amount (e.g. 100 or 100 ${defaultCurrency}):`,
        wizard.getBackButton()
      )
      break

    case "BALANCE_DELETE_TRANSFER":
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

    case "BALANCE_DELETE_SELECT_TARGET":
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

    case "BALANCE_EDIT_CURRENCY_CHOICE":
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

    case "BALANCE_LIST": {
      await showBalancesMenu(wizard, chatId, userId)
      break
    }
    case "BALANCE_EDIT_MENU": {
      const data = await wizard.getState(userId).data
      const text = data?.text || ''

      await handlers.handleBalanceEditMenu(wizard, chatId, userId, text)
      break
    }

    default:
      wizard.clearState(userId)
      await showMainMenu(wizard.getBot(), chatId)
  }
}
