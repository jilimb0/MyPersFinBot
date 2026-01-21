import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../wizards/wizards"
import { BankParserFactory } from "../parsers"
import { dbStorage as db } from "../database/storage-db"
import { ParsedTransaction, BankType, Currency, TransactionCategory } from "../types"
import { formatMoney } from "../utils"
import { SETTINGS_KEYBOARD } from "../constants"
import { randomUUID } from "crypto"

// Handle file upload
export async function handleStatementUpload(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  userId: string
): Promise<void> {
  const document = msg.document

  if (!document) {
    await bot.sendMessage(msg.chat.id, "⚠️ Please upload a valid file")
    return
  }

  // Check file extension
  const fileName = document.file_name || ""
  const ext = fileName.split(".").pop()?.toLowerCase()

  if (!ext || !["csv", "txt", "json"].includes(ext)) {
    await bot.sendMessage(
      msg.chat.id,
      "⚠️ *Unsupported file format*\n\n" +
      "Supported formats:\n" +
      "• CSV (Tinkoff, Monobank, Revolut)\n" +
      "• TXT (Wise)\n" +
      "• JSON (Monobank)",
      { parse_mode: "Markdown" }
    )
    return
  }

  try {
    await bot.sendMessage(msg.chat.id, "📥 Downloading and parsing file...")

    // Download file
    const fileLink = await bot.getFileLink(document.file_id)
    const response = await fetch(fileLink)
    const content = await response.text()

    // Parse file
    const defaultCurrency = await db.getDefaultCurrency(userId)
    const result = await BankParserFactory.parseAuto(content, fileName, {
      defaultCurrency,
      autoCategorie: true,
    })

    if (result.errors.length > 0) {
      await bot.sendMessage(
        msg.chat.id,
        `⚠️ *Parsing errors:*\n${result.errors.join("\n")}`,
        { parse_mode: "Markdown" }
      )
    }

    if (result.transactions.length === 0) {
      await bot.sendMessage(
        msg.chat.id,
        "❌ No transactions found in the file"
      )
      return
    }

    // Show preview
    await showTransactionPreview(
      bot,
      msg.chat.id,
      userId,
      result.transactions,
      result.bankType
    )
  } catch (error) {
    console.error("Upload error:", error)
    await bot.sendMessage(
      msg.chat.id,
      `❌ Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

// Show transaction preview
async function showTransactionPreview(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  transactions: ParsedTransaction[],
  bankType: BankType
): Promise<void> {
  const total = transactions.length
  const incomeCount = transactions.filter(t => t.type === "INCOME").length
  const expenseCount = transactions.filter(t => t.type === "EXPENSE").length

  // Calculate totals by currency
  const totalsByCurrency: Record<string, { income: number; expense: number }> = {}

  transactions.forEach(tx => {
    if (!totalsByCurrency[tx.currency]) {
      totalsByCurrency[tx.currency] = { income: 0, expense: 0 }
    }

    if (tx.type === "INCOME") {
      totalsByCurrency[tx.currency].income += tx.amount
    } else if (tx.type === "EXPENSE") {
      totalsByCurrency[tx.currency].expense += tx.amount
    }
  })

  // Preview first 5 transactions
  const preview = transactions.slice(0, 5)
  let msg = `📊 *Statement Preview*\n\n`
  msg += `Bank: ${bankType}\n`
  msg += `Total transactions: ${total}\n`
  msg += `Income: ${incomeCount} | Expense: ${expenseCount}\n\n`

  msg += "*Totals:*\n"
  Object.entries(totalsByCurrency).forEach(([currency, totals]) => {
    msg += `${currency}: +${formatMoney(totals.income, currency as Currency, true)} / -${formatMoney(totals.expense, currency as Currency, true)}\n`
  })

  msg += "\n*First transactions:*\n"
  preview.forEach((tx, i) => {
    const emoji = tx.type === "INCOME" ? "💰" : "💸"
    const sign = tx.type === "INCOME" ? "+" : "-"
    msg += `${i + 1}. ${emoji} ${sign}${formatMoney(tx.amount, tx.currency, true)}\n`
    msg += `   ${tx.description}\n`
    msg += `   ${tx.category || "Other"}\n`
  })

  if (total > 5) {
    msg += `\n...and ${total - 5} more\n`
  }

  // Store in wizard state for import
  const wizardManager = new WizardManager(bot)
  wizardManager.setState(userId, {
    step: "STATEMENT_PREVIEW",
    data: {
      transactions,
      bankType,
      currentIndex: 0,
    },
    returnTo: "settings",
  })

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "✅ Import All" }, { text: "✏️ Edit & Import" }],
        [{ text: "🔍 Review Transactions" }],
        [{ text: "❌ Cancel" }],
      ],
      resize_keyboard: true,
    },
  })
}

// Handle statement preview actions
export async function handleStatementPreviewAction(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state || state.step !== "STATEMENT_PREVIEW") return false

  const { transactions } = state.data

  if (text === "✅ Import All") {
    return await importAllTransactions(wizardManager, chatId, userId, transactions)
  }

  if (text === "✏️ Edit & Import") {
    return await startEditingTransactions(wizardManager, chatId, userId, transactions)
  }

  if (text === "🔍 Review Transactions") {
    return await showTransactionsList(wizardManager, chatId, userId, transactions)
  }

  if (text === "❌ Cancel") {
    wizardManager.clearState(userId)
    await wizardManager.sendMessage(
      chatId,
      "❌ Import cancelled",
      { reply_markup: SETTINGS_KEYBOARD }
    )
    return true
  }

  return false
}

// Import all transactions
async function importAllTransactions(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  transactions: ParsedTransaction[]
): Promise<boolean> {
  try {
    // Get user's default account
    const balances = await db.getBalancesList(userId)

    if (balances.length === 0) {
      await wizardManager.sendMessage(
        chatId,
        "⚠️ No accounts found. Please create a balance account first.",
        { reply_markup: SETTINGS_KEYBOARD }
      )
      wizardManager.clearState(userId)
      return true
    }

    const defaultAccount = balances[0].accountId

    const txsToImport = transactions.map(tx => ({
      id: randomUUID(),
      date: new Date(tx.date),
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      category: tx.category as TransactionCategory,
      description: tx.description,
      fromAccountId: tx.type === "EXPENSE" ? (tx.accountId || defaultAccount) : undefined,
      toAccountId: tx.type === "INCOME" ? (tx.accountId || defaultAccount) : undefined,
    }))

    const { valid, invalid } = db.validateTransactionsBatch(txsToImport)

    if (invalid.length > 0) {
      console.warn(`⚠️ ${invalid.length} invalid transactions will be skipped`)
    }

    const startTime = Date.now()
    const result = await db.addTransactionsBatch(userId, valid)
    const duration = Date.now() - startTime

    await wizardManager.sendMessage(
      chatId,
      `✅ *Import completed!*\n\n` +
      `Imported: ${result.added}\n` +
      (invalid.length > 0 ? `Skipped (invalid): ${invalid.length}\n` : "") +
      (result.errors.length > 0 ? `Errors: ${result.errors.length}\n` : "") +
      `\n⚡ Time: ${duration}ms`,
      {
        parse_mode: "Markdown",
        reply_markup: SETTINGS_KEYBOARD,
      }
    )

    wizardManager.clearState(userId)
    return true
  } catch (error) {
    console.error("Import error:", error)
    await wizardManager.sendMessage(
      chatId,
      `❌ Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { reply_markup: SETTINGS_KEYBOARD }
    )
    wizardManager.clearState(userId)
    return true
  }
}

// Start editing transactions
async function startEditingTransactions(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  transactions: ParsedTransaction[]
): Promise<boolean> {
  wizardManager.setState(userId, {
    step: "STATEMENT_EDIT",
    data: {
      transactions,
      currentIndex: 0,
      edited: [],
    },
    returnTo: "settings",
  })

  return await showTransactionEditor(wizardManager, chatId, userId, transactions[0], 0, transactions.length)
}

// Show transaction editor
async function showTransactionEditor(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  tx: ParsedTransaction,
  index: number,
  total: number
): Promise<boolean> {
  const emoji = tx.type === "INCOME" ? "💰" : "💸"
  const sign = tx.type === "INCOME" ? "+" : "-"

  let msg = `*Edit Transaction ${index + 1}/${total}*\n\n`
  msg += `${emoji} ${sign}${formatMoney(tx.amount, tx.currency, true)}\n`
  msg += `Date: ${new Date(tx.date).toLocaleDateString()}\n`
  msg += `Category: ${tx.category || "Other"}\n`
  msg += `Description: ${tx.description}\n`

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "✏️ Edit Category" }, { text: "✏️ Edit Description" }],
        [{ text: "✅ Keep & Next" }, { text: "❌ Skip" }],
        [{ text: "💾 Save All" }],
      ],
      resize_keyboard: true,
    },
  })

  return true
}

// Show transactions list
async function showTransactionsList(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  transactions: ParsedTransaction[]
): Promise<boolean> {
  let msg = `📋 *All Transactions (${transactions.length})*\n\n`

  transactions.forEach((tx, i) => {
    const emoji = tx.type === "INCOME" ? "💰" : "💸"
    const sign = tx.type === "INCOME" ? "+" : "-"
    msg += `${i + 1}. ${emoji} ${sign}${formatMoney(tx.amount, tx.currency, true)}\n`
    msg += `   ${tx.description} | ${tx.category || "Other"}\n`
  })

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "✅ Import All" }, { text: "✏️ Edit & Import" }],
        [{ text: "❌ Cancel" }],
      ],
      resize_keyboard: true,
    },
  })

  return true
}
