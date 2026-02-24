import { randomUUID } from "node:crypto"
import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { config } from "./config"
import { dbStorage as db } from "./database/storage-db"
import {
  clearPersistedCache,
  getCacheHitRate,
  getCacheStatus,
  getMetrics,
  resetMetrics,
} from "./fx"
import {
  getCategoryLabel,
  getExpenseCategoryByLabel,
  getIncomeCategoryByLabel,
  getLocale,
  type Language,
  t,
} from "./i18n"
import { sendPremiumRequiredMessage } from "./monetization/premium-gate"
import { queryMonitor } from "./monitoring"
import { tgObservability } from "./observability/tgwrapper-observability"
import {
  handleSuccessfulPayment,
  type PremiumPlan,
  sendStarsInvoice,
} from "./services/billing-service"
import { type ChartType, generateChartImage } from "./services/chart-service"
import { ExpenseCategory, IncomeCategory, TransactionType } from "./types"
import {
  escapeMarkdown,
  formatDateDisplay,
  formatMoney,
  formatSearchUsage,
  parseSearchCommandInput,
} from "./utils"

function resolveExpenseCategory(input: string): ExpenseCategory {
  return getExpenseCategoryByLabel(input) || ExpenseCategory.OTHER_EXPENSE
}

function resolveIncomeCategory(input: string): IncomeCategory {
  return getIncomeCategoryByLabel(input) || IncomeCategory.OTHER_INCOME
}

function parseAmountAndCategory(
  text: string
): { amount: number; category: string } | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) return null

  const firstPart = parts[0]
  if (firstPart) {
    const firstAsAmount = parseFloat(firstPart.replace(",", "."))
    if (!Number.isNaN(firstAsAmount) && firstAsAmount > 0) {
      return {
        amount: firstAsAmount,
        category: parts.slice(1).join(" "),
      }
    }
  }

  const lastPart = parts[parts.length - 1]
  if (lastPart) {
    const lastAsAmount = parseFloat(lastPart.replace(",", "."))
    if (!Number.isNaN(lastAsAmount) && lastAsAmount > 0) {
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

function getAdminIds(): string[] {
  return (process.env.ADMIN_USERS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

function isAdmin(userId: string): boolean {
  return getAdminIds().includes(userId)
}

function premiumPitch(lang: Language): string {
  const monthly = (config.PREMIUM_MONTHLY_PRICE_CENTS / 100).toFixed(2)
  const yearly = (config.PREMIUM_YEARLY_PRICE_CENTS / 100).toFixed(2)
  return t(lang, "commands.monetization.pitch", {
    monthly,
    yearly,
    trialDays: config.TRIAL_DAYS,
  })
}

function formatDateTime(
  lang: Language,
  value: Date | null | undefined
): string {
  if (!value) return "-"
  return value.toLocaleString(getLocale(lang), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseBuyPlan(input: string): PremiumPlan | null {
  if (input === "month" || input === "monthly") return "monthly"
  if (input === "year" || input === "yearly") return "yearly"
  if (input === "lifetime") return "lifetime"
  return null
}

function txSign(type: TransactionType): string {
  if (type === TransactionType.INCOME) return "+"
  if (type === TransactionType.EXPENSE) return "-"
  return "↔"
}

function premiumLimitMessage(
  lang: Language,
  kind: "transaction" | "voice"
): string {
  const limitText =
    kind === "voice"
      ? t(lang, "commands.monetization.limitVoice", {
          limit: config.FREE_VOICE_INPUTS_PER_DAY,
        })
      : t(lang, "commands.monetization.limitTransaction", {
          limit: config.FREE_TRANSACTIONS_PER_MONTH,
        })
  return `${limitText}\n\n${premiumPitch(lang)}`
}

async function ensurePremiumForCommand(
  bot: BotClient,
  userId: string,
  chatId: number,
  lang: Language,
  feature: string
): Promise<boolean> {
  const premiumEnabled = await db.canUsePremiumFeature(userId)
  if (premiumEnabled) return true
  await sendPremiumRequiredMessage(bot, chatId, lang, feature)
  return false
}

function onTextMatch(
  bot: BotClient,
  regexp: RegExp,
  callback: (
    msg: Tg.Message,
    match: RegExpExecArray | null
  ) => unknown | Promise<unknown>
): void {
  const wrapped = async (
    msg: Tg.Message,
    forcedMatch?: RegExpExecArray | null
  ) => {
    if (forcedMatch) {
      await callback(msg, forcedMatch)
      return
    }

    const text = msg.text
    if (!text) {
      await callback(msg, null)
      return
    }
    regexp.lastIndex = 0
    const match = regexp.exec(text)
    if (match) {
      await callback(msg, match)
    }
  }
  ;(wrapped as { __pattern?: RegExp }).__pattern = regexp
  bot.on("message", wrapped)
}

export function registerCommands(bot: BotClient) {
  bot.on("pre_checkout_query", async (query) => {
    const parsed = query.invoice_payload.startsWith("premium:")
    if (!parsed) {
      await bot.answerPreCheckoutQuery({
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: "Unsupported payment payload",
      })
      return
    }
    await bot.answerPreCheckoutQuery({
      pre_checkout_query_id: query.id,
      ok: true,
    })
  })

  bot.on("message", async (msg) => {
    const processed = await handleSuccessfulPayment(msg)
    if (!processed) return
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    await bot.sendMessage(
      chatId,
      t(lang, "commands.monetization.paymentSuccess")
    )
  })

  onTextMatch(bot, /^\/premium(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    const status = await db.getSubscriptionStatus(userId)

    let statusText = t(lang, "commands.monetization.planFree")
    if (status.tier === "trial") {
      statusText =
        `${t(lang, "commands.monetization.planTrial")}\n` +
        `${t(lang, "commands.monetization.expires")}: ${formatDateTime(lang, status.trialExpiresAt)}`
    }
    if (status.tier === "premium") {
      statusText =
        `${t(lang, "commands.monetization.planPremium")}\n` +
        `${t(lang, "commands.monetization.expires")}: ${formatDateTime(lang, status.premiumExpiresAt)}`
    }

    await bot.sendMessage(
      chatId,
      `${statusText}\n\n${premiumPitch(lang)}\n\n` +
        `${t(lang, "commands.monetization.buyNow")}:\n` +
        "/buy month\n" +
        "/buy year\n" +
        "/buy lifetime",
      {
        parse_mode: "Markdown",
      }
    )
  })

  onTextMatch(bot, /^\/buy(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (!config.ENABLE_TELEGRAM_STARS) {
      await bot.sendMessage(
        chatId,
        t(lang, "commands.monetization.paymentsDisabled")
      )
      return
    }

    const plan = parseBuyPlan((match?.[1] || "").trim().toLowerCase())
    if (!plan) {
      await bot.sendMessage(chatId, t(lang, "commands.monetization.buyUsage"))
      return
    }

    try {
      await sendStarsInvoice(bot, chatId, userId, plan)
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `${t(lang, "commands.monetization.invoiceFailed")}: ${error instanceof Error ? error.message : "unknown error"}`
      )
    }
  })

  onTextMatch(bot, /^\/trial(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    const status = await db.getSubscriptionStatus(userId)

    if (status.tier === "trial" && status.trialExpiresAt) {
      await bot.sendMessage(
        chatId,
        t(lang, "commands.monetization.trialAlreadyActive", {
          date: formatDateTime(lang, status.trialExpiresAt),
        })
      )
      return
    }

    if (status.tier === "premium" && status.premiumExpiresAt) {
      await bot.sendMessage(
        chatId,
        t(lang, "commands.monetization.premiumAlreadyActive", {
          date: formatDateTime(lang, status.premiumExpiresAt),
        })
      )
      return
    }

    if (status.trialUsed) {
      await bot.sendMessage(
        chatId,
        t(lang, "commands.monetization.trialAlreadyUsed")
      )
      return
    }

    await bot.sendMessage(
      chatId,
      t(lang, "commands.monetization.trialConfirmPrompt", {
        trialDays: config.TRIAL_DAYS,
      }),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t(lang, "commands.monetization.trialConfirmButton"),
                callback_data: "trial_confirm",
              },
              {
                text: t(lang, "commands.monetization.trialCancelButton"),
                callback_data: "trial_cancel",
              },
            ],
          ],
        },
      }
    )
  })

  onTextMatch(bot, /^\/balance(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (
      !(await ensurePremiumForCommand(
        bot,
        userId,
        chatId,
        lang,
        t(lang, "commands.monetization.featureCommandMode")
      ))
    ) {
      return
    }

    const balancesText = await db.getBalances(userId)
    await bot.sendMessage(
      chatId,
      `${t(lang, "balances.title")}\n\n${balancesText}`,
      {
        parse_mode: "Markdown",
      }
    )
  })

  onTextMatch(bot, /^\/templates(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (
      !(await ensurePremiumForCommand(
        bot,
        userId,
        chatId,
        lang,
        t(lang, "commands.monetization.featureTemplates")
      ))
    ) {
      return
    }

    const templates = await db.getTemplates(userId)

    if (templates.length === 0) {
      await bot.sendMessage(
        chatId,
        `${t(lang, "commands.templates.empty", {
          saveAsTemplate: t(lang, "buttons.saveAsTemplate"),
        })}\n\n${t(lang, "templates.emptyHint")}`,
        { parse_mode: "Markdown" }
      )
      return
    }

    const buttons: Tg.InlineKeyboardButton[][] = templates.map((tpl) => {
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
    })

    await bot.sendMessage(chatId, t(lang, "commands.templates.listHint"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    })
  })

  onTextMatch(bot, /^\/expense(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (
      !(await ensurePremiumForCommand(
        bot,
        userId,
        chatId,
        lang,
        t(lang, "commands.monetization.featureCommandMode")
      ))
    ) {
      return
    }
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

    let txId: string
    try {
      txId = await db.addTransaction(userId, {
        id: randomUUID(),
        date: new Date(),
        amount,
        currency,
        type: TransactionType.EXPENSE,
        category,
        fromAccountId: smartAccount,
      })
    } catch (error) {
      if ((error as { code?: string }).code === "SUBSCRIPTION_LIMIT_EXCEEDED") {
        await bot.sendMessage(
          chatId,
          premiumLimitMessage(lang, "transaction"),
          {
            parse_mode: "Markdown",
          }
        )
        return
      }
      throw error
    }

    const formatted = formatMoney(amount, currency)
    const text = t(lang, "commands.expense.added", {
      amount: formatted,
      category: escapeMarkdown(getCategoryLabel(lang, category)),
      account: escapeMarkdown(smartAccount || ""),
    })

    const buttons: Tg.InlineKeyboardButton[][] = [
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

  onTextMatch(bot, /^\/income(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (
      !(await ensurePremiumForCommand(
        bot,
        userId,
        chatId,
        lang,
        t(lang, "commands.monetization.featureCommandMode")
      ))
    ) {
      return
    }
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

    let txId: string
    try {
      txId = await db.addTransaction(userId, {
        id: randomUUID(),
        date: new Date(),
        amount,
        currency,
        type: TransactionType.INCOME,
        category,
        toAccountId: smartAccount,
      })
    } catch (error) {
      if ((error as { code?: string }).code === "SUBSCRIPTION_LIMIT_EXCEEDED") {
        await bot.sendMessage(
          chatId,
          premiumLimitMessage(lang, "transaction"),
          {
            parse_mode: "Markdown",
          }
        )
        return
      }
      throw error
    }

    const formatted = formatMoney(amount, currency)
    const text = t(lang, "commands.income.added", {
      amount: formatted,
      category: escapeMarkdown(getCategoryLabel(lang, category)),
      account: escapeMarkdown(smartAccount || ""),
    })

    const buttons: Tg.InlineKeyboardButton[][] = [
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

  onTextMatch(bot, /^\/search(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (
      !(await ensurePremiumForCommand(
        bot,
        userId,
        chatId,
        lang,
        t(lang, "commands.monetization.featureCommandMode")
      ))
    ) {
      return
    }
    const rawInput = match?.[1]

    const parsed = parseSearchCommandInput(rawInput)
    if (parsed.errors.length > 0) {
      await bot.sendMessage(
        chatId,
        `❌ Invalid filters:\n${parsed.errors.map((e) => `• ${e}`).join("\n")}\n\n${formatSearchUsage()}`,
        { parse_mode: "Markdown" }
      )
      return
    }

    const hasAnyFilter = Object.keys(parsed.filters).length > 0
    if (!hasAnyFilter) {
      await bot.sendMessage(chatId, formatSearchUsage())
      return
    }

    const { transactions, total, hasMore } = await tgObservability.trackAsync(
      "search.command.ms",
      async () =>
        await db.searchTransactions(userId, {
          ...parsed.filters,
          page: 1,
          limit: 10,
        })
    )
    tgObservability.increment("search.command.count")

    if (transactions.length === 0) {
      await bot.sendMessage(
        chatId,
        `🔍 ${t(lang, "history.noFilteredTransactions")}`
      )
      return
    }

    const lines = transactions.map((tx, index) => {
      const account = tx.fromAccountId || tx.toAccountId || "N/A"
      const amount = `${txSign(tx.type)}${formatMoney(tx.amount, tx.currency, true)}`
      const date = formatDateDisplay(tx.date)
      const desc = tx.description ? escapeMarkdown(tx.description) : "-"
      return `${index + 1}. ${date} | *${tx.type}* | ${amount}\n   ${escapeMarkdown(tx.category)} | ${escapeMarkdown(account)}\n   ${desc}`
    })

    await bot.sendMessage(
      chatId,
      `🔎 *Search Results*\nTotal: *${total}*\n\n${lines.join("\n\n")}${hasMore ? "\n\n…and more (showing first 10)" : ""}`,
      { parse_mode: "Markdown" }
    )
  })

  onTextMatch(bot, /^\/chart(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)
    if (
      !(await ensurePremiumForCommand(
        bot,
        userId,
        chatId,
        lang,
        t(lang, "commands.monetization.featureCharts")
      ))
    ) {
      return
    }

    const args = (match?.[1] || "").trim().split(/\s+/).filter(Boolean)
    const typeRaw = (args[0] || "trends").toLowerCase()
    const monthsRaw = args[1]
    const months = monthsRaw ? Number.parseInt(monthsRaw, 10) : 6

    const validTypes: ChartType[] = ["trends", "categories", "balance"]
    if (!validTypes.includes(typeRaw as ChartType)) {
      await bot.sendMessage(chatId, t(lang, "commands.monetization.chartUsage"))
      return
    }

    if (!Number.isFinite(months) || months < 1 || months > 24) {
      await bot.sendMessage(
        chatId,
        t(lang, "commands.monetization.chartMonthsRange")
      )
      return
    }

    await bot.sendMessage(
      chatId,
      t(lang, "commands.monetization.chartGenerating")
    )

    try {
      const image = await tgObservability.trackAsync(
        "chart.command.ms",
        async () =>
          await generateChartImage(userId, typeRaw as ChartType, lang, months)
      )
      tgObservability.increment("chart.command.count")

      if (!image) {
        await bot.sendMessage(chatId, t(lang, "history.noTransactions"))
        return
      }

      await bot.sendDocument(
        chatId,
        image,
        {},
        {
          filename: `chart_${typeRaw}_${months}m.png`,
          contentType: "image/png",
        }
      )
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `${t(lang, "commands.monetization.chartFailed")}: ${error instanceof Error ? error.message : "unknown error"}`
      )
    }
  })

  onTextMatch(bot, /\/querystats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    if (!isAdmin(userId)) {
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

  onTextMatch(bot, /\/resetquerystats/, async (msg) => {
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

  onTextMatch(bot, /\/fxstats/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    const lang = await resolveUserLanguage(userId)

    if (!isAdmin(userId)) {
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

  onTextMatch(bot, /\/fxreset/, async (msg) => {
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

  onTextMatch(bot, /\/fxclear/, async (msg) => {
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

  onTextMatch(bot, /^\/admin_stats(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id
    const userId = chatId.toString()
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, "Access denied")
      return
    }

    const stats = await db.getMonetizationStats()
    const obs = tgObservability.getSnapshot()
    await bot.sendMessage(
      chatId,
      "📊 Monetization stats\n\n" +
        `Users: ${stats.totalUsers}\n` +
        `Free: ${stats.freeUsers}\n` +
        `Trial: ${stats.trialUsers}\n` +
        `Premium: ${stats.premiumUsers}\n` +
        `Active premium: ${stats.activePremiumUsers}\n` +
        `Transactions this month: ${stats.transactionsThisMonthTotal}\n\n` +
        `APM counters: ${Object.keys(obs.counters || {}).length}\n` +
        `APM timers: ${Object.keys(obs.timers || {}).length}`
    )
  })

  onTextMatch(
    bot,
    /^\/admin_sub(?:@\w+)?\s+(\S+)\s+(free|trial|premium)(?:\s+(\d+))?$/i,
    async (msg, match) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()
      if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, "Access denied")
        return
      }
      if (!match) return
      const targetUserId = match[1] || ""
      const tier = (match[2] || "free").toLowerCase() as
        | "free"
        | "trial"
        | "premium"
      const days = match[3] ? Number.parseInt(match[3], 10) : 30

      const status = await db.setSubscriptionTier(targetUserId, tier, days)
      await bot.sendMessage(
        chatId,
        `✅ Updated ${targetUserId}\nTier: ${status.tier}\nPremium expires: ${status.premiumExpiresAt?.toISOString() || "n/a"}\nTrial expires: ${status.trialExpiresAt?.toISOString() || "n/a"}`
      )
    }
  )

  onTextMatch(
    bot,
    /^\/admin_payment(?:@\w+)?\s+(\S+)\s+(\d+)\s+([A-Z]{3})\s+(\S+)\s+(.+)$/i,
    async (msg, match) => {
      const chatId = msg.chat.id
      const userId = chatId.toString()
      if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, "Access denied")
        return
      }
      if (!match) return
      const targetUserId = match[1] || ""
      const amount = Number.parseInt(match[2] || "0", 10)
      const currency = (match[3] || "USD").toUpperCase()
      const provider = match[4] || "manual"
      const reference = match[5] || "manual_ref"

      const days = Math.max(
        1,
        Math.floor((amount / config.PREMIUM_MONTHLY_PRICE_CENTS) * 30)
      )
      const status = await db.recordPayment(
        targetUserId,
        provider,
        reference,
        days
      )
      await bot.sendMessage(
        chatId,
        `💳 Payment recorded for ${targetUserId}: ${amount} ${currency}\n` +
          `Premium granted for ${days} days.\n` +
          `Expires: ${status.premiumExpiresAt?.toISOString() || "n/a"}`
      )
    }
  )
}
