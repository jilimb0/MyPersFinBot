import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "./database/storage-db"
import {
  TransactionType,
  ExpenseCategory,
  IncomeCategory,
} from "./types"
import { formatMoney } from "./utils"
import { randomUUID } from "crypto"
import { queryMonitor } from "./monitoring"
import { clearPersistedCache, getCacheHitRate, getCacheStatus, getMetrics, resetMetrics } from "./fx"

function resolveExpenseCategory(input: string): ExpenseCategory {
  const normalized = input.toLowerCase()
  const values = Object.values(ExpenseCategory)

  const exact = values.find((v) => v.toLowerCase() === normalized)
  if (exact) return exact

  const byPrefix = values.find((v) =>
    v.toLowerCase().startsWith(normalized.split(" ")[0])
  )
  if (byPrefix) return byPrefix

  return ExpenseCategory.OTHER_EXPENSE
}

function resolveIncomeCategory(input: string): IncomeCategory {
  const normalized = input.toLowerCase()
  const values = Object.values(IncomeCategory)

  const exact = values.find((v) => v.toLowerCase() === normalized)
  if (exact) return exact

  const byPrefix = values.find((v) =>
    v.toLowerCase().startsWith(normalized.split(" ")[0])
  )
  if (byPrefix) return byPrefix

  return IncomeCategory.OTHER_INCOME
}

function parseAmountAndCategory(text: string): { amount: number; category: string } | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) return null

  const firstAsAmount = parseFloat(parts[0].replace(",", "."))
  if (!isNaN(firstAsAmount) && firstAsAmount > 0) {
    return {
      amount: firstAsAmount,
      category: parts.slice(1).join(" "),
    }
  }

  const lastAsAmount = parseFloat(parts[parts.length - 1].replace(",", "."))
  if (!isNaN(lastAsAmount) && lastAsAmount > 0) {
    return {
      amount: lastAsAmount,
      category: parts.slice(0, -1).join(" "),
    }
  }

  return null
}

export function registerCommands(bot: TelegramBot) {
  bot.onText(/^\/balance(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()

    const balancesText = await db.getBalances(userId)
    await bot.sendMessage(chatId, `💳 *Balances*\n\n${balancesText}`, {
      parse_mode: "Markdown",
    })
  })

  bot.onText(/^\/templates(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()

    const templates = await db.getTemplates(userId)

    if (templates.length === 0) {
      await bot.sendMessage(
        chatId,
        "📋 *Templates*\n\nNo templates saved yet.\n\nUse `/expense` or `/income` and click \"💾 Save as template?\" to create templates.",
        { parse_mode: "Markdown" }
      )
      return
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = templates.map((tpl) => {
      const amountWithCurrency = formatMoney(tpl.amount, tpl.currency)
      return [
        {
          text: `${tpl.name} — ${amountWithCurrency}`,
          callback_data: `tmpl_use|${tpl.id}`,
        },
        {
          text: "⚙️ Manage",
          callback_data: `tmpl_manage|${tpl.id}`,
        },
      ]
    })

    await bot.sendMessage(
      chatId,
      `📋 *Templates*\n\nClick to use or ⚙️ to manage:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons,
        },
      }
    )
  })

  bot.onText(
    /^\/expense(?:@\w+)?\s+(.+)$/i,
    async (msg, match) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()
      if (!match) return

      const parsed = parseAmountAndCategory(match[1])
      if (!parsed) {
        await bot.sendMessage(
          chatId,
          "❌ Invalid format. Use: `/expense 100 coffee` or `/expense coffee 100`",
          { parse_mode: "Markdown" }
        )
        return
      }

      const { amount, category: rawText } = parsed
      const category = resolveExpenseCategory(rawText)
      const userData = await db.getUserData(userId)
      const currency = userData.defaultCurrency

      const balances = await db.getBalancesList(userId)
      if (balances.length === 0) {
        await bot.sendMessage(
          chatId,
          "⚠️ No balances found. Add one in 💳 Balances."
        )
        return
      }

      const smartAccount =
        (await db.getSmartBalanceSelection(userId, category)) ||
        balances[0].accountId

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
      const text =
        `💸 Expense added: *${formatted}* — ${category}\n` +
        `Account: *${smartAccount}*`

      const buttons: TelegramBot.InlineKeyboardButton[][] = [
        [
          {
            text: "💾 Save as template?",
            callback_data: `tmpl_save|exp|${amount}|${encodeURIComponent(category)}|${currency}|${smartAccount}`,
          },
        ],
      ]

      if (balances.length > 1) {
        buttons.push([
          {
            text: "🔄 Change account",
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
    }
  )

  bot.onText(
    /^\/income(?:@\w+)?\s+(.+)$/i,
    async (msg, match) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()
      if (!match) return

      const parsed = parseAmountAndCategory(match[1])
      if (!parsed) {
        await bot.sendMessage(
          chatId,
          "❌ Invalid format. Use: `/income 1000 salary` or `/income salary 1000`",
          { parse_mode: "Markdown" }
        )
        return
      }

      const { amount, category: rawText } = parsed
      const category = resolveIncomeCategory(rawText)
      const userData = await db.getUserData(userId)
      const currency = userData.defaultCurrency

      const balances = await db.getBalancesList(userId)
      if (balances.length === 0) {
        await bot.sendMessage(
          chatId,
          "⚠️ No balances found. Add one in 💳 Balances."
        )
        return
      }

      const smartAccount =
        (await db.getSmartBalanceSelection(userId, category)) ||
        balances[0].accountId

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
      const text =
        `💰 Income added: *${formatted}* — ${category}\n` +
        `Account: *${smartAccount}*`

      const buttons: TelegramBot.InlineKeyboardButton[][] = [
        [
          {
            text: "💾 Save as template?",
            callback_data: `tmpl_save|inc|${amount}|${encodeURIComponent(category)}|${currency}|${smartAccount}`,
          },
        ],
      ]

      if (balances.length > 1) {
        buttons.push([
          {
            text: "🔄 Change account",
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
    }
  )

  bot.onText(/\/querystats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()

    const ADMIN_IDS = process.env.ADMIN_USERS?.split(',') || []
    if (!ADMIN_IDS.includes(userId)) {
      await bot.sendMessage(chatId, '❌ Access denied')
      return
    }

    const report = queryMonitor.formatReport()

    await bot.sendMessage(chatId, report, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '/resetquerystats' }],
          [{ text: '🏠 Main Menu' }],
        ],
        resize_keyboard: true,
      },
    })
  })

  bot.onText(/\/resetquerystats/, async (msg) => {
    const chatId = msg.chat.id

    queryMonitor.reset()

    await bot.sendMessage(
      chatId,
      '✅ Query statistics reset!\n\nAll query counters have been reset to zero.',
      {
        reply_markup: {
          keyboard: [
            [{ text: '/querystats' }],
            [{ text: '🏠 Main Menu' }],
          ],
          resize_keyboard: true,
        },
      }
    )
  })

  bot.onText(/\/fxstats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()

    const ADMIN_IDS = process.env.ADMIN_USERS?.split(',') || []
    if (!ADMIN_IDS.includes(userId)) {
      await bot.sendMessage(chatId, '❌ Access denied')
      return
    }

    const metrics = getMetrics()
    const hitRate = getCacheHitRate()
    const status = getCacheStatus()

    let report = '📊 *FX Cache Statistics*\n\n'

    // 💾 Cache Status
    report += '💾 *Cache Status:*\n'
    report += `• Valid: ${status.cacheValid ? '✅ Yes' : '❌ No'}\n`
    report += `• Age: ${status.cacheAge}s\n`
    report += `• Next update: ${status.nextUpdate}s\n`
    report += `• Persisted: ${status.isPersisted ? '✅' : '❌'}\n`
    report += `• Errors: ${status.errorCount}\n\n`

    // 📈 Performance Metrics
    report += '📈 *Performance:*\n'
    report += `• Cache hits: ${metrics.cacheHits}\n`
    report += `• Cache misses: ${metrics.cacheMisses}\n`
    report += `• Hit rate: ${hitRate}%\n\n`

    // 🌐 API Metrics
    report += '🌐 *API Usage:*\n'
    report += `• Total calls: ${metrics.apiCalls}\n`
    report += `• Errors: ${metrics.apiErrors}\n`
    report += `• Retries: ${metrics.retries}\n`
    report += `• HTTP/2: ${metrics.http2Used ? '✅' : '❌'}\n\n`

    // ⏰ Last Update
    if (metrics.lastUpdate > 0) {
      const lastUpdateDate = new Date(metrics.lastUpdate)
      const timeAgo = Math.round((Date.now() - metrics.lastUpdate) / 1000)
      report += `⏰ Last update: ${lastUpdateDate.toLocaleTimeString()} (${timeAgo}s ago)\n`
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '/fxreset' }, { text: '/fxclear' }],
          [{ text: '🏠 Main Menu' }],
        ],
        resize_keyboard: true,
      },
    })
  })

  bot.onText(/\/fxreset/, async (msg) => {
    const chatId = msg.chat.id

    resetMetrics()

    await bot.sendMessage(
      chatId,
      '✅ FX metrics reset!\n\nAll counters have been reset to zero.',
      {
        reply_markup: {
          keyboard: [
            [{ text: '/fxstats' }],
            [{ text: '🏠 Main Menu' }],
          ],
          resize_keyboard: true,
        },
      }
    )
  })

  bot.onText(/\/fxclear/, async (msg) => {
    const chatId = msg.chat.id

    await clearPersistedCache()

    await bot.sendMessage(
      chatId,
      '✅ Persisted FX cache cleared!\n\nThe cache file has been deleted. Next restart will fetch fresh rates from API.',
      {
        reply_markup: {
          keyboard: [
            [{ text: '/fxstats' }],
            [{ text: '🏠 Main Menu' }],
          ],
          resize_keyboard: true,
        },
      }
    )
  })
}