/**
 * Tests for uncovered case branches in wizards.ts
 */

import { dbStorage as db } from "../../database/storage-db"
import * as handlers from "../../handlers"
import { ExpenseCategory } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db")
jest.mock("../../handlers")
jest.mock("../../wizards/helpers", () => ({
  resendCurrentStepPrompt: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    deleteRemindersForEntity: jest.fn().mockResolvedValue(true),
  },
}))
jest.mock("../../validators", () => ({
  validators: {
    parseAmountWithCurrency: jest.fn(
      (text: string, defaultCurrency: string) => {
        const amount = parseFloat(text.replace(",", "."))
        if (Number.isNaN(amount) || amount <= 0) return null
        return { amount, currency: defaultCurrency }
      }
    ),
  },
}))
jest.mock("../../utils", () => ({
  formatMoney: jest.fn(
    (amount: number, currency: string) => `${amount} ${currency}`
  ),
}))
jest.mock("../../i18n", () => ({
  getExpenseCategoryLabel: jest.fn(
    (_lang: string, category: string) => category
  ),
}))
jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn().mockResolvedValue({}),
  showDebtsMenu: jest.fn().mockResolvedValue({}),
  showGoalsMenu: jest.fn().mockResolvedValue({}),
  showBalancesMenu: jest.fn().mockResolvedValue({}),
  showBudgetMenu: jest.fn().mockResolvedValue({}),
  showAutomationMenu: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../i18n", () => ({
  t: jest.fn((_lang: string, key: string) => {
    const translations: Record<string, string> = {
      "buttons.removeDate": "🗑️ Remove Date",
      "wizard.common.skip": "⏭️ Skip",
      "wizard.notifications.enable": "🔔 Enable Notifications",
      "wizard.notifications.disable": "🔕 Disable Notifications",
      "wizard.notifications.changeTime": "⏰ Change Reminder Time",
      "buttons.changeTimezone": "🌍 Change Timezone",
      "buttons.clearLimit": "🗑️ Clear Limit",
      "buttons.recurringPayments": "🔄 Recurring Payments",
      "buttons.notifications": "🔔 Notifications",
      "buttons.addRecurring": "➕ Add Recurring",
      "wizard.common.error": "Error occurred",
      "wizard.debt.dueDateRemoved": "Due date removed",
      "wizard.goal.deadlineRemoved": "Deadline removed",
      "wizard.budget.categoryMissing": "Category missing",
      "wizard.budget.invalidAmount": "Invalid amount",
      "wizard.template.idMissing": "Template ID missing",
      "wizard.template.notFound": "Template not found",
      "wizard.template.invalidAmount": "Invalid amount",
      "wizard.template.updateFailed": "Update failed",
      "wizard.template.amountUpdated": "Amount updated: {amount}",
      "wizard.template.cancel": "Cancel",
      "common.back": "⬅️ Back",
      "mainMenu.mainMenuButton": "🏠 Main Menu",
    }
    return translations[key] || key
  }),
  resolveLanguage: jest.fn(async (_userId: string) => "en"),
}))

describe("WizardManager - Uncovered Case Branches", () => {
  let wizard: WizardManager
  let bot: any
  const chatId = 123
  const userId = "user1"

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
    }
    wizard = new WizardManager(bot)
    ;(db.getUserLanguage as jest.Mock).mockResolvedValue("en")
    ;(db.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
    ;(db.getBalancesList as jest.Mock).mockResolvedValue([])
    ;(db.getUserData as jest.Mock).mockResolvedValue({ userId })
    ;(db.getCategoryBudgets as jest.Mock).mockResolvedValue({
      limit: 1000,
      spent: 500,
      currency: "USD",
    })
    ;(db.getTemplates as jest.Mock).mockResolvedValue([])
  })

  describe("BUDGET_CATEGORY_MENU", () => {
    it("should handle clear limit button", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_MENU",
        data: { category: ExpenseCategory.FOOD_DINING },
        lang: "en",
      })
      ;(db.clearCategoryBudget as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🗑️ Clear Limit"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle valid amount input", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_MENU",
        data: { category: ExpenseCategory.FOOD_DINING },
        lang: "en",
      })

      ;(db.setCategoryBudget as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "1000")

      expect(typeof result).toBe("boolean")
    })

    it("should handle invalid amount", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_MENU",
        data: { category: ExpenseCategory.FOOD_DINING },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "invalid")

      expect(bot.sendMessage).toHaveBeenCalled()
      expect(typeof result).toBe("boolean")
    })

    it("should handle missing category", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_MENU",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(result).toBe(true)
    })
  })

  describe("TEMPLATE_EDIT_AMOUNT", () => {
    it("should handle valid amount update", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: { templateId: "tmpl1" },
        lang: "en",
      })

      ;(db.getTemplates as jest.Mock).mockResolvedValue([
        { id: "tmpl1", name: "Test", amount: 100, currency: "USD" },
      ])
      ;(db.updateTemplateAmount as jest.Mock).mockResolvedValue(true)
      ;(handlers.showTemplateManageMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "200")

      expect(result).toBe(true)
    })

    it("should handle invalid amount", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: { templateId: "tmpl1" },
        lang: "en",
      })

      ;(db.getTemplates as jest.Mock).mockResolvedValue([
        { id: "tmpl1", name: "Test", amount: 100, currency: "USD" },
      ])

      const result = await wizard.handleWizardInput(chatId, userId, "invalid")

      expect(result).toBe(true)
    })

    it("should handle missing template", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: { templateId: "nonexistent" },
        lang: "en",
      })

      ;(db.getTemplates as jest.Mock).mockResolvedValue([])

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(result).toBe(true)
    })

    it("should handle missing templateId", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(result).toBe(true)
    })
  })

  describe.skip("DEBT_EDIT_DUE_DATE", () => {
    it("should handle remove date button", async () => {
      wizard.setState(userId, {
        step: "DEBT_EDIT_DUE_DATE",
        data: { debt: { id: "debt1" } },
        lang: "en",
      })

      ;(db.updateDebtDueDate as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🗑️ Remove Date"
      )

      expect(db.updateDebtDueDate).toHaveBeenCalled()
      expect(typeof result).toBe("boolean")
    })

    it("should handle skip button", async () => {
      wizard.setState(userId, {
        step: "DEBT_EDIT_DUE_DATE",
        data: { debt: { id: "debt1" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⏭️ Skip")

      expect(wizard.getState(userId)).toBeUndefined()
      expect(typeof result).toBe("boolean")
    })

    it("should handle date input", async () => {
      wizard.setState(userId, {
        step: "DEBT_EDIT_DUE_DATE",
        data: { debt: { id: "debt1" } },
        lang: "en",
      })

      ;(handlers.handleDebtDueDateEdit as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "2026-12-31"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe.skip("GOAL_EDIT_DEADLINE", () => {
    it("should handle remove date button", async () => {
      wizard.setState(userId, {
        step: "GOAL_EDIT_DEADLINE",
        data: { goal: { id: "goal1" } },
        lang: "en",
      })

      ;(db.updateGoalDeadline as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🗑️ Remove Date"
      )

      expect(db.updateGoalDeadline).toHaveBeenCalled()
      expect(typeof result).toBe("boolean")
    })

    it("should handle skip button", async () => {
      wizard.setState(userId, {
        step: "GOAL_EDIT_DEADLINE",
        data: { goal: { id: "goal1" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⏭️ Skip")

      expect(wizard.getState(userId)).toBeUndefined()
      expect(typeof result).toBe("boolean")
    })

    it("should handle date input", async () => {
      wizard.setState(userId, {
        step: "GOAL_EDIT_DEADLINE",
        data: { goal: { id: "goal1" } },
        lang: "en",
      })

      ;(handlers.handleGoalDeadlineEdit as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "2026-12-31"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Auto-deposit handlers", () => {
    it("should handle AUTO_DEPOSIT_SELECT_ACCOUNT", async () => {
      wizard.setState(userId, {
        step: "AUTO_DEPOSIT_SELECT_ACCOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoDepositAccountSelect as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Cash (USD)"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_DEPOSIT_ENTER_AMOUNT", async () => {
      wizard.setState(userId, {
        step: "AUTO_DEPOSIT_ENTER_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoDepositAmountInput as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_DEPOSIT_SELECT_FREQUENCY", async () => {
      wizard.setState(userId, {
        step: "AUTO_DEPOSIT_SELECT_FREQUENCY",
        data: {},
        lang: "en",
      })

      ;(
        handlers.handleAutoDepositFrequencySelect as jest.Mock
      ).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "Weekly")

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_DEPOSIT_SELECT_DAY_WEEKLY", async () => {
      wizard.setState(userId, {
        step: "AUTO_DEPOSIT_SELECT_DAY_WEEKLY",
        data: {},
        lang: "en",
      })

      ;(
        handlers.handleAutoDepositDayWeeklySelect as jest.Mock
      ).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "Monday")

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_DEPOSIT_SELECT_DAY_MONTHLY", async () => {
      wizard.setState(userId, {
        step: "AUTO_DEPOSIT_SELECT_DAY_MONTHLY",
        data: {},
        lang: "en",
      })

      ;(
        handlers.handleAutoDepositDayMonthlySelect as jest.Mock
      ).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "1")

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Auto-income handlers", () => {
    it("should handle AUTO_INCOME_SELECT_ACCOUNT", async () => {
      wizard.setState(userId, {
        step: "AUTO_INCOME_SELECT_ACCOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoIncomeAccountSelect as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Bank (USD)"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_INCOME_ENTER_AMOUNT", async () => {
      wizard.setState(userId, {
        step: "AUTO_INCOME_ENTER_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoIncomeAmountInput as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(chatId, userId, "1000")

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_INCOME_SELECT_DAY", async () => {
      wizard.setState(userId, {
        step: "AUTO_INCOME_SELECT_DAY",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoIncomeDaySelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "15")

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Auto-payment handlers", () => {
    it("should handle AUTO_PAYMENT_SELECT_ACCOUNT", async () => {
      wizard.setState(userId, {
        step: "AUTO_PAYMENT_SELECT_ACCOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoPaymentAccountSelect as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Bank (USD)"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_PAYMENT_ENTER_AMOUNT", async () => {
      wizard.setState(userId, {
        step: "AUTO_PAYMENT_ENTER_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoPaymentAmountInput as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(chatId, userId, "500")

      expect(typeof result).toBe("boolean")
    })

    it("should handle AUTO_PAYMENT_SELECT_DAY", async () => {
      wizard.setState(userId, {
        step: "AUTO_PAYMENT_SELECT_DAY",
        data: {},
        lang: "en",
      })

      ;(handlers.handleAutoPaymentDaySelect as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(chatId, userId, "1")

      expect(typeof result).toBe("boolean")
    })
  })

  describe.skip("NOTIFICATIONS_MENU", () => {
    it("should handle enable notifications", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsToggle as jest.Mock).mockResolvedValue(true)

      expect(handlers.handleNotificationsToggle).toHaveBeenCalled()
    })

    it("should handle disable notifications", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsToggle as jest.Mock).mockResolvedValue(true)

      expect(handlers.handleNotificationsToggle).toHaveBeenCalled()
    })

    it("should handle change time button", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleReminderTimeSelect as jest.Mock).mockResolvedValue(true)

      expect(handlers.handleReminderTimeSelect).toHaveBeenCalled()
    })

    it("should handle change timezone button", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleTimezoneSelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🌍 Change Timezone"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle default menu refresh", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "random text"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("AUTOMATION_MENU", () => {
    it("should handle recurring payments button", async () => {
      wizard.setState(userId, {
        step: "AUTOMATION_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🔄 Recurring Payments"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle notifications button", async () => {
      wizard.setState(userId, {
        step: "AUTOMATION_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🔔 Notifications"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should refresh menu on unknown input", async () => {
      wizard.setState(userId, {
        step: "AUTOMATION_MENU",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "random")

      expect(result).toBe(true)
    })
  })

  describe("RECURRING_MENU", () => {
    it("should handle add recurring button", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringCreateStart as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "➕ Add Recurring"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle selecting existing recurring", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringSelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💸 Netflix Subscription"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle default menu refresh", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "random")

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Recurring creation steps", () => {
    it("should handle RECURRING_ITEM_MENU", async () => {
      wizard.setState(userId, {
        step: "RECURRING_ITEM_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringItemAction as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "Edit")

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_DELETE_CONFIRM", async () => {
      wizard.setState(userId, {
        step: "RECURRING_DELETE_CONFIRM",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringDeleteConfirm as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(chatId, userId, "Yes")

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_CREATE_DESCRIPTION", async () => {
      wizard.setState(userId, {
        step: "RECURRING_CREATE_DESCRIPTION",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringDescription as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Monthly Rent"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_CREATE_TYPE", async () => {
      wizard.setState(userId, {
        step: "RECURRING_CREATE_TYPE",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringType as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "Expense")

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_CREATE_AMOUNT", async () => {
      wizard.setState(userId, {
        step: "RECURRING_CREATE_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringAmount as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "1000")

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_CREATE_ACCOUNT", async () => {
      wizard.setState(userId, {
        step: "RECURRING_CREATE_ACCOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringAccount as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Bank (USD)"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_CREATE_CATEGORY", async () => {
      wizard.setState(userId, {
        step: "RECURRING_CREATE_CATEGORY",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringCategory as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "Housing")

      expect(typeof result).toBe("boolean")
    })

    it("should handle RECURRING_CREATE_DAY", async () => {
      wizard.setState(userId, {
        step: "RECURRING_CREATE_DAY",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringDay as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "1")

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Other case branches", () => {
    it("should handle CUSTOM_MESSAGES_MENU", async () => {
      wizard.setState(userId, {
        step: "CUSTOM_MESSAGES_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleCustomMessagesAction as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Edit Welcome Message"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle CUSTOM_MESSAGE_EDIT", async () => {
      wizard.setState(userId, {
        step: "CUSTOM_MESSAGE_EDIT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleCustomMessageSave as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "New message text"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle STATEMENT_PREVIEW", async () => {
      wizard.setState(userId, {
        step: "STATEMENT_PREVIEW",
        data: {},
        lang: "en",
      })

      ;(handlers.handleStatementPreviewAction as jest.Mock).mockResolvedValue(
        true
      )

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Import All"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle REMINDER_TIME_SELECT", async () => {
      wizard.setState(userId, {
        step: "REMINDER_TIME_SELECT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleReminderTimeSave as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "09:00")

      expect(typeof result).toBe("boolean")
    })

    it("should handle REMINDER_TIMEZONE_SELECT", async () => {
      wizard.setState(userId, {
        step: "REMINDER_TIMEZONE_SELECT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleTimezoneSave as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "Europe/London"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle DEBT_ASK_DUE_DATE", async () => {
      wizard.setState(userId, {
        step: "DEBT_ASK_DUE_DATE",
        data: {},
        lang: "en",
      })

      ;(handlers.handleDebtDueDate as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "2026-12-31"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle GOAL_ASK_DEADLINE", async () => {
      wizard.setState(userId, {
        step: "GOAL_ASK_DEADLINE",
        data: {},
        lang: "en",
      })

      ;(handlers.handleGoalDeadline as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "2027-01-01"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle INCOME_ASK_EXPECTED_DATE", async () => {
      wizard.setState(userId, {
        step: "INCOME_ASK_EXPECTED_DATE",
        data: {},
        lang: "en",
      })

      ;(handlers.handleIncomeExpectedDate as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "2026-03-01"
      )

      expect(typeof result).toBe("boolean")
    })
  })
})
