import type { TgTypes as Tg } from "@jilimb0/tgwrapper"
import type { SubscriptionStatus } from "../database/storage-db"
import { getLocale, type Language, t } from "../i18n"

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

function formatDuration(lang: Language, ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return t(lang, "settings.subscriptionRemainingValue", {
    days,
    hours,
    minutes,
  })
}

export function buildSubscriptionView(
  lang: Language,
  status: SubscriptionStatus
): {
  text: string
  keyboard: Tg.InlineKeyboardButton[][]
} {
  const tierLabel = status.subscriptionPaused
    ? t(lang, "commands.monetization.tierPaused")
    : status.tier === "premium"
      ? t(lang, "commands.monetization.tierPremium")
      : status.tier === "trial"
        ? t(lang, "commands.monetization.tierTrial")
        : t(lang, "commands.monetization.tierFree")

  const expireDate =
    status.tier === "premium"
      ? formatDateTime(lang, status.premiumExpiresAt)
      : status.tier === "trial"
        ? formatDateTime(lang, status.trialExpiresAt)
        : "-"

  const timeLine = status.subscriptionPaused
    ? t(lang, "settings.subscriptionRemainingLine", {
        value: formatDuration(lang, status.pausedRemainingMs),
      })
    : t(lang, "settings.subscriptionExpiresLine", { date: expireDate })

  const text =
    `${t(lang, "settings.subscriptionTitle")}\n\n` +
    `${t(lang, "settings.subscriptionTierLine", { tier: tierLabel })}\n` +
    `${timeLine}\n\n` +
    `${t(lang, "settings.subscriptionHint")}`

  const keyboard: Tg.InlineKeyboardButton[][] = []
  if (
    status.tier === "free" &&
    !status.trialUsed &&
    !status.subscriptionPaused
  ) {
    keyboard.push([
      {
        text: t(lang, "commands.monetization.trialConfirmButton"),
        callback_data: "trial_confirm",
      },
    ])
  }

  if (
    status.tier === "free" ||
    status.tier === "trial" ||
    status.subscriptionPaused
  ) {
    keyboard.push([
      {
        text: t(lang, "commands.monetization.buyMonthButton"),
        callback_data: "sub_buy_month",
      },
      {
        text: t(lang, "commands.monetization.buyYearButton"),
        callback_data: "sub_buy_year",
      },
    ])
    keyboard.push([
      {
        text: t(lang, "commands.monetization.buyLifetimeButton"),
        callback_data: "sub_buy_lifetime",
      },
    ])
  }

  if (status.subscriptionPaused) {
    keyboard.push([
      {
        text: t(lang, "settings.resumeSubscription"),
        callback_data: "sub_resume",
      },
    ])
  }

  if (status.tier === "premium" || status.tier === "trial") {
    keyboard.push([
      {
        text: t(lang, "settings.cancelSubscription"),
        callback_data: "sub_cancel_prompt",
      },
    ])
  }

  keyboard.push([
    {
      text: t(lang, "settings.subscriptionRefresh"),
      callback_data: "sub_refresh",
    },
  ])

  return { text, keyboard }
}
