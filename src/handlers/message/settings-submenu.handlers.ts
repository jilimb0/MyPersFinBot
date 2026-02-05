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

  await bot.sendMessage(
    chatId,
    "❓ *Personal Finance Bot - User Guide*\n\n" +
      "===================\n\n" +
      "📊 *Core Features*\n\n" +
      "💸 *Expense & Income*\n" +
      "• Track expenses and income\n" +
      "• Quick entry with amount buttons\n" +
      "• Categorize transactions\n" +
      "• Multi-currency support\n" +
      '• Natural language: "50 coffee"\n\n' +
      "💳 *Balances*\n" +
      "• Manage multiple accounts\n" +
      '• Format: "Cash 1000 USD" or just "Cash"\n' +
      "• Edit and transfer between accounts\n" +
      "• Auto currency conversion\n\n" +
      "📉 *Debts*\n" +
      "• Track money you owe or are owed\n" +
      '• Format: "John 500 USD"\n' +
      "• Set due dates and reminders\n" +
      "• Partial payments supported\n\n" +
      "🎯 *Goals*\n" +
      "• Set savings targets\n" +
      '• Format: "Laptop 2000 USD"\n' +
      "• Track progress with visual bars\n" +
      "• Auto-deposit automation\n\n" +
      "📊 *Analytics*\n" +
      "• Monthly/weekly stats\n" +
      "• Trends and top categories\n" +
      "• Custom period reports\n" +
      "• CSV export\n" +
      "• Net worth tracking\n\n" +
      "===================\n\n" +
      "🤖 *Automation Features*\n\n" +
      "🔁 *Recurring Payments*\n" +
      "• Set up auto transactions\n" +
      "• Daily/weekly/monthly schedules\n" +
      "• Auto-categorization\n\n" +
      "🔔 *Notifications*\n" +
      "• Debt/goal reminders\n" +
      "• Custom timezone\n" +
      "• Snooze and mark as done\n\n" +
      "===================\n\n" +
      "👥 *Advanced*\n\n" +
      "📅 *History & Filters*\n" +
      "• Browse all transactions\n" +
      "• Filter by date/category/type\n" +
      "• Edit or delete past entries\n\n" +
      "📊 *Budget Planner*\n" +
      "• Set category limits\n" +
      "• Visual spending progress\n" +
      "• Budget alerts\n\n" +
      "💱 *Multi-Currency*\n" +
      "• USD, EUR, GEL, RUB, UAH, PLN\n" +
      "• Auto conversion\n" +
      "• Live exchange rates\n\n" +
      "📝 *Custom Messages*\n" +
      "• Personalize transaction confirmations\n" +
      "• Motivational messages for goals\n\n" +
      "📥 *Upload Bank Statements*\n" +
      "• Tinkoff, Monobank, Revolut, Wise\n" +
      "• Auto-import transactions\n\n" +
      "===================\n\n" +
      "💡 *Quick Tips*\n\n" +
      "• Use templates to save common transactions\n" +
      "• Set reminders for bills and payments\n" +
      "• Enable auto-deposit for consistent savings\n" +
      "• Check Analytics weekly for insights\n" +
      "• Export CSV for external analysis\n\n" +
      "===================\n\n" +
      "🆘 *Format Examples*\n\n" +
      "*Balances:* Cash 1000 | Wallet 500 USD\n" +
      "*Debts:* John 500 | Maria 200 EUR\n" +
      "*Goals:* Laptop 2000 | Vacation 5000 USD\n" +
      "*Natural:* 50 coffee | spent 100 lunch\n\n" +
      "Version: 0.2 | Multi-currency support\n" +
      "Built with ❤️ for personal finance management",
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

  await bot.sendMessage(
    chatId,
    "⚠️ *WARNING*\n\nThis will permanently delete:\n" +
      "• All transactions\n" +
      "• All balances\n" +
      "• All debts\n" +
      "• All goals\n" +
      "• All income sources\n" +
      "• All settings\n\n" +
      "❗ This action CANNOT be undone!\n\n" +
      "Are you sure you want to continue?",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: t(lang, "settings.yesDeleteEverything") }],
          [{ text: t(lang, "common.noCancel") }],
        ],
        resize_keyboard: true,
      },
    }
  )
}

/**
 * Handle Clear Data execution
 */
export const handleClearDataExecute: MessageHandler = async (context) => {
  const { bot, chatId, userId } = context

  try {
    await context.db.clearAllUserData(userId)
    await bot.sendMessage(
      chatId,
      "👋 *Welcome to Personal Finance Bot!*\n\n" +
        "📊 Track your money with ease:\n" +
        "• 💸 Record expenses and income\n" +
        "• 💰 Manage multiple accounts\n" +
        "• 📉 Track debts\n" +
        "• 🎯 Set financial goals\n" +
        "• 📈 View statistics\n\n" +
        "Ready to take control of your finances?",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [[{ text: "💰 Start tracking" }]],
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
    "📥 *Upload Bank Statement*\n\n" +
      "**Supported formats:**\n" +
      "• Tinkoff - CSV\n" +
      "• Monobank - CSV/JSON\n" +
      "• Revolut - CSV\n" +
      "• Wise - TXT\n\n" +
      "Please upload your statement file:",
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
    `💱 *Currency Settings*\n\nCurrent: ${currentCurr}\n\nSelect your default currency:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "USD 🇺🇸" }, { text: "EUR 🇪🇺" }],
          [{ text: "GEL 🇬🇪" }, { text: "RUB 🇷🇺" }],
          [{ text: "UAH 🇺🇦" }, { text: "PLN 🇵🇱" }],
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
      `⚠️ *Currency Change Confirmation*\n\n` +
        `Change from *${oldCurrency}* to *${currency}*?\n\n` +
        `This will affect:\n` +
        (balancesCount > 0
          ? `• ${balancesCount} balance(s) will be converted to ${currency}\n`
          : "") +
        `• Statistics display\n\n` +
        `Are you sure?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "settings.yesChange") }],
            [{ text: "❌ Cancel" }],
          ],
          resize_keyboard: true,
        },
      }
    )
  } else {
    await bot.sendMessage(
      chatId,
      `ℹ️ ${currency} is already your current currency.`,
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
      `✅ Default currency set to ${newCurrency}\n🔄 ${balancesCount} balance(s) converted to ${newCurrency}`,
      {
        reply_markup: getSettingsKeyboard(lang),
      }
    )
  } else {
    await bot.sendMessage(chatId, `✅ Default currency set to ${newCurrency}`, {
      reply_markup: getSettingsKeyboard(lang),
    })
  }

  wizardManager.clearState(userId)

  return true
}
