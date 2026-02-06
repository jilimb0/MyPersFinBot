import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../../wizards/wizards"
import {
  handleBack,
  handleMainMenu,
} from "../../handlers/message/navigation.handlers"

jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn(),
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Navigation handlers", () => {
  test("handleBack clears wizard and returns to main", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("1", {
      step: "TX_AMOUNT",
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    const context = {
      bot,
      chatId: 1,
      userId: "1",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(wizard.getState("1")).toBeUndefined()
  })

  test("handleMainMenu clears wizard state", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("2", {
      step: "TX_AMOUNT",
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    const context = {
      bot,
      chatId: 2,
      userId: "2",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleMainMenu(context)

    expect(wizard.getState("2")).toBeUndefined()
  })
})
