import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { config } from "../config"
import { dbStorage as db } from "../database/storage-db"
import { getLocale, type Language, resolveLanguage, t } from "../i18n"
import { buildSubscriptionView } from "./subscription-view"
import { type PremiumPlan, sendStarsInvoice } from "../services/billing-service"
import { safeAnswerCallback } from "../utils"

async function resolveLang(userId: string): Promise<Language> {
  try {
    const lang = await db.getUserLanguage(userId)
    return resolveLanguage(lang)
  } catch {
    return "en"
  }
}

function formatDateTime(lang: Language, value: Date | null | undefined): string {
  if (!value) return "-"
  return value.toLocaleString(getLocale(lang), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isMessageNotModifiedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.toLowerCase().includes("message is not modified")
}

export async function handleTrialConfirm(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  const current = await db.getSubscriptionStatus(userId)

  if (current.tier === "trial" && current.trialExpiresAt) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "commands.monetization.trialAlreadyActive", {
        date: formatDateTime(lang, current.trialExpiresAt),
      }),
      show_alert: true,
    })
    return
  }

  if (current.tier === "premium" && current.premiumExpiresAt) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "commands.monetization.premiumAlreadyActive", {
        date: formatDateTime(lang, current.premiumExpiresAt),
      }),
      show_alert: true,
    })
    return
  }

  if (current.trialUsed) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "commands.monetization.trialAlreadyUsed"),
      show_alert: true,
    })
    return
  }

  const status = await db.startTrial(userId, config.TRIAL_DAYS)
  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: t(lang, "common.done"),
  })

  if (query.message) {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: query.message.message_id,
      }
    )
  }

  await bot.sendMessage(
    chatId,
    `${t(lang, "commands.monetization.trialStartedTitle")}\n\n` +
      `${t(lang, "commands.monetization.trialStartedBody", {
        date: formatDateTime(lang, status.trialExpiresAt),
      })}\n\n` +
      `${t(lang, "commands.monetization.trialWhatIncluded")}`
  )
}

export async function handleTrialCancel(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: t(lang, "commands.monetization.trialCancelled"),
  })

  if (query.message) {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: query.message.message_id,
      }
    )
  }
}

export async function handleSubscriptionBuy(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  plan: PremiumPlan
) {
  const lang = await resolveLang(userId)
  if (!config.ENABLE_TELEGRAM_STARS) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "commands.monetization.paymentsDisabled"),
      show_alert: true,
    })
    return
  }

  try {
    await sendStarsInvoice(bot, chatId, userId, plan)
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "common.done"),
    })
  } catch (error) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: `${t(lang, "commands.monetization.invoiceFailed")}: ${error instanceof Error ? error.message : "unknown error"}`,
      show_alert: true,
    })
  }
}

export async function handleSubscriptionOpen(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  const status = await db.getSubscriptionStatus(userId)
  const view = buildSubscriptionView(lang, status)

  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
  })

  await bot.sendMessage(chatId, view.text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: view.keyboard,
    },
  })
}

export async function handleSubscriptionCancelPrompt(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(chatId, t(lang, "settings.cancelSubscriptionPrompt"), {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: t(lang, "settings.cancelSubscriptionConfirm"),
            callback_data: "sub_cancel_confirm",
          },
          {
            text: t(lang, "settings.cancelSubscriptionAbort"),
            callback_data: "sub_cancel_abort",
          },
        ],
      ],
    },
  })
}

export async function handleSubscriptionCancelConfirm(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  const before = await db.getSubscriptionStatus(userId)
  const endDate =
    before.tier === "premium" ? before.premiumExpiresAt : before.trialExpiresAt
  const status = await db.pauseSubscription(userId)
  const view = buildSubscriptionView(lang, status)

  const message = endDate
    ? t(lang, "settings.cancelSubscriptionDoneUntil", {
        date: formatDateTime(lang, endDate),
      })
    : t(lang, "settings.cancelSubscriptionDone")

  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: message,
  })
  if (query.message) {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: query.message.message_id,
      }
    )
  }

  await bot.sendMessage(chatId, message)
  await bot.sendMessage(chatId, view.text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: view.keyboard,
    },
  })
}

export async function handleSubscriptionCancelAbort(
  bot: BotClient,
  query: Tg.CallbackQuery,
  _userId: string,
  chatId: number
) {
  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
  })
  if (query.message) {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: query.message.message_id,
      }
    )
  }
}

export async function handleSubscriptionResume(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  const status = await db.resumePausedSubscription(userId)
  const view = buildSubscriptionView(lang, status)

  if (query.message) {
    try {
      await bot.editMessageText(view.text, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: view.keyboard,
        },
      })
    } catch (error) {
      if (!isMessageNotModifiedError(error)) throw error
    }
  } else {
    await bot.sendMessage(chatId, view.text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: view.keyboard,
      },
    })
  }

  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: t(lang, "settings.subscriptionResumed"),
  })
}

export async function handleSubscriptionRefresh(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number
) {
  const lang = await resolveLang(userId)
  const status = await db.getSubscriptionStatus(userId)
  const view = buildSubscriptionView(lang, status)

  if (query.message) {
    try {
      await bot.editMessageText(view.text, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: view.keyboard,
        },
      })
    } catch (error) {
      if (!isMessageNotModifiedError(error)) throw error
    }
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "settings.subscriptionUpdated"),
    })
    return
  }

  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: t(lang, "settings.subscriptionUpdated"),
  })
}
