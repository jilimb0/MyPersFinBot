export const MAIN_MENU_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: "💸 Expense" }, { text: "💰 Income" }],
      [{ text: "💳 Balances" }, { text: "🔮 Budget Planner" }],
      [{ text: "📉 Debts" }, { text: "🎯 Goals" }],
      [{ text: "📊 Analytics" }, { text: "⚙️ Settings" }],
    ],
    resize_keyboard: true,
  },
}

export const SETTINGS_KEYBOARD = {
  keyboard: [
    [{ text: "🌐 Change currency" }],
    [{ text: "💵 Income Sources" }],
    [{ text: "🤖 Automation" }, { text: "🛠️ Advanced" }],
    [{ text: "❓ Help & Info" }, { text: "🏠 Main Menu" }],
  ],
  resize_keyboard: true,
}

export const STATS_KEYBOARD = {
  keyboard: [
    [{ text: "📈 Reports" }],
    [{ text: "📋 History" }],
    [{ text: "💎 Net Worth" }],
    [{ text: "🏠 Main Menu" }],
  ],
  resize_keyboard: true,
}

export const BACK_N_MAIN_KEYBOARD = {
  keyboard: [[{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]],
  resize_keyboard: true,
}

export const ANALYTICS_KEYBOARD = {
  keyboard: [
    [{ text: "📅 Export CSV" }],
    [{ text: "🔍 Filters" }],
    [{ text: "📈 Trends" }],
    [{ text: "📉 Top Categories" }],
    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
  ],
  resize_keyboard: true,
}
