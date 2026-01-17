/**
 * Progress bar utilities
 */

import { formatAmount } from "../../utils"

/**
 * Creates a visual progress bar
 * @param current - Current value
 * @param target - Target value
 * @param length - Bar length in characters (default: 10)
 * @returns Formatted progress bar string
 */
export function createProgressBar(
  current: number,
  target: number,
  length: number = 10
): string {
  const percentage = Math.min(100, (current / target) * 100)
  const filled = Math.floor((percentage / 100) * length)
  const empty = length - filled

  const bar = "█".repeat(filled) + "░".repeat(empty)
  return `${bar} ${formatAmount(percentage)}%`
}

/**
 * Gets a status emoji based on progress percentage
 * @param current - Current value
 * @param target - Target value
 * @returns Status emoji
 */
export function getProgressEmoji(current: number, target: number): string {
  const percentage = (current / target) * 100

  if (percentage >= 100) return "✅"
  if (percentage >= 75) return "🔥"
  if (percentage >= 50) return "💪"
  if (percentage >= 25) return "🌱"
  return "🎯"
}
