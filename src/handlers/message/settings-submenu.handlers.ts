/**
 * Settings sub-menu handlers
 */

import { MessageHandler } from "./types"
import { t } from "../../i18n"
import { getSettingsKeyboard } from "../../i18n/keyboards"
import * as menus from "../../menus-i18n"
import * as handlers from "../../handlers"
import { showLanguageMenu } from "../language-handler"
import { Currency } from "../../types"

/**
 * Handle Language settings
 */
export const handleLanguageSettings: MessageHandler = async (context) => {
  const { bot, chatId, userId } = context
  await showLanguageMenu(bot, chatId, userId)
}

/**
 * Handle Automation menu
 */
export const handleAutomationMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context
  await menus.showAutomationMenu(wizardManager, chatId, userId, lang)
}

/**
 * Handle Advanced menu
 */
export const handleAdvancedMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context
  await menus.showAdvancedMenu(wizardManager, chatId, userId, lang)
}

/**
 * Handle Help
 */
export const handleHelp: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "HELP_VIEW",
    data: {},
    returnTo: "settings",
    lang,
  })

  await bot.sendMessage(chatId, t(lang, "messages.userGuide"), {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [
          { text: t(lang, "common.back") },
          { text: t(lang, "mainMenu.mainMenuButton") },
        ],
      ],
      resize_keyboard: true,
    },
  })
}

/**
 * Handle Income Sources menu
 */
export const handleIncomeSourcesMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "INCOME_VIEW",
    data: {},
    returnTo: "settings",
    lang,
  })

  await menus.showIncomeSourcesMenu(bot, chatId, userId, lang)
}

/**
 * Handle Clear Data confirmation
 */
export const handleClearDataConfirm: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "CONFIRM_CLEAR_DATA",
    data: {},
    returnTo: "advanced",
    lang,
  })

  await bot.sendMessage(chatId, t(lang, "settings.clearDataWarning"), {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: t(lang, "settings.yesDeleteEverything") }],
        [{ text: t(lang, "common.noCancel") }],
      ],
      resize_keyboard: true,
    },
  })
}

/**
 * Handle Clear Data execution
 */
export const handleClearDataExecute: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang } = context

  try {
    await context.db.clearAllUserData(userId)
    await bot.sendMessage(
      chatId,
      `${t(lang, "mainMenu.welcome")}\n\n${t(lang, "mainMenu.welcomeIntro")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [[{ text: t(lang, "buttons.startTracking") }]],
          resize_keyboard: true,
        },
      }
    )
  } catch (error) {
    console.error("Error clearing user ", error)
    await bot.sendMessage(chatId, t(context.lang, "errors.clearingData"), {
      reply_markup: getSettingsKeyboard(context.lang),
    })
  }
}

/**
 * Handle Notifications menu
 */
export const handleNotificationsMenu: MessageHandler = async (context) => {
  const { chatId, userId, wizardManager } = context

  wizardManager.setState(userId, {
    step: "NOTIFICATIONS_MENU",
    data: {},
    returnTo: "automation",
    lang: context.lang,
  })

  await handlers.handleNotificationsMenu(wizardManager, chatId, userId)
}

/**
 * Handle Recurring Payments menu
 */
export const handleRecurringMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context
  await handlers.handleRecurringMenu(wizardManager, chatId, userId, lang)
}

/**
 * Handle Custom Messages menu
 */
export const handleCustomMessagesMenu: MessageHandler = async (context) => {
  const { chatId, userId, wizardManager } = context
  await handlers.handleCustomMessagesMenu(wizardManager, chatId, userId)
}

/**
 * Handle Upload Statement
 */
export const handleUploadStatement: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "UPLOAD_STATEMENT",
    data: {},
    returnTo: "advanced",
    lang,
  })

  await bot.sendMessage(
    chatId,
    `${t(lang, "import.title")}\n\n${t(
      lang,
      "import.supported"
    )}\n\n${t(lang, "import.upload")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            { text: t(lang, "common.back") },
            { text: t(lang, "mainMenu.mainMenuButton") },
          ],
        ],
        resize_keyboard: true,
      },
    }
  )
}

/**
 * Handle Change Currency
 */
export const handleChangeCurrency: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context

  const currentCurr = await db.getDefaultCurrency(userId)

  wizardManager.setState(userId, {
    step: "CURRENCY_SELECT",
    data: {},
    returnTo: "settings",
    lang,
  })

  await bot.sendMessage(
    chatId,
    `${t(lang, "settings.changeCurrencyTitle")}\n\n${t(
      lang,
      "settings.currentCurrency"
    )} ${currentCurr}\n\n${t(lang, "settings.selectNewCurrency")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            { text: t(lang, "settings.currencyOptions.usd") },
            { text: t(lang, "settings.currencyOptions.eur") },
          ],
          [
            { text: t(lang, "settings.currencyOptions.gel") },
            { text: t(lang, "settings.currencyOptions.rub") },
          ],
          [
            { text: t(lang, "settings.currencyOptions.uah") },
            { text: t(lang, "settings.currencyOptions.pln") },
          ],
          [
            { text: t(lang, "common.back") },
            { text: t(lang, "mainMenu.mainMenuButton") },
          ],
        ],
        resize_keyboard: true,
      },
    }
  )
}

/**
 * Handle Currency Change Confirmation
 */
export const handleCurrencyChangeConfirm: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db, text } = context

  if (!text.match(/^(USD|EUR|GEL|RUB|UAH|PLN) /)) {
    return false // Not a currency selection
  }

  const currency = text.split(" ")[0] as Currency
  const oldCurrency = await db.getDefaultCurrency(userId)

  if (oldCurrency !== currency) {
    const balancesCount = (await db.getBalancesList(userId)).length

    await wizardManager.goToStep(userId, "SETTINGS_CURRENCY_CONFIRM", {
      newCurrency: currency,
      balancesCount,
    })

    await bot.sendMessage(
      chatId,
      balancesCount > 0
        ? t(lang, "settings.currencyChangeConfirmWithBalances", {
            oldCurrency,
            newCurrency: currency,
            balancesCount,
          })
        : t(lang, "settings.currencyChangeConfirmNoBalances", {
            oldCurrency,
            newCurrency: currency,
          }),
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "settings.yesChange") }],
            [{ text: t(lang, "common.cancel") }],
          ],
          resize_keyboard: true,
        },
      }
    )
  } else {
    await bot.sendMessage(
      chatId,
      t(lang, "settings.currencyAlreadyCurrent", { currency }),
      {
        reply_markup: getSettingsKeyboard(lang),
      }
    )
  }

  return true
}

/**
 * Handle Currency Change Execution
 */
export const handleCurrencyChangeExecute: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context

  const state = wizardManager.getState(userId)
  if (state?.step !== "SETTINGS_CURRENCY_CONFIRM" || !state.data) {
    return false
  }

  const { newCurrency, balancesCount } = state.data

  await db.setDefaultCurrency(userId, newCurrency)

  if (balancesCount > 0) {
    await db.convertAllBalancesToCurrency(userId, newCurrency)
    await bot.sendMessage(
      chatId,
      `${t(lang, "settings.currencySet", { currency: newCurrency })}\n${t(
        lang,
        "settings.balancesConverted",
        { count: balancesCount, currency: newCurrency }
      )}`,
      {
        reply_markup: getSettingsKeyboard(lang),
      }
    )
  } else {
    await bot.sendMessage(
      chatId,
      t(lang, "settings.currencySet", { currency: newCurrency }),
      {
        reply_markup: getSettingsKeyboard(lang),
      }
    )
  }

  wizardManager.clearState(userId)

  return true
}
