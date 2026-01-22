import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "./database/storage-db"
import { formatGoals, formatMonthlyStats } from "./reports"
import { Debt, Goal, IncomeSource, ExpenseCategory, Transaction } from "./types"
import {
  ANALYTICS_KEYBOARD,
  BACK_N_MAIN_KEYBOARD,
  MAIN_MENU_KEYBOARD,
  SETTINGS_KEYBOARD,
  STATS_KEYBOARD,
} from "./constants"
import { WizardManager } from "./wizards/wizards"
import { createListButtons, formatMoney } from "./utils"
import { Language, t } from "./i18n"
import { getMainMenuKeyboard } from "./i18n/keyboards"

export async function showMainMenu(
  bot: TelegramBot,
  chatId: number,
  lang: Language
): Promise<void> {
  await bot.sendMessage(chatId, t(lang, 'mainMenu.welcomeBack'), getMainMenuKeyboard(lang))
}

export async function showBalancesMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  const balancesMsg = (await db.getBalances(userId)) || t(lang, 'balances.noBalances')
  const balancesList = await db.getBalancesList(userId)

  const items = balancesList.map((b) => `${b.accountId} (${b.currency})`)

  const keyboard = createListButtons({
    items,
    withoutBack: true,
    beforeItemsButtons:
      balancesList.length >= 2
        ? [[{ text: t(lang, 'balances.transfer') }, { text: t(lang, 'balances.addBalance') }]]
        : [[{ text: t(lang, 'balances.addBalance') }]],
  })

  wizard.setState(userId, {
    step: "BALANCE_LIST",
    data: {},
    returnTo: "balances",
  })

  await wizard.sendMessage(chatId, balancesMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard, resize_keyboard: true },
  })
}

export async function showDebtsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  const userData = await db.getUserData(userId)
  const activeDebts = userData.debts.filter((d: Debt) => !d.isPaid)

  const youOwe = activeDebts.filter((d) => d.type === "I_OWE")
  const theyOwe = activeDebts.filter((d) => d.type === "OWES_ME")

  const youOweTotal = youOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const theyOweTotal = theyOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  let msg = t(lang, 'debts.title') + "\n\n"

  if (youOwe.length > 0) {
    msg += `${t(lang, 'debts.youOwe')} ${formatMoney(-youOweTotal, userData.defaultCurrency)}\n`
    youOwe.forEach((d) => {
      const remaining = d.amount - d.paidAmount
      const dueDateStr = d.dueDate ? ` | 📅 ${new Date(d.dueDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')}` : ''
      msg += `└─ ${d.name}: ${formatMoney(remaining, d.currency)}${dueDateStr}\n`
    })
    msg += "\n"
  }

  if (theyOwe.length > 0) {
    msg += `${t(lang, 'debts.theyOwe')} ${formatMoney(theyOweTotal, userData.defaultCurrency)}\n`
    theyOwe.forEach((d, index) => {
      const remaining = d.amount - d.paidAmount
      const prefix = index === theyOwe.length - 1 ? "└─" : "┣─"
      const dueDateStr = d.dueDate ? ` | 📅 ${new Date(d.dueDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')}` : ''
      msg += `${prefix} ${d.name}: ${formatMoney(remaining, d.currency)}${dueDateStr}\n`
    })
    msg += "\n"
  }

  if (activeDebts.length === 0) {
    msg += t(lang, 'debts.noActiveDebts') + "\n\n"
  } else {
    const netDebt = theyOweTotal - youOweTotal
    const netLabel = netDebt > 0 ? t(lang, 'debts.netTheyOwe') : t(lang, 'debts.netYouOwe')
    msg += `──────────────────\n`
    msg += `${t(lang, 'debts.net')} ${formatMoney(Math.abs(netDebt), userData.defaultCurrency)} (${netLabel})\n\n`
  }

  const items = activeDebts.map((d: Debt) => d.name)

  const listButtons = createListButtons({
    items,
    withoutBack: true,
    beforeItemsButtons: [[{ text: t(lang, 'debts.addDebt') }]],
  })

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: listButtons, resize_keyboard: true },
  })
}

export async function showGoalsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  const goalsMsg = await formatGoals(userId)

  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g: Goal) => g.status === "ACTIVE")

  const items = activeGoals.map((g: Goal) => `${g.name}`)

  const listButtons = createListButtons({
    items,
    withoutBack: true,
    beforeItemsButtons: [[{ text: t(lang, 'goals.addGoal') }]],
  })

  await bot.sendMessage(chatId, goalsMsg, {
    parse_mode: "Markdown",
    reply_markup: { keyboard: listButtons, resize_keyboard: true },
  })
}

export async function showIncomeSourcesMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  const sourcesText = await db.getIncomeSources(userId)
  const userData = await db.getUserData(userId)
  const sources = userData.incomeSources

  const items = sources.map((s: IncomeSource) => `${s.name}`)

  const listButtons = createListButtons({
    items,
    beforeItemsButtons: [[{ text: t(lang, 'incomeSources.addSource') }]],
  })

  await bot.sendMessage(chatId, sourcesText || t(lang, 'incomeSources.noSources'), {
    parse_mode: "Markdown",
    reply_markup: { keyboard: listButtons, resize_keyboard: true },
  })
}

export async function showSettingsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  const currentCurrency = await db.getDefaultCurrency(userId)
  bot.sendMessage(
    chatId,
    `${t(lang, 'settings.title')}\n\n${t(lang, 'settings.currentCurrency')} ${currentCurrency}\n\n${t(lang, 'settings.manageConfig')}`,
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )
}

export async function showStatsMenu(
  bot: TelegramBot,
  chatId: number,
  lang: Language
): Promise<void> {
  await bot.sendMessage(
    chatId,
    t(lang, 'analytics.title') + "\n\n" + t(lang, 'analytics.viewInsights'),
    {
      parse_mode: "Markdown",
      reply_markup: STATS_KEYBOARD,
    }
  )
}

export async function showHistoryMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  lang: Language,
  page: number = 1
): Promise<void> {
  const limit = 8

  const state = wizard.getState(userId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: any = {}

  if (state?.step === "HISTORY_FILTERED" && state.data) {
    if (state.data.startDate) filters.startDate = new Date(state.data.startDate)
    if (state.data.endDate) filters.endDate = new Date(state.data.endDate)
    if (state.data.type) filters.type = state.data.type as Transaction
  }

  const { transactions, total, hasMore } = await db.getTransactionsPaginated(
    userId,
    page,
    limit,
    Object.keys(filters).length > 0 ? filters : undefined
  )

  if (total === 0) {
    const msg = Object.keys(filters).length > 0
      ? t(lang, 'history.title') + "\n\n" + t(lang, 'history.noFilteredTransactions')
      : t(lang, 'history.title') + "\n\n" + t(lang, 'history.noTransactions')

    await wizard.sendMessage(
      chatId,
      msg,
      {
        parse_mode: "Markdown",
        reply_markup: BACK_N_MAIN_KEYBOARD,
      }
    )
    return
  }

  wizard.setState(userId, {
    step: state?.step === "HISTORY_FILTERED" ? "HISTORY_FILTERED" : "HISTORY_LIST",
    data: {
      page,
      totalPages: Math.ceil(total / limit),
      ...state?.data,
    },
    returnTo: "analytics",
  })

  const startIdx = (page - 1) * limit + 1
  const endIdx = Math.min(page * limit, total)

  let filterInfo = ""
  if (state?.step === "HISTORY_FILTERED" && state.data?.filterType) {
    const filterLabels: Record<string, string> = {
      last7days: t(lang, 'history.last7days'),
      last30days: t(lang, 'history.last30days'),
      expenses: t(lang, 'history.expensesOnly'),
      income: t(lang, 'history.incomeOnly'),
    }
    filterInfo = `\n🔍 ${t(lang, 'history.filter')} ${filterLabels[state.data.filterType] || state.data.filterType}`
  }

  let msg = `${t(lang, 'history.title')} (${startIdx}-${endIdx} ${t(lang, 'common.of')} ${total})${filterInfo}\n\n`

  const items = transactions.map((tx, i) => {
    const emoji =
      tx.type === "EXPENSE" ? "📉" : tx.type === "INCOME" ? "📈" : "↔️"
    const date = new Date(tx.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')
    const account = tx.fromAccountId || tx.toAccountId || "N/A"
    msg += `${emoji} *${tx.category}* - ${formatMoney(tx.amount, tx.currency)}\n`
    msg += `   💳 ${account} | 📅 ${date}\n`
    if (i < transactions.length - 1) msg += "\n"

    return `${emoji} ${tx.category} \n${formatMoney(tx.amount, tx.currency)}`
  })

  const navButtons = []
  if (page > 1) navButtons.push(t(lang, 'common.previous'))
  if (hasMore) navButtons.push(t(lang, 'common.next'))

  const listButtons = createListButtons({
    items,
    afterItemsButtons: navButtons.length > 0 ? navButtons : [t(lang, 'history.filters')],
  })

  await wizard.sendMessage(chatId, msg, {
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
  userId: string,
  lang: Language
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
      `${cat}: ${limit} ${currency || defaultCurrency} (${Math.round((limit / totalLimit) * 100 || 0)}%) ${bar} ${spent} ${currency || defaultCurrency} ${t(lang, 'budget.spent')}`
    )

    items.push(cat)
  }

  const summaryLine =
    totalLimit > 0
      ? `\n${t(lang, 'budget.summary', { spent: formatMoney(totalSpent, defaultCurrency), total: formatMoney(totalLimit, defaultCurrency), percent: Math.round((totalSpent / totalLimit) * 100) })}`
      : `\n${t(lang, 'budget.noBudgets')}`

  const keyboard = createListButtons({
    items,
    beforeItemsButtons: [[{ text: t(lang, 'budget.addEditBudget') }]],
    withoutBack: true,
  })

  const text =
    t(lang, 'budget.title') + "\n\n" +
    (lines.length ? lines.join("\n") : t(lang, 'budget.noBudgetsCategories')) +
    summaryLine

  wizard.setState(userId, {
    step: "BUDGET_MENU",
    data: {},
  })

  await wizard.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { keyboard, resize_keyboard: true },
  })
}

export async function showAnalyticsReportsMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  lang: Language
) {
  const statsMsg = await formatMonthlyStats(userId)

  wizard.setState(userId, {
    step: "ANALYTICS_REPORTS_MENU",
    data: {},
    returnTo: "reports",
  })

  wizard.sendMessage(chatId, statsMsg, {
    parse_mode: "Markdown",
    reply_markup: ANALYTICS_KEYBOARD,
  })
}

export async function showNetWorthMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  lang: Language,
  view: 'summary' | 'assets' | 'debts' | 'full' = 'summary'
): Promise<void> {
  const userData = await db.getUserData(userId)
  const balances = userData.balances
  const debts = userData.debts.filter((d: Debt) => !d.isPaid)
  const defaultCurrency = userData.defaultCurrency

  const totalAssets = balances.reduce((sum, b) => sum + b.amount, 0)

  const youOwe = debts.filter((d) => d.type === "I_OWE")
  const theyOwe = debts.filter((d) => d.type === "OWES_ME")
  const youOweTotal = youOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const theyOweTotal = theyOwe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const netDebt = theyOweTotal - youOweTotal

  const netWorth = totalAssets + netDebt

  let msg = `${t(lang, 'netWorth.title')} ${formatMoney(netWorth, defaultCurrency)}*\n\n`

  if (view === 'summary') {
    msg += `${t(lang, 'netWorth.assets')} ${formatMoney(totalAssets, defaultCurrency)} (${balances.length} ${t(lang, 'netWorth.accounts')})\n`
    msg += `${t(lang, 'netWorth.debts')} ${formatMoney(netDebt, defaultCurrency)} (${debts.length} ${t(lang, 'netWorth.debtsCount')})\n`
    msg += `──────────────────\n`
    msg += `${t(lang, 'netWorth.net')} ${formatMoney(netWorth, defaultCurrency)}\n`
  } else if (view === 'assets') {
    msg += `${t(lang, 'netWorth.assetsDetail')} ${formatMoney(totalAssets, defaultCurrency)}*\n\n`
    balances.forEach((b) => {
      msg += `• ${b.accountId}: ${formatMoney(b.amount, b.currency)}\n`
    })
  } else if (view === 'debts') {
    msg += `${t(lang, 'netWorth.debtsDetail')}\n\n`

    if (youOwe.length > 0) {
      msg += `${t(lang, 'debts.youOwe')} ${formatMoney(-youOweTotal, defaultCurrency)}\n`
      youOwe.forEach((d) => {
        const remaining = d.amount - d.paidAmount
        const dueDateStr = d.dueDate ? ` | 📅 ${new Date(d.dueDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')}` : ''
        msg += `└─ ${d.name}: ${formatMoney(remaining, d.currency)}${dueDateStr}\n`
      })
      msg += "\n"
    }

    if (theyOwe.length > 0) {
      msg += `${t(lang, 'debts.theyOwe')} ${formatMoney(theyOweTotal, defaultCurrency)}\n`
      theyOwe.forEach((d, index) => {
        const remaining = d.amount - d.paidAmount
        const prefix = index === theyOwe.length - 1 ? "└─" : "┣─"
        const dueDateStr = d.dueDate ? ` | 📅 ${new Date(d.dueDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')}` : ''
        msg += `${prefix} ${d.name}: ${formatMoney(remaining, d.currency)}${dueDateStr}\n`
      })
    }

    if (debts.length > 0) {
      msg += `\n──────────────────\n`
      msg += `${t(lang, 'netWorth.netDebts')} ${formatMoney(Math.abs(netDebt), defaultCurrency)} ${netDebt > 0 ? `(${t(lang, 'debts.netTheyOwe')})` : `(${t(lang, 'debts.netYouOwe')})`}\n`
    }
  } else if (view === 'full') {
    msg += `${t(lang, 'netWorth.assetsDetail')}\n`
    balances.forEach((b) => {
      msg += `• ${b.accountId}: ${formatMoney(b.amount, b.currency)}\n`
    })
    msg += `${t(lang, 'common.total')} ${formatMoney(totalAssets, defaultCurrency)}\n\n`

    msg += `${t(lang, 'netWorth.debtsDetail')}\n`
    if (youOwe.length > 0) {
      msg += `${t(lang, 'debts.youOwe')} ${formatMoney(-youOweTotal, defaultCurrency)}\n`
    }
    if (theyOwe.length > 0) {
      msg += `${t(lang, 'debts.theyOwe')} ${formatMoney(theyOweTotal, defaultCurrency)}\n`
    }
    msg += `${t(lang, 'netWorth.net')} ${formatMoney(netDebt, defaultCurrency)}\n\n`

    msg += `──────────────────\n`
    msg += `${t(lang, 'netWorth.title')} ${formatMoney(netWorth, defaultCurrency)}\n`
  }

  const keyboard: TelegramBot.KeyboardButton[][] = []

  if (view === 'summary') {
    keyboard.push([
      { text: t(lang, 'netWorth.viewAssets') },
      { text: t(lang, 'netWorth.viewDebts') },
      { text: t(lang, 'netWorth.fullReport') }
    ])
  } else {
    const row: TelegramBot.KeyboardButton[] = []
    if (view !== 'assets') row.push({ text: t(lang, 'netWorth.viewAssets') })
    if (view !== 'debts') row.push({ text: t(lang, 'netWorth.viewDebts') })
    if (view !== 'full') row.push({ text: t(lang, 'netWorth.fullReport') })
    row.push({ text: t(lang, 'netWorth.summary') })

    if (row.length > 0) keyboard.push(row)
  }

  keyboard.push([{ text: t(lang, 'common.back') }, { text: t(lang, 'mainMenu.mainMenuButton') }])

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  })
}

export async function showActiveRemindersMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  const { reminderManager } = await import('./services/reminder-manager')
  const data = await reminderManager.getUserReminders(userId)

  let msg = t(lang, 'reminders.title') + '\n\n'

  // Debts
  if (data.debts.length > 0) {
    msg += t(lang, 'reminders.debtsSection') + '\n'
    for (const { debt, reminders } of data.debts) {
      msg += `└─ ${debt.name}\n`
      for (const r of reminders) {
        const dateStr = new Date(r.reminderDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')
        msg += `   📅 ${dateStr} - ${r.message}\n`
      }
    }
    msg += '\n'
  }

  // Goals
  if (data.goals.length > 0) {
    msg += t(lang, 'reminders.goalsSection') + '\n'
    for (const { goal, reminders } of data.goals) {
      msg += `└─ ${goal.name}\n`
      for (const r of reminders) {
        const dateStr = new Date(r.reminderDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')
        msg += `   📅 ${dateStr} - ${r.message}\n`
      }
    }
    msg += '\n'
  }

  if (data.debts.length === 0 && data.goals.length === 0) {
    msg += t(lang, 'reminders.noReminders') + '\n'
  }

  wizard.setState(userId, {
    step: 'REMINDERS_LIST',
    data: {},
  })

  await wizard.sendMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: BACK_N_MAIN_KEYBOARD,
  })
}

export async function showAutomationMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  wizard.setState(userId, {
    step: "AUTOMATION_MENU",
    data: {},
    returnTo: "settings",
  })

  await wizard.sendMessage(
    chatId,
    t(lang, 'automation.title') + "\n\n" + t(lang, 'automation.description'),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: t(lang, 'automation.notifications') }],
          [{ text: t(lang, 'automation.recurringPayments') }],
          [{ text: t(lang, 'common.back') }, { text: t(lang, 'mainMenu.mainMenuButton') }],
        ],
        resize_keyboard: true,
      },
    }
  )
}

export async function showAdvancedMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  lang: Language
): Promise<void> {
  wizard.setState(userId, {
    step: "ADVANCED_MENU",
    data: {},
    returnTo: "settings",
  })

  await wizard.sendMessage(
    chatId,
    t(lang, 'advanced.title') + "\n\n" + t(lang, 'advanced.description'),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: t(lang, 'advanced.customMessages') }],
          [{ text: t(lang, 'advanced.uploadStatement') }],
          [{ text: t(lang, 'advanced.clearData') }],
          [{ text: t(lang, 'common.back') }, { text: t(lang, 'mainMenu.mainMenuButton') }],
        ],
        resize_keyboard: true,
      },
    }
  )
}
