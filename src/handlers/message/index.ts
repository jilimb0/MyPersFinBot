/**
 * Message handlers registry
 */

import type TelegramBot from "@telegram-api"
import { type Language, t } from "../../i18n"
import type { WizardManager } from "../../wizards/wizards"
import { handleLanguageSelection } from "../language-handler"
import { handleAnalyticsMenu } from "./analytics.handlers"
import { handleAddBalance, handleBalancesMenu } from "./balances.handlers"
import { handleBudgetMenu } from "./budget.handlers"
import {
  handleAddDebt,
  handleDebtSelection,
  handleDebtsMenu,
} from "./debts.handlers"
import { handleExpenseStart } from "./expense.handlers"
import {
  handleAddGoal,
  handleGoalSelection,
  handleGoalsMenu,
} from "./goals.handlers"
import { handleIncomeStart } from "./income.handlers"
import {
  handleBack,
  handleCancel,
  handleMainMenu,
  handleNoCancel,
} from "./navigation.handlers"
import { handleNLPInput, isNLPInput } from "./nlp.handlers"
import { MessageRouter } from "./router"
import { handleSettingsMenu } from "./settings.handlers"
import {
  handleAdvancedMenu,
  handleAutomationMenu,
  handleChangeCurrency,
  handleClearDataConfirm,
  handleClearDataExecute,
  handleCurrencyChangeConfirm,
  handleCurrencyChangeExecute,
  handleCustomMessagesMenu,
  handleHelp,
  handleIncomeSourcesMenu,
  handleLanguageSettings,
  handleNotificationsMenu,
  handleRecurringMenu,
  handleUploadStatement,
} from "./settings-submenu.handlers"
import { handleStart, handleStartTracking } from "./start.handlers"
import type { MessageHandler } from "./types"

/**
 * Create and configure MessageRouter
 */
export function createMessageRouter(
  bot: TelegramBot,
  wizardManager: WizardManager
): MessageRouter {
  const router = new MessageRouter(bot, wizardManager)

  // Register all routes
  registerAllRoutes(router)

  return router
}

/**
 * Register all message routes
 */
function registerAllRoutes(router: MessageRouter): void {
  const allLanguages: Language[] = ["en", "ru", "uk", "es", "pl"]
  const startTrackingLabels = new Set(
    allLanguages.flatMap((lng) => [
      t(lng, "mainMenu.startTracking"),
      t(lng, "buttons.startTracking"),
    ])
  )
  const addDebtLabels = new Set(
    allLanguages.flatMap((lng) => [
      t(lng, "debts.addDebt"),
      t(lng, "buttons.addDebt"),
    ])
  )
  const addGoalLabels = new Set(
    allLanguages.flatMap((lng) => [
      t(lng, "goals.addGoal"),
      t(lng, "buttons.addGoal"),
    ])
  )
  const normalizeText = (input: string) =>
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()

  const fallbackMap = new Map<string, MessageHandler>()
  const addFallback = (key: string, handler: MessageHandler) => {
    for (const lng of allLanguages) {
      const label = t(lng, key)
      const normalized = normalizeText(label)
      if (normalized) {
        fallbackMap.set(normalized, handler)
      }
    }
  }

  addFallback("mainMenu.expense", handleExpenseStart)
  addFallback("mainMenu.income", handleIncomeStart)
  addFallback("mainMenu.balances", handleBalancesMenu)
  addFallback("mainMenu.budgetPlanner", handleBudgetMenu)
  addFallback("mainMenu.debts", handleDebtsMenu)
  addFallback("mainMenu.goals", handleGoalsMenu)
  addFallback("mainMenu.analytics", handleAnalyticsMenu)
  addFallback("mainMenu.settings", handleSettingsMenu)
  // ============================================
  // PRIORITY HANDLERS (Execute First)
  // ============================================

  // NLP input handler (highest priority)
  router.register(
    (text) => isNLPInput(text),
    async (context) => {
      if (context.wizardManager.isInWizard(context.userId)) {
        return false
      }
      await handleNLPInput(
        context.bot,
        context.chatId,
        context.userId,
        context.text,
        context.wizardManager
      )
      return true
    },
    "NLP input"
  )

  // Language selection handler
  router.register(
    () => true, // Handle inside, return false to continue routing
    async (context) => {
      const { bot, chatId, userId, text } = context
      const handled = await handleLanguageSelection(bot, chatId, userId, text)
      if (handled) {
        context.wizardManager.clearState(userId)
      }
      return handled
    },
    "Language selection"
  )

  // ============================================
  // MAIN MENU HANDLERS
  // ============================================

  // Start command
  router.register(/^\/start(?:@\w+)?$/i, handleStart, "Start command")

  // Slash commands without args (open flows)
  router.register(
    /^\/expense(?:@\w+)?$/i,
    handleExpenseStart,
    "Command: Expense"
  )
  router.register(/^\/income(?:@\w+)?$/i, handleIncomeStart, "Command: Income")

  // Start tracking button
  router.register(
    (text, lang) =>
      text === t(lang, "mainMenu.startTracking") ||
      startTrackingLabels.has(text),
    handleStartTracking,
    "Start tracking"
  )

  // Expense
  router.register(
    (text, lang) =>
      text === t(lang, "mainMenu.expense") ||
      text === t(lang, "transactions.addAnotherExpense"),
    handleExpenseStart,
    "Expense menu"
  )

  // Income
  router.register(
    (text, lang) =>
      text === t(lang, "mainMenu.income") ||
      text === t(lang, "transactions.addAnotherIncome"),
    handleIncomeStart,
    "Income menu"
  )

  // Balances
  router.register(
    (text, lang) =>
      text === t(lang, "mainMenu.balances") ||
      text === t(lang, "transactions.goToBalances"),
    handleBalancesMenu,
    "Balances menu"
  )

  // Budget Planner
  router.register(
    (text, lang) => text === t(lang, "mainMenu.budgetPlanner"),
    handleBudgetMenu,
    "Budget planner menu"
  )

  // Debts
  router.register(
    (text, lang) => text === t(lang, "mainMenu.debts"),
    handleDebtsMenu,
    "Debts menu"
  )

  // Goals
  router.register(
    (text, lang) => text === t(lang, "mainMenu.goals"),
    handleGoalsMenu,
    "Goals menu"
  )

  // Analytics
  router.register(
    (text, lang) => text === t(lang, "mainMenu.analytics"),
    handleAnalyticsMenu,
    "Analytics menu"
  )

  // Settings
  router.register(
    (text, lang) => text === t(lang, "mainMenu.settings"),
    handleSettingsMenu,
    "Settings menu"
  )

  // ============================================
  // SETTINGS SUB-MENU HANDLERS
  // ============================================

  // Language settings
  router.register(
    (text, lang) => text === t(lang, "settings.language"),
    handleLanguageSettings,
    "Settings: Language"
  )

  // Automation menu
  router.register(
    (text, lang) => text === t(lang, "settings.automation"),
    handleAutomationMenu,
    "Settings: Automation"
  )

  // Advanced menu
  router.register(
    (text, lang) => text === t(lang, "settings.advanced"),
    handleAdvancedMenu,
    "Settings: Advanced"
  )

  // Help
  router.register(
    (text, lang) => text === t(lang, "settings.help"),
    handleHelp,
    "Settings: Help"
  )

  // Income sources
  router.register(
    (text, lang) => text === t(lang, "settings.incomeSources"),
    handleIncomeSourcesMenu,
    "Settings: Income Sources"
  )

  // Clear data (confirmation)
  router.register(
    (text, lang) => text === t(lang, "settings.clearData"),
    handleClearDataConfirm,
    "Settings: Clear Data Confirm"
  )

  // Clear data (execute)
  router.register(
    (text, lang) => text === t(lang, "settings.yesDeleteEverything"),
    handleClearDataExecute,
    "Settings: Clear Data Execute"
  )

  // Notifications
  router.register(
    (text, lang) => text === t(lang, "settings.notifications"),
    handleNotificationsMenu,
    "Settings: Notifications"
  )

  // Recurring payments
  router.register(
    (text, lang) => text === t(lang, "automation.recurringPayments"),
    handleRecurringMenu,
    "Automation: Recurring Payments"
  )

  // Custom messages
  router.register(
    (text, lang) => text === t(lang, "advanced.customMessages"),
    handleCustomMessagesMenu,
    "Advanced: Custom Messages"
  )

  // Upload statement
  router.register(
    (text, lang) => text === t(lang, "advanced.uploadStatement"),
    handleUploadStatement,
    "Advanced: Upload Statement"
  )

  // Change currency
  router.register(
    (text, lang) => text === t(lang, "settings.changeCurrency"),
    handleChangeCurrency,
    "Settings: Change Currency"
  )

  // Currency change confirmation (pattern: "USD 🇺🇸")
  router.register(
    (text) => /^(USD|EUR|GEL|RUB|UAH|PLN) /.test(text),
    handleCurrencyChangeConfirm,
    "Settings: Currency Select"
  )

  // Currency change execution
  router.register(
    (text, lang) => text === t(lang, "settings.yesChange"),
    handleCurrencyChangeExecute,
    "Settings: Currency Change Execute"
  )

  // ============================================
  // BALANCES SUB-MENU
  // ============================================

  // Add Balance
  router.register(
    (text, lang) => text === t(lang, "balances.addBalance"),
    handleAddBalance,
    "Balances: Add"
  )

  // ============================================
  // DEBTS/GOALS SUB-MENU
  // ============================================

  // Add Debt
  router.register(
    (text, lang) =>
      addDebtLabels.has(text) ||
      text === t(lang, "debts.addDebt") ||
      text === t(lang, "buttons.addDebt"),
    handleAddDebt,
    "Debts: Add"
  )

  // Add Goal
  router.register(
    (text, lang) =>
      addGoalLabels.has(text) ||
      text === t(lang, "goals.addGoal") ||
      text === t(lang, "buttons.addGoal"),
    handleAddGoal,
    "Goals: Add"
  )

  // ============================================
  // DEBTS/GOALS SELECTION (Must be after menu handlers)
  // ============================================

  // Debt selection (dynamic - matches debt names)
  router.register(
    () => false, // Checked inside handler
    handleDebtSelection,
    "Debt selection"
  )

  // Goal selection (dynamic - matches goal names)
  router.register(
    () => false, // Checked inside handler
    handleGoalSelection,
    "Goal selection"
  )

  // ============================================
  // NAVIGATION HANDLERS (Lower Priority)
  // ============================================

  // Back button
  router.register(
    (text, lang) => text === t(lang, "common.back"),
    handleBack,
    "Navigation: Back"
  )

  // Main Menu button
  router.register(
    (text, lang) => text === t(lang, "mainMenu.mainMenuButton"),
    handleMainMenu,
    "Navigation: Main Menu"
  )

  // Cancel button
  router.register(
    (text, lang) => text === t(lang, "common.cancel"),
    handleCancel,
    "Navigation: Cancel"
  )

  // "No, Cancel" button
  router.register(
    (text, lang) => text === t(lang, "common.noCancel"),
    handleNoCancel,
    "Navigation: No Cancel"
  )

  // ============================================
  // TEXT FALLBACK (Last Resort)
  // ============================================
  router.register(
    () => true,
    async (context) => {
      const { bot, chatId, userId, lang, text, wizardManager } = context
      if (wizardManager.isInWizard(userId)) {
        return false
      }

      const normalized = normalizeText(text)
      const handler = fallbackMap.get(normalized)
      if (handler) {
        return await handler(context)
      }

      await bot.sendMessage(chatId, t(lang, "common.unknownCommand"), {
        reply_markup: {
          keyboard: [[{ text: t(lang, "mainMenu.mainMenuButton") }]],
          resize_keyboard: true,
        },
      })
      return true
    },
    "Fallback: Text"
  )
}

export { MessageRouter } from "./router"
export type { MessageContext, MessageHandler } from "./types"
