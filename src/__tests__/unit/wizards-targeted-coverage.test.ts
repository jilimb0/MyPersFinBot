/**
 * Targeted tests for specific uncovered lines in wizards.ts
 * Lines: 3206-3212, 3239-3326, 3345-3364, 3374-3383, 3387-3389, 3402-3484
 */

import { dbStorage as db } from "../../database/storage-db"
import * as handlers from "../../handlers"
import { t } from "../../i18n"
import { reminderManager } from "../../services/reminder-manager"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db")
jest.mock("../../handlers")
jest.mock("../../services/reminder-manager")
jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn(),
  showDebtsMenu: jest.fn(),
  showGoalsMenu: jest.fn(),
  showAutomationMenu: jest.fn(),
}))

describe("WizardManager - Targeted Coverage for Uncovered Lines", () => {
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
  })

  describe("DEBT_EDIT_DUE_DATE - Remove and Skip options", () => {
    it("should handle removeDate button", async () => {
      wizard.setState(userId, {
        step: "DEBT_EDIT_DUE_DATE",
        data: { debt: { id: "debt1", dueDate: "2026-12-31" } },
        lang: "en",
      })

      ;(db.updateDebtDueDate as jest.Mock).mockResolvedValue(true)
      ;(
        reminderManager.deleteRemindersForEntity as jest.Mock
      ).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "buttons.removeDate")
      )

      expect(result).toBe(true)
      expect(db.updateDebtDueDate).toHaveBeenCalledWith(userId, "debt1", null)
      expect(reminderManager.deleteRemindersForEntity).toHaveBeenCalledWith(
        userId,
        "debt1"
      )
    })

    it("should handle skip button", async () => {
      wizard.setState(userId, {
        step: "DEBT_EDIT_DUE_DATE",
        data: { debt: { id: "debt1" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "wizard.common.skip")
      )

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should delegate to handler for date input", async () => {
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

      expect(result).toBe(true)
      expect(handlers.handleDebtDueDateEdit).toHaveBeenCalled()
    })
  })

  describe("GOAL_EDIT_DEADLINE - Remove and Skip options", () => {
    it("should handle removeDate button", async () => {
      wizard.setState(userId, {
        step: "GOAL_EDIT_DEADLINE",
        data: { goal: { id: "goal1", deadline: "2026-12-31" } },
        lang: "en",
      })

      ;(db.updateGoalDeadline as jest.Mock).mockResolvedValue(true)
      ;(
        reminderManager.deleteRemindersForEntity as jest.Mock
      ).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "buttons.removeDate")
      )

      expect(result).toBe(true)
      expect(db.updateGoalDeadline).toHaveBeenCalledWith(userId, "goal1", null)
      expect(reminderManager.deleteRemindersForEntity).toHaveBeenCalledWith(
        userId,
        "goal1"
      )
    })

    it("should handle skip button", async () => {
      wizard.setState(userId, {
        step: "GOAL_EDIT_DEADLINE",
        data: { goal: { id: "goal1" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "wizard.common.skip")
      )

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should delegate to handler for date input", async () => {
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

      expect(result).toBe(true)
      expect(handlers.handleGoalDeadlineEdit).toHaveBeenCalled()
    })
  })

  describe("NOTIFICATIONS_MENU - All button options", () => {
    it("should handle enable notifications", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsToggle as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "wizard.notifications.enable")
      )

      expect(result).toBe(true)
      expect(handlers.handleNotificationsToggle).toHaveBeenCalled()
    })

    it("should handle disable notifications", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsToggle as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "wizard.notifications.disable")
      )

      expect(result).toBe(true)
      expect(handlers.handleNotificationsToggle).toHaveBeenCalled()
    })

    it("should handle change time", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleReminderTimeSelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "wizard.notifications.changeTime")
      )

      expect(result).toBe(true)
      expect(handlers.handleReminderTimeSelect).toHaveBeenCalled()
    })

    it("should handle change timezone", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleTimezoneSelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        t("en", "buttons.changeTimezone")
      )

      expect(result).toBe(true)
      expect(handlers.handleTimezoneSelect).toHaveBeenCalled()
    })

    it("should show menu again for other inputs", async () => {
      wizard.setState(userId, {
        step: "NOTIFICATIONS_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleNotificationsMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "some other input"
      )

      expect(result).toBe(true)
      expect(handlers.handleNotificationsMenu).toHaveBeenCalled()
    })
  })

  describe("AUTOMATION_MENU - Button options", () => {
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
        t("en", "buttons.recurringPayments")
      )

      expect(result).toBe(true)
      expect(handlers.handleRecurringMenu).toHaveBeenCalled()
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
        t("en", "buttons.notifications")
      )

      expect(result).toBe(true)
      expect(handlers.handleNotificationsMenu).toHaveBeenCalled()
    })

    it("should show automation menu for other inputs", async () => {
      wizard.setState(userId, {
        step: "AUTOMATION_MENU",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "some input"
      )

      expect(result).toBe(true)
    })
  })

  describe("RECURRING_MENU - Button options", () => {
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
        t("en", "buttons.addRecurring")
      )

      expect(result).toBe(true)
      expect(handlers.handleRecurringCreateStart).toHaveBeenCalled()
    })

    it("should handle selecting expense recurring (💸)", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringSelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💸 Rent Payment"
      )

      expect(result).toBe(true)
      expect(handlers.handleRecurringSelect).toHaveBeenCalled()
    })

    it("should handle selecting income recurring (💰)", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringSelect as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "💰 Salary")

      expect(result).toBe(true)
      expect(handlers.handleRecurringSelect).toHaveBeenCalled()
    })

    it("should show menu for other inputs", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        lang: "en",
      })

      ;(handlers.handleRecurringMenu as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "some input"
      )

      expect(result).toBe(true)
      expect(handlers.handleRecurringMenu).toHaveBeenCalled()
    })
  })

  describe("Error handling in try-catch block", () => {
    it("should catch errors and show error message", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleTxAmount as jest.Mock).mockRejectedValue(
        new Error("Test error")
      )

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(result).toBe(false)
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        t("en", "wizard.common.error")
      )
      expect(wizard.getState(userId)).toBeUndefined()
    })
  })

  describe("Additional handler delegations", () => {
    const handlerTestCases = [
      ["AUTO_DEPOSIT_SELECT_ACCOUNT", "handleAutoDepositAccountSelect"],
      ["AUTO_DEPOSIT_ENTER_AMOUNT", "handleAutoDepositAmountInput"],
      ["AUTO_DEPOSIT_SELECT_FREQUENCY", "handleAutoDepositFrequencySelect"],
      ["AUTO_DEPOSIT_SELECT_DAY_WEEKLY", "handleAutoDepositDayWeeklySelect"],
      ["AUTO_DEPOSIT_SELECT_DAY_MONTHLY", "handleAutoDepositDayMonthlySelect"],
      ["AUTO_INCOME_SELECT_ACCOUNT", "handleAutoIncomeAccountSelect"],
      ["AUTO_INCOME_ENTER_AMOUNT", "handleAutoIncomeAmountInput"],
      ["AUTO_INCOME_SELECT_DAY", "handleAutoIncomeDaySelect"],
      ["AUTO_PAYMENT_SELECT_ACCOUNT", "handleAutoPaymentAccountSelect"],
      ["AUTO_PAYMENT_ENTER_AMOUNT", "handleAutoPaymentAmountInput"],
      ["AUTO_PAYMENT_SELECT_DAY", "handleAutoPaymentDaySelect"],
      ["REMINDER_TIME_SELECT", "handleReminderTimeSave"],
      ["REMINDER_TIMEZONE_SELECT", "handleTimezoneSave"],
      ["RECURRING_ITEM_MENU", "handleRecurringItemAction"],
      ["RECURRING_DELETE_CONFIRM", "handleRecurringDeleteConfirm"],
      ["RECURRING_CREATE_DESCRIPTION", "handleRecurringDescription"],
      ["RECURRING_CREATE_TYPE", "handleRecurringType"],
      ["RECURRING_CREATE_AMOUNT", "handleRecurringAmount"],
      ["RECURRING_CREATE_ACCOUNT", "handleRecurringAccount"],
      ["RECURRING_CREATE_CATEGORY", "handleRecurringCategory"],
      ["RECURRING_CREATE_DAY", "handleRecurringDay"],
      ["CUSTOM_MESSAGES_MENU", "handleCustomMessagesAction"],
      ["CUSTOM_MESSAGE_EDIT", "handleCustomMessageSave"],
      ["STATEMENT_PREVIEW", "handleStatementPreviewAction"],
    ]

    test.each(
      handlerTestCases
    )("should delegate %s to %s", async (step, handlerName) => {
      wizard.setState(userId, {
        step,
        data: {},
        lang: "en",
      })

      const mockHandler = (handlers as any)[handlerName]
      if (mockHandler) {
        mockHandler.mockResolvedValue(true)
      }

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "test input"
      )

      expect(result).toBe(true)
      if (mockHandler) {
        expect(mockHandler).toHaveBeenCalled()
      }
    })
  })
})
