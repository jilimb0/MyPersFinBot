/**
 * Excel (XLSX) export
 */

import ExcelJS from "exceljs"
import { Transaction, TransactionType } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { CSVExportOptions } from "./csv-advanced"

/**
 * Generate Excel workbook with transactions
 */
export async function generateExcel(
  userId: string,
  options: CSVExportOptions = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  workbook.creator = "MyPersFinBot"
  workbook.created = new Date()

  // Get all transactions
  let transactions = await db.getAllTransactions(userId)

  // Apply filters (same as CSV)
  transactions = applyFilters(transactions, options)

  // Create sheets by type
  await createExpensesSheet(workbook, transactions)
  await createIncomeSheet(workbook, transactions)
  await createTransfersSheet(workbook, transactions)
  await createSummarySheet(workbook, transactions, userId)

  // Generate buffer
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

/**
 * Create Expenses sheet
 */
async function createExpensesSheet(
  workbook: ExcelJS.Workbook,
  transactions: Transaction[]
) {
  const expenses = transactions.filter(
    (tx) => tx.type === TransactionType.EXPENSE
  )

  if (expenses.length === 0) return

  const sheet = workbook.addWorksheet("Расходы", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  })

  // Headers
  sheet.columns = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Сумма", key: "amount", width: 12 },
    { header: "Валюта", key: "currency", width: 10 },
    { header: "Счёт", key: "account", width: 15 },
    { header: "Описание", key: "description", width: 40 },
  ]

  // Style headers
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE74C3C" }, // Red
  }

  // Add data
  expenses.forEach((tx) => {
    sheet.addRow({
      date: new Date(tx.date),
      category: tx.category,
      amount: tx.amount,
      currency: tx.currency,
      account: tx.fromAccountId || "",
      description: tx.description || "",
    })
  })

  // Format date column
  sheet.getColumn("date").numFmt = "dd.mm.yyyy"

  // Format amount column
  sheet.getColumn("amount").numFmt = "#,##0.00"

  // Add total
  const totalRow = sheet.addRow({
    date: "",
    category: "ИТОГО",
    amount: { formula: `SUM(C2:C${expenses.length + 1})` },
    currency: "",
    account: "",
    description: "",
  })

  totalRow.font = { bold: true }
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDECEA" },
  }
}

/**
 * Create Income sheet
 */
async function createIncomeSheet(
  workbook: ExcelJS.Workbook,
  transactions: Transaction[]
) {
  const income = transactions.filter((tx) => tx.type === TransactionType.INCOME)

  if (income.length === 0) return

  const sheet = workbook.addWorksheet("Доходы", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  })

  // Headers
  sheet.columns = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Сумма", key: "amount", width: 12 },
    { header: "Валюта", key: "currency", width: 10 },
    { header: "Счёт", key: "account", width: 15 },
    { header: "Описание", key: "description", width: 40 },
  ]

  // Style headers
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF27AE60" }, // Green
  }

  // Add data
  income.forEach((tx) => {
    sheet.addRow({
      date: new Date(tx.date),
      category: tx.category,
      amount: tx.amount,
      currency: tx.currency,
      account: tx.toAccountId || "",
      description: tx.description || "",
    })
  })

  // Format columns
  sheet.getColumn("date").numFmt = "dd.mm.yyyy"
  sheet.getColumn("amount").numFmt = "#,##0.00"

  // Add total
  const totalRow = sheet.addRow({
    date: "",
    category: "ИТОГО",
    amount: { formula: `SUM(C2:C${income.length + 1})` },
    currency: "",
    account: "",
    description: "",
  })

  totalRow.font = { bold: true }
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F8F5" },
  }
}

/**
 * Create Transfers sheet
 */
async function createTransfersSheet(
  workbook: ExcelJS.Workbook,
  transactions: Transaction[]
) {
  const transfers = transactions.filter(
    (tx) => tx.type === TransactionType.TRANSFER
  )

  if (transfers.length === 0) return

  const sheet = workbook.addWorksheet("Переводы", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Сумма", key: "amount", width: 12 },
    { header: "Валюта", key: "currency", width: 10 },
    { header: "Откуда", key: "from", width: 15 },
    { header: "Куда", key: "to", width: 15 },
    { header: "Описание", key: "description", width: 40 },
  ]

  // Style headers
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3498DB" }, // Blue
  }

  // Add data
  transfers.forEach((tx) => {
    sheet.addRow({
      date: new Date(tx.date),
      amount: tx.amount,
      currency: tx.currency,
      from: tx.fromAccountId || "",
      to: tx.toAccountId || "",
      description: tx.description || "",
    })
  })

  sheet.getColumn("date").numFmt = "dd.mm.yyyy"
  sheet.getColumn("amount").numFmt = "#,##0.00"
}

/**
 * Create Summary sheet
 */
async function createSummarySheet(
  workbook: ExcelJS.Workbook,
  transactions: Transaction[],
  userId: string
) {
  const sheet = workbook.addWorksheet("Сводка", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  })

  const userData = await db.getUserData(userId)
  const defaultCurrency = userData.defaultCurrency

  // Title
  sheet.mergeCells("A1:D1")
  sheet.getCell("A1").value = "ФИНАНСОВАЯ СВОДКА"
  sheet.getCell("A1").font = { bold: true, size: 16 }
  sheet.getCell("A1").alignment = { horizontal: "center" }

  sheet.addRow([])

  // Period info
  const startDate = transactions.reduce(
    (min, tx) => (new Date(tx.date) < min ? new Date(tx.date) : min),
    new Date()
  )
  const endDate = transactions.reduce(
    (max, tx) => (new Date(tx.date) > max ? new Date(tx.date) : max),
    new Date(0)
  )

  sheet.addRow([
    "Период:",
    startDate.toLocaleDateString("ru-RU"),
    "-",
    endDate.toLocaleDateString("ru-RU"),
  ])
  sheet.addRow(["Валюта:", defaultCurrency])
  sheet.addRow(["Транзакций:", transactions.length])

  sheet.addRow([])

  // Summary by type
  const expenses = transactions.filter(
    (tx) => tx.type === TransactionType.EXPENSE
  )
  const income = transactions.filter((tx) => tx.type === TransactionType.INCOME)

  const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0)
  const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0)
  const balance = totalIncome - totalExpenses

  sheet.addRow(["Тип", "Количество", "Сумма"])
  sheet.getRow(sheet.lastRow!.number).font = { bold: true }

  sheet.addRow(["Доходы", income.length, totalIncome])
  sheet.addRow(["Расходы", expenses.length, totalExpenses])
  sheet.addRow(["Баланс", "", balance])

  // Style balance row
  const balanceRow = sheet.lastRow!
  balanceRow.font = { bold: true }
  balanceRow.getCell(3).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: balance >= 0 ? "FFE8F8F5" : "FFFDECEA" },
  }

  // Format amount columns
  sheet.getColumn(3).numFmt = "#,##0.00"
}

/**
 * Apply filters to transactions
 */
function applyFilters(
  transactions: Transaction[],
  options: CSVExportOptions
): Transaction[] {
  let filtered = transactions

  if (options.startDate) {
    filtered = filtered.filter((tx) => new Date(tx.date) >= options.startDate!)
  }

  if (options.endDate) {
    filtered = filtered.filter((tx) => new Date(tx.date) <= options.endDate!)
  }

  if (options.type) {
    filtered = filtered.filter((tx) => tx.type === options.type)
  }

  if (options.category) {
    filtered = filtered.filter((tx) => tx.category === options.category)
  }

  if (options.currency) {
    filtered = filtered.filter((tx) => tx.currency === options.currency)
  }

  return filtered
}
