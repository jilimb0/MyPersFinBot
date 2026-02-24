import type { BotClient } from "@jilimb0/tgwrapper"
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
  bot: BotClient,
  chatId: number
): Promise<void> {
  const lang = await resolveLangByChat(chatId)
  const userId = chatId.toString()
  return menusI18n.showMainMenu(bot, chatId, lang, userId)
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
  bot: BotClient,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showDebtsMenu(bot, chatId, userId, lang)
}

export async function showGoalsMenu(
  bot: BotClient,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showGoalsMenu(bot, chatId, userId, lang)
}

export async function showIncomeSourcesMenu(
  bot: BotClient,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showIncomeSourcesMenu(bot, chatId, userId, lang)
}

export async function showSettingsMenu(
  bot: BotClient,
  chatId: number,
  userId: string
): Promise<void> {
  const lang = await resolveLangByUser(userId)
  return menusI18n.showSettingsMenu(bot, chatId, userId, lang)
}

export async function showStatsMenu(
  bot: BotClient,
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
  bot: BotClient,
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
