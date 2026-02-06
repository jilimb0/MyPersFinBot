import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../../wizards/wizards"
import {
  handleTemplateSave,
  handleTemplateUse,
  handleTemplateDelete,
} from "../../handlers/template-handlers"
import { TransactionType } from "../../types"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    addTemplate: jest.fn(),
    getTemplates: jest.fn(),
    getBalancesList: jest.fn(),
    getSmartBalanceSelection: jest.fn(),
    addTransaction: jest.fn(),
    deleteTemplate: jest.fn(),
  },
}))

jest.mock("../../utils", () => ({
  safeAnswerCallback: jest.fn().mockResolvedValue(undefined),
  formatMoney: jest.fn().mockImplementation((amt) => `$${amt}`),
}))

import { dbStorage } from "../../database/storage-db"
import { safeAnswerCallback } from "../../utils"

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockAddTemplate = dbStorage.addTemplate as jest.MockedFunction<
  typeof dbStorage.addTemplate
>
const mockGetTemplates = dbStorage.getTemplates as jest.MockedFunction<
  typeof dbStorage.getTemplates
>
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockAddTransaction = dbStorage.addTransaction as jest.MockedFunction<
  typeof dbStorage.addTransaction
>
const mockDeleteTemplate = dbStorage.deleteTemplate as jest.MockedFunction<
  typeof dbStorage.deleteTemplate
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Template handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
  })

  test("handleTemplateSave persists template", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    wizard.setState("1", { step: "NONE", data: {}, lang: "uk" })

    await handleTemplateSave(
      bot,
      { id: "cb-1" } as TelegramBot.CallbackQuery,
      "1",
      "tmpl_save|exp|50|Food%20%26%20dining%20%F0%9F%8D%94|USD|Cash",
      wizard
    )

    expect(mockAddTemplate).toHaveBeenCalled()
    expect(safeAnswerCallback).toHaveBeenCalled()
  })

  test("handleTemplateUse creates transaction and sends confirmation", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    wizard.setState("2", { step: "NONE", data: {}, lang: "uk" })

    mockGetTemplates.mockResolvedValue([
      {
        id: "tpl-1",
        name: "☕ Food",
        category: "Food & dining 🍔",
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

  test("handleTemplateDelete removes template and refreshes list", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    wizard.setState("3", { step: "NONE", data: {}, lang: "uk" })

    mockDeleteTemplate.mockResolvedValue(true)
    mockGetTemplates.mockResolvedValue([
      {
        id: "tpl-2",
        name: "💰 Salary",
        category: "Salary 💼",
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
})
