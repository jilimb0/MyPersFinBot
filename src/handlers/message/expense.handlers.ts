/**
 * Expense message handlers
 */

import type TelegramBot from "node-telegram-bot-api"
import { t } from "../../i18n"
import { getGoToBalancesKeyboard } from "../../i18n/keyboards"
import { TransactionType } from "../../types"
import { formatMoney } from "../../utils"
import type { MessageHandler } from "./types"

/**
 * Handle expense menu button
 */
export const handleExpenseStart: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context

  const balanceCount = (await db.getBalancesList(userId)).length

  if (balanceCount === 0) {
    await bot.sendMessage(chatId, t(lang, "transactions.noBalances"), {
      parse_mode: "Markdown",
      ...getGoToBalancesKeyboard(lang),
    })
    return true
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
  const standardValues = denominations.filter((d) => !topValues.includes(d))

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

  await bot.sendMessage(
    chatId,
    `${t(lang, "transactions.expenseTitle")}\n\n${t(
      lang,
      "transactions.selectAmount"
    )}\n\n${t(lang, "transactions.currency")} ${currency}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
      },
    }
  )
  return true
}
