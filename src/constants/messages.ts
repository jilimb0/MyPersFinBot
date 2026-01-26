/**
 * Centralized message constants
 * All user-facing messages in one place for easy maintenance
 */

export const MESSAGES = {
  // ❌ Error Messages
  ERRORS: {
    INSUFFICIENT_FUNDS: (account: string, current: number, required: number) =>
      `❌ Insufficient funds in ${account}\n\nCurrent: ${current}\nRequired: ${Math.abs(required)}`,

    INVALID_CATEGORY: "❌ Invalid category. Please select from the list.",

    INVALID_AMOUNT: "❌ Invalid amount. Please enter a valid number.",

    INVALID_CURRENCY: (currency: string) =>
      `❌ Invalid currency: ${currency}\n\nSupported: USD, EUR, GEL, RUB, UAH, PLN`,

    ACCOUNT_NOT_FOUND: (accountId: string) =>
      `❌ Account "${accountId}" not found`,

    BALANCE_NOT_FOUND: (accountId: string, currency: string) =>
      `❌ Balance not found for account "${accountId}" in ${currency}`,

    TRANSACTION_FAILED: "❌ Transaction failed. Please try again.",

    DATABASE_ERROR: "❌ Database error. Please contact support.",

    PERMISSION_DENIED:
      "❌ Permission denied. You don't have access to this resource.",

    INVALID_DATE: "❌ Invalid date format. Please use YYYY-MM-DD.",

    INVALID_INPUT: "❌ Invalid input. Please check your data and try again.",

    RATE_LIMIT_EXCEEDED: (retryAfter: number) =>
      `⏱️ Too many requests. Please try again in ${retryAfter} seconds.`,

    USER_BLOCKED: (until: Date) =>
      `🚫 You have been temporarily blocked until ${until.toLocaleString()}`,
  },

  // ✅ Success Messages
  SUCCESS: {
    TRANSACTION_ADDED: (amount: number, currency: string, category?: string) =>
      category
        ? `✅ Added: ${amount} ${currency} (${category})`
        : `✅ Added: ${amount} ${currency}`,

    EXPENSE_ADDED: (amount: number, currency: string, account: string) =>
      `✅ Expense recorded: -${amount} ${currency} from ${account}`,

    INCOME_ADDED: (amount: number, currency: string, account: string) =>
      `✅ Income recorded: +${amount} ${currency} to ${account}`,

    TRANSFER_COMPLETED: (
      amount: number,
      currency: string,
      from: string,
      to: string
    ) =>
      `✅ Transfer completed: ${amount} ${currency}\nFrom: ${from}\nTo: ${to}`,

    BALANCE_UPDATED: (account: string, newBalance: number, currency: string) =>
      `✅ Balance updated\n${account}: ${newBalance} ${currency}`,

    TRANSACTION_DELETED: "✅ Transaction deleted successfully",

    SETTINGS_SAVED: "✅ Settings saved",

    LANGUAGE_CHANGED: (lang: string) => `✅ Language changed to ${lang}`,

    CURRENCY_CHANGED: (currency: string) =>
      `✅ Default currency changed to ${currency}`,

    EXPORT_READY: (format: string) => `✅ Export ready! Format: ${format}`,

    GOAL_CREATED: (name: string, target: number, currency: string) =>
      `✅ Goal created: ${name}\nTarget: ${target} ${currency}`,

    GOAL_PROGRESS: (
      name: string,
      current: number,
      target: number,
      percent: number
    ) => `📊 ${name}\nProgress: ${current} / ${target} (${percent}%)`,
  },

  // ℹ️ Info Messages
  INFO: {
    WELCOME: (username: string) =>
      `👋 Welcome, ${username}!\n\nI'm your personal finance assistant. Let's get started!`,

    HELP:
      `ℹ️ Available commands:\n\n` +
      `/start - Start the bot\n` +
      `/balance - View balances\n` +
      `/expense - Add expense\n` +
      `/income - Add income\n` +
      `/transfer - Transfer between accounts\n` +
      `/stats - View statistics\n` +
      `/export - Export data\n` +
      `/settings - Settings`,

    BALANCE_SUMMARY: (total: number, currency: string, accounts: number) =>
      `💰 Total Balance: ${total} ${currency}\n📊 Accounts: ${accounts}`,

    NO_TRANSACTIONS: "📭 No transactions found",

    NO_BALANCES: "📭 No balances yet. Add your first transaction!",

    PROCESSING: "⏳ Processing...",

    LOADING: "⏳ Loading...",

    CALCULATING: "🧮 Calculating...",
  },

  // ❓ Prompts (asking for user input)
  PROMPTS: {
    ENTER_AMOUNT: "💵 Enter amount:",

    ENTER_DESCRIPTION: "📝 Enter description (optional):",

    SELECT_CATEGORY: "🏷️ Select category:",

    SELECT_ACCOUNT: "🏦 Select account:",

    SELECT_CURRENCY: "💱 Select currency:",

    SELECT_DATE: "📅 Select date (or use today):",

    CONFIRM_ACTION: (action: string) =>
      `⚠️ Confirm action: ${action}\n\nType 'yes' to confirm`,

    CONFIRM_DELETE: (item: string) =>
      `⚠️ Are you sure you want to delete ${item}?\n\nThis action cannot be undone.`,
  },

  // 📊 Analytics Messages
  ANALYTICS: {
    MONTHLY_SUMMARY: (
      month: string,
      income: number,
      expenses: number,
      balance: number,
      currency: string
    ) =>
      `📊 ${month} Summary\n\n` +
      `✅ Income: ${income} ${currency}\n` +
      `❌ Expenses: ${expenses} ${currency}\n` +
      `💰 Balance: ${balance >= 0 ? "+" : ""}${balance} ${currency}`,

    TOP_CATEGORY: (category: string, amount: number, currency: string) =>
      `🏆 Top category: ${category} (${amount} ${currency})`,

    SPENDING_TREND: (trend: "up" | "down" | "stable", percent: number) =>
      trend === "up"
        ? `📈 Spending increased by ${percent}%`
        : trend === "down"
          ? `📉 Spending decreased by ${percent}%`
          : `➡️ Spending stable (±${percent}%)`,

    BUDGET_STATUS: (
      spent: number,
      budget: number,
      remaining: number,
      currency: string
    ) =>
      `💰 Budget Status\n\n` +
      `Spent: ${spent} ${currency}\n` +
      `Budget: ${budget} ${currency}\n` +
      `Remaining: ${remaining >= 0 ? remaining : 0} ${currency}` +
      (remaining < 0
        ? `\n⚠️ Over budget by ${Math.abs(remaining)} ${currency}`
        : ""),
  },

  // 🎯 Goals Messages
  GOALS: {
    PROGRESS_UPDATE: (
      name: string,
      saved: number,
      target: number,
      remaining: number,
      currency: string
    ) =>
      `🎯 ${name}\n\n` +
      `Saved: ${saved} ${currency}\n` +
      `Target: ${target} ${currency}\n` +
      `Remaining: ${remaining} ${currency}`,

    GOAL_REACHED: (name: string) =>
      `🎉 Congratulations! You reached your goal: ${name}!`,

    GOAL_ALMOST_REACHED: (name: string, percent: number) =>
      `🎯 Almost there! ${name} is ${percent}% complete!`,
  },

  // 🔔 Notifications
  NOTIFICATIONS: {
    RECURRING_TRANSACTION_PROCESSED: (
      description: string,
      amount: number,
      currency: string
    ) =>
      `🔄 Recurring transaction processed\n${description}: ${amount} ${currency}`,

    BUDGET_WARNING: (
      category: string,
      spent: number,
      budget: number,
      currency: string
    ) =>
      `⚠️ Budget Warning\n\n` +
      `Category: ${category}\n` +
      `Spent: ${spent} ${currency} (${Math.round((spent / budget) * 100)}% of budget)`,

    LOW_BALANCE: (account: string, balance: number, currency: string) =>
      `⚠️ Low balance alert\n${account}: ${balance} ${currency}`,

    GOAL_MILESTONE: (name: string, percent: number) =>
      `🎯 Milestone reached!\n${name} is now ${percent}% complete!`,
  },
} as const

/**
 * Validation error messages
 */
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  INVALID_FORMAT: (field: string) => `${field} has invalid format`,
  MIN_VALUE: (field: string, min: number) => `${field} must be at least ${min}`,
  MAX_VALUE: (field: string, max: number) => `${field} must be at most ${max}`,
  MIN_LENGTH: (field: string, min: number) =>
    `${field} must be at least ${min} characters`,
  MAX_LENGTH: (field: string, max: number) =>
    `${field} must be at most ${max} characters`,
} as const

/**
 * Time-related messages
 */
export const TIME_MESSAGES = {
  TODAY: "Today",
  YESTERDAY: "Yesterday",
  THIS_WEEK: "This Week",
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  THIS_YEAR: "This Year",
  CUSTOM_RANGE: "Custom Range",
} as const
