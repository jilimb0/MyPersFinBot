import type { TgTypes as Tg } from "@jilimb0/tgwrapper"
import { getTranslationValue, type Language, t } from "./index"

/**
 * Generate main menu keyboard based on user language
 */
export function getMainMenuKeyboard(
  lang: Language,
  mode: "basic" | "pro" = "basic"
): Tg.SendMessageOptions {
  if (mode === "basic") {
    return {
      reply_markup: {
        keyboard: [
          [
            { text: t(lang, "mainMenu.expense") },
            { text: t(lang, "mainMenu.income") },
          ],
          [
            { text: t(lang, "mainMenu.balances") },
            { text: t(lang, "mainMenu.analytics") },
          ],
          [{ text: t(lang, "mainMenu.settings") }],
        ],
        resize_keyboard: true,
      },
    }
  }

  return {
    reply_markup: {
      keyboard: [
        [
          { text: t(lang, "mainMenu.expense") },
          { text: t(lang, "mainMenu.income") },
        ],
        [
          { text: t(lang, "mainMenu.balances") },
          { text: t(lang, "mainMenu.budgetPlanner") },
        ],
        [
          { text: t(lang, "mainMenu.debts") },
          { text: t(lang, "mainMenu.goals") },
        ],
        [
          { text: t(lang, "mainMenu.analytics") },
          { text: t(lang, "mainMenu.settings") },
        ],
      ],
      resize_keyboard: true,
    },
  }
}

/**
 * Generate settings keyboard
 */
export function getSettingsKeyboard(
  lang: Language,
  mode: "basic" | "pro" = "basic"
): Tg.ReplyKeyboardMarkup {
  if (mode === "basic") {
    return {
      keyboard: [
        [
          { text: t(lang, "settings.language") },
          { text: t(lang, "settings.changeCurrency") },
        ],
        [
          { text: t(lang, "settings.subscription") },
          { text: t(lang, "settings.uiModePro") },
        ],
        [
          { text: t(lang, "settings.helpInfo") },
          { text: t(lang, "mainMenu.mainMenuButton") },
        ],
      ],
      resize_keyboard: true,
    }
  }

  return {
    keyboard: [
      [
        { text: t(lang, "settings.language") },
        { text: t(lang, "settings.changeCurrency") },
      ],
      [
        { text: t(lang, "settings.subscription") },
        { text: t(lang, "settings.incomeSources") },
      ],
      [
        { text: t(lang, "settings.automation") },
        { text: t(lang, "settings.advanced") },
      ],
      [{ text: t(lang, "settings.uiModeBasic") }],
      [
        { text: t(lang, "settings.helpInfo") },
        { text: t(lang, "mainMenu.mainMenuButton") },
      ],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate analytics keyboard
 */
export function getAnalyticsKeyboard(lang: Language): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: t(lang, "analytics.exportCSV") }],
      [{ text: t(lang, "analytics.filters") }],
      [{ text: t(lang, "analytics.trends") }],
      [{ text: t(lang, "analytics.topCategories") }],
      [
        { text: t(lang, "common.back") },
        { text: t(lang, "mainMenu.mainMenuButton") },
      ],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate stats keyboard
 */
export function getStatsKeyboard(lang: Language): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: t(lang, "analytics.reports") }],
      [{ text: t(lang, "analytics.history") }],
      [{ text: t(lang, "analytics.netWorth") }],
      [{ text: t(lang, "mainMenu.mainMenuButton") }],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate back + main menu keyboard
 */
export function getBackAndMainKeyboard(lang: Language): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [
        { text: t(lang, "common.back") },
        { text: t(lang, "mainMenu.mainMenuButton") },
      ],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate date selection keyboard
 */
export function getDateKeyboard(lang: Language): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: t(lang, "common.today") }],
      [{ text: t(lang, "common.yesterday") }],
      [{ text: t(lang, "common.custom") }],
      [{ text: t(lang, "common.cancel") }],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate confirm/cancel keyboard
 */
export function getConfirmKeyboard(lang: Language): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: t(lang, "common.confirm") }, { text: t(lang, "common.cancel") }],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate language selection keyboard
 */
export function getLanguageKeyboard(lang: Language): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: t(lang, "languages.en") }],
      [{ text: t(lang, "languages.ru") }],
      [{ text: t(lang, "languages.uk") }],
      [{ text: t(lang, "languages.es") }],
      [{ text: t(lang, "languages.pl") }],
      [{ text: t(lang, "common.back") }],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate start tracking keyboard
 */
export function getStartTrackingKeyboard(
  lang: Language
): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: t(lang, "mainMenu.startTracking") }]],
    resize_keyboard: true,
  }
}

/**
 * Generate go to balances keyboard
 */
export function getGoToBalancesKeyboard(
  lang: Language
): Tg.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: t(lang, "transactions.goToBalances") }],
      [{ text: t(lang, "mainMenu.mainMenuButton") }],
    ],
    resize_keyboard: true,
  }
}

/**
 * Generate reminder time selection keyboard
 */
export function getReminderTimeKeyboard(
  lang: Language
): Tg.ReplyKeyboardMarkup {
  const timeOptions =
    (getTranslationValue(lang, "reminders.timeOptions") as string[]) || []

  const rows: Tg.KeyboardButton[][] = []
  for (let i = 0; i < timeOptions.length; i += 3) {
    rows.push(timeOptions.slice(i, i + 3).map((time) => ({ text: time })))
  }

  rows.push([
    { text: t(lang, "common.back") },
    { text: t(lang, "mainMenu.mainMenuButton") },
  ])

  return {
    keyboard: rows,
    resize_keyboard: true,
  }
}
