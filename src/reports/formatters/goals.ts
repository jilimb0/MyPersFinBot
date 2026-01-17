/**
 * Goals formatting
 */

import { dbStorage as db } from "../../database/storage-db"
import { formatMoney } from "../../utils"
import { createProgressBar, getProgressEmoji } from "../helpers"

/**
 * Formats active goals for a user
 * @param userId - User ID
 * @returns Formatted goals string
 */
export async function formatGoals(userId: string): Promise<string> {
  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g) => g.status === "ACTIVE")

  if (activeGoals.length === 0) {
    return "🎯 *Goals*\n\nNo active goals. Set one to start saving!"
  }

  let msg = "🎯 *Your Financial Goals*\n\n"

  activeGoals.forEach((g) => {
    const remaining = g.targetAmount - g.currentAmount
    const progress = createProgressBar(g.currentAmount, g.targetAmount)
    const statusEmoji = getProgressEmoji(g.currentAmount, g.targetAmount)

    msg += `${statusEmoji} *${g.name}*\n`
    msg += `${progress}\n`
    msg += `💰 Saved: ${formatMoney(g.currentAmount, g.currency)}\n`
    msg += `🎯 Target: ${formatMoney(g.targetAmount, g.currency)}\n`

    if (remaining > 0) {
      msg += `📈 Remaining: ${formatMoney(remaining, g.currency)}\n`
    } else {
      msg += `🎉 Goal achieved!\n`
    }
    msg += "\n"
  })

  return msg
}
