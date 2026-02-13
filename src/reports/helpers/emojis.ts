/**
 * Category emoji mappings for visual representation
 */

export const CATEGORY_EMOJIS: Record<string, string> = {
  // Income categories
  SALARY: "💼",
  FREELANCE: "💻",
  BUSINESS: "💼",
  INVESTMENT: "📈",
  TRADING: "💸",
  BONUS: "🎁",
  GIFT: "🎁",
  REFUND: "🔄",
  OTHER_INCOME: "💰",

  // Expense categories
  FOOD_DINING: "🍔",
  COFFEE: "☕",
  GROCERIES: "🛍️",
  TRANSPORTATION: "🚗",
  HOUSING: "🏠",
  UTILITIES: "💡",
  ENTERTAINMENT: "🎬",
  HEALTH: "🏥",
  SHOPPING: "🛒",
  EDUCATION: "📚",
  OTHER_EXPENSE: "📦",

  // Internal categories
  GOAL_DEPOSIT: "🎯",
  DEBT_REPAYMENT: "📉",
  TRANSFER: "↔️",
} as const

/**
 * Gets the emoji for a category
 * @param category - Category name
 * @returns Emoji string, defaults to 💰 if category not found
 */
export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJIS[category] ?? "💰"
}
