/**
 * Goals formatting
 */

import { dbStorage as db } from "../../database/storage-db"
import { Goal } from "../../types"
import { formatMoney } from "../../utils"
import { createProgressBar, getProgressEmoji } from "../helpers"
import { t } from "../../i18n"

/**
 * Formats active goals for a user
 * @param userId - User ID
 * @returns Formatted goals string
 */
export async function formatGoals(userId: string): Promise<string> {
  const lang = await db.getUserLanguage(userId)
  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g: Goal) => g.status === "ACTIVE")

  if (activeGoals.length === 0) {
    return `${t(lang, "reports.goals.empty")}\n\n${t(
      lang,
      "goals.emptyHint"
    )}`
  }

  let msg = `${t(lang, "reports.goals.title")}\n\n`

  activeGoals.forEach((g: Goal) => {
    const remaining = g.targetAmount - g.currentAmount
    const progress = createProgressBar(g.currentAmount, g.targetAmount)
    const statusEmoji = getProgressEmoji(g.currentAmount, g.targetAmount)

    msg += `${statusEmoji} *${g.name}*\n`
    msg += `${progress}\n`

    if (g.currentAmount === 0) {
      msg += `${t(lang, "reports.goals.target", {
        amount: formatMoney(g.targetAmount, g.currency),
      })}\n`
    } else if (remaining > 0) {
      msg += `${t(lang, "reports.goals.remaining", {
        amount: formatMoney(remaining, g.currency),
      })}\n`
    } else {
      msg += `${t(lang, "reports.goals.achieved")}\n`
    }

    // Add deadline if exists
    if (g.deadline) {
      const deadlineDate = new Date(g.deadline)
      msg += `${t(lang, "reports.goals.deadline", {
        date: deadlineDate.toLocaleDateString(
          lang === "ru"
            ? "ru-RU"
            : lang === "uk"
              ? "uk-UA"
              : lang === "es"
                ? "es-ES"
                : lang === "pl"
                  ? "pl-PL"
                  : "en-GB"
        ),
      })}\n`
    }

    msg += "\n"
  })

  return msg
}
