import { config } from "../config"
import { dbStorage } from "../database/storage-db"
import { getCategoryLabel, type Language } from "../i18n"
import type { Currency, Transaction } from "../types"
import { TransactionType } from "../types"

export type ChartType = "trends" | "categories" | "balance"

interface ChartDataset {
  labels: string[]
  valuesA: number[]
  valuesB?: number[]
  currency: Currency
}

function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

async function getTransactionsForMonths(
  userId: string,
  months: number,
  currency: Currency
): Promise<Transaction[]> {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - Math.max(1, months))

  return await dbStorage.getTransactions(userId, {
    startDate: start,
    endDate: end,
    currency,
  })
}

function buildTrendsData(
  transactions: Transaction[],
  currency: Currency
): ChartDataset {
  const monthly = new Map<string, { income: number; expense: number }>()

  for (const tx of transactions) {
    const key = monthKey(new Date(tx.date))
    if (!monthly.has(key)) {
      monthly.set(key, { income: 0, expense: 0 })
    }
    const current = monthly.get(key)!

    if (tx.type === TransactionType.INCOME) current.income += tx.amount
    if (tx.type === TransactionType.EXPENSE) current.expense += tx.amount
  }

  const labels = Array.from(monthly.keys()).sort()
  const valuesA = labels.map((l) => round2(monthly.get(l)?.income || 0))
  const valuesB = labels.map((l) => round2(monthly.get(l)?.expense || 0))

  return { labels, valuesA, valuesB, currency }
}

function buildCategoryData(
  transactions: Transaction[],
  currency: Currency,
  lang: Language
): ChartDataset {
  const expenseOnly = transactions.filter(
    (tx) => tx.type === TransactionType.EXPENSE
  )

  const byCategory = new Map<string, number>()
  for (const tx of expenseOnly) {
    const key = tx.category || "OTHER_EXPENSE"
    byCategory.set(key, (byCategory.get(key) || 0) + tx.amount)
  }

  const top = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return {
    labels: top.map(([cat]) => getCategoryLabel(lang, cat)),
    valuesA: top.map(([, amount]) => round2(amount)),
    currency,
  }
}

function buildBalanceHistoryData(
  transactions: Transaction[],
  currency: Currency
): ChartDataset {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  let balance = 0
  const points: Array<{ label: string; value: number }> = []

  for (const tx of sorted) {
    if (tx.type === TransactionType.INCOME) balance += tx.amount
    else if (tx.type === TransactionType.EXPENSE) balance -= tx.amount
    points.push({
      label: new Date(tx.date).toISOString().split("T")[0] || "",
      value: round2(balance),
    })
  }

  const sampled = points.filter(
    (_, index) => index % Math.max(1, Math.floor(points.length / 30)) === 0
  )

  return {
    labels: sampled.map((p) => p.label),
    valuesA: sampled.map((p) => p.value),
    currency,
  }
}

function buildQuickChartConfig(type: ChartType, data: ChartDataset): unknown {
  if (type === "trends") {
    return {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Income",
            data: data.valuesA,
            borderColor: "#2E8B57",
            fill: false,
          },
          {
            label: "Expense",
            data: data.valuesB || [],
            borderColor: "#B22222",
            fill: false,
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `Income vs Expense (${data.currency})`,
          },
        },
      },
    }
  }

  if (type === "categories") {
    return {
      type: "doughnut",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.valuesA,
            backgroundColor: [
              "#4E79A7",
              "#F28E2B",
              "#E15759",
              "#76B7B2",
              "#59A14F",
              "#EDC948",
              "#B07AA1",
              "#FF9DA7",
            ],
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `Expense Categories (${data.currency})`,
          },
        },
      },
    }
  }

  return {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: `Balance (${data.currency})`,
          data: data.valuesA,
          borderColor: "#1F77B4",
          fill: false,
        },
      ],
    },
    options: { plugins: { title: { display: true, text: "Balance History" } } },
  }
}

export async function generateChartImage(
  userId: string,
  chartType: ChartType,
  lang: Language,
  months: number = 6
): Promise<Buffer | null> {
  const user = await dbStorage.getUserData(userId)
  const currency = user.defaultCurrency
  const txs = await getTransactionsForMonths(userId, months, currency)

  if (txs.length === 0) return null

  let dataset: ChartDataset
  if (chartType === "trends") dataset = buildTrendsData(txs, currency)
  else if (chartType === "categories")
    dataset = buildCategoryData(txs, currency, lang)
  else dataset = buildBalanceHistoryData(txs, currency)

  if (dataset.labels.length === 0 || dataset.valuesA.length === 0) {
    return null
  }

  const chartConfig = buildQuickChartConfig(chartType, dataset)
  const url = `${config.QUICKCHART_BASE_URL}/chart?width=1200&height=700&format=png&c=${encodeURIComponent(JSON.stringify(chartConfig))}`

  const response = await fetch(url, {
    signal: AbortSignal.timeout(config.QUICKCHART_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Failed to generate chart: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
