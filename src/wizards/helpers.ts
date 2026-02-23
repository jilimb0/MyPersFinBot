import { dbStorage as db } from "../database/storage-db"
import * as handlers from "../handlers"
import {
  DAY_KEYS,
  getCategoryLabel,
  getExpenseCategoryLabel,
  getIncomeCategoryLabel,
  resolveLanguage,
  t,
} from "../i18n"
import {
  showActiveRemindersMenu,
  showAnalyticsReportsMenu,
  showBalancesMenu,
  showBudgetMenu,
  showHistoryMenu,
  showIncomeSourcesMenu,
  showMainMenu,
} from "../menus-i18n"
import { createProgressBar, getProgressEmoji } from "../reports"
import {
  type Debt,
  ExpenseCategory,
  type Goal,
  IncomeCategory,
  type Transaction,
  TransactionType,
} from "../types"
import {
  createListButtons,
  escapeMarkdown,
  formatDateDisplay,
  formatMoney,
} from "../utils"
import type { WizardManager, WizardState } from "./wizards"

export async function resendCurrentStepPrompt(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  state: WizardState
): Promise<void> {
  const { step, data, txType } = state
  const lang = resolveLanguage(state?.lang)
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
        lang,
      })

      const titleWithEmoji =
        state.txType === TransactionType.EXPENSE
          ? t(lang, "transactions.expenseTitle")
          : state.txType === TransactionType.INCOME
            ? t(lang, "transactions.incomeTitle")
            : t(lang, "transactions.transferTitle")
      await wizard.sendMessage(
        chatId,
        `${titleWithEmoji}\n\n${t(
          lang,
          "transactions.selectAmount"
        )}\n\n${t(lang, "transactions.currency")} ${currency}`,
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
          ? t(lang, "transactions.selectDeductAccount")
          : txType === TransactionType.INCOME
            ? t(lang, "transactions.selectAddAccount")
            : t(lang, "wizard.tx.selectSourceAccount")
      await handlers.handleTxAccount(wizard, chatId, userId, accountMsg)
      break
    }

    case "TX_TO_ACCOUNT":
      await handlers.handleTxToAccount(
        wizard,
        chatId,
        userId,
        t(lang, "wizard.tx.selectDestinationAccount")
      )
      break

    case "TX_CONFIRM_REFUND": {
      if (!data) break
      if (data.amount !== undefined && data.currency) {
        await wizard.sendMessage(
          chatId,
          t(lang, "wizard.tx.refundConfirmMessage", {
            amount: data.amount,
            currency: data.currency,
          }),
          {
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "transactions.yesRefund") }],
                [
                  { text: t(lang, "buttons.back") },
                  { text: t(lang, "buttons.mainMenu") },
                ],
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
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
            ],
            resize_keyboard: true,
          },
        }
      )
      break
    }
    case "TX_VIEW_LIST": {
      const transactions = state?.data?.transactions || []
      const period = state?.data?.period || t(lang, "wizard.tx.periodAllTime")
      const toShow = transactions.slice(0, 10)

      const items = toShow.map((tx: Transaction) => {
        const emoji =
          tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
        return `${emoji} ${escapeMarkdown(getCategoryLabel(lang, tx.category))} \n${formatMoney(tx.amount, tx.currency)}`
      })

      const listButtons = createListButtons({
        items,
        lang,
      })

      await wizard.sendMessage(
        chatId,
        `${t(lang, "transactions.historyTitle")}\n\n${period}\n\n${t(
          lang,
          "transactions.showing",
          { count: toShow.length, total: transactions.length }
        )}\n\n${t(lang, "wizard.tx.selectTransactionToEdit")}`,
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
      const account =
        tx.fromAccountId || tx.toAccountId || t(lang, "common.notAvailable")
      await wizard.sendMessage(
        chatId,
        `${t(lang, "wizard.tx.detailsTitle")}\n\n` +
          `${t(lang, "wizard.tx.detailsType", {
            type:
              tx.type === "EXPENSE"
                ? t(lang, "transactions.expenseTitle")
                : tx.type === "INCOME"
                  ? t(lang, "transactions.incomeTitle")
                  : t(lang, "transactions.transferTitle"),
          })}\n` +
          `${t(lang, "wizard.tx.detailsCategory", {
            category: escapeMarkdown(getCategoryLabel(lang, tx.category)),
          })}\n` +
          `${t(lang, "wizard.tx.detailsAmount", {
            amount: formatMoney(tx.amount, tx.currency),
          })}\n` +
          `${t(lang, "wizard.tx.detailsAccount", {
            account: escapeMarkdown(account),
          })}\n` +
          `${t(lang, "wizard.tx.detailsDate", {
            date: formatDateDisplay(new Date(tx.date)),
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
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
        `${t(lang, "wizard.tx.editAmountTitle")}\n\n${t(
          lang,
          "wizard.tx.currentAmount",
          { amount: formatMoney(tx.amount, tx.currency) }
        )}\n\n${t(lang, "wizard.tx.enterNewAmount", {
          currency: defaultCurrency,
        })}`,
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(lang),
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
        title = `${t(lang, "wizard.tx.editCategoryExpenseTitle")}\n\n${t(
          lang,
          "wizard.tx.currentCategory",
          { category: getExpenseCategoryLabel(lang, tx.category) }
        )}`
      } else {
        categories = Object.values(IncomeCategory)
        title = `${t(lang, "wizard.tx.editCategoryIncomeTitle")}\n\n${t(
          lang,
          "wizard.tx.currentCategory",
          { category: getIncomeCategoryLabel(lang, tx.category) }
        )}`
      }

      const items =
        tx.type === "EXPENSE"
          ? categories.map((c) => getExpenseCategoryLabel(lang, c, "short"))
          : categories.map((c) => getIncomeCategoryLabel(lang, c, "short"))
      const keyboard = createListButtons({ items, lang })

      await wizard.sendMessage(
        chatId,
        `${title}\n\n${t(lang, "wizard.tx.selectNewCategory")}`,
        {
          parse_mode: "Markdown",
          reply_markup: { keyboard, resize_keyboard: true },
        }
      )
      break
    }
    case "TX_EDIT_ACCOUNT": {
      const tx = state?.data?.transaction
      if (!tx) break
      const account =
        tx.fromAccountId || tx.toAccountId || t(lang, "common.notAvailable")
      const msg = `${t(lang, "wizard.tx.editAccountTitle")}\n\n${t(
        lang,
        "wizard.tx.currentAccount",
        { account: escapeMarkdown(account) }
      )}\n\n${t(lang, "wizard.tx.selectNewAccount")}`
      await handlers.handleTxAccount(wizard, chatId, userId, msg)
      break
    }

    // --- Debt Flow ---
    case "DEBT_TYPE":
      await wizard.sendMessage(chatId, t(lang, "wizard.debt.selectType"), {
        reply_markup: {
          keyboard: [
            [
              { text: t(lang, "buttons.iOwe") },
              { text: t(lang, "buttons.theyOweMe") },
            ],
            [
              { text: t(lang, "buttons.back") },
              { text: t(lang, "buttons.mainMenu") },
            ],
          ],
          resize_keyboard: true,
        },
      })
      break

    case "DEBT_AMOUNT":
      await wizard.sendMessage(
        chatId,
        t(lang, "wizard.debt.enterAmount", { currency: defaultCurrency }),
        wizard.getBackButton(lang)
      )
      break

    case "DEBT_PARTIAL_AMOUNT": {
      if (!data) break
      if (data.debt) {
        const remaining = data.debt.amount - data.debt.paidAmount
        await wizard.sendMessage(
          chatId,
          t(lang, "wizard.debt.partialPaymentPrompt", {
            name: escapeMarkdown(data.debt.name),
            remaining,
          }),
          wizard.getBackButton(lang)
        )
      }
      break
    }

    case "DEBT_PARTIAL_ACCOUNT":
      await handlers.handleTxAccount(
        wizard,
        chatId,
        userId,
        t(lang, "wizard.debt.selectPaymentAccount")
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
        lang,
        beforeItemsButtons: [[{ text: t(lang, "buttons.addDebt") }]],
      })

      await wizard.sendMessage(chatId, t(lang, "wizard.debt.selectToEdit"), {
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
        t(lang, "wizard.debt.editAmountPrompt", {
          current: formatMoney(debt.amount, debt.currency),
          paid: formatMoney(debt.paidAmount, debt.currency),
        }),
        wizard.getBackButton(lang)
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

        wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "buttons.editAmount") }],
              ...deadlineButtons,
              [{ text: t(lang, "wizard.debt.deleteDebtButton") }],
              [
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
      const action =
        type === "I_OWE"
          ? t(lang, "wizard.debt.actionOweTo")
          : t(lang, "wizard.debt.actionLentTo")
      const defaultCurrency = await db.getDefaultCurrency(userId)
      await wizard.sendMessage(
        chatId,
        t(lang, "wizard.debt.createDetails", {
          emoji,
          action,
          currency: defaultCurrency,
        }),
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(lang),
        }
      )
      break
    }

    // --- Goal Flow ---
    case "GOAL_INPUT":
      await wizard.sendMessage(
        chatId,
        t(lang, "wizard.goal.addPrompt", { currency: defaultCurrency }),
        wizard.getBackButton(lang)
      )
      break

    case "GOAL_DEPOSIT_AMOUNT": {
      if (!data) break
      if (data.goal) {
        await wizard.sendMessage(
          chatId,
          t(lang, "wizard.goal.depositAmountPrompt", {
            name: escapeMarkdown(data.goal.name),
            target: data.goal.targetAmount,
            current: data.goal.currentAmount,
          }),
          wizard.getBackButton(lang)
        )
      }
      break
    }

    case "GOAL_DEPOSIT_ACCOUNT":
      await handlers.handleTxAccount(
        wizard,
        chatId,
        userId,
        t(lang, "wizard.goal.selectWithdrawAccount")
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

        wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "buttons.editTarget") }],
              ...deadlineButtons,
              [{ text: t(lang, "wizard.goal.deleteGoalButton") }],
              [
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
      const items = completedGoals.map((g: Goal) =>
        t(lang, "wizard.goal.completedItem", {
          name: escapeMarkdown(g.name),
        })
      )
      const keyboard = createListButtons({ items, lang })
      await wizard.sendMessage(chatId, t(lang, "wizard.goal.completedSelect"), {
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
        t(lang, "wizard.goal.completedDeleteMessage", {
          name: escapeMarkdown(goal.name),
          target: `${goal.targetAmount} ${goal.currency}`,
          achieved: `${goal.currentAmount} ${goal.currency}`,
        }),
        {
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "wizard.goal.deleteGoalButton") }],
              [
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
        t(lang, "wizard.goal.editTargetPrompt", {
          current: formatMoney(goal.targetAmount, goal.currency),
        }),
        {
          parse_mode: "Markdown",
          ...wizard.getBackButton(lang),
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
        t(lang, "wizard.goal.completeConfirmMessage", {
          amount: formatMoney(newTargetAmount, goal.currency),
        }),
        {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "wizard.goal.confirmCompleteYes") }],
              [{ text: t(lang, "wizard.goal.confirmCompleteNo") }],
              [
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
        t(lang, "wizard.income.enterAmount", {
          name: escapeMarkdown(data.name),
          currency: defaultCurrency,
        }),
        wizard.getBackButton(lang)
      )
      break
    }
    case "INCOME_VIEW":
      await showIncomeSourcesMenu(wizard.getBot(), chatId, userId, lang)
      break

    case "INCOME_NAME":
      wizard.sendMessage(
        chatId,
        t(lang, "wizard.income.enterName"),
        wizard.getBackButton(lang)
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
          lang,
        })
        await wizard.sendMessage(
          chatId,
          t(lang, "wizard.income.deleteConfirm", {
            name: escapeMarkdown(incomeName),
          }),
          {
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "wizard.income.confirmDeleteButton") }],
                [
                  { text: t(lang, "buttons.back") },
                  { text: t(lang, "buttons.mainMenu") },
                ],
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
        t(lang, "wizard.balance.enterName"),
        wizard.getBackButton(lang)
      )
      break

    case "BALANCE_AMOUNT":
      await wizard.sendMessage(
        chatId,
        t(lang, "wizard.balance.enterAmount", { currency: defaultCurrency }),
        wizard.getBackButton(lang)
      )
      break

    case "BALANCE_DELETE_TRANSFER": {
      if (!data) break
      if (data.accountId && data.currency && data.amount !== undefined) {
        await wizard.sendMessage(
          chatId,
          t(lang, "wizard.balance.deleteTransferPrompt", {
            accountId: data.accountId,
            amount: formatMoney(data.amount, data.currency),
          }),
          {
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "buttons.transferToAnotherAccount") }],
                [{ text: t(lang, "wizard.balance.deleteAndClear") }],
                [
                  { text: t(lang, "buttons.back") },
                  { text: t(lang, "buttons.mainMenu") },
                ],
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
          lang,
        })

        await wizard.sendMessage(
          chatId,
          t(lang, "wizard.balance.transferToPrompt", {
            amount: formatMoney(data.amount, data.currency),
          }),
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
          t(lang, "wizard.balance.currencyChoicePrompt", {
            inputAmount: data.inputAmount,
            inputCurrency: data.inputCurrency,
            balanceCurrency: data.currency,
          }),
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: t(lang, "wizard.balance.convertTo", {
                      amount: formatMoney(data.convertedAmount, data.currency),
                    }),
                  },
                ],
                [
                  {
                    text: t(lang, "wizard.balance.changeTo", {
                      amount: data.inputAmount,
                      currency: data.inputCurrency,
                    }),
                  },
                ],
                [
                  { text: t(lang, "buttons.back") },
                  { text: t(lang, "buttons.mainMenu") },
                ],
              ],
              resize_keyboard: true,
            },
          }
        )
      }
      break
    }
    case "BALANCE_LIST": {
      await showBalancesMenu(wizard, chatId, userId, lang)
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
            keyboard.push([{ text: t(lang, "wizard.balance.setToZero") }])
          }

          keyboard.push(
            [{ text: t(lang, "wizard.balance.deleteBalance") }],
            [
              { text: t(lang, "buttons.back") },
              { text: t(lang, "buttons.mainMenu") },
            ]
          )

          await wizard.sendMessage(
            chatId,
            `${t(lang, "wizard.balance.editTitle", {
              accountId,
              currency,
            })}\n\n` +
              `${t(lang, "wizard.balance.editBalanceLine", {
                amount: formatMoney(balance.amount, currency),
              })}\n\n` +
              `${t(lang, "wizard.balance.quickEditTitle")}\n` +
              `${t(lang, "wizard.balance.quickEditNumber")}\n` +
              `${t(lang, "wizard.balance.quickEditText")}`,
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
      await showHistoryMenu(wizard, chatId, userId, lang)
      break
    }
    case "ANALYTICS_REPORTS_MENU": {
      await showAnalyticsReportsMenu(wizard, chatId, userId, lang)
      break
    }
    case "ANALYTICS_FILTERS": {
      await wizard.sendMessage(
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
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
      await showActiveRemindersMenu(wizard, chatId, userId, lang)
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

        let msg = `${statusEmoji} *${escapeMarkdown(name)}*\n${progress}\n`

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

        if (autoDeposit?.enabled) {
          const { amount, accountId, frequency, dayOfWeek, dayOfMonth } =
            autoDeposit
          const scheduleStr =
            frequency === "WEEKLY"
              ? t(lang, "wizard.goal.autoDepositWeekly", {
                  day: t(lang, `wizard.days.${DAY_KEYS[dayOfWeek || 0]}`),
                })
              : t(lang, "wizard.goal.autoDepositMonthly", {
                  day: dayOfMonth || 0,
                })
          msg += `${t(lang, "wizard.goal.autoDepositLine", {
            amount: formatMoney(amount, currency),
            accountId: escapeMarkdown(accountId),
            schedule: scheduleStr,
          })}\n`
        }

        msg += `\n${t(lang, "wizard.goal.enterDepositAmount")}`

        await wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "buttons.editTarget") }],
              [{ text: t(lang, "buttons.advanced") }],
              [{ text: t(lang, "wizard.goal.deleteGoalButton") }],
              [
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
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
        const emoji =
          type === "I_OWE"
            ? t(lang, "wizard.debt.payTo")
            : t(lang, "wizard.debt.getPaidFrom")
        const action =
          type === "I_OWE"
            ? t(lang, "wizard.debt.actionPay")
            : t(lang, "wizard.debt.actionReceive")

        let msg = `${emoji} *${escapeMarkdown(name)}*\n${progress}\n`

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

        await wizard.sendMessage(chatId, msg, {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: t(lang, "buttons.editAmount") }],
              [{ text: t(lang, "buttons.advanced") }],
              [{ text: t(lang, "wizard.debt.deleteDebtButton") }],
              [
                { text: t(lang, "buttons.back") },
                { text: t(lang, "buttons.mainMenu") },
              ],
            ],
            resize_keyboard: true,
          },
        })
      }
      break
    }

    // --- Budget Planner ---
    case "BUDGET_MENU": {
      await showBudgetMenu(wizard, chatId, userId, lang)
      break
    }
    case "BUDGET_SELECT_CATEGORY": {
      const categories = Object.values(ExpenseCategory)
      const items = categories.map((c) => c)
      const keyboard = createListButtons({ items, lang })

      await wizard.sendMessage(
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
          `${t(lang, "wizard.budget.categoryTitle", {
            category,
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
                  { text: t(lang, "buttons.back") },
                  { text: t(lang, "buttons.mainMenu") },
                ],
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
      if (state?.data?.text === t(lang, "buttons.addRecurring")) {
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
      await handlers.handleRecurringMenu(wizard, chatId, userId, lang)
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
      await showMainMenu(wizard.getBot(), chatId, lang, userId)
  }
}
