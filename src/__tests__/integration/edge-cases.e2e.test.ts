import type TelegramBot from "node-telegram-bot-api"
import { ExpenseCategory, TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
  },
}))

jest.mock("../../services/recurring-manager", () => ({
  recurringManager: {
    createRecurring: jest.fn(),
  },
}))

import { recurringManager } from "../../services/recurring-manager"

const mockCreateRecurring =
  recurringManager.createRecurring as jest.MockedFunction<
    typeof recurringManager.createRecurring
  >

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("E2E edge cases", () => {
  test("debt due date invalid format keeps step", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-e1"
    const chatId = 1501
    const lang = "uk"

    wizard.setState(userId, {
      step: "DEBT_ASK_DUE_DATE",
      data: {
        name: "John",
        amount: 100,
        currency: "USD",
        type: "I_OWE",
      },
      returnTo: "debts",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "invalid")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("DEBT_ASK_DUE_DATE")
  })

  test("goal deadline invalid format keeps step", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-e2"
    const chatId = 1502
    const lang = "uk"

    wizard.setState(userId, {
      step: "GOAL_ASK_DEADLINE",
      data: {
        goalId: "goal-1",
        name: "Laptop",
        targetAmount: 1000,
        currency: "USD",
      },
      returnTo: "goals",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "invalid")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("GOAL_ASK_DEADLINE")
  })

  test("income expected day invalid keeps step", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-e3"
    const chatId = 1503
    const lang = "uk"

    wizard.setState(userId, {
      step: "INCOME_ASK_EXPECTED_DATE",
      data: {
        incomeId: "inc-1",
        name: "Salary",
        expectedAmount: 1000,
        currency: "USD",
      },
      returnTo: "settings",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "99")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("INCOME_ASK_EXPECTED_DATE")
  })

  test("balance amount invalid keeps step", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-e4"
    const chatId = 1504
    const lang = "uk"

    wizard.setState(userId, {
      step: "BALANCE_AMOUNT",
      data: { accountIdRaw: "Cash" },
      returnTo: "balances",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "abc")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_AMOUNT")
  })

  test("income inline invalid format keeps step", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-e5"
    const chatId = 1505
    const lang = "uk"

    wizard.setState(userId, {
      step: "INCOME_INLINE",
      data: {},
      returnTo: "settings",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "Salary")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("INCOME_INLINE")
  })

  test("recurring invalid day keeps step", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-e6"
    const chatId = 1506
    const lang = "uk"

    wizard.setState(userId, {
      step: "RECURRING_CREATE_DAY",
      data: {
        type: TransactionType.EXPENSE,
        amount: 20,
        currency: "USD",
        category: ExpenseCategory.FOOD_DINING,
        accountId: "Cash",
        description: "Coffee",
      },
      returnTo: "recurring",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "40")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("RECURRING_CREATE_DAY")
    expect(mockCreateRecurring).not.toHaveBeenCalled()
  })
})
