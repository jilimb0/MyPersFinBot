import TelegramBot from "node-telegram-bot-api"
import { TransactionType, ExpenseCategory, IncomeCategory } from "../types"
import { dbStorage as db } from "../database/storage-db"
import type { WizardState } from "../wizards/wizards"
import { formatMoney, handleInsufficientFunds } from "../utils"
import { randomUUID } from "crypto"
import { Language, t } from "../i18n"

export class QuickActionsHandlers {
  private static buildInlineCategoryKeyboard(
    items: string[],
    itemsPerRow: number = 2
  ): TelegramBot.InlineKeyboardButton[][] {
    const keyboard: TelegramBot.InlineKeyboardButton[][] = []

    for (let i = 0; i < items.length; i += itemsPerRow) {
      const row: TelegramBot.InlineKeyboardButton[] = []
      for (let j = 0; j < itemsPerRow && i + j < items.length; j++) {
        const text = items[i + j]
        if (text) {
          row.push({ text, callback_data: `tx_cat|${text}` })
        }
      }
      if (row.length > 0) keyboard.push(row)
    }

    return keyboard
  }

  static async handleQuickCategory(
    bot: TelegramBot,
    chatId: number,
    userId: string,
    text: string,
    state: WizardState
  ): Promise<{ handled: boolean; showAllCategories?: boolean }> {
    if (!state?.data) {
      if (!state) return { handled: false, showAllCategories: false }
      state.data = {}
    }

    if (!state?.data?.topCategoriesShown) {
      const lang = state?.lang || "en"
      const topCategories = await db.getTopCategories(
        userId,
        state.txType!,
        5,
        30
      )

      const defaultCategories = this.getDefaultTopCategories(state.txType!)

      for (const category of defaultCategories) {
        if (!topCategories.includes(category) && topCategories.length < 5) {
          topCategories.push(category)
        }
      }

      const allItems = [
        ...topCategories,
        t(lang, "transactions.moreCategories"),
      ]

      const items = allItems.map((item) => item)

      await bot.sendMessage(
        chatId,
        `${state.txType === TransactionType.EXPENSE ? "💸" : "💰"} ${t(
          lang,
          "transactions.selectCategory"
        )}`,
        {
          reply_markup: {
            inline_keyboard: this.buildInlineCategoryKeyboard(items),
          },
        }
      )

      if (state?.data) {
        state.data.topCategoriesShown = true
      }
      return { handled: true }
    }

    if (text === t(state?.lang || "en", "transactions.moreCategories")) {
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
    if (!state?.data) {
      if (state) {
        state.data = {}
      }
    }

    const lang = state?.lang || "en"
    const balances = await db.getBalancesList(userId)
    const balancesCount = balances.length

    if (balancesCount > 1 && state.txType === TransactionType.INCOME)
      return false

    let eligibleBalances = balances

    if (state.txType === TransactionType.EXPENSE) {
      eligibleBalances = balances.filter(
        (b) =>
          b.amount > 0 &&
          (b.currency === state?.data?.currency ||
            b.amount >= state?.data?.amount)
      )

      if (eligibleBalances.length > 1) {
        return false
      }

      if (eligibleBalances.length === 1) {
        const onlyAccount = eligibleBalances[0]?.accountId || ""

        if (eligibleBalances[0]?.currency !== state?.data?.currency) {
          await bot.sendMessage(
            chatId,
            t(lang, "errors.currencyMismatchAccount", {
              account: onlyAccount,
              accountCurrency: eligibleBalances[0]?.currency || "",
              transactionCurrency: state?.data?.currency || "",
            }),
            {
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "common.goToBalances") }],
                  [
                    { text: t(lang, "buttons.changeAmount") },
                    { text: t(lang, "mainMenu.mainMenuButton") },
                  ],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        if (
          eligibleBalances[0] &&
          eligibleBalances[0].amount < state?.data?.amount
        ) {
          await bot.sendMessage(
            chatId,
            handleInsufficientFunds(
              lang,
              onlyAccount,
              eligibleBalances[0]?.amount,
              eligibleBalances[0]?.currency,
              state?.data?.amount,
              state?.data?.currency
            ),
            {
              reply_markup: {
                keyboard: [
                  [{ text: t(lang, "common.goToBalances") }],
                  [
                    { text: t(lang, "buttons.changeAmount") },
                    { text: t(lang, "mainMenu.mainMenuButton") },
                  ],
                ],
                resize_keyboard: true,
              },
            }
          )
          return true
        }

        await db.addTransaction(userId, {
          id: randomUUID(),
          type: state.txType!,
          amount: state?.data?.amount,
          category: state?.data?.category,
          fromAccountId: onlyAccount,
          currency: state?.data?.currency,
          date: new Date(),
        })

        await db.setCategoryPreferredAccount(
          userId,
          state?.data?.category,
          onlyAccount
        )

        await bot.sendMessage(
          chatId,
          t(lang, "transactions.addedDetails", {
            emoji: "💸",
            amount: formatMoney(state?.data?.amount, state?.data?.currency),
            category: state?.data?.category,
            account: onlyAccount,
          }),
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: t(
                      lang,
                      state.txType === TransactionType.EXPENSE
                        ? "transactions.addAnotherExpense"
                        : "transactions.addAnotherIncome"
                    ),
                  },
                ],
                [{ text: t(lang, "mainMenu.mainMenuButton") }],
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
          t(lang, "transactions.noEligibleAccounts", {
            currency: state?.data?.currency,
          }),
          {
            reply_markup: {
              keyboard: [
                [{ text: t(lang, "common.goToBalances") }],
                [
                  { text: t(lang, "buttons.changeAmount") },
                  { text: t(lang, "mainMenu.mainMenuButton") },
                ],
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
      state?.data?.category
    )

    if (smartAccount) {
      const balance = balances.find((b) => b.accountId === smartAccount)

      if (!balance) {
        await bot.sendMessage(
          chatId,
          t(lang, "errors.accountNotFound", { account: smartAccount }),
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
        return false
      }

      if (state.txType === TransactionType.EXPENSE) {
        if (balance.currency !== state?.data?.currency) {
          if (balancesCount === 1) {
            await bot.sendMessage(
              chatId,
              t(lang, "transactions.currencyMismatchSingleAccount", {
                account: smartAccount,
                accountCurrency: balance.currency,
                transactionCurrency: state?.data?.currency,
              }),
              {
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "common.goToBalances") }],
                    [
                      { text: t(lang, "buttons.changeAmount") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
                  ],
                  resize_keyboard: true,
                },
              }
            )
            return true
          } else {
            await bot.sendMessage(
              chatId,
              t(lang, "errors.currencyMismatchAccount", {
                account: smartAccount,
                accountCurrency: balance.currency,
                transactionCurrency: state?.data?.currency || "",
              }),
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
            return false
          }
        }
        if (balance.amount < state?.data?.amount) {
          if (balancesCount === 1) {
            await bot.sendMessage(
              chatId,
              handleInsufficientFunds(
                lang,
                smartAccount,
                balance.amount,
                balance.currency,
                state?.data?.amount,
                state?.data?.currency
              ),
              {
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "common.goToBalances") }],
                    [
                      { text: t(lang, "buttons.changeAmount") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
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
                lang,
                smartAccount,
                balance.amount,
                balance.currency,
                state?.data?.amount,
                state?.data?.currency
              ),
              {
                reply_markup: {
                  keyboard: [
                    [{ text: t(lang, "common.goToBalances") }],
                    [
                      { text: t(lang, "buttons.changeAmount") },
                      { text: t(lang, "mainMenu.mainMenuButton") },
                    ],
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
        id: randomUUID(),
        type: state.txType!,
        amount: state?.data?.amount,
        category: state?.data?.category,
        fromAccountId:
          state.txType === TransactionType.EXPENSE ? smartAccount : undefined,
        toAccountId:
          state.txType === TransactionType.INCOME ? smartAccount : undefined,
        currency: state?.data?.currency,
        date: new Date(),
      })

      await db.setCategoryPreferredAccount(
        userId,
        state?.data?.category,
        smartAccount
      )

      const emoji = state.txType === TransactionType.EXPENSE ? "💸" : "💰"

      await bot.sendMessage(
        chatId,
        t(lang, "transactions.addedDetails", {
          emoji,
          amount: formatMoney(state?.data?.amount, state?.data?.currency),
          category: state?.data?.category,
          account: smartAccount,
        }),
        {
          reply_markup: {
            keyboard: [
              [
                {
                  text: t(
                    lang,
                    state.txType === TransactionType.EXPENSE
                      ? "transactions.addAnotherExpense"
                      : "transactions.addAnotherIncome"
                  ),
                },
              ],
              [{ text: t(lang, "mainMenu.mainMenuButton") }],
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
      return (
        categoryTxs[0]?.fromAccountId || categoryTxs[0]?.toAccountId || null
      )
    }

    return null
  }

  static async showAllCategories(
    bot: TelegramBot,
    chatId: number,
    txType: TransactionType,
    lang: Language
  ) {
    const categories =
      txType === TransactionType.EXPENSE
        ? Object.values(ExpenseCategory)
        : Object.values(IncomeCategory)

    const items = categories.map((category) => category)

    await bot.sendMessage(
      chatId,
      `${txType === TransactionType.EXPENSE ? "💸" : "💰"} ${t(
        lang,
        "transactions.selectCategory"
      )}`,
      {
        reply_markup: {
          inline_keyboard: this.buildInlineCategoryKeyboard(items),
        },
      }
    )
  }
}
