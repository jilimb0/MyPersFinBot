import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "./database/storage-db"
import { formatGoals, formatMonthlyStats } from "./reports"
import { Debt, Goal, IncomeSource, ExpenseCategory } from "./types"
import {
  ANALYTICS_KEYBOARD,
  BACK_N_MAIN_KEYBOARD,
  MAIN_MENU_KEYBOARD,
  SETTINGS_KEYBOARD,
  STATS_KEYBOARD,
} from "./constants"
import { WizardManager } from "./wizards/wizards"
import { createListButtons, formatMoney } from "./utils"

export async function showMainMenu(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  await bot.sendMessage(chatId, "👋 Main Menu", MAIN_MENU_KEYBOARD)
}

export async function showBalancesMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const balancesMsg = (await db.getBalances(userId)) || "No balances."
  const balancesList = await db.getBalancesList(userId)

  const items = balancesList.map((b) => `${b.accountId} (${b.currency})`)

  const keyboard = createListButtons({
    items,
    withoutBack: true,
    beforeItemsButtons:
      balancesList.length >= 2
        ? [[{ text: "↔️ Transfer" }, { text: "✨ Add Balance" }]]
        : [[{ text: "✨ Add Balance" }]],
  })

  await wizard.goToStep(userId, "BALANCE_LIST", {})

  await wizard.sendMessage(chatId, balancesMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard, resize_keyboard: true },
  })
}

export async function showDebtsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const userData = await db.getUserData(userId)
  const activeDebts = userData.debts.filter((d: Debt) => !d.isPaid)

  // Разделяем на два типа: YOU_OWE и OWES_ME
  const youOwe = activeDebts.filter((d) => d.type === "I_OWE")
  const theyOwe = activeDebts.filter((d) => d.type === "OWES_ME")

  const youOweTotal = youOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const theyOweTotal = theyOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  let msg = "💸 *Debts*\n\n"

  if (youOwe.length > 0) {
    msg += `💸 *YOU OWE:* ${formatMoney(-youOweTotal, userData.defaultCurrency)}\n`
    youOwe.forEach((d) => {
      const remaining = d.amount - d.paidAmount
      msg += `└─ ${d.name}: ${formatMoney(remaining, d.currency)}\n`
    })
    msg += "\n"
  }

  if (theyOwe.length > 0) {
    msg += `💰 *THEY OWE YOU:* ${formatMoney(theyOweTotal, userData.defaultCurrency)}\n`
    theyOwe.forEach((d, index) => {
      const remaining = d.amount - d.paidAmount
      const prefix = index === theyOwe.length - 1 ? "└─" : "┣─"
      msg += `${prefix} ${d.name}: ${formatMoney(remaining, d.currency)}\n`
    })
    msg += "\n"
  }

  if (activeDebts.length === 0) {
    msg += "✅ No active debts!\n\n"
  } else {
    const netDebt = theyOweTotal - youOweTotal
    const netLabel = netDebt > 0 ? "they owe you" : "you owe"
    msg += `──────────────────\n`
    msg += `📊 Net: ${formatMoney(Math.abs(netDebt), userData.defaultCurrency)} (${netLabel})\n\n`
  }

  const items = activeDebts.map((d: Debt) => d.name)

  const listButtons = createListButtons({
    items,
    withoutBack: true,
    beforeItemsButtons: [[{ text: "✨ Add Debt" }]],
  })

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: listButtons, resize_keyboard: true },
  })
}

export async function showGoalsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const goalsMsg = await formatGoals(userId)

  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g: Goal) => g.status === "ACTIVE")

  const items = activeGoals.map((g: Goal) => `${g.name}`)

  const listButtons = createListButtons({
    items,
    withoutBack: true,
    beforeItemsButtons: [[{ text: "✨ Add Goal" }]],
  })

  await bot.sendMessage(chatId, goalsMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: listButtons, resize_keyboard: true },
  })
}

export async function showIncomeSourcesMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const sourcesText = await db.getIncomeSources(userId)
  const userData = await db.getUserData(userId)
  const sources = userData.incomeSources

  const items = sources.map((s: IncomeSource) => `${s.name}`)

  const listButtons = createListButtons({
    items,
    beforeItemsButtons: [[{ text: "✨ Add Income Source" }]],
  })

  await bot.sendMessage(chatId, sourcesText || "No income sources recorded.", {
    parse_mode: "Markdown",
    reply_markup: { keyboard: listButtons, resize_keyboard: true },
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
      reply_markup: STATS_KEYBOARD,
    }
  )
}

export async function showHistoryMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const recentTransactions = await db.getRecentTransactions(userId, 4)

  if (recentTransactions.length === 0) {
    await bot.sendMessage(
      chatId,
      "📖 *Transaction History*\n\n💭 No transactions yet.",
      {
        parse_mode: "Markdown",
        reply_markup: BACK_N_MAIN_KEYBOARD,
      }
    )
    return
  }

  let msg = `📖 *Recent Transactions* (last ${recentTransactions.length})\n\n`

  const items = recentTransactions.map((tx, i) => {
    const emoji =
      tx.type === "EXPENSE" ? "📉" : tx.type === "INCOME" ? "📈" : "↔️"
    const date = new Date(tx.date).toLocaleDateString("en-GB")
    const account = tx.fromAccountId || tx.toAccountId || "N/A"
    msg += `${emoji} *${tx.category}* - ${formatMoney(tx.amount, tx.currency)}\n`
    msg += `   💳 ${account} | 📅 ${date}\n`
    if (i < recentTransactions.length - 1) msg += "\n"

    return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
  })

  const listButtons = createListButtons({
    items,
    afterItemsButtons: ["🔍 Filters"],
  })

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: listButtons,
      resize_keyboard: true,
    },
  })
}

export async function showBudgetMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const budgets = await db.getCategoryBudgets(userId)
  const categories = Object.values(ExpenseCategory)
  const defaultCurrency = await db.getDefaultCurrency(userId)

  const lines: string[] = []
  const items: string[] = []

  let totalLimit = 0
  let totalSpent = 0

  for (const cat of categories) {
    const b = budgets[cat] || { limit: 0, spent: 0 }
    const { limit, spent, currency } = b
    if (limit <= 0) continue

    totalLimit += limit
    totalSpent += spent

    const ratio = Math.min(1, limit > 0 ? spent / limit : 0)
    const blocks = 10
    const filled = Math.round(ratio * blocks)
    const bar = "█".repeat(filled) + "░".repeat(blocks - filled)

    lines.push(
      `${cat}: ${limit} ${currency || defaultCurrency} (${Math.round((limit / totalLimit) * 100 || 0)}%) ${bar} ${spent} ${currency || defaultCurrency} spent`
    )

    items.push(cat)
  }

  const summaryLine =
    totalLimit > 0
      ? `\n📊 ${formatMoney(totalSpent, defaultCurrency)} of ${formatMoney(totalLimit, defaultCurrency)} budget spent (${Math.round((totalSpent / totalLimit) * 100)}%)`
      : "\n📊 No budgets set yet."

  const keyboard = createListButtons({
    items,
    beforeItemsButtons: [[{ text: "✨ Add / Edit Budget" }]],
    withoutBack: true,
  })

  const text =
    "💳 *Budget Setup*\n\n" +
    (lines.length ? lines.join("\n") : "No budgets set for categories yet.") +
    summaryLine

  await wizard.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { keyboard, resize_keyboard: true },
  })
}

export async function showAnalyticsReportsMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
) {
  const statsMsg = await formatMonthlyStats(userId)

  wizard.sendMessage(chatId, statsMsg, {
    parse_mode: "Markdown",
    reply_markup: ANALYTICS_KEYBOARD,
  })
}

export async function showNetWorthMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  view: 'summary' | 'assets' | 'debts' | 'full' = 'summary'
): Promise<void> {
  const userData = await db.getUserData(userId)
  const balances = userData.balances
  const debts = userData.debts.filter((d: Debt) => !d.isPaid)
  const defaultCurrency = userData.defaultCurrency

  // Считаем итоги
  const totalAssets = balances.reduce((sum, b) => sum + b.amount, 0)

  const youOwe = debts.filter((d) => d.type === "I_OWE")
  const theyOwe = debts.filter((d) => d.type === "OWES_ME")
  const youOweTotal = youOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const theyOweTotal = theyOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const netDebt = theyOweTotal - youOweTotal

  const netWorth = totalAssets + netDebt

  let msg = `💎 *Net Worth: ${formatMoney(netWorth, defaultCurrency)}*\n\n`

  if (view === 'summary') {
    // Краткая версия
    msg += `💳 Assets: ${formatMoney(totalAssets, defaultCurrency)} (${balances.length} accounts)\n`
    msg += `💰 Debts: ${formatMoney(netDebt, defaultCurrency)} (${debts.length} debts)\n`
    msg += `──────────────────\n`
    msg += `Net: ${formatMoney(netWorth, defaultCurrency)}\n`
  } else if (view === 'assets') {
    // Детали активов
    msg += `💳 *Assets: ${formatMoney(totalAssets, defaultCurrency)}*\n\n`
    balances.forEach((b) => {
      msg += `• ${b.accountId}: ${formatMoney(b.amount, b.currency)}\n`
    })
  } else if (view === 'debts') {
    // Детали долгов
    msg += `💰 *Debts*\n\n`

    if (youOwe.length > 0) {
      msg += `💸 *YOU OWE:* ${formatMoney(-youOweTotal, defaultCurrency)}\n`
      youOwe.forEach((d) => {
        const remaining = d.amount - d.paidAmount
        msg += `└─ ${d.name}: ${formatMoney(remaining, d.currency)}\n`
      })
      msg += "\n"
    }

    if (theyOwe.length > 0) {
      msg += `💰 *THEY OWE YOU:* ${formatMoney(theyOweTotal, defaultCurrency)}\n`
      theyOwe.forEach((d, index) => {
        const remaining = d.amount - d.paidAmount
        const prefix = index === theyOwe.length - 1 ? "└─" : "┣─"
        msg += `${prefix} ${d.name}: ${formatMoney(remaining, d.currency)}\n`
      })
    }

    if (debts.length > 0) {
      msg += `\n──────────────────\n`
      msg += `📊 Net: ${formatMoney(Math.abs(netDebt), defaultCurrency)} ${netDebt > 0 ? '(they owe you)' : '(you owe)'}\n`
    }
  } else if (view === 'full') {
    // Полный отчёт
    msg += `💳 *Assets:*\n`
    balances.forEach((b) => {
      msg += `• ${b.accountId}: ${formatMoney(b.amount, b.currency)}\n`
    })
    msg += `Total: ${formatMoney(totalAssets, defaultCurrency)}\n\n`

    msg += `💰 *Debts:*\n`
    if (youOwe.length > 0) {
      msg += `You owe: ${formatMoney(-youOweTotal, defaultCurrency)}\n`
    }
    if (theyOwe.length > 0) {
      msg += `They owe you: ${formatMoney(theyOweTotal, defaultCurrency)}\n`
    }
    msg += `Net: ${formatMoney(netDebt, defaultCurrency)}\n\n`

    msg += `──────────────────\n`
    msg += `💎 Net Worth: ${formatMoney(netWorth, defaultCurrency)}\n`
  }

  // Кнопки в зависимости от view
  const keyboard: TelegramBot.KeyboardButton[][] = []

  if (view === 'summary') {
    keyboard.push([
      { text: "💳 Assets" },
      { text: "💰 Debts" }
    ])
    keyboard.push([{ text: "📋 Full Report" }])
  } else {
    const row: TelegramBot.KeyboardButton[] = []
    if (view !== 'assets') row.push({ text: "💳 Assets" })
    if (view !== 'debts') row.push({ text: "💰 Debts" })
    if (view !== 'full') row.push({ text: "📋 Full" })
    row.push({ text: "📊 Summary" })

    if (row.length > 0) keyboard.push(row)
  }

  keyboard.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  })
}
