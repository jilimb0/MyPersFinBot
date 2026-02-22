import type TelegramBot from "node-telegram-bot-api"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getUserData: jest.fn(),
    addIncomeSource: jest.fn(),
    updateIncomeSourceName: jest.fn(),
    deleteIncomeSource: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>
const mockAddIncomeSource = dbStorage.addIncomeSource as jest.MockedFunction<
  typeof dbStorage.addIncomeSource
>
const mockUpdateIncomeSourceName =
  dbStorage.updateIncomeSourceName as jest.MockedFunction<
    typeof dbStorage.updateIncomeSourceName
  >
const mockDeleteIncomeSource =
  dbStorage.deleteIncomeSource as jest.MockedFunction<
    typeof dbStorage.deleteIncomeSource
  >

describe("E2E income sources flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetUserData.mockResolvedValue({
      balances: [],
      transactions: [],
      debts: [],
      goals: [],
      budgets: [],
      incomeSources: [
        {
          id: "inc-1",
          name: "Salary",
          expectedAmount: 1000,
          currency: "USD",
          frequency: "MONTHLY",
        },
      ],
      templates: [],
      defaultCurrency: "USD",
    })
  })

  test("income source add flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-i1"
    const chatId = 901
    const lang = "uk"

    wizard.setState(userId, {
      step: "INCOME_VIEW",
      data: {},
      returnTo: "settings",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "buttons.addIncomeSource")
    )
    let state = wizard.getState(userId)
    expect(state?.step).toBe("INCOME_INLINE")

    await wizard.handleWizardInput(chatId, userId, "Salary 1000 USD")
    expect(mockAddIncomeSource).toHaveBeenCalled()
    state = wizard.getState(userId)
    expect(state?.step).toBeUndefined()
  })

  test("income source rename flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-i2"
    const chatId = 902
    const lang = "uk"

    wizard.setState(userId, {
      step: "INCOME_MENU",
      data: {
        source: {
          name: "Salary",
          amount: 1000,
          currency: "USD",
        },
      },
      returnTo: "settings",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, t(lang, "buttons.editName"))
    let state = wizard.getState(userId)
    expect(state?.step).toBe("INCOME_EDIT_NAME")

    await wizard.handleWizardInput(chatId, userId, "Paycheck")
    expect(mockUpdateIncomeSourceName).toHaveBeenCalledWith(
      userId,
      "Salary",
      "Paycheck"
    )
    state = wizard.getState(userId)
    expect(state?.step).toBeUndefined()
  })

  test("income source delete flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-i3"
    const chatId = 903
    const lang = "uk"

    wizard.setState(userId, {
      step: "INCOME_MENU",
      data: {
        source: {
          name: "Salary",
          amount: 1000,
          currency: "USD",
        },
      },
      returnTo: "settings",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "wizard.income.deleteIncomeButton")
    )
    const state = wizard.getState(userId)
    expect(state?.step).toBe("INCOME_DELETE_CONFIRM")

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "wizard.income.confirmDeleteButton")
    )
    expect(mockDeleteIncomeSource).toHaveBeenCalledWith(userId, "Salary")
  })
})
