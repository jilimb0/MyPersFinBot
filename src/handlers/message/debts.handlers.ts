/**
 * Debts message handlers
 */

import { type Language, t } from "../../i18n"
import * as menus from "../../menus-i18n"
import { createProgressBar } from "../../reports"
import type { Debt } from "../../types"
import { escapeMarkdown, formatMoney } from "../../utils"
import * as helpers from "../../wizards/helpers"
import type { MessageHandler } from "./types"

const LOCALES: Record<Language, string> = {
  en: "en-US",
  ru: "ru-RU",
  uk: "uk-UA",
  es: "es-ES",
  pl: "pl-PL",
}

function formatDate(lang: Language, date: Date): string {
  return date.toLocaleDateString(LOCALES[lang])
}

/**
 * Handle debts menu button
 */
export const handleDebtsMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "DEBT_EDIT_SELECT",
    data: {},
    returnTo: "debts",
    lang,
  })

  await menus.showDebtsMenu(bot, chatId, userId, lang)
  return true
}

/**
 * Handle "Add Debt" button
 */
export const handleAddDebt: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "DEBT_TYPE",
    data: {},
    returnTo: "debts",
    lang,
  })

  await helpers.resendCurrentStepPrompt(
    wizardManager,
    chatId,
    userId,
    wizardManager.getState(userId)!
  )
  return true
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
  const emoji =
    type === "I_OWE"
      ? t(lang, "wizard.debt.payTo")
      : t(lang, "wizard.debt.getPaidFrom")
  const action =
    type === "I_OWE"
      ? t(lang, "wizard.debt.actionPay")
      : t(lang, "wizard.debt.actionReceive")

  let msg = `${emoji} *${escapeMarkdown(name)}*\n`
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
      date: formatDate(lang, deadlineDate),
    })}\n`
  }

  msg += `\n${t(lang, "wizard.debt.enterAmountTo", { action })}`

  const deadlineButtons = dueDate
    ? [[{ text: t(lang, "buttons.advanced") }]]
    : [[{ text: t(lang, "buttons.setDeadline") }]]

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: t(lang, "buttons.editAmount") }],
        ...deadlineButtons,
        [{ text: t(lang, "wizard.debt.deleteDebtButton") }],
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
