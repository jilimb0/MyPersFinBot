import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "../database/storage-db"
import { Transaction, TransactionType } from "../types"
import { Language, t, getCategoryLabel } from "../i18n"

const LOCALES: Record<Language, string> = {
  en: "en-US",
  ru: "ru-RU",
  uk: "uk-UA",
  es: "es-ES",
  pl: "pl-PL",
}

function formatDate(lang: Language, date: Date): string {
  return date.toLocaleDateString(LOCALES[lang])
}

// Helper функция для форматирования отчета
function formatPeriodReport(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  lang: Language,
  type?: TransactionType
): string {
  if (transactions.length === 0) {
    return t(lang, "periodReport.noTransactions", {
      start: formatDate(lang, startDate),
      end: formatDate(lang, endDate),
    })
  }

  const typeEmoji = {
    [TransactionType.INCOME]: "💰",
    [TransactionType.EXPENSE]: "💸",
    [TransactionType.TRANSFER]: "↔️",
  }

  let report = `${t(lang, "periodReport.title")}\n`
  report += `${t(lang, "periodReport.dateRange", {
    start: formatDate(lang, startDate),
    end: formatDate(lang, endDate),
  })}\n`

  if (type) {
    const typeLabel =
      type === TransactionType.INCOME
        ? t(lang, "periodReport.types.income")
        : type === TransactionType.EXPENSE
          ? t(lang, "periodReport.types.expense")
          : t(lang, "periodReport.types.transfer")
    report += `${t(lang, "periodReport.typeLine", {
      emoji: typeEmoji[type],
      type: typeLabel,
    })}\n`
  }
  report += `\n`

  // Группировка по валюте
  const byCurrency: Record<string, { total: number; count: number }> = {}

  transactions.forEach((tx) => {
    if (!byCurrency[tx.currency]) {
      byCurrency[tx.currency] = { total: 0, count: 0 }
    }
    byCurrency[tx.currency]!.total += tx.amount
    byCurrency[tx.currency]!.count++
  })

  report += `${t(lang, "periodReport.totalsHeader")}\n`
  Object.entries(byCurrency).forEach(([currency, data]) => {
    report += `${t(lang, "periodReport.totalLine", {
      currency,
      total: data.total.toFixed(2),
      count: data.count,
    })}\n`
  })

  // Группировка по категориям (топ-5)
  const byCategory: Record<string, number> = {}
  transactions.forEach((tx) => {
    if (!byCategory[tx.category]!) {
      byCategory[tx.category]! = 0
    }
    byCategory[tx.category]! += tx.amount
  })

  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  if (topCategories.length > 0) {
    report += `\n${t(lang, "periodReport.topCategoriesHeader")}\n`
    topCategories.forEach(([category, amount]) => {
      report += `${t(lang, "periodReport.topCategoryLine", {
        category: getCategoryLabel(lang, category),
        amount: amount.toFixed(2),
      })}\n`
    })
  }

  return report
}

export function registerPeriodReportHandlers(bot: TelegramBot) {
  // Команда: Отчет за произвольный период
  bot.onText(/^\/report_period(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await db.getUserLanguage(userId)
    await bot.sendMessage(chatId, t(lang, "periodReport.prompt"), {
      parse_mode: "Markdown",
    })
  })

  // Обработчик ввода дат для периода
  bot.onText(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})(\s+(INCOME|EXPENSE|TRANSFER))?$/i,
    async (msg, match) => {
      if (!match) return Promise.resolve()

      const chatId = msg.chat.id
      const userId = chatId.toString()
      const lang = await db.getUserLanguage(userId)

      const startDate = new Date(match[1]!)
      const endDate = new Date(match[2]!)
      endDate.setHours(23, 59, 59, 999) // Включаем конец дня
      const type = match[4] as TransactionType | undefined

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return bot.sendMessage(
          chatId,
          t(lang, "periodReport.invalidDateFormat")
        )
      }

      if (startDate > endDate) {
        return bot.sendMessage(chatId, t(lang, "periodReport.startAfterEnd"))
      }

      try {
        const transactions = await db.getTransactionsByDateRange(
          userId,
          startDate,
          endDate,
          type
        )

        const report = formatPeriodReport(
          transactions,
          startDate,
          endDate,
          lang,
          type
        )
        await bot.sendMessage(chatId, report, { parse_mode: "Markdown" })
      } catch (error) {
        console.error("Error generating period report:", error)
        await bot.sendMessage(chatId, t(lang, "periodReport.generationError"))
      }
    }
  )

  // Команда: Отчет за квартал
  bot.onText(/^\/report_quarter(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await db.getUserLanguage(userId)
    const now = new Date()
    const currentQuarter = Math.floor(now.getMonth() / 3)
    const startMonth = currentQuarter * 3

    const startDate = new Date(now.getFullYear(), startMonth, 1)
    const endDate = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59)

    try {
      const transactions = await db.getTransactionsByDateRange(
        userId,
        startDate,
        endDate
      )

      let report = `${t(lang, "periodReport.quarterTitle", {
        quarter: currentQuarter + 1,
        year: now.getFullYear(),
      })}\n\n`
      report += formatPeriodReport(transactions, startDate, endDate, lang)

      await bot.sendMessage(chatId, report, { parse_mode: "Markdown" })
    } catch (error) {
      console.error("Error generating quarter report:", error)
      await bot.sendMessage(chatId, t(lang, "periodReport.generationError"))
    }
  })

  // Команда: Отчет за год
  bot.onText(/^\/report_year(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await db.getUserLanguage(userId)
    const now = new Date()

    const startDate = new Date(now.getFullYear(), 0, 1)
    const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59)

    try {
      const transactions = await db.getTransactionsByDateRange(
        userId,
        startDate,
        endDate
      )

      let report = `${t(lang, "periodReport.yearTitle", {
        year: now.getFullYear(),
      })}\n\n`
      report += formatPeriodReport(transactions, startDate, endDate, lang)

      // Добавляем сравнение по месяцам
      const byMonth: Record<number, number> = {}
      transactions.forEach((tx) => {
        const month = new Date(tx.date).getMonth()
        byMonth[month] = (byMonth[month] || 0) + tx.amount
      })

      if (Object.keys(byMonth).length > 0) {
        report += `\n${t(lang, "periodReport.monthsHeader")}\n`
        Object.entries(byMonth)
          .sort(([a], [b]) => Number(a) - Number(b))
          .forEach(([month, amount]) => {
            const monthName = new Date(2024, Number(month)).toLocaleString(
              LOCALES[lang],
              { month: "long" }
            )
            report += `${t(lang, "periodReport.monthLine", {
              month: monthName,
              amount: amount.toFixed(2),
            })}\n`
          })
      }

      await bot.sendMessage(chatId, report, { parse_mode: "Markdown" })
    } catch (error) {
      console.error("Error generating year report:", error)
      await bot.sendMessage(chatId, t(lang, "periodReport.generationError"))
    }
  })
}
