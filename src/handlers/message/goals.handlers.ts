/**
 * Goals message handlers
 */

import { MessageHandler } from "./types"
import { Language, t } from "../../i18n"
import { createProgressBar } from "../../reports"
import { formatMoney } from "../../utils"
import { Goal } from "../../types"
import * as menus from "../../menus-i18n"
import * as helpers from "../../wizards/helpers"

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
 * Handle goals menu button
 */
export const handleGoalsMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "NONE",
    data: {},
    returnTo: "goals",
    lang,
  })

  await menus.showGoalsMenu(bot, chatId, userId, lang)
}

/**
 * Handle "Add Goal" button
 */
export const handleAddGoal: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "GOAL_INPUT",
    data: {},
    returnTo: "goals",
    lang,
  })

  await helpers.resendCurrentStepPrompt(
    wizardManager,
    chatId,
    userId,
    wizardManager.getState(userId)!
  )
}

/**
 * Handle goal selection (when user clicks on specific goal name)
 */
export const handleGoalSelection: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db, text } = context

  const state = wizardManager.getState(userId)
  if (state?.returnTo !== "goals") {
    return false // Not in goals context
  }

  const userData = await db.getUserData(userId)
  const goal = userData.goals.find(
    (g: Goal) => g.name === text && g.status !== "COMPLETED"
  )

  if (!goal) {
    return false // Not a goal
  }

  await wizardManager.goToStep(userId, "GOAL_MENU", {
    goal,
    goalId: goal.id,
  })

  const { name, targetAmount, currentAmount, deadline, currency } = goal
  const remaining = targetAmount - currentAmount
  const progress = createProgressBar(currentAmount, targetAmount)
  const progressPercent = Math.round((currentAmount / targetAmount) * 100)

  let msg = `🎯 *${name}*\n`
  msg += `${progress} ${progressPercent}%\n\n`

  if (currentAmount === 0) {
    msg += `${t(lang, "wizard.goal.targetLine", {
      amount: formatMoney(targetAmount, currency),
    })}\n`
  } else if (remaining > 0) {
    msg += `${t(lang, "wizard.goal.remainingLine", {
      amount: formatMoney(remaining, currency),
    })}\n`
    msg += `${t(lang, "goals.savedLine", {
      current: formatMoney(currentAmount, currency),
      target: formatMoney(targetAmount, currency),
    })}\n`
  } else {
    msg += `${t(lang, "wizard.goal.achievedLine")}\n`
    msg += `${t(lang, "goals.amountLine", {
      amount: formatMoney(currentAmount, currency),
    })}\n`
  }

  if (deadline) {
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysLeft > 0) {
      msg += `${t(lang, "goals.deadlineWithDaysLeft", {
        date: formatDate(lang, deadlineDate),
        days: daysLeft,
      })}\n`
    } else {
      msg += `${t(lang, "goals.deadlinePassed", {
        date: formatDate(lang, deadlineDate),
      })}\n`
    }
  }

  msg += `\n${t(lang, "wizard.goal.enterDepositAmount")}`

  const deadlineButtons = deadline
    ? [[{ text: t(lang, "buttons.advanced") }]]
    : [[{ text: t(lang, "goals.setDeadlineBtn") }]]

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: t(lang, "buttons.editTarget") }],
        ...deadlineButtons,
        [{ text: t(lang, "wizard.goal.deleteGoalButton") }],
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
