import type TelegramBot from "@telegram-api"
import { dbStorage as db } from "./database/storage-db"
import type { Language } from "./i18n"
import * as menusI18n from "./menus-i18n"
import type { WizardManager } from "./wizards/wizards"

async function resolveLangByUser(userId: string): Promise<Language> {
  try {
    return await db.getUserLanguage(userId)
  } catch {
    return "en"
  }
}

async function resolveLangByChat(chatId: number): Promise<Language> {
  return resolveLangByUser(chatId.toString())
}

export async function showMainMenu(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  const lang = await resolveLangByChat(chatId)
  return menusI18n.showMainMenu(bot, chatId, lang)
}

export async function showBalancesMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showBalancesMenu(wizard, chatId, userId, lang)
}

export async function showDebtsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showDebtsMenu(bot, chatId, userId, lang)
}

export async function showGoalsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showGoalsMenu(bot, chatId, userId, lang)
}

export async function showIncomeSourcesMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showIncomeSourcesMenu(bot, chatId, userId, lang)
}

export async function showSettingsMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showSettingsMenu(bot, chatId, userId, lang)
}

export async function showStatsMenu(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  const lang = await resolveLangByChat(chatId)
  return menusI18n.showStatsMenu(bot, chatId, lang)
}

export async function showHistoryMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  page: number = 1
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showHistoryMenu(wizard, chatId, userId, lang, page)
}

export async function showBudgetMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showBudgetMenu(wizard, chatId, userId, lang)
}

export async function showAnalyticsReportsMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
) {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showAnalyticsReportsMenu(wizard, chatId, userId, lang)
}

export async function showNetWorthMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  view: "summary" | "assets" | "debts" | "full" = "summary"
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showNetWorthMenu(bot, chatId, userId, lang, view)
}

export async function showActiveRemindersMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showActiveRemindersMenu(wizard, chatId, userId, lang)
}

export async function showAutomationMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showAutomationMenu(wizard, chatId, userId, lang)
}

export async function showAdvancedMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showAdvancedMenu(wizard, chatId, userId, lang)
}
