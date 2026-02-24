import type { BotClient } from "@jilimb0/tgwrapper"
import { config } from "../config"
import { type Language, t } from "../i18n"

function premiumPitch(lang: Language): string {
  const monthly = (config.PREMIUM_MONTHLY_PRICE_CENTS / 100).toFixed(2)
  const yearly = (config.PREMIUM_YEARLY_PRICE_CENTS / 100).toFixed(2)
  return t(lang, "commands.monetization.pitch", {
    monthly,
    yearly,
    trialDays: config.TRIAL_DAYS,
  })
}

export async function sendPremiumRequiredMessage(
  bot: BotClient,
  chatId: number,
  lang: Language,
  feature: string
): Promise<void> {
  await bot.sendMessage(
    chatId,
    `${t(lang, "commands.monetization.featureLocked", { feature })}\n\n${premiumPitch(lang)}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: t(lang, "commands.monetization.openSubscriptionButton"),
              callback_data: "sub_open",
            },
          ],
          [
            {
              text: t(lang, "commands.monetization.buyMonthButton"),
              callback_data: "sub_buy_month",
            },
            {
              text: t(lang, "commands.monetization.buyYearButton"),
              callback_data: "sub_buy_year",
            },
          ],
        ],
      },
    }
  )
}
