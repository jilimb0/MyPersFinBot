/**
 * Goals formatting
 */

import { dbStorage as db } from "../../database/storage-db"
import { Goal } from "../../types"
import { formatMoney } from "../../utils"
import { createProgressBar, getProgressEmoji } from "../helpers"

/**
 * Formats active goals for a user
 * @param userId - User ID
 * @returns Formatted goals string
 */
export async function formatGoals(userId: string): Promise<string> {
  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g: Goal) => g.status === "ACTIVE")

  if (activeGoals.length === 0) {
    return "🎯 *Goals*\n\nNo active goals. Set one to start saving!"
  }

  let msg = "🎯 *Your Financial Goals*\n\n"

  activeGoals.forEach((g: Goal) => {
    const remaining = g.targetAmount - g.currentAmount
    const progress = createProgressBar(g.currentAmount, g.targetAmount)
    const statusEmoji = getProgressEmoji(g.currentAmount, g.targetAmount)

    msg += `${statusEmoji} *${g.name}*\n`
    msg += `${progress}\n`

    if (g.currentAmount === 0) {
      msg += `Target: ${formatMoney(g.targetAmount, g.currency)}\n`
    } else if (remaining > 0) {
      msg += `📈 Remaining: ${formatMoney(remaining, g.currency)}\n`
    } else {
      msg += `🎉 Goal achieved!\n`
    }

    // Add deadline if exists
    if (g.deadline) {
      const deadlineDate = new Date(g.deadline)
      msg += `Deadline: ${deadlineDate.toLocaleDateString("en-GB")}\n`
    }

    msg += "\n"
  })

  return msg
}
