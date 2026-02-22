import type TelegramBot from "@telegram-api"
import { handleStatementPreviewAction } from "../../handlers/upload-statement-handlers"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getBalancesList: jest.fn(),
    validateTransactionsBatch: jest.fn(),
    addTransactionsBatch: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockValidateTransactionsBatch =
  dbStorage.validateTransactionsBatch as jest.MockedFunction<
    typeof dbStorage.validateTransactionsBatch
  >
const mockAddTransactionsBatch =
  dbStorage.addTransactionsBatch as jest.MockedFunction<
    typeof dbStorage.addTransactionsBatch
  >

describe("E2E upload statement flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 100,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
    ])
    mockValidateTransactionsBatch.mockReturnValue({
      valid: [],
      invalid: [],
    })
    mockAddTransactionsBatch.mockResolvedValue({
      added: 1,
      errors: [],
    })
  })

  test("statement preview -> import all", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-u1"
    const chatId = 1201
    const lang = "uk"

    wizard.setState(userId, {
      step: "STATEMENT_PREVIEW",
      data: {
        transactions: [
          {
            date: new Date().toISOString(),
            amount: 10,
            currency: "USD",
            type: "EXPENSE",
            category: "FOOD_DINING",
            description: "Coffee",
          },
        ],
        bankType: "mono",
        currentIndex: 0,
        lang,
      },
      returnTo: "settings",
      lang,
    })

    const handled = await handleStatementPreviewAction(
      wizard,
      chatId,
      userId,
      t(lang, "common.importAll")
    )
    expect(handled).toBe(true)
    expect(mockAddTransactionsBatch).toHaveBeenCalled()
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("statement preview -> cancel", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-u2"
    const chatId = 1202
    const lang = "uk"

    wizard.setState(userId, {
      step: "STATEMENT_PREVIEW",
      data: {
        transactions: [],
        bankType: "mono",
        currentIndex: 0,
        lang,
      },
      returnTo: "settings",
      lang,
    })

    const handled = await handleStatementPreviewAction(
      wizard,
      chatId,
      userId,
      t(lang, "common.cancel")
    )
    expect(handled).toBe(true)
    expect(wizard.getState(userId)).toBeUndefined()
  })
})
