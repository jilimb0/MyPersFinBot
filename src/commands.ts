import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "./database/storage-db"
import { TransactionType, ExpenseCategory, IncomeCategory } from "./types"
import { formatMoney } from "./utils"
import { randomUUID } from "crypto"
import { queryMonitor } from "./monitoring"
import {
  clearPersistedCache,
  getCacheHitRate,
  getCacheStatus,
  getMetrics,
  resetMetrics,
} from "./fx"
import { Language, t } from "./i18n"

function resolveExpenseCategory(input: string): ExpenseCategory {
  const normalized = input.toLowerCase()
  const values = Object.values(ExpenseCategory)

  const exact = values.find((v) => v.toLowerCase() === normalized)
  if (exact) return exact

  const firstWord = normalized.split(" ")[0]
  const byPrefix = firstWord
    ? values.find((v) => v.toLowerCase().startsWith(firstWord))
    : undefined
  if (byPrefix) return byPrefix

  return ExpenseCategory.OTHER_EXPENSE
}

function resolveIncomeCategory(input: string): IncomeCategory {
  const normalized = input.toLowerCase()
  const values = Object.values(IncomeCategory)

  const exact = values.find((v) => v.toLowerCase() === normalized)
  if (exact) return exact

  const firstWord = normalized.split(" ")[0]
  const byPrefix = firstWord
    ? values.find((v) => v.toLowerCase().startsWith(firstWord))
    : undefined
  if (byPrefix) return byPrefix

  return IncomeCategory.OTHER_INCOME
}

function parseAmountAndCategory(
  text: string
): { amount: number; category: string } | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) return null

  const firstPart = parts[0]
  if (firstPart) {
    const firstAsAmount = parseFloat(firstPart.replace(",", "."))
    if (!isNaN(firstAsAmount) && firstAsAmount > 0) {
      return {
        amount: firstAsAmount,
        category: parts.slice(1).join(" "),
      }
    }
  }

  const lastPart = parts[parts.length - 1]
  if (lastPart) {
    const lastAsAmount = parseFloat(lastPart.replace(",", "."))
    if (!isNaN(lastAsAmount) && lastAsAmount > 0) {
      return {
        amount: lastAsAmount,
        category: parts.slice(0, -1).join(" "),
      }
    }
  }

  return null
}

async function resolveUserLanguage(userId: string): Promise<Language> {
  try {
    return await db.getUserLanguage(userId)
  } catch {
    return "en"
  }
}

export function registerCommands(bot: TelegramBot) {
  bot.onText(/^\/balance(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    const balancesText = await db.getBalances(userId)
    await bot.sendMessage(
      chatId,
      `${t(lang, "balances.title")}\n\n${balancesText}`,
      {
        parse_mode: "Markdown",
      }
    )
  })

  bot.onText(/^\/templates(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    const templates = await db.getTemplates(userId)

    if (templates.length === 0) {
      await bot.sendMessage(
        chatId,
        t(lang, "commands.templates.empty", {
          saveAsTemplate: t(lang, "buttons.saveAsTemplate"),
        }),
        { parse_mode: "Markdown" }
      )
      return
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = templates.map(
      (tpl) => {
        const amountWithCurrency = formatMoney(tpl.amount, tpl.currency)
        return [
          {
            text: `${tpl.name} — ${amountWithCurrency}`,
            callback_data: `tmpl_use|${tpl.id}`,
          },
          {
            text: t(lang, "buttons.manage"),
            callback_data: `tmpl_manage|${tpl.id}`,
          },
        ]
      }
    )

    await bot.sendMessage(chatId, t(lang, "commands.templates.listHint"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  })

  bot.onText(/^\/expense(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (!match || !match[1]) return

    const parsed = parseAmountAndCategory(match[1])
    if (!parsed) {
      await bot.sendMessage(chatId, t(lang, "commands.expense.invalidFormat"), {
        parse_mode: "Markdown",
      })
      return
    }

    const { amount, category: rawText } = parsed
    const category = resolveExpenseCategory(rawText)
    const userData = await db.getUserData(userId)
    const currency = userData.defaultCurrency

    const balances = await db.getBalancesList(userId)
    if (balances.length === 0) {
      await bot.sendMessage(chatId, t(lang, "warnings.noBalancesAdd"))
      return
    }

    const smartAccount =
      (await db.getSmartBalanceSelection(userId, category)) ||
      balances[0]?.accountId

    const txId = await db.addTransaction(userId, {
      id: randomUUID(),
      date: new Date(),
      amount,
      currency,
      type: TransactionType.EXPENSE,
      category,
      fromAccountId: smartAccount,
    })

    const formatted = formatMoney(amount, currency)
    const text = t(lang, "commands.expense.added", {
      amount: formatted,
      category,
      account: smartAccount || "",
    })

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text: t(lang, "buttons.saveAsTemplate"),
          callback_data: `tmpl_save|exp|${amount}|${encodeURIComponent(category)}|${currency}|${smartAccount}`,
        },
      ],
    ]

    if (balances.length > 1) {
      buttons.push([
        {
          text: t(lang, "buttons.changeAccount"),
          callback_data: `acc_change|${txId}`,
        },
      ])
    }

    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  })

  bot.onText(/^\/income(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (!match || !match[1]) return

    const parsed = parseAmountAndCategory(match[1])
    if (!parsed) {
      await bot.sendMessage(chatId, t(lang, "commands.income.invalidFormat"), {
        parse_mode: "Markdown",
      })
      return
    }

    const { amount, category: rawText } = parsed
    const category = resolveIncomeCategory(rawText)
    const userData = await db.getUserData(userId)
    const currency = userData.defaultCurrency

    const balances = await db.getBalancesList(userId)
    if (balances.length === 0) {
      await bot.sendMessage(chatId, t(lang, "warnings.noBalancesAdd"))
      return
    }

    const smartAccount =
      (await db.getSmartBalanceSelection(userId, category)) ||
      balances[0]?.accountId

    const txId = await db.addTransaction(userId, {
      id: randomUUID(),
      date: new Date(),
      amount,
      currency,
      type: TransactionType.INCOME,
      category,
      toAccountId: smartAccount,
    })

    const formatted = formatMoney(amount, currency)
    const text = t(lang, "commands.income.added", {
      amount: formatted,
      category,
      account: smartAccount || "",
    })

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text: t(lang, "buttons.saveAsTemplate"),
          callback_data: `tmpl_save|inc|${amount}|${encodeURIComponent(category)}|${currency}|${smartAccount}`,
        },
      ],
    ]

    if (balances.length > 1) {
      buttons.push([
        {
          text: t(lang, "buttons.changeAccount"),
          callback_data: `acc_change|${txId}`,
        },
      ])
    }

    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  })

  bot.onText(/\/querystats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    const ADMIN_IDS = process.env.ADMIN_USERS?.split(",") || []
    if (!ADMIN_IDS.includes(userId)) {
      await bot.sendMessage(chatId, t(lang, "errors.accessDenied"))
      return
    }

    const report = queryMonitor.formatReport()

    await bot.sendMessage(chatId, report, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "/resetquerystats" }],
          [{ text: t(lang, "mainMenu.mainMenuButton") }],
        ],
        resize_keyboard: true,
      },
    })
  })

  bot.onText(/\/resetquerystats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    queryMonitor.reset()

    await bot.sendMessage(chatId, t(lang, "success.queryStatsReset"), {
      reply_markup: {
        keyboard: [
          [{ text: "/querystats" }],
          [{ text: t(lang, "mainMenu.mainMenuButton") }],
        ],
        resize_keyboard: true,
      },
    })
  })

  bot.onText(/\/fxstats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    const ADMIN_IDS = process.env.ADMIN_USERS?.split(",") || []
    if (!ADMIN_IDS.includes(userId)) {
      await bot.sendMessage(chatId, t(lang, "errors.accessDenied"))
      return
    }

    const metrics = getMetrics()
    const hitRate = getCacheHitRate()
    const status = getCacheStatus()

    let report = `${t(lang, "fxReport.title")}\n\n`

    // 💾 Cache Status
    report += `${t(lang, "fxReport.cacheStatusTitle")}\n`
    report += `${t(lang, "fxReport.valid", { value: status.cacheValid ? t(lang, "common.yes") : t(lang, "common.no") })}\n`
    report += `${t(lang, "fxReport.age", { seconds: status.cacheAge })}\n`
    report += `${t(lang, "fxReport.nextUpdate", { seconds: status.nextUpdate })}\n`
    report += `${t(lang, "fxReport.persisted", { value: status.isPersisted ? t(lang, "common.checkYes") : t(lang, "common.checkNo") })}\n`
    report += `${t(lang, "fxReport.errors", { count: status.errorCount })}\n\n`

    // 📈 Performance Metrics
    report += `${t(lang, "fxReport.performanceTitle")}\n`
    report += `${t(lang, "fxReport.cacheHits", { count: metrics.cacheHits })}\n`
    report += `${t(lang, "fxReport.cacheMisses", { count: metrics.cacheMisses })}\n`
    report += `${t(lang, "fxReport.hitRate", { percent: hitRate })}\n\n`

    // 🌐 API Metrics
    report += `${t(lang, "fxReport.apiTitle")}\n`
    report += `${t(lang, "fxReport.totalCalls", { count: metrics.apiCalls })}\n`
    report += `${t(lang, "fxReport.apiErrors", { count: metrics.apiErrors })}\n`
    report += `${t(lang, "fxReport.retries", { count: metrics.retries })}\n`
    report += `${t(lang, "fxReport.http2", { value: metrics.http2Used ? t(lang, "common.checkYes") : t(lang, "common.checkNo") })}\n\n`

    // ⏰ Last Update
    if (metrics.lastUpdate > 0) {
      const lastUpdateDate = new Date(metrics.lastUpdate)
      const timeAgo = Math.round((Date.now() - metrics.lastUpdate) / 1000)
      report += t(lang, "fxReport.lastUpdate", {
        time: lastUpdateDate.toLocaleTimeString(),
        seconds: timeAgo,
      })
      report += "\n"
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "/fxreset" }, { text: "/fxclear" }],
          [{ text: t(lang, "mainMenu.mainMenuButton") }],
        ],
        resize_keyboard: true,
      },
    })
  })

  bot.onText(/\/fxreset/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    resetMetrics()

    await bot.sendMessage(chatId, t(lang, "success.metricsReset"), {
      reply_markup: {
        keyboard: [
          [{ text: "/fxstats" }],
          [{ text: t(lang, "mainMenu.mainMenuButton") }],
        ],
        resize_keyboard: true,
      },
    })
  })

  bot.onText(/\/fxclear/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    await clearPersistedCache()

    await bot.sendMessage(
      chatId,
      t(lang, "success.persistedCacheClearedDetails"),
      {
        reply_markup: {
          keyboard: [
            [{ text: "/fxstats" }],
            [{ text: t(lang, "mainMenu.mainMenuButton") }],
          ],
          resize_keyboard: true,
        },
      }
    )
  })
}
