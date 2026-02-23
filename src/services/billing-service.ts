import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { config } from "../config"
import { dbStorage } from "../database/storage-db"

export type PremiumPlan = "monthly" | "yearly" | "lifetime"

const PLAN_DAYS: Record<PremiumPlan, number> = {
  monthly: 30,
  yearly: 365,
  lifetime: 3650,
}

const PLAN_STARS: Record<PremiumPlan, number> = {
  monthly: config.PREMIUM_MONTHLY_STARS,
  yearly: config.PREMIUM_YEARLY_STARS,
  lifetime: config.LIFETIME_STARS,
}

export function buildInvoicePayload(userId: string, plan: PremiumPlan): string {
  return `premium:${plan}:${userId}:${Date.now()}`
}

export function parseInvoicePayload(payload: string): {
  kind: string
  plan: PremiumPlan
  userId: string
} | null {
  const [kind, planRaw, userId] = payload.split(":")
  if (!kind || !planRaw || !userId) return null
  if (kind !== "premium") return null
  if (!["monthly", "yearly", "lifetime"].includes(planRaw)) return null
  return { kind, plan: planRaw as PremiumPlan, userId }
}

export function planToDays(plan: PremiumPlan): number {
  return PLAN_DAYS[plan]
}

export async function sendStarsInvoice(
  bot: BotClient,
  chatId: number | string,
  userId: string,
  plan: PremiumPlan
): Promise<void> {
  if (!config.ENABLE_TELEGRAM_STARS) {
    throw new Error("Telegram Stars payments are disabled")
  }

  const amount = PLAN_STARS[plan]
  const payload = buildInvoicePayload(userId, plan)
  const title =
    plan === "monthly"
      ? "MyPersFinBot Premium (Monthly)"
      : plan === "yearly"
        ? "MyPersFinBot Premium (Yearly)"
        : "MyPersFinBot Premium (Lifetime)"
  const description =
    plan === "monthly"
      ? "30 days Premium access"
      : plan === "yearly"
        ? "365 days Premium access"
        : "Lifetime Premium access"

  await bot.sendInvoice(chatId, {
    title,
    description,
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: title, amount }],
    start_parameter: `premium_${plan}`,
  })
}

export async function handleSuccessfulPayment(
  message: Tg.Message
): Promise<boolean> {
  const payment = (message as Tg.Message & { successful_payment?: Tg.SuccessfulPayment })
    .successful_payment
  if (!payment) return false

  const parsed = parseInvoicePayload(payment.invoice_payload)
  if (!parsed) return false

  const days = planToDays(parsed.plan)
  await dbStorage.recordPayment(
    parsed.userId,
    "telegram_stars",
    payment.telegram_payment_charge_id,
    days
  )
  return true
}
