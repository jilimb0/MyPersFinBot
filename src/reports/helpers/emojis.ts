/**
 * Category emoji mappings for visual representation
 */

export const CATEGORY_EMOJIS: Record<string, string> = {
  // Income categories
  Salary: "💼",
  Freelance: "💻",
  Business: "💼",
  Investment: "📈",
  Trading: "💸",
  Bonus: "🎁",
  Gift: "🎁",
  Refund: "🔄",

  // Expense categories
  Food: "🍔",
  Coffee: "☕",
  Groceries: "🛍️",
  Transport: "🚗",
  Housing: "🏠",
  Utilities: "💡",
  Entertainment: "🎬",
  Health: "🏥",
  Shopping: "🛒",
  Education: "📚",

  // Internal categories
  Goal: "🎯",
  Debt: "📉",
  Transfer: "↔️",
  Other: "📦",
} as const

/**
 * Gets the emoji for a category
 * @param category - Category name
 * @returns Emoji string, defaults to 💰 if category not found
 */
export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJIS[category] ?? "💰"
}
