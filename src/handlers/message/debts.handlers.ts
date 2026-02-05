/**
 * Debts message handlers
 */

import { MessageHandler } from "./types"
import { t } from "../../i18n"
import { createProgressBar } from "../../reports"
import { formatMoney } from "../../utils"
import { Debt } from "../../types"
import * as menus from "../../menus-i18n"

/**
 * Handle debts menu button
 */
export const handleDebtsMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "NONE",
    data: {},
    returnTo: "debts",
    lang,
  })

  await menus.showDebtsMenu(bot, chatId, userId, lang)
}

/**
 * Handle debt selection (when user clicks on specific debt name)
 */
export const handleDebtSelection: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db, text } = context

  const state = wizardManager.getState(userId)
  if (state?.returnTo !== "debts") {
    return false // Not in debts context
  }

  const userData = await db.getUserData(userId)
  const debt = userData.debts.find((d: Debt) => d.name === text && !d.isPaid)

  if (!debt) {
    return false // Not a debt
  }

  await wizardManager.goToStep(userId, "DEBT_MENU", {
    debt,
    debtId: debt.id,
  })

  const { amount, paidAmount, type, dueDate, name, currency } = debt
  const remaining = amount - paidAmount
  const progress = createProgressBar(paidAmount, amount)
  const emoji = type === "I_OWE" ? "💸 Pay to" : "💰 Get paid from"
  const action = type === "I_OWE" ? "pay" : "receive"

  let msg = `${emoji} *${name}*\n`
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

  await bot.sendMessage(chatId, msg, {
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

  return true
}
