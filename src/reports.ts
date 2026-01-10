import {
  TransactionType,
  Transaction,
  Balance,
  Debt,
  IncomeSource,
} from "./types"
import { dbStorage as db } from "./storage-db"
import { convertBatchSync } from "./fx"

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    // Income
    Salary: "💼",
    Freelance: "💻",
    Business: "💼",
    Investment: "📈",
    Trading: "💸",
    Bonus: "🎁",
    Gift: "🎁",
    Refund: "🔄",

    // Expense
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

    // Internal
    Goal: "🎯",
    Debt: "📉",
    Transfer: "↔️",
    Other: "📦",
  }
  return emojis[category] || "💰"
}

/**
 * Форматирует последние N транзакций для отображения
 */
export async function formatTransactionHistory(
  userId: string,
  limit: number = 10
): Promise<string> {
  const transactions = await db.getTransactionHistory(userId, limit)

  if (transactions.length === 0) {
    return "📭 No transactions found yet."
  }

  const lines = transactions.map((tx) => {
    const date = new Date(tx.date)
    const dateStr = `${date.getDate().toString().padStart(2, "0")}.${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}`

    const emoji = getCategoryEmoji(tx.category)
    const sign =
      tx.type === TransactionType.EXPENSE
        ? "-"
        : tx.type === TransactionType.INCOME
          ? "+"
          : "↔"
    const account = tx.fromAccountId || tx.toAccountId || "N/A"

    // Используем категорию, а для Goal/Debt добавляем конкретное имя
    let label: string = tx.category as unknown as string

    if (
      tx.category === "Goal 🎯" &&
      tx.description?.startsWith("Goal Deposit:")
    ) {
      const goalName = tx.description.replace("Goal Deposit: ", "").trim()
      label = `Goal: ${goalName}`
    } else if (
      tx.category === "Debt 📉" &&
      tx.description?.startsWith("Debt repayment:")
    ) {
      const debtName = tx.description.replace("Debt repayment: ", "").trim()
      label = `Debt: ${debtName}`
    }

    return `📅 ${dateStr} | ${emoji} ${label} | ${sign}${tx.amount} ${tx.currency} | 💳 ${account}`
  })

  return `📊 *Transaction History*\n\n${lines.join("\n")}`
}

/**
 * Генерирует статистику по транзакциям за текущий месяц
 */
export async function formatMonthlyStats(userId: string): Promise<string> {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  const transactions = await db.getTransactionsByMonth(userId, year, month)
  const userData = await db.getUserData(userId)
  const incomeSources = userData.incomeSources
  const defaultCurrency = userData.defaultCurrency

  if (transactions.length === 0 && incomeSources.length === 0) {
    return "📊 No transactions this month."
  }

  // Разделение на Income и Expense для корректной группировки
  const incomeTotals: Record<string, Record<string, number>> = {}
  const expenseTotals: Record<string, Record<string, number>> = {}

  let totalIncomeCount = 0
  let totalExpenseCount = 0

  // ⚡ Batch конвертация для income транзакций
  const incomeTransactions = transactions.filter(
    (tx) => tx.type === TransactionType.INCOME
  )

  const incomeAmounts = incomeTransactions.map((tx: Transaction) => ({
    amount: tx.amount,
    from: tx.currency,
    to: defaultCurrency,
  }))

  const convertedIncomes =
    incomeAmounts.length > 0 ? convertBatchSync(incomeAmounts) : []

  const totalIncomeInDefaultCurrency = convertedIncomes.reduce(
    (sum, val) => sum + val,
    0
  )

  transactions.forEach((tx) => {
    if (tx.type === TransactionType.TRANSFER) return

    const targetMap =
      tx.type === TransactionType.INCOME ? incomeTotals : expenseTotals

    if (tx.type === TransactionType.INCOME) {
      totalIncomeCount++
    } else {
      totalExpenseCount++
    }

    if (!targetMap[tx.category]) targetMap[tx.category] = {}
    if (!targetMap[tx.category][tx.currency])
      targetMap[tx.category][tx.currency] = 0

    targetMap[tx.category][tx.currency] += tx.amount
  })

  let statsText = ""

  // Income Planning vs Actual
  if (incomeSources.length > 0) {
    statsText += "💵 *Income Plan vs Actual*\n"

    // Expected Income
    statsText += "\nExpected:\n"

    // ⚡ Batch конвертация для income sources
    const sourceAmounts = incomeSources.map((source: IncomeSource) => ({
      amount: source.expectedAmount || 0,
      from: source.currency || defaultCurrency,
      to: defaultCurrency,
    }))

    const convertedSources =
      sourceAmounts.length > 0 ? convertBatchSync(sourceAmounts) : []

    const totalExpected = convertedSources.reduce((sum, val) => sum + val, 0)

    incomeSources.forEach((source: IncomeSource) => {
      const amount = source.expectedAmount || 0
      const currency = source.currency || defaultCurrency
      statsText += `• ${source.name}: ${Math.round(amount)} ${currency}\n`
    })
    statsText += `Total: ${Math.round(totalExpected)} ${defaultCurrency}\n`

    // Actual Income
    statsText += "\nActual:\n"
    if (totalIncomeCount > 0) {
      Object.entries(incomeTotals).forEach(([category, currencies]) => {
        const currencyStr = Object.entries(currencies)
          .map(([cur, amt]) => `${Math.round(amt)} ${cur}`)
          .join(" / ")
        statsText += `• ${getCategoryEmoji(
          category
        )} ${category}: ${currencyStr}\n`
      })
      statsText += `Total: ${Math.round(
        totalIncomeInDefaultCurrency
      )} ${defaultCurrency}\n`
    } else {
      statsText += `• No income received yet\nTotal: 0 ${defaultCurrency}\n`
    }

    // Difference
    const difference = totalIncomeInDefaultCurrency - totalExpected

    // 📈 Прогресс-бар для дохода
    const progress = createProgressBar(
      totalIncomeInDefaultCurrency,
      totalExpected
    )
    statsText += `\n📈 Progress: ${progress}\n`

    if (difference >= 0) {
      statsText += `✅ Goal reached! +${Math.round(
        difference
      )} ${defaultCurrency}\n`
    } else {
      statsText += `⚠️ Shortfall: ${Math.round(
        Math.abs(difference)
      )} ${defaultCurrency}\n`
    }

    statsText += "\n"
  } else if (totalIncomeCount > 0) {
    // No income sources defined, just show actual income
    statsText += "💰 *Income*\n"
    Object.entries(incomeTotals).forEach(([category, currencies]) => {
      const currencyStr = Object.entries(currencies)
        .map(([cur, amt]) => `${Math.round(amt)} ${cur}`)
        .join(" / ")
      statsText += `• ${getCategoryEmoji(
        category
      )} ${category}: ${currencyStr}\n`
    })
    statsText += "\n"
  }

  // Expenses
  if (totalExpenseCount > 0) {
    statsText += "📉 *Expenses*\n"
    Object.entries(expenseTotals).forEach(([category, currencies]) => {
      const currencyStr = Object.entries(currencies)
        .map(([cur, amt]) => `${Math.round(amt)} ${cur}`)
        .join(" / ")
      statsText += `• ${getCategoryEmoji(
        category
      )} ${category}: ${currencyStr}\n`
    })
  }

  if (
    totalIncomeCount === 0 &&
    totalExpenseCount === 0 &&
    incomeSources.length === 0
  ) {
    return "📊 No Income or Expense transactions this month (only Transfers)."
  }

  return `📊 *Monthly Stats (${month + 1}/${year})*\n\n${statsText}`
}

/**
 * Рассчитывает общий капитал (Net Worth) в дефолтной валюте пользователя
 * Включает балансы и долги (кто кому должен)
 */
export async function formatNetWorth(userId: string): Promise<string> {
  const userData = await db.getUserData(userId)
  const balances = userData.balances
  const debts = userData.debts
  const defaultCurrency = userData.defaultCurrency

  if (balances.length === 0 && debts.length === 0) {
    return `💰 Net Worth: 0 ${defaultCurrency}`
  }

  // ⚡ Batch конвертация для всех balances
  const balanceAmounts = balances.map((b: Balance) => ({
    amount: b.amount,
    from: b.currency,
    to: defaultCurrency,
  }))

  const convertedBalances =
    balanceAmounts.length > 0 ? convertBatchSync(balanceAmounts) : []

  const totalBalances = convertedBalances.reduce((sum, val) => sum + val, 0)

  // ⚡ Batch конвертация для долгов
  const debtAmounts = debts.map((d: Debt) => ({
    amount: d.amount - d.paidAmount, // Остаток долга
    from: d.currency,
    to: defaultCurrency,
  }))

  const convertedDebts =
    debtAmounts.length > 0 ? convertBatchSync(debtAmounts) : []

  // 💰 Считаем net worth:
  // + Балансы
  // + Долги мне (OWES_ME)
  // - Мои долги (I_OWE)
  let totalDebtsOwedToMe = 0
  let totalDebtsIOwe = 0

  debts.forEach((d: Debt, index: number) => {
    if (d.isPaid) return // Пропускаем оплаченные

    const debtValue = convertedDebts[index]
    if (d.type === "OWES_ME") {
      totalDebtsOwedToMe += debtValue
    } else if (d.type === "I_OWE") {
      totalDebtsIOwe += debtValue
    }
  })

  const netWorth = totalBalances + totalDebtsOwedToMe - totalDebtsIOwe

  // Создаем детализацию
  const breakdown: string[] = []

  // Балансы
  if (balances.length > 0) {
    breakdown.push("\n💳 *Balances:*")
    balances.forEach((b: Balance, index: number) => {
      const val = convertedBalances[index]
      if (Math.abs(val) > 0.1) {
        // Показываем конвертацию ТОЛЬКО если валюта отличается
        if (b.currency === defaultCurrency) {
          breakdown.push(
            `  • ${b.accountId}: *${b.amount.toFixed(2)} ${b.currency}*`
          )
        } else {
          breakdown.push(
            `  • ${b.accountId}: ${b.amount.toFixed(2)} ${b.currency} _(≈${Math.round(val)} ${defaultCurrency})_`
          )
        }
      }
    })
    breakdown.push(`  ──────────────`)
    breakdown.push(
      `  💰 Total: *${Math.round(totalBalances)} ${defaultCurrency}*`
    )
  }

  // Долги мне
  if (totalDebtsOwedToMe > 0) {
    breakdown.push(
      `\n📗 *They owe you:* +${Math.round(totalDebtsOwedToMe)} ${defaultCurrency}`
    )
    debts.forEach((d: Debt, index: number) => {
      if (d.type === "OWES_ME" && !d.isPaid) {
        const val = convertedDebts[index]
        if (val > 0.1) {
          const remaining = d.amount - d.paidAmount
          breakdown.push(
            `  • ${d.counterparty}: ${remaining.toFixed(2)} ${d.currency}`
          )
        }
      }
    })
  }

  // Мои долги
  if (totalDebtsIOwe > 0) {
    breakdown.push(
      `\n📕 *You owe:* -${Math.round(totalDebtsIOwe)} ${defaultCurrency}`
    )
    debts.forEach((d: Debt, index: number) => {
      if (d.type === "I_OWE" && !d.isPaid) {
        const val = convertedDebts[index]
        if (val > 0.1) {
          const remaining = d.amount - d.paidAmount
          breakdown.push(
            `  • ${d.counterparty}: ${remaining.toFixed(2)} ${d.currency}`
          )
        }
      }
    })
  }

  return `💎 *Net Worth:* \`${Math.round(netWorth)} ${defaultCurrency}\n\`${breakdown.join("\n")}`
}

/**
 * Создаёт прогресс-бар для визуализации
 */
function createProgressBar(
  current: number,
  target: number,
  length: number = 10
): string {
  const percentage = Math.min(100, (current / target) * 100)
  const filled = Math.floor((percentage / 100) * length)
  const empty = length - filled

  const bar = "█".repeat(filled) + "░".repeat(empty)
  return `${bar} ${percentage.toFixed(0)}%`
}

/**
 * Форматирует финансовые цели с прогресс-барами
 */
export async function formatGoals(userId: string): Promise<string> {
  const userData = await db.getUserData(userId)
  const activeGoals = userData.goals.filter((g) => g.status === "ACTIVE")

  if (activeGoals.length === 0) {
    return "🎯 *Goals*\n\nNo active goals. Set one to start saving!"
  }

  let msg = "🎯 *Your Financial Goals*\n\n"

  activeGoals.forEach((g) => {
    const percentage = Math.min(100, (g.currentAmount / g.targetAmount) * 100)
    const remaining = g.targetAmount - g.currentAmount

    // Прогресс-бар
    const progress = createProgressBar(g.currentAmount, g.targetAmount)

    // Эмодзи статуса
    let statusEmoji = "🎯"
    if (percentage >= 100) statusEmoji = "✅"
    else if (percentage >= 75) statusEmoji = "🔥"
    else if (percentage >= 50) statusEmoji = "💪"
    else if (percentage >= 25) statusEmoji = "🌱"

    msg += `${statusEmoji} *${g.name}*\n`
    msg += `${progress}\n`
    msg += `💰 Saved: ${g.currentAmount.toFixed(2)} ${g.currency}\n`
    msg += `🎯 Target: ${g.targetAmount.toFixed(2)} ${g.currency}\n`

    if (remaining > 0) {
      msg += `📈 Remaining: ${remaining.toFixed(2)} ${g.currency}\n`
    } else {
      msg += `🎉 Goal achieved!\n`
    }
    msg += "\n"
  })

  return msg
}

/**
 * Генерирует CSV файл со всеми транзакциями
 */
export async function generateCSV(userId: string): Promise<string> {
  const transactions = await db.getAllTransactions(userId)

  if (transactions.length === 0) {
    return ""
  }

  const header =
    "Date,Type,Category,Amount,Currency,FromAccount,ToAccount,Description\n"

  const rows = transactions.map((tx) => {
    const date = new Date(tx.date).toISOString().split("T")[0]
    const cleanDesc = (tx.description || "").replace(/,/g, " ") // escape commas

    return [
      date,
      tx.type,
      tx.category,
      tx.amount,
      tx.currency,
      tx.fromAccountId || "",
      tx.toAccountId || "",
      cleanDesc,
    ].join(",")
  })

  return header + rows.join("\n")
}
