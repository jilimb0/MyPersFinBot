import type TelegramBot from "node-telegram-bot-api"
import { dbStorage } from "../../database/storage-db"
import * as templateHandlers from "../../handlers/template-handlers"
import {
  handleTemplateDelete,
  handleTemplateSave,
  handleTemplateUse,
} from "../../handlers/template-handlers"
import { ExpenseCategory, IncomeCategory, TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    addTemplate: jest.fn(),
    getTemplates: jest.fn(),
    getBalancesList: jest.fn(),
    getSmartBalanceSelection: jest.fn(),
    addTransaction: jest.fn(),
    deleteTemplate: jest.fn(),
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    updateTemplateAccount: jest.fn().mockResolvedValue(undefined),
    saveTemplate: jest.fn().mockResolvedValue({ id: "new-template-id" }),
  },
}))

jest.mock("../../utils", () => ({
  safeAnswerCallback: jest.fn().mockResolvedValue(undefined),
  formatMoney: jest.fn().mockImplementation((amt) => `${amt}`),
  escapeMarkdown: jest.fn().mockImplementation((text) => text),
}))

jest.mock("../../cache", () => ({
  initializeCache: jest.fn(),
  getCache: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

import { safeAnswerCallback } from "../../utils"

const mockDbStorage = dbStorage as jest.Mocked<typeof dbStorage>
const mockGetDefaultCurrency = mockDbStorage.getDefaultCurrency
const mockAddTemplate = mockDbStorage.addTemplate
const mockGetTemplates = mockDbStorage.getTemplates
const mockGetBalancesList = mockDbStorage.getBalancesList
const mockAddTransaction = mockDbStorage.addTransaction
const mockDeleteTemplate = mockDbStorage.deleteTemplate

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
  answerCallbackQuery = jest.fn().mockResolvedValue(true)
  editMessageText = jest.fn().mockResolvedValue({})
  editMessageReplyMarkup = jest.fn().mockResolvedValue({})
}

const baseQuery = {
  id: "query123",
  from: { id: 123, is_bot: false, first_name: "Test" },
  message: {
    message_id: 1,
    chat: { id: 123, type: "private" as const },
    date: Date.now(),
    text: "test",
  },
  chat_instance: "123",
} as any

/**
 * Comprehensive test suite for template handler functions.
 * Merged from template-handlers.test.ts and template-handlers-extended.test.ts
 * All duplicate tests have been removed.
 */
describe("Template handlers", () => {
  let mockWizardManager: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetTemplates.mockResolvedValue([])
    mockGetBalancesList.mockResolvedValue([])

    mockWizardManager = {
      setState: jest.fn(),
      getState: jest.fn().mockReturnValue(undefined),
      clearState: jest.fn(),
      goToStep: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({}),
    }
  })

  describe("handleTemplateSave", () => {
    test("persists template", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      const wizard = new WizardManager(bot)
      wizard.setState("1", { step: "NONE", data: {}, lang: "uk" })

      await handleTemplateSave(
        bot,
        { id: "cb-1" } as TelegramBot.CallbackQuery,
        "1",
        `tmpl_save|exp|50|${encodeURIComponent(ExpenseCategory.FOOD_DINING)}|USD|Cash`,
        wizard
      )

      expect(mockAddTemplate).toHaveBeenCalled()
      expect(safeAnswerCallback).toHaveBeenCalled()
    })

    test("saves expense template", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      const query = {
        ...baseQuery,
        data: "tmpl_save|expense|50|FOOD_DINING",
      }

      await templateHandlers.handleTemplateSave(
        bot,
        query,
        "123",
        "tmpl_save|expense|50|FOOD_DINING",
        mockWizardManager
      )

      expect(mockDbStorage.addTemplate).toHaveBeenCalled()
    })

    test("saves income template", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      const query = {
        ...baseQuery,
        data: "tmpl_save|income|1000|SALARY",
      }

      await templateHandlers.handleTemplateSave(
        bot,
        query,
        "123",
        "tmpl_save|income|1000|SALARY",
        mockWizardManager
      )

      expect(mockDbStorage.addTemplate).toHaveBeenCalled()
    })
  })

  describe("handleTemplateUse", () => {
    test("creates transaction and sends confirmation", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      const wizard = new WizardManager(bot)
      wizard.setState("2", { step: "NONE", data: {}, lang: "uk" })

      mockGetTemplates.mockResolvedValue([
        {
          id: "tpl-1",
          name: "☕ Food",
          category: ExpenseCategory.FOOD_DINING,
          amount: 50,
          currency: "USD",
          type: TransactionType.EXPENSE,
          accountId: "Cash",
        },
      ])

      mockGetBalancesList.mockResolvedValue([
        {
          accountId: "Cash",
          amount: 100,
          currency: "USD",
          lastUpdated: "2026-01-01",
        },
      ])

      await handleTemplateUse(
        bot,
        { id: "cb-2" } as TelegramBot.CallbackQuery,
        "2",
        200,
        "tmpl_use|tpl-1",
        wizard
      )

      expect(mockAddTransaction).toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalled()
    })

    test("answers callback query", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([
        {
          id: "tmpl1",
          type: TransactionType.EXPENSE,
          amount: 100,
          category: ExpenseCategory.FOOD_DINING,
          accountId: "acc1",
          name: "acc1",
          currency: "USD",
        },
      ])

      await templateHandlers.handleTemplateUse(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_use|tmpl1",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
    })

    test("handles non-existent template", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([])

      await templateHandlers.handleTemplateUse(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_use|nonexistent",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
    })
  })

  describe("handleTemplateDelete", () => {
    test("removes template and refreshes list", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      const wizard = new WizardManager(bot)
      wizard.setState("3", { step: "NONE", data: {}, lang: "uk" })

      mockDeleteTemplate.mockResolvedValue(true)
      mockGetTemplates.mockResolvedValue([
        {
          id: "tpl-2",
          name: "💰 Salary",
          category: IncomeCategory.SALARY,
          amount: 1000,
          currency: "USD",
          type: TransactionType.INCOME,
        },
      ])

      await handleTemplateDelete(
        bot,
        { id: "cb-3" } as TelegramBot.CallbackQuery,
        "3",
        300,
        "tmpl_del|tpl-2",
        wizard
      )

      expect(mockDeleteTemplate).toHaveBeenCalledWith("3", "tpl-2")
      expect(bot.sendMessage).toHaveBeenCalled()
    })

    test("answers callback and deletes template", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([
        {
          id: "tmpl1",
          type: TransactionType.EXPENSE,
          amount: 50,
          category: ExpenseCategory.FOOD_DINING,
          name: "tmpl1",
          currency: "USD",
        },
        {
          id: "tmpl2",
          type: TransactionType.INCOME,
          amount: 100,
          category: IncomeCategory.SALARY,
          name: "tmpl2",
          currency: "USD",
        },
      ])

      await templateHandlers.handleTemplateDelete(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_del|tmpl1",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
      expect(mockDbStorage.deleteTemplate).toHaveBeenCalledWith("123", "tmpl1")
    })

    test("handles deleting last template", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates
        .mockResolvedValueOnce([
          {
            id: "tmpl1",
            type: TransactionType.EXPENSE,
            amount: 50,
            category: ExpenseCategory.FOOD_DINING,
            name: "tmpl1",
            currency: "USD",
          },
        ])
        .mockResolvedValueOnce([]) // After deletion

      await templateHandlers.handleTemplateDelete(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_del|tmpl1",
        mockWizardManager
      )

      expect(mockDbStorage.deleteTemplate).toHaveBeenCalled()
      expect(safeAnswerCallback).toHaveBeenCalled()
    })
  })

  describe("handleTemplateManage", () => {
    test("shows template list when templates exist", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([
        {
          id: "tmpl1",
          type: TransactionType.EXPENSE,
          amount: 50,
          category: ExpenseCategory.FOOD_DINING,
          name: "tmpl1",
          currency: "USD",
        },
      ])

      await templateHandlers.handleTemplateManage(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_manage",
        mockWizardManager
      )

      expect(mockDbStorage.getTemplates).toHaveBeenCalledWith("123")
      expect(safeAnswerCallback).toHaveBeenCalled()
    })
  })

  describe("handleTemplateEditAmount", () => {
    test("sets wizard to edit amount step", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([
        {
          id: "tmpl1",
          type: TransactionType.EXPENSE,
          amount: 50,
          category: ExpenseCategory.FOOD_DINING,
          name: "tmpl1",
          currency: "USD",
        },
      ])

      await templateHandlers.handleTemplateEditAmount(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_edit_amt|tmpl1",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
      expect(mockWizardManager.setState).toHaveBeenCalled()
    })
  })

  describe("handleTemplateEditAccount", () => {
    test("shows account selection when balances exist", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getBalancesList.mockResolvedValue([
        {
          accountId: "Cash",
          amount: 100,
          currency: "USD",
          lastUpdated: Date(),
        },
        {
          accountId: "Bank",
          amount: 500,
          currency: "EUR",
          lastUpdated: Date(),
        },
      ])

      await templateHandlers.handleTemplateEditAccount(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_edit_acc|tmpl1",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
      expect(mockDbStorage.getBalancesList).toHaveBeenCalled()
    })

    test("handles no balances case", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getBalancesList.mockResolvedValue([])

      await templateHandlers.handleTemplateEditAccount(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_edit_acc|tmpl1",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
      expect(mockDbStorage.getBalancesList).toHaveBeenCalled()
    })
  })

  describe("handleTemplateSetAccount", () => {
    test("updates template with selected account", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([
        {
          id: "tmpl1",
          type: TransactionType.EXPENSE,
          amount: 50,
          category: ExpenseCategory.FOOD_DINING,
          name: "tmpl1",
          currency: "USD",
        },
      ])

      await templateHandlers.handleTemplateSetAccount(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_set_acc|tmpl1|acc1",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
      expect(mockDbStorage.updateTemplateAccount).toHaveBeenCalledWith(
        "123",
        "tmpl1",
        "acc1"
      )
    })
  })

  describe("handleTemplateCancelEdit", () => {
    test("clears wizard state and shows manage menu", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([])

      await templateHandlers.handleTemplateCancelEdit(
        bot,
        baseQuery,
        "123",
        123,
        "tmpl_cancel",
        mockWizardManager
      )

      expect(safeAnswerCallback).toHaveBeenCalled()
      expect(mockWizardManager.clearState).toHaveBeenCalled()
    })
  })

  describe("showTemplatesList", () => {
    test("shows empty state when no templates", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([])

      await templateHandlers.showTemplatesList(bot, 123, "123")

      expect(bot.sendMessage).toHaveBeenCalled()
      const message = (bot.sendMessage as jest.Mock).mock.calls[0][1]
      expect(message).toContain("No templates")
    })

    test("shows list when templates exist", async () => {
      const bot = new MockBot() as unknown as TelegramBot
      mockDbStorage.getTemplates.mockResolvedValue([
        {
          id: "tmpl1",
          name: "Coffee",
          type: TransactionType.EXPENSE,
          amount: 5,
          currency: "USD",
          category: ExpenseCategory.FOOD_DINING,
        },
        {
          id: "tmpl2",
          name: "Salary",
          type: TransactionType.INCOME,
          amount: 1000,
          currency: "USD",
          category: IncomeCategory.SALARY,
        },
      ])

      await templateHandlers.showTemplatesList(bot, 123, "123")

      expect(bot.sendMessage).toHaveBeenCalled()
      const call = (bot.sendMessage as jest.Mock).mock.calls[0]
      expect(call).toBeDefined()
    })
  })
})
