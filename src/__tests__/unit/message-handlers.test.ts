import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../../wizards/wizards"
import { handleAnalyticsMenu } from "../../handlers/message/analytics.handlers"
import { handleAddDebt } from "../../handlers/message/debts.handlers"
import { handleAddGoal } from "../../handlers/message/goals.handlers"

jest.mock("../../menus-i18n", () => ({
  showDebtsMenu: jest.fn(),
  showGoalsMenu: jest.fn(),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
  },
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Message handlers", () => {
  test("analytics menu sets wizard state and renders menu", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const context = {
      bot,
      chatId: 1,
      userId: "1",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleAnalyticsMenu(context)

    const state = wizard.getState("1")
    expect(state?.step).toBe("ANALYTICS_MENU")
  })

  test("add debt handler sets DEBT_TYPE", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const context = {
      bot,
      chatId: 2,
      userId: "2",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleAddDebt(context)

    const state = wizard.getState("2")
    expect(state?.step).toBe("DEBT_TYPE")
  })

  test("add goal handler sets GOAL_INPUT", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const context = {
      bot,
      chatId: 3,
      userId: "3",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleAddGoal(context)

    const state = wizard.getState("3")
    expect(state?.step).toBe("GOAL_INPUT")
  })
})
