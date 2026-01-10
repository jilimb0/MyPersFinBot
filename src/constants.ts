export const MAIN_MENU_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: "💸 Expense" }, { text: "💰 Income" }],
      [{ text: "💰 Balances" }, { text: "📊 History" }],
      [{ text: "📉 Debts" }, { text: "🎯 Goals" }],
      [{ text: "📊 Analytics" }, { text: "⚙️ Settings" }],
    ],
    resize_keyboard: true,
  },
}

export const SETTINGS_KEYBOARD = {
  keyboard: [
    [{ text: "💱 Change Currency" }],
    [{ text: "💵 Income Sources" }, { text: "❓ Help & Info" }],
    [{ text: "🗑️ Clear All Data" }],
    [{ text: "🏠 Main Menu" }],
  ],
  resize_keyboard: true,
}
