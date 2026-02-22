import { randomUUID } from "node:crypto"
import type TelegramBot from "@telegram-api"
import { SETTINGS_KEYBOARD } from "../constants"
import { dbStorage as db } from "../database/storage-db"
import { getCategoryLabel, resolveLanguage, t } from "../i18n"
import { BankParserFactory } from "../parsers"
import type {
  BankType,
  Currency,
  ParsedTransaction,
  TransactionCategory,
} from "../types"
import { escapeMarkdown, formatMoney } from "../utils"
import type { WizardManager } from "../wizards/wizards"

// Handle file upload
export async function handleStatementUpload(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  userId: string,
  wizardManager: WizardManager
): Promise<void> {
  const document = msg.document

  const state = wizardManager.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (!document) {
    await bot.sendMessage(msg.chat.id, t(lang, "import.invalidFile"))
    return
  }

  // Check file extension
  const fileName = document.file_name || ""
  const ext = fileName.split(".").pop()?.toLowerCase()

  if (!ext || !["csv", "txt", "json"].includes(ext)) {
    await bot.sendMessage(msg.chat.id, t(lang, "import.unsupportedFormat"), {
      parse_mode: "Markdown",
    })
    return
  }

  try {
    await bot.sendMessage(msg.chat.id, t(lang, "import.processing"))

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
        `${t(lang, "import.parsingErrors")}\n${result.errors.join("\n")}`,
        { parse_mode: "Markdown" }
      )
    }

    if (result.transactions.length === 0) {
      await bot.sendMessage(msg.chat.id, t(lang, "import.noTransactions"))
      return
    }

    // Show preview
    await showTransactionPreview(
      bot,
      msg.chat.id,
      userId,
      result.transactions,
      result.bankType,
      wizardManager
    )
  } catch (error) {
    console.error("Upload error:", error)
    await bot.sendMessage(
      msg.chat.id,
      t(lang, "import.failed", {
        error:
          error instanceof Error ? error.message : t(lang, "errors.unknown"),
      })
    )
  }
}

// Show transaction preview
async function showTransactionPreview(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  transactions: ParsedTransaction[],
  bankType: BankType,
  wizardManager: WizardManager
): Promise<void> {
  const total = transactions.length
  const incomeCount = transactions.filter((t) => t.type === "INCOME").length
  const expenseCount = transactions.filter((t) => t.type === "EXPENSE").length

  // Calculate totals by currency
  const totalsByCurrency: Record<string, { income: number; expense: number }> =
    {}

  transactions.forEach((tx) => {
    if (!totalsByCurrency[tx.currency]) {
      totalsByCurrency[tx.currency] = { income: 0, expense: 0 }
    }

    if (tx.type === "INCOME") {
      totalsByCurrency[tx.currency]!.income += tx.amount
    } else if (tx.type === "EXPENSE") {
      totalsByCurrency[tx.currency]!.expense += tx.amount
    }
  })

  // Preview first 5 transactions
  const preview = transactions.slice(0, 5)
  const state = wizardManager.getState(userId)
  const lang = resolveLanguage(state?.lang)

  let msg = `${t(lang, "import.preview")}\n\n`
  msg += `${t(lang, "import.bankLine", { bank: bankType })}\n`
  msg += `${t(lang, "import.totalTransactions", { count: total })}\n`
  msg += `${t(lang, "import.incomeExpenseLine", {
    income: incomeCount,
    expense: expenseCount,
  })}\n\n`

  msg += `${t(lang, "import.totalsTitle")}\n`
  Object.entries(totalsByCurrency).forEach(([currency, totals]) => {
    msg += `${currency}: +${formatMoney(totals.income, currency as Currency, true)} / -${formatMoney(totals.expense, currency as Currency, true)}\n`
  })

  msg += `\n${t(lang, "import.firstTransactionsTitle")}\n`
  preview.forEach((tx, i) => {
    const emoji = tx.type === "INCOME" ? "💰" : "💸"
    const sign = tx.type === "INCOME" ? "+" : "-"
    msg += `${i + 1}. ${emoji} ${sign}${formatMoney(tx.amount, tx.currency, true)}\n`
    msg += `   ${escapeMarkdown(tx.description)}\n`
    msg += `   ${
      tx.category
        ? getCategoryLabel(lang, tx.category)
        : t(lang, "buttons.other")
    }\n`
  })

  if (total > 5) {
    msg += `\n${t(lang, "import.moreTransactions", { count: total - 5 })}\n`
  }
  wizardManager.setState(userId, {
    step: "STATEMENT_PREVIEW",
    data: {
      transactions,
      bankType,
      currentIndex: 0,
    },
    returnTo: "settings",
    lang,
  })

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [
          { text: t(lang, "common.importAll") },
          { text: t(lang, "common.editAndImport") },
        ],
        [{ text: t(lang, "import.review") }],
        [{ text: t(lang, "common.cancel") }],
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

  if (!state.data) return true
  const { transactions, lang } = state.data

  if (text === t(lang, "common.importAll")) {
    return await importAllTransactions(
      wizardManager,
      chatId,
      userId,
      transactions
    )
  }

  if (text === t(lang, "common.editAndImport")) {
    return await startEditingTransactions(
      wizardManager,
      chatId,
      userId,
      transactions
    )
  }

  if (text === t(lang, "import.review")) {
    return await showTransactionsList(
      wizardManager,
      chatId,
      userId,
      transactions
    )
  }

  if (text === t(lang, "common.cancel")) {
    wizardManager.clearState(userId)
    await wizardManager.sendMessage(chatId, t(lang, "import.cancelled"), {
      reply_markup: SETTINGS_KEYBOARD,
    })
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
  const lang = resolveLanguage(wizardManager.getState(userId)?.lang)
  try {
    // Get user's default account
    const balances = await db.getBalancesList(userId)

    if (balances.length === 0) {
      await wizardManager.sendMessage(chatId, t(lang, "import.noAccounts"), {
        reply_markup: SETTINGS_KEYBOARD,
      })
      wizardManager.clearState(userId)
      return true
    }

    const defaultAccount = balances[0]?.accountId

    const txsToImport = transactions.map((tx) => ({
      id: randomUUID(),
      date: new Date(tx.date),
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      category: tx.category as TransactionCategory,
      description: tx.description,
      fromAccountId:
        tx.type === "EXPENSE" ? tx.accountId || defaultAccount : undefined,
      toAccountId:
        tx.type === "INCOME" ? tx.accountId || defaultAccount : undefined,
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
      `${t(lang, "import.completed")}\n\n` +
        `${t(lang, "import.imported", { count: result.added })}\n` +
        (invalid.length > 0
          ? `${t(lang, "import.skipped", { count: invalid.length })}\n`
          : "") +
        (result.errors.length > 0
          ? `${t(lang, "import.errors", { count: result.errors.length })}\n`
          : "") +
        `\n${t(lang, "import.time", { ms: duration })}`,
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
      t(lang, "import.failed", {
        error:
          error instanceof Error ? error.message : t(lang, "errors.unknown"),
      }),
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
  const lang = resolveLanguage(wizardManager.getState(userId)?.lang)
  wizardManager.setState(userId, {
    step: "STATEMENT_EDIT",
    data: {
      transactions,
      currentIndex: 0,
      edited: [],
    },
    returnTo: "settings",
    lang,
  })

  return await showTransactionEditor(
    wizardManager,
    chatId,
    userId,
    transactions[0]!,
    0,
    transactions.length
  )
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
  const state = wizardManager.getState(userId)
  const lang = resolveLanguage(state?.lang)

  const emoji = tx.type === "INCOME" ? "💰" : "💸"
  const sign = tx.type === "INCOME" ? "+" : "-"

  let msg = `${t(lang, "import.editorTitle", {
    index: index + 1,
    total,
  })}\n\n`
  msg += `${emoji} ${sign}${formatMoney(tx.amount, tx.currency, true)}\n`
  msg += `${t(lang, "import.editorDateLine", {
    date: new Date(tx.date).toLocaleDateString(),
  })}\n`
  msg += `${t(lang, "import.editorCategoryLine", {
    category: tx.category
      ? getCategoryLabel(lang, tx.category)
      : t(lang, "buttons.other"),
  })}\n`
  msg += `${t(lang, "import.editorDescriptionLine", {
    description: tx.description,
  })}\n`

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [
          { text: t(lang, "common.editCategory") },
          { text: t(lang, "common.editDescription") },
        ],
        [
          { text: t(lang, "common.keepAndNext") },
          { text: t(lang, "common.skip") },
        ],
        [{ text: t(lang, "import.saveAll") }],
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
  const state = wizardManager.getState(userId)
  const lang = resolveLanguage(state?.lang)

  let msg = `${t(lang, "import.allTransactionsTitle", {
    count: transactions.length,
  })}\n\n`

  transactions.forEach((tx, i) => {
    const emoji = tx.type === "INCOME" ? "💰" : "💸"
    const sign = tx.type === "INCOME" ? "+" : "-"
    msg += `${i + 1}. ${emoji} ${sign}${formatMoney(tx.amount, tx.currency, true)}\n`
    msg += `   ${t(lang, "import.listItemLine", {
      description: tx.description,
      category: tx.category
        ? getCategoryLabel(lang, tx.category)
        : t(lang, "buttons.other"),
    })}\n`
  })

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [
          { text: t(lang, "common.importAll") },
          { text: t(lang, "common.editAndImport") },
        ],
        [{ text: t(lang, "common.cancel") }],
      ],
      resize_keyboard: true,
    },
  })

  return true
}
