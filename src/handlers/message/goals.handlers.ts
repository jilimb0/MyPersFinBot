/**
 * Goals message handlers
 */

import { MessageHandler } from "./types"
import { t } from "../../i18n"
import { createProgressBar } from "../../reports"
import { formatMoney } from "../../utils"
import { Goal } from "../../types"
import * as menus from "../../menus-i18n"

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
    msg += `Target: ${formatMoney(targetAmount, currency)}\n`
  } else if (remaining > 0) {
    msg += `Remaining: ${formatMoney(remaining, currency)}\n`
    msg += `Saved: ${formatMoney(currentAmount, currency)} / ${formatMoney(targetAmount, currency)}\n`
  } else {
    msg += `🎉 Goal completed!\n`
    msg += `Amount: ${formatMoney(currentAmount, currency)}\n`
  }

  if (deadline) {
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysLeft > 0) {
      msg += `Deadline: ${deadlineDate.toLocaleDateString("en-GB")} (${daysLeft} days)\n`
    } else {
      msg += `⚠️ Deadline passed: ${deadlineDate.toLocaleDateString("en-GB")}\n`
    }
  }

  msg += `\n💡 Enter amount to contribute`

  const deadlineButtons = deadline
    ? [[{ text: "⚙️ Advanced" }]]
    : [[{ text: t(lang, "goals.setDeadlineBtn") }]]

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "✏️ Edit Target" }],
        ...deadlineButtons,
        [{ text: "🗑 Delete Goal" }],
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
