import TelegramBot from "node-telegram-bot-api"
import { TransactionType, ExpenseCategory, IncomeCategory } from "../types"
import { dbStorage as db } from "../database/storage-db"
import type { WizardState } from "../wizards/wizards"
import { createListButtons, formatMoney, handleInsufficientFunds } from "../utils"

export class QuickActionsHandlers {
  static async handleQuickCategory(
    bot: TelegramBot,
    chatId: number,
    userId: string,
    text: string,
    state: WizardState
  ): Promise<{ handled: boolean; showAllCategories?: boolean }> {
    if (!state.data) {
      state.data = {}
    }

    if (!state.data.topCategoriesShown) {
      const topCategories = await db.getTopCategories(
        userId,
        state.txType,
        5,
        30
      )

      const defaultCategories = this.getDefaultTopCategories(state.txType)

      for (const category of defaultCategories) {
        if (!topCategories.includes(category) && topCategories.length < 5) {
          topCategories.push(category)
        }
      }

      const allItems = [...topCategories, "📋 More..."]

      const items = allItems.map((item) => item)

      const listButtons = createListButtons({
        items,
      })

      await bot.sendMessage(
        chatId,
        `${state.txType === TransactionType.EXPENSE ? "💸" : "💰"} Select category:`,
        {
          reply_markup: { keyboard: listButtons, resize_keyboard: true },
        }
      )

      state.data.topCategoriesShown = true
      return { handled: true }
    }

    if (text === "📋 More...") {
      return { handled: true, showAllCategories: true }
    }

    return { handled: false }
  }

  static async handleQuickAccount(
    bot: TelegramBot,
    chatId: number,
    userId: string,
    state: WizardState,
    clearState: (userId: string) => void
  ): Promise<boolean> {
    if (!state.data) {
      state.data = {}
    }

    const balances = await db.getBalancesList(userId)
    const balancesCount = balances.length

    if (balancesCount > 1 && state.txType === TransactionType.INCOME)
      return false

    let eligibleBalances = balances

    if (state.txType === TransactionType.EXPENSE) {
      eligibleBalances = balances.filter(
        (b) =>
          b.amount > 0 &&
          (b.currency === state.data.currency || b.amount >= state.data.amount)
      )

      if (eligibleBalances.length > 1) {
        return false
      }

      if (eligibleBalances.length === 1) {
        const onlyAccount = eligibleBalances[0].accountId

        if (eligibleBalances[0].currency !== state.data.currency) {
          await bot.sendMessage(
            chatId,
            `❌ Currency mismatch. Account "${onlyAccount}" is in ${eligibleBalances[0].currency}, but expense is in ${state.data.currency}.`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: "💳 Go to Balances" }],
                  [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        if (eligibleBalances[0].amount < state.data.amount) {
          await bot.sendMessage(
            chatId,
            handleInsufficientFunds(
              onlyAccount,
              eligibleBalances[0].amount,
              eligibleBalances[0].currency,
              state.data.amount,
              state.data.currency
            ),
            {
              reply_markup: {
                keyboard: [
                  [{ text: "💳 Go to Balances" }],
                  [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        await db.addTransaction(userId, {
          id: Date.now().toString(),
          type: state.txType,
          amount: state.data.amount,
          category: state.data.category,
          fromAccountId: onlyAccount,
          currency: state.data.currency,
          date: new Date(),
        })

        await db.setCategoryPreferredAccount(
          userId,
          state.data.category,
          onlyAccount
        )

        await bot.sendMessage(
          chatId,
          `✅ 💸 Added: ${formatMoney(state.data.amount, state.data.currency)}\n` +
          `Category: ${state.data.category}\n` +
          `Account: ${onlyAccount}`,
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: `✨ Add Another${state.txType === TransactionType.EXPENSE ? " Expense" : " Income"}`,
                  },
                ],
                [{ text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          }
        )

        clearState(userId)
        return true
      }

      if (eligibleBalances.length === 0) {
        await bot.sendMessage(
          chatId,
          `❌ No accounts available for this expense.\n\n` +
          `Either no accounts have sufficient balance, or currency doesn't match.\n\n` +
          `💡 Add funds to an account or create a new one with ${state.data.currency}.`,
          {
            reply_markup: {
              keyboard: [
                [{ text: "💳 Go to Balances" }],
                [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
              ],
              resize_keyboard: true,
            },
          }
        )
        return true
      }
    }

    const smartAccount = await db.getSmartBalanceSelection(
      userId,
      state.data.category
    )

    if (smartAccount) {
      const balance = balances.find((b) => b.accountId === smartAccount)

      if (!balance) {
        await bot.sendMessage(
          chatId,
          `❌ Account "${smartAccount}" not found.`,
          {
            reply_markup: {
              keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
              resize_keyboard: true,
            },
          }
        )
        return false
      }

      if (state.txType === TransactionType.EXPENSE) {
        if (balance.currency !== state.data.currency) {
          if (balancesCount === 1) {
            await bot.sendMessage(
              chatId,
              `❌ Currency mismatch. Account "${smartAccount}" is in ${balance.currency}, but expense is in ${state.data.currency}.\n\n💡 You can change the amount or add a new account with ${state.data.currency}.`,
              {
                reply_markup: {
                  keyboard: [
                    [{ text: "💳 Go to Balances" }],
                    [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          } else {
            await bot.sendMessage(
              chatId,
              `❌ Currency mismatch. Account "${smartAccount}" is in ${balance.currency}, but expense is in ${state.data.currency}.`,
              {
                reply_markup: {
                  keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
                  resize_keyboard: true,
                },
              }
            )
            return false
          }
        }
        if (balance.amount < state.data.amount) {
          if (balancesCount === 1) {
            await bot.sendMessage(
              chatId,
              handleInsufficientFunds(
                smartAccount,
                balance.amount,
                balance.currency,
                state.data.amount,
                state.data.currency
              ),
              {
                reply_markup: {
                  keyboard: [
                    [{ text: "💳 Go to Balances" }],
                    [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          } else {
            await bot.sendMessage(
              chatId,
              handleInsufficientFunds(
                smartAccount,
                balance.amount,
                balance.currency,
                state.data.amount,
                state.data.currency
              ),
              {
                reply_markup: {
                  keyboard: [
                    [{ text: "💳 Go to Balances" }],
                    [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return false
          }
        }
      }

      await db.addTransaction(userId, {
        id: Date.now().toString(),
        type: state.txType,
        amount: state.data.amount,
        category: state.data.category,
        fromAccountId:
          state.txType === TransactionType.EXPENSE ? smartAccount : undefined,
        toAccountId:
          state.txType === TransactionType.INCOME ? smartAccount : undefined,
        currency: state.data.currency,
        date: new Date(),
      })

      await db.setCategoryPreferredAccount(
        userId,
        state.data.category,
        smartAccount
      )

      const emoji = state.txType === TransactionType.EXPENSE ? "💸" : "💰"

      await bot.sendMessage(
        chatId,
        `✅ ${emoji} Added: ${formatMoney(state.data.amount, state.data.currency)}\n` +
        `Category: ${state.data.category}\n` +
        `Account: ${smartAccount}`,
        {
          reply_markup: {
            keyboard: [
              [
                {
                  text: `✨ Add Another${state.txType === TransactionType.EXPENSE ? " Expense" : " Income"}`,
                },
              ],
              [{ text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )

      clearState(userId)
      return true
    }

    return false
  }

  private static getDefaultTopCategories(txType: TransactionType): string[] {
    if (txType === TransactionType.EXPENSE) {
      return [
        ExpenseCategory.FOOD_DINING,
        ExpenseCategory.SHOPPING,
        ExpenseCategory.TRANSPORTATION,
        ExpenseCategory.UTILITIES,
        ExpenseCategory.ENTERTAINMENT,
      ]
    } else {
      return [
        IncomeCategory.SALARY,
        IncomeCategory.FREELANCE,
        IncomeCategory.BUSINESS,
        IncomeCategory.INVESTMENT,
        IncomeCategory.GIFT,
      ]
    }
  }

  static async getLastUsedAccount(
    userId: string,
    category: string
  ): Promise<string | null> {
    const allTxs = await db.getAllTransactions(userId)
    const categoryTxs = allTxs
      .filter((tx) => tx.category === category)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (categoryTxs.length > 0) {
      return categoryTxs[0].fromAccountId || categoryTxs[0].toAccountId || null
    }

    return null
  }

  static async showAllCategories(
    bot: TelegramBot,
    chatId: number,
    txType: TransactionType
  ) {
    const categories =
      txType === TransactionType.EXPENSE
        ? Object.values(ExpenseCategory)
        : Object.values(IncomeCategory)

    const items = categories.map((category) => category)

    const listButtons = createListButtons({
      items,
    })

    await bot.sendMessage(
      chatId,
      `${txType === TransactionType.EXPENSE ? "💸" : "💰"} Select category:`,
      {
        reply_markup: { keyboard: listButtons, resize_keyboard: true },
      }
    )
  }
}
