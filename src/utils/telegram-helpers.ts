/**
 * Telegram Bot helper functions
 */

import type TelegramBot from "node-telegram-bot-api"
import type { AnswerCallbackQueryOptions } from "node-telegram-bot-api"
import { type Language, t } from "../i18n"

/**
 * Escape Telegram Markdown special chars in user-provided strings.
 * Use only for values injected into Markdown messages.
 */
export function escapeMarkdown(text: string): string {
  if (!text) return ""
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/`/g, "\\`")
}

/**
 * Safely answer callback query (ignores outdated queries)
 */
export async function safeAnswerCallback(
  bot: TelegramBot,
  options?: AnswerCallbackQueryOptions
) {
  if (!options?.callback_query_id) return

  try {
    await bot.answerCallbackQuery(options.callback_query_id, options)
  } catch (err: unknown) {
    // Ignore errors from outdated callback queries
    const error = err as {
      response?: { body?: { description?: string } }
      message?: string
    }
    if (
      error?.response?.body?.description?.includes("query is too old") ||
      error?.response?.body?.description?.includes("query ID is invalid")
    ) {
      return
    }
    console.error("Error answering callback:", error.message || err)
  }
}

/**
 * Create keyboard buttons from list of items
 */
export function createListButtons(options: {
  items: string[]
  withoutBack?: boolean
  beforeItemsButtons?: TelegramBot.KeyboardButton[][]
  afterItemsButtons?: string[]
  itemsPerRowCustom?: number
  lang: Language
}): TelegramBot.KeyboardButton[][] {
  const {
    items,
    withoutBack,
    beforeItemsButtons = [],
    afterItemsButtons = [],
    itemsPerRowCustom = 2,
    lang,
  } = options

  const buttons: TelegramBot.KeyboardButton[][] = beforeItemsButtons

  if (afterItemsButtons) items.push(...afterItemsButtons)
  const itemsPerRow = items.length >= 4 ? itemsPerRowCustom : 1

  for (let i = 0; i < items.length; i += itemsPerRow) {
    const row: TelegramBot.KeyboardButton[] = []
    for (let j = 0; j < itemsPerRow && i + j < items.length; j++) {
      const text = items[i + j]
      if (text) {
        row.push({ text })
      }
    }
    if (row.length > 0) {
      buttons.push(row)
    }
  }

  if (withoutBack) buttons.push([{ text: t(lang, "mainMenu.mainMenuButton") }])
  else
    buttons.push([
      { text: t(lang, "buttons.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ])

  return buttons
}
