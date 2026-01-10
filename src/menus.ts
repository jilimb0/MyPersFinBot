import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "./storage-db"
import { formatGoals } from "./reports"
import { Debt, Goal, IncomeSource } from "./types"
import { MAIN_MENU_KEYBOARD, SETTINGS_KEYBOARD } from "./constants"

/**
 * Menu Helpers Module
 * Централизованные функции для отображения всех меню бота
 */

export async function showMainMenu(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  await bot.sendMessage(chatId, "👋 Main Menu", MAIN_MENU_KEYBOARD)
}

export async function showBalancesMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const balancesMsg = (await db.getBalances(userId)) || "No balances."
  const balancesList = await db.getBalancesList(userId)
  const balancesKeyboard: TelegramBot.KeyboardButton[][] = []

  if (balancesList.length === 0) {
    balancesKeyboard.push([{ text: "➕ Add Balance" }])
  } else if (balancesList.length === 1) {
    balancesKeyboard.push(
      [{ text: "➕ Add Balance" }],
      [{ text: "✏️ Edit Balances" }]
    )
  } else {
    // Если 2+ баланса - показываем Transfer и Edit
    balancesKeyboard.push(
      [{ text: "↔ Transfer" }],
      [{ text: "✏️ Edit Balances" }]
    )
  }

  balancesKeyboard.push([{ text: "🏠 Main Menu" }])

  await bot.sendMessage(chatId, balancesMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: balancesKeyboard, resize_keyboard: true },
  })
}

export async function showDebtsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const debtsMsg = await db.getDebts(userId)
  const debtKeyboard: TelegramBot.KeyboardButton[][] = []

  const userData = await db.getUserData(userId)
  const iOweDebts = userData.debts.filter(
    (d: Debt) => d.type === "I_OWE" && !d.isPaid
  )
  const oweMeDebts = userData.debts.filter(
    (d: Debt) => d.type === "OWES_ME" && !d.isPaid
  )

  const activeDebtsCount = iOweDebts.length + oweMeDebts.length

  if (iOweDebts.length > 0) {
    iOweDebts.forEach((d: Debt) => {
      debtKeyboard.push([{ text: `💸 Pay to: ${d.name}` }])
    })
  }

  if (oweMeDebts.length > 0) {
    oweMeDebts.forEach((d: Debt) => {
      debtKeyboard.push([{ text: `💰 Receive from: ${d.name}` }])
    })
  }

  if (activeDebtsCount <= 1) {
    debtKeyboard.push([{ text: "➕ Add Debt" }])
  } else {
    debtKeyboard.push([{ text: "✏️ Edit Debts" }])
  }

  debtKeyboard.push([{ text: "🏠 Main Menu" }])

  await bot.sendMessage(chatId, debtsMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: debtKeyboard, resize_keyboard: true },
  })
}

export async function showGoalsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const goalsMsg = await formatGoals(userId)
  const goalKeyboard: TelegramBot.KeyboardButton[][] = []

  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g: Goal) => g.status === "ACTIVE")

  activeGoals.forEach((g: Goal) => {
    goalKeyboard.push([{ text: `Goal: ${g.name}` }])
  })

  if (activeGoals.length < 1) {
    goalKeyboard.push([{ text: "➕ Add Goal" }])
  } else {
    goalKeyboard.push([{ text: "✏️ Edit Goals" }])
  }

  goalKeyboard.push([{ text: "🏠 Main Menu" }])

  await bot.sendMessage(chatId, goalsMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: goalKeyboard, resize_keyboard: true },
  })
}

export async function showIncomeMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const sourcesText = await db.getIncomeSources(userId)
  const userData = await db.getUserData(userId)
  const sources = userData.incomeSources
  const keyboard: TelegramBot.KeyboardButton[][] = []

  if (sources.length > 0) {
    sources.forEach((s: IncomeSource) => {
      keyboard.push([{ text: `🗑 Delete Income: ${s.name}` }])
    })
  }
  keyboard.push([{ text: "➕ Add Income Source" }])
  keyboard.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

  await bot.sendMessage(chatId, sourcesText || "No income sources recorded.", {
    parse_mode: "Markdown",
    reply_markup: { keyboard, resize_keyboard: true },
  })
}

export async function showSettingsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const currentCurrency = await db.getDefaultCurrency(userId)
  bot.sendMessage(
    chatId,
    `⚙️ *Settings*\n\nCurrent currency: ${currentCurrency}\n\nManage your bot configuration:`,
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )
}

export async function showStatsMenu(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  await bot.sendMessage(
    chatId,
    "📊 *Analytics*\n\nView your financial insights:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "📈 Monthly Stats" }],
          [{ text: "🔄 Net Worth" }],
          [{ text: "📅 Export CSV" }],
          [{ text: "🔙 Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )
}

export async function showHistoryMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const recentTransactions = await db.getRecentTransactions(userId, 5)

  if (recentTransactions.length === 0) {
    await bot.sendMessage(
      chatId,
      "📖 *Transaction History*\n\n💭 No transactions yet.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [[{ text: "🏠 Main Menu" }]],
          resize_keyboard: true,
        },
      }
    )
    return
  }

  // Форматирование последних транзакций
  let msg = `📖 *Recent Transactions* (last ${recentTransactions.length})\n\n`

  recentTransactions.forEach((tx, i) => {
    const emoji =
      tx.type === "EXPENSE" ? "📉" : tx.type === "INCOME" ? "📈" : "↔️"
    const date = new Date(tx.date).toLocaleDateString("en-GB")
    const account = tx.fromAccountId || tx.toAccountId || "N/A"
    msg += `${emoji} *${tx.category}* - ${tx.amount} ${tx.currency}\n`
    msg += `   💳 ${account} | 📅 ${date}\n`
    if (i < recentTransactions.length - 1) msg += "\n"
  })

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "✏️ Edit Transactions" }],
        [{ text: "🔍 View More" }],
        [{ text: "🏠 Main Menu" }],
      ],
      resize_keyboard: true,
    },
  })
}

export async function showEditTransactionsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const recentTxs = await db.getRecentTransactions(userId, 5)

  if (recentTxs.length === 0) {
    bot.sendMessage(chatId, "💭 No transactions to edit.", {
      reply_markup: {
        keyboard: [[{ text: "🔙 Back" }, { text: "🏠 Main Menu" }]],
        resize_keyboard: true,
      },
    })
    return
  }

  const txButtons: TelegramBot.KeyboardButton[][] = []
  recentTxs.forEach((tx) => {
    const emoji =
      tx.type === "EXPENSE" ? "💸" : tx.type === "INCOME" ? "💰" : "↔️"
    const date = new Date(tx.date).toLocaleDateString("en-GB")
    txButtons.push([
      {
        text: `${emoji} ${tx.category} - ${tx.amount} ${tx.currency} (${date})`,
      },
    ])
  })
  txButtons.push([{ text: "🔙 Back" }, { text: "🏠 Main Menu" }])

  await bot.sendMessage(
    chatId,
    "✏️ *Edit Transactions*\n\nSelect transaction to edit:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: txButtons,
        resize_keyboard: true,
      },
    }
  )
  return
}
