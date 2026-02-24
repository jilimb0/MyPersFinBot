/**
 * Settings sub-menu handlers
 */

import * as handlers from "../../handlers"
import { resolveLanguage, t } from "../../i18n"
import { getSettingsKeyboard } from "../../i18n/keyboards"
import * as menus from "../../menus-i18n"
import { sendPremiumRequiredMessage } from "../../monetization/premium-gate"
import { cancelRecurringTransaction, cancelReminder } from "../../queue"
import { userContext } from "../../services/user-context"
import type { Currency } from "../../types"
import { showLanguageMenu } from "../language-handler"
import { buildSubscriptionView } from "../subscription-view"
import type { MessageHandler } from "./types"

type DbWithUiMode = {
  getUserUiMode?: (userId: string) => Promise<"basic" | "pro">
}

type DbWithPremiumGate = {
  canUsePremiumFeature?: (userId: string) => Promise<boolean>
}

async function getUserUiModeOrDefault(
  db: DbWithUiMode,
  userId: string
): Promise<"basic" | "pro"> {
  if (typeof db.getUserUiMode !== "function") {
    return "basic"
  }
  return await db.getUserUiMode(userId)
}

async function canUsePremiumFeatureOrDefault(
  db: DbWithPremiumGate,
  userId: string
): Promise<boolean> {
  if (typeof db.canUsePremiumFeature !== "function") {
    return true
  }
  return await db.canUsePremiumFeature(userId)
}

/**
 * Handle Language settings
 */
export const handleLanguageSettings: MessageHandler = async (context) => {
  const { bot, chatId, userId } = context
  await showLanguageMenu(bot, chatId, userId)
  return true
}

/**
 * Handle Automation menu
 */
export const handleAutomationMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context
  const uiMode = await getUserUiModeOrDefault(db, userId)
  if (uiMode === "basic") {
    await bot.sendMessage(chatId, t(lang, "settings.switchToProHint"), {
      reply_markup: getSettingsKeyboard(lang, "basic"),
    })
    return true
  }
  await menus.showAutomationMenu(wizardManager, chatId, userId, lang)
  return true
}

/**
 * Handle Advanced menu
 */
export const handleAdvancedMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context
  const uiMode = await getUserUiModeOrDefault(db, userId)
  if (uiMode === "basic") {
    await bot.sendMessage(chatId, t(lang, "settings.switchToProHint"), {
      reply_markup: getSettingsKeyboard(lang, "basic"),
    })
    return true
  }
  await menus.showAdvancedMenu(wizardManager, chatId, userId, lang)
  return true
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
  return true
}

/**
 * Handle Income Sources menu
 */
export const handleIncomeSourcesMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context
  const uiMode = await getUserUiModeOrDefault(db, userId)
  if (uiMode === "basic") {
    await bot.sendMessage(chatId, t(lang, "settings.switchToProHint"), {
      reply_markup: getSettingsKeyboard(lang, "basic"),
    })
    return true
  }

  wizardManager.setState(userId, {
    step: "INCOME_VIEW",
    data: {},
    returnTo: "settings",
    lang,
  })

  await menus.showIncomeSourcesMenu(bot, chatId, userId, lang)
  return true
}

export const handleSubscriptionMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, db } = context
  const status = await db.getSubscriptionStatus(userId)
  const view = buildSubscriptionView(lang, status)

  await bot.sendMessage(chatId, view.text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: view.keyboard,
    },
  })

  return true
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
  return true
}

/**
 * Handle Clear Data execution
 */
export const handleClearDataExecute: MessageHandler = async (context) => {
  const { bot, chatId, userId, wizardManager } = context

  try {
    // Best-effort cleanup of queued reminders/recurring jobs before data deletion
    try {
      const [reminders, recurring] = await Promise.all([
        context.db.getAllReminders(userId),
        context.db.getAllRecurringTransactions(userId),
      ])

      await Promise.all([
        ...reminders.map((reminder) => cancelReminder(reminder.id)),
        ...recurring
          .filter((item) => item.cronExpression)
          .map((item) =>
            cancelRecurringTransaction(item.id, item.cronExpression!)
          ),
      ])
    } catch (cleanupError) {
      // Ignore queue cleanup errors to avoid blocking data purge
      console.warn("Queue cleanup failed", cleanupError)
    }

    await context.db.clearAllUserData(userId)
    userContext.clearContext(userId)
    wizardManager.clearState(userId)
    const resetLang = resolveLanguage("en")
    await bot.sendMessage(
      chatId,
      `${t(resetLang, "mainMenu.welcome")}\n\n${t(resetLang, "mainMenu.welcomeIntro")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [[{ text: t(resetLang, "buttons.startTracking") }]],
          resize_keyboard: true,
        },
      }
    )
  } catch (error) {
    console.error("Error clearing user ", error)
    const uiMode = await getUserUiModeOrDefault(context.db, userId)
    await bot.sendMessage(chatId, t(context.lang, "errors.clearingData"), {
      reply_markup: getSettingsKeyboard(context.lang, uiMode),
    })
  }
  return true
}

export const handleUiModeBasic: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, db } = context
  await db.setUserUiMode(userId, "basic")
  await bot.sendMessage(chatId, t(lang, "settings.uiModeChangedBasic"), {
    parse_mode: "Markdown",
    reply_markup: getSettingsKeyboard(lang, "basic"),
  })
  return true
}

export const handleUiModePro: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, db } = context
  await db.setUserUiMode(userId, "pro")
  await bot.sendMessage(chatId, t(lang, "settings.uiModeChangedPro"), {
    parse_mode: "Markdown",
    reply_markup: getSettingsKeyboard(lang, "pro"),
  })
  return true
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
  return true
}

/**
 * Handle Recurring Payments menu
 */
export const handleRecurringMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context
  const premiumEnabled = await canUsePremiumFeatureOrDefault(db, userId)
  if (!premiumEnabled) {
    await sendPremiumRequiredMessage(
      bot,
      chatId,
      lang,
      t(lang, "commands.monetization.featureRecurring")
    )
    return true
  }
  await handlers.handleRecurringMenu(wizardManager, chatId, userId, lang)
  return true
}

/**
 * Handle Custom Messages menu
 */
export const handleCustomMessagesMenu: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context
  const premiumEnabled = await canUsePremiumFeatureOrDefault(db, userId)
  if (!premiumEnabled) {
    await sendPremiumRequiredMessage(
      bot,
      chatId,
      lang,
      t(lang, "commands.monetization.featureCustomMessages")
    )
    return true
  }
  await handlers.handleCustomMessagesMenu(wizardManager, chatId, userId)
  return true
}

/**
 * Handle Upload Statement
 */
export const handleUploadStatement: MessageHandler = async (context) => {
  const { bot, chatId, userId, lang, wizardManager, db } = context
  const premiumEnabled = await canUsePremiumFeatureOrDefault(db, userId)
  if (!premiumEnabled) {
    await sendPremiumRequiredMessage(
      bot,
      chatId,
      lang,
      t(lang, "commands.monetization.featureStatementImport")
    )
    return true
  }

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
  return true
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
  return true
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
        reply_markup: getSettingsKeyboard(
          lang,
          await getUserUiModeOrDefault(db, userId)
        ),
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
        reply_markup: getSettingsKeyboard(
          lang,
          await getUserUiModeOrDefault(db, userId)
        ),
      }
    )
  } else {
    await bot.sendMessage(
      chatId,
      t(lang, "settings.currencySet", { currency: newCurrency }),
      {
        reply_markup: getSettingsKeyboard(
          lang,
          await getUserUiModeOrDefault(db, userId)
        ),
      }
    )
  }

  wizardManager.clearState(userId)

  return true
}
