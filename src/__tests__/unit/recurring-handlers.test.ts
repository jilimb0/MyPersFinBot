import { TransactionType } from "../../types"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    getTopCategories: jest.fn(),
  },
}))

jest.mock("../../services/recurring-manager", () => ({
  recurringManager: {
    getUserRecurring: jest.fn(),
    toggleRecurring: jest.fn(),
    deleteRecurring: jest.fn(),
    createRecurring: jest.fn(),
  },
}))

jest.mock("../../utils", () => ({
  escapeMarkdown: jest.fn((text) => text),
  formatDateDisplay: jest.fn(() => "2026-02-15"),
  formatMoney: jest.fn((amount, currency) => `${amount} ${currency}`),
}))

jest.mock("../../i18n", () => ({
  resolveLanguage: jest.fn((lang) => lang || "en"),
  t: jest.fn((lang, key) => {
    const translations: Record<string, any> = {
      "common.delete": "🗑 Delete",
      "recurring.pauseButton": "⏸ Pause",
      "recurring.resumeButton": "▶️ Resume",
      "common.yesDelete": "✅ Yes, delete",
      "common.cancel": "❌ Cancel",
      "recurring.expense": "💸 Expense",
      "recurring.income": "💰 Income",
      "recurring.paused": "Paused",
      "recurring.resumed": "Resumed",
      "recurring.deleted": "Deleted",
      "recurring.deleteConfirmTitle": "Delete?",
      "recurring.deleteConfirmBody": "Delete?",
      "recurring.createTitle": "Create",
      "recurring.enterDescription": "Enter description",
      "recurring.selectType": "Select type",
      "recurring.enterAmount": "Enter amount",
      "recurring.enterAmountPrompt": "Enter amount",
      "errors.invalidAmount": "Invalid amount",
      "errors.invalidDay": "Invalid day",
      "recurring.noAccountsCreate": "No accounts",
      "common.selectAccount": "Select account",
      "recurring.selectCategory": "Select category",
      "recurring.enterDayPrompt": "Enter day",
      "recurring.dayExamples": "Examples",
      "recurring.createdTitle": "Created",
      "recurring.amountLine": "Amount",
      "recurring.accountLine": "Account",
      "recurring.dayOfMonthLine": "Day",
      "recurring.nextLine": "Next",
      "common.back": "Back",
      "mainMenu.mainMenuButton": "Main Menu",
      "buttons.addRecurring": "Add Recurring",
    }
    return translations[key] || key || lang.key
  }),
}))

import { dbStorage } from "../../database/storage-db"
import {
  handleRecurringAccount,
  handleRecurringAmount,
  handleRecurringCategory,
  handleRecurringCreateStart,
  handleRecurringDay,
  handleRecurringDeleteConfirm,
  handleRecurringDescription,
  handleRecurringItemAction,
  handleRecurringMenu,
  handleRecurringSelect,
  handleRecurringType,
} from "../../handlers/recurring-handlers"
import { recurringManager } from "../../services/recurring-manager"
import * as validators from "../../validators"

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockGetTopCategories = dbStorage.getTopCategories as jest.MockedFunction<
  typeof dbStorage.getTopCategories
>
const mockGetUserRecurring =
  recurringManager.getUserRecurring as jest.MockedFunction<
    typeof recurringManager.getUserRecurring
  >
const mockToggleRecurring =
  recurringManager.toggleRecurring as jest.MockedFunction<
    typeof recurringManager.toggleRecurring
  >
const mockDeleteRecurring =
  recurringManager.deleteRecurring as jest.MockedFunction<
    typeof recurringManager.deleteRecurring
  >
const mockCreateRecurring =
  recurringManager.createRecurring as jest.MockedFunction<
    typeof recurringManager.createRecurring
  >

class MockBot {
  sendMessage = jest.fn()
}

class MockWizard {
  private state: any
  private bot: MockBot
  constructor(state?: any) {
    this.state = state || null
    this.bot = new MockBot()
  }
  getState() {
    return this.state
  }
  setState(_: string, next: any) {
    this.state = next
  }
  clearState() {
    this.state = null
  }
  getBackButton() {
    return { reply_markup: { keyboard: [[{ text: "Back" }]] } }
  }
  async sendMessage(...args: any[]) {
    return this.bot.sendMessage(...args)
  }
  async goToStep(_: string, step: string, data: any) {
    this.state = { ...this.state, step, data: { ...this.state?.data, ...data } }
  }
  getBot() {
    return this.bot as any
  }
}

describe("recurring-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
  })

  describe("handleRecurringMenu", () => {
    test("shows empty state", async () => {
      const wizard = new MockWizard() as any
      mockGetUserRecurring.mockResolvedValue([])
      await handleRecurringMenu(wizard, 1, "u1", "en")
      expect(wizard.getState()?.step).toBe("RECURRING_MENU")
    })

    test("shows recurring transactions list", async () => {
      const wizard = new MockWizard() as any
      mockGetUserRecurring.mockResolvedValue([
        {
          id: "r1",
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: "USD",
          description: "Rent",
          frequency: "MONTHLY",
          isActive: true,
          nextExecutionDate: "2026-02-15",
        },
      ] as any)
      await handleRecurringMenu(wizard, 1, "u1", "en")
      expect(wizard.getState()?.step).toBe("RECURRING_MENU")
    })

    test("handles inactive transactions", async () => {
      const wizard = new MockWizard() as any
      mockGetUserRecurring.mockResolvedValue([
        {
          id: "r1",
          type: TransactionType.INCOME,
          amount: 2000,
          currency: "USD",
          description: "Salary",
          frequency: "MONTHLY",
          isActive: false,
          nextExecutionDate: "2026-03-01",
        },
      ] as any)
      await handleRecurringMenu(wizard, 1, "u1", "en")
      expect(wizard.getState()?.step).toBe("RECURRING_MENU")
    })
  })

  describe("handleRecurringSelect", () => {
    test("returns false if transaction not found", async () => {
      const wizard = new MockWizard({ lang: "en" }) as any
      mockGetUserRecurring.mockResolvedValue([])
      const result = await handleRecurringSelect(wizard, 1, "u1", "💸 Rent")
      expect(result).toBe(false)
    })

    test("shows transaction details", async () => {
      const wizard = new MockWizard({ lang: "en" }) as any
      mockGetUserRecurring.mockResolvedValue([
        {
          id: "r1",
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: "USD",
          description: "Rent",
          accountId: "Cash",
          frequency: "MONTHLY",
          dayOfMonth: 1,
          isActive: true,
          nextExecutionDate: "2026-03-01",
        },
      ] as any)
      await handleRecurringSelect(wizard, 1, "u1", "💸 Rent")
      expect(wizard.getState()?.step).toBe("RECURRING_ITEM_MENU")
    })
  })

  describe("handleRecurringItemAction", () => {
    test("returns false if no recurringId", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const result = await handleRecurringItemAction(wizard, 1, "u1", "Pause")
      expect(result).toBe(false)
    })

    test("pauses recurring transaction", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { recurringId: "r1", recurring: { description: "Rent" } },
      }) as any
      await handleRecurringItemAction(wizard, 1, "u1", "⏸ Pause")
      expect(mockToggleRecurring).toHaveBeenCalledWith("r1", false)
    })

    test("resumes recurring transaction", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { recurringId: "r1", recurring: { description: "Rent" } },
      }) as any
      await handleRecurringItemAction(wizard, 1, "u1", "▶️ Resume")
      expect(mockToggleRecurring).toHaveBeenCalledWith("r1", true)
    })

    test("shows delete confirmation", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          recurringId: "r1",
          recurring: { description: "Rent", amount: 100, currency: "USD" },
        },
      }) as any
      await handleRecurringItemAction(wizard, 1, "u1", "🗑 Delete")
      expect(wizard.getState()?.step).toBe("RECURRING_DELETE_CONFIRM")
    })

    test("returns false for unknown action", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { recurringId: "r1", recurring: {} },
      }) as any
      const result = await handleRecurringItemAction(wizard, 1, "u1", "Unknown")
      expect(result).toBe(false)
    })
  })

  describe("handleRecurringDeleteConfirm", () => {
    test("returns false if no recurringId", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const result = await handleRecurringDeleteConfirm(
        wizard,
        1,
        "u1",
        "Yes, delete"
      )
      expect(result).toBe(false)
    })

    test("deletes transaction on confirmation", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { recurringId: "r1" },
      }) as any
      await handleRecurringDeleteConfirm(wizard, 1, "u1", "✅ Yes, delete")
      expect(mockDeleteRecurring).toHaveBeenCalledWith("r1")
    })

    test("cancels deletion", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { recurringId: "r1" },
      }) as any
      await handleRecurringDeleteConfirm(wizard, 1, "u1", "❌ Cancel")
      expect(mockDeleteRecurring).not.toHaveBeenCalled()
    })

    test("returns false for unknown response", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { recurringId: "r1" },
      }) as any
      const result = await handleRecurringDeleteConfirm(
        wizard,
        1,
        "u1",
        "Maybe"
      )
      expect(result).toBe(false)
    })
  })

  describe("handleRecurringCreateStart", () => {
    test("starts creation flow", async () => {
      const wizard = new MockWizard({ lang: "en" }) as any
      await handleRecurringCreateStart(wizard, 1, "u1")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_DESCRIPTION")
    })
  })

  describe("handleRecurringDescription", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleRecurringDescription(wizard, 1, "u1", "Rent")
      expect(result).toBe(false)
    })

    test("saves description and asks for type", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      await handleRecurringDescription(wizard, 1, "u1", "Rent")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_TYPE")
      expect(wizard.getState()?.data?.description).toBe("Rent")
    })
  })

  describe("handleRecurringType", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleRecurringType(wizard, 1, "u1", "Expense")
      expect(result).toBe(false)
    })

    test("handles expense type", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      await handleRecurringType(wizard, 1, "u1", "💸 Expense")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_AMOUNT")
      expect(wizard.getState()?.data?.type).toBe(TransactionType.EXPENSE)
    })

    test("handles income type", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      await handleRecurringType(wizard, 1, "u1", "💰 Income")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_AMOUNT")
      expect(wizard.getState()?.data?.type).toBe(TransactionType.INCOME)
    })

    test("returns false for invalid type", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const result = await handleRecurringType(wizard, 1, "u1", "Invalid")
      expect(result).toBe(false)
    })
  })

  describe("handleRecurringAmount", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleRecurringAmount(wizard, 1, "u1", "100")
      expect(result).toBe(false)
    })

    test("shows error for invalid amount", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      jest.spyOn(validators, "parseAmountWithCurrency").mockReturnValue(null)
      await handleRecurringAmount(wizard, 1, "u1", "abc")
      expect(wizard.getState()?.step).toBe(undefined)
    })

    test("shows error for zero or negative amount", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: -10, currency: "USD" })
      await handleRecurringAmount(wizard, 1, "u1", "-10")
      expect(wizard.getState()?.step).toBe(undefined)
    })

    test("shows error if no accounts", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetBalancesList.mockResolvedValue([])
      await handleRecurringAmount(wizard, 1, "u1", "100")
      expect(wizard.getState()).toBe(null)
    })

    test("proceeds to account selection", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 500, currency: "USD" },
      ] as any)
      await handleRecurringAmount(wizard, 1, "u1", "100")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_ACCOUNT")
    })
  })

  describe("handleRecurringAccount", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleRecurringAccount(wizard, 1, "u1", "💳 Cash")
      expect(result).toBe(false)
    })

    test("returns false if account not found", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: TransactionType.EXPENSE },
      }) as any
      mockGetBalancesList.mockResolvedValue([])
      const result = await handleRecurringAccount(wizard, 1, "u1", "💳 Cash")
      expect(result).toBe(false)
    })

    test("proceeds to category selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: TransactionType.EXPENSE },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 500, currency: "USD" },
      ] as any)
      mockGetTopCategories.mockResolvedValue(["Food", "Transport"])
      await handleRecurringAccount(wizard, 1, "u1", "💳 Cash")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_CATEGORY")
      expect(wizard.getState()?.data?.accountId).toBe("Cash")
    })
  })

  describe("handleRecurringCategory", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleRecurringCategory(wizard, 1, "u1", "Food")
      expect(result).toBe(false)
    })

    test("returns false for invalid category", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: TransactionType.EXPENSE },
      }) as any
      mockGetTopCategories.mockResolvedValue(["Food", "Transport"])
      const result = await handleRecurringCategory(wizard, 1, "u1", "Invalid")
      expect(result).toBe(false)
    })

    test("proceeds to day selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: TransactionType.EXPENSE },
      }) as any
      mockGetTopCategories.mockResolvedValue(["Food", "Transport"])
      await handleRecurringCategory(wizard, 1, "u1", "Food")
      expect(wizard.getState()?.step).toBe("RECURRING_CREATE_DAY")
      expect(wizard.getState()?.data?.category).toBe("Food")
    })
  })

  describe("handleRecurringDay", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleRecurringDay(wizard, 1, "u1", "15")
      expect(result).toBe(false)
    })

    test("shows error for invalid day format", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      await handleRecurringDay(wizard, 1, "u1", "abc")
      expect(wizard.getState()?.step).toBe(undefined)
    })

    test("shows error for day out of range", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      await handleRecurringDay(wizard, 1, "u1", "35")
      expect(wizard.getState()?.step).toBe(undefined)
    })

    test("creates recurring transaction successfully", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          type: TransactionType.EXPENSE,
          amount: 100,
          currency: "USD",
          category: "Food",
          accountId: "Cash",
          description: "Groceries",
        },
      }) as any
      await handleRecurringDay(wizard, 1, "u1", "15")
      expect(mockCreateRecurring).toHaveBeenCalled()
    })
  })
})
