import TelegramBot from "node-telegram-bot-api"
import { MessageRouter } from "../../handlers/message"
import type { WizardManager } from "../../wizards/wizards"

jest.mock("../../security", () => ({
  securityCheck: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

class MockBot {
  handlers: Record<string, (msg: any) => void> = {}
  on = jest.fn((event: string, handler: (msg: any) => void) => {
    this.handlers[event] = handler
  })
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("MessageRouter", () => {
  test("routes matching pattern are handled", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizardManager = {
      isInWizard: jest.fn().mockReturnValue(false),
      handleWizardInput: jest.fn().mockResolvedValue(true),
    } as unknown as WizardManager

    const router = new MessageRouter(bot, wizardManager)

    const handler = jest.fn().mockResolvedValue(true)
    router.register((text) => text === "ping", handler, "Ping")

    router.listen()

    await (bot as any).handlers.message({
      chat: { id: 1 },
      text: "ping",
    })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test("falls back to wizard when no route matches", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizardManager = {
      isInWizard: jest.fn().mockReturnValue(true),
      handleWizardInput: jest.fn().mockResolvedValue(true),
    } as unknown as WizardManager

    const router = new MessageRouter(bot, wizardManager)
    router.listen()

    await (bot as any).handlers.message({
      chat: { id: 2 },
      text: "unknown",
    })

    expect(wizardManager.handleWizardInput).toHaveBeenCalledWith(
      2,
      "2",
      "unknown"
    )
  })
})
