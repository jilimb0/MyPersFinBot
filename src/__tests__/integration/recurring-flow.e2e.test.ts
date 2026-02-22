import type { BotClient } from "@jilimb0/tgwrapper"
import { t } from "../../i18n"
import { ExpenseCategory, TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

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
    createRecurring: jest.fn(),
    toggleRecurring: jest.fn(),
    deleteRecurring: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"
import { recurringManager } from "../../services/recurring-manager"

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
const mockCreateRecurring =
  recurringManager.createRecurring as jest.MockedFunction<
    typeof recurringManager.createRecurring
  >
const mockToggleRecurring =
  recurringManager.toggleRecurring as jest.MockedFunction<
    typeof recurringManager.toggleRecurring
  >
const mockDeleteRecurring =
  recurringManager.deleteRecurring as jest.MockedFunction<
    typeof recurringManager.deleteRecurring
  >

describe("E2E recurring flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 100,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
    ])
    mockGetTopCategories.mockResolvedValue([ExpenseCategory.FOOD_DINING])
    mockGetUserRecurring.mockResolvedValue([
      {
        id: "rec-1",
        userId: "user-r1",
        type: TransactionType.EXPENSE,
        amount: 20,
        currency: "USD",
        category: ExpenseCategory.FOOD_DINING,
        accountId: "Cash",
        description: "Coffee",
        frequency: "MONTHLY",
        startDate: new Date(),
        nextExecutionDate: new Date(),
        isActive: true,
        autoExecute: true,
        user: {} as any,
      },
    ])
  })

  test("recurring create flow: description -> type -> amount -> account -> category -> day", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "user-r1"
    const chatId = 1001
    const lang = "uk"

    wizard.setState(userId, {
      step: "RECURRING_CREATE_DESCRIPTION",
      data: {},
      returnTo: "recurring",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "Coffee")
    let state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_CREATE_TYPE")

    await wizard.handleWizardInput(chatId, userId, t(lang, "recurring.expense"))
    state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_CREATE_AMOUNT")

    await wizard.handleWizardInput(chatId, userId, "20")
    state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_CREATE_ACCOUNT")

    await wizard.handleWizardInput(chatId, userId, "💳 Cash")
    state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_CREATE_CATEGORY")

    await wizard.handleWizardInput(chatId, userId, ExpenseCategory.FOOD_DINING)
    state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_CREATE_DAY")

    await wizard.handleWizardInput(chatId, userId, "5")
    expect(mockCreateRecurring).toHaveBeenCalled()
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("recurring item flow: pause and delete", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "user-r2"
    const chatId = 1002
    const lang = "uk"

    wizard.setState(userId, {
      step: "RECURRING_MENU",
      data: {},
      returnTo: "recurring",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "💸 Coffee")
    let state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_ITEM_MENU")

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "recurring.pauseButton")
    )
    expect(mockToggleRecurring).toHaveBeenCalledWith("rec-1", false)

    const recurringItem = (await mockGetUserRecurring(userId))[0]
    wizard.setState(userId, {
      step: "RECURRING_ITEM_MENU",
      data: { recurringId: "rec-1", recurring: recurringItem },
      returnTo: "recurring",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, t(lang, "common.delete"))
    state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_DELETE_CONFIRM")

    await wizard.handleWizardInput(chatId, userId, t(lang, "common.yesDelete"))
    expect(mockDeleteRecurring).toHaveBeenCalledWith("rec-1")
  })
})
