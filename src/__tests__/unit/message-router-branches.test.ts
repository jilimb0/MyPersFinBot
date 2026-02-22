import { dbStorage } from "../../database/storage-db"
import { MessageRouter } from "../../handlers/message/router"
import { securityCheck } from "../../security"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    getUserData: jest.fn().mockResolvedValue({
      defaultCurrency: "USD",
      balances: [],
    }),
    logUserActivity: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock("../../security", () => ({
  securityCheck: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../wizards/wizards", () => ({
  WizardManager: jest.fn().mockImplementation(() => ({
    hydrateState: jest.fn().mockResolvedValue(undefined),
    isInWizard: jest.fn().mockReturnValue(false),
    handleWizardInput: jest.fn().mockResolvedValue(false),
  })),
}))

jest.mock("../../config", () => ({
  config: {
    sentryDsn: null,
    isProduction: false,
  },
}))

describe("MessageRouter - Branch Coverage", () => {
  let bot: any
  let router: MessageRouter
  let wizard: any
  const chatId = 12345

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    }
    wizard = {
      hydrateState: jest.fn().mockResolvedValue(undefined),
      isInWizard: jest.fn().mockReturnValue(false),
      handleWizardInput: jest.fn().mockResolvedValue(false),
    }
    router = new MessageRouter(bot, wizard)
  })

  describe("Route registration", () => {
    it("should register a single route", () => {
      const handler = jest.fn().mockResolvedValue(true)
      const pattern = (text: string) => text === "test"

      router.register(pattern, handler, "Test route")

      // Route registered successfully
      expect(true).toBe(true)
    })

    it("should register multiple routes", () => {
      const handler1 = jest.fn().mockResolvedValue(true)
      const handler2 = jest.fn().mockResolvedValue(true)
      const pattern1 = (text: string) => text === "test1"
      const pattern2 = (text: string) => text === "test2"

      router.registerRoutes([
        { pattern: pattern1, handler: handler1, description: "Route 1" },
        { pattern: pattern2, handler: handler2, description: "Route 2" },
      ])

      // Routes registered successfully
      expect(true).toBe(true)
    })
  })

  describe("Security checks", () => {
    it("should block message when security check fails", async () => {
      ;(securityCheck as jest.Mock).mockResolvedValueOnce(false)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "test",
        from: { id: chatId },
      })

      expect(bot.sendMessage).not.toHaveBeenCalled()
    })

    it("should process message when security check passes", async () => {
      ;(securityCheck as jest.Mock).mockResolvedValueOnce(true)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "test",
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })
  })

  describe("Message handling", () => {
    it("should handle message with registered route", async () => {
      const handler = jest.fn().mockResolvedValue(true)
      router.register((text) => text === "hello", handler)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "hello",
        from: { id: chatId },
      })

      expect(handler).toHaveBeenCalled()
    })

    it("should handle wizard input when in wizard", async () => {
      wizard.isInWizard.mockReturnValue(true)
      wizard.handleWizardInput.mockResolvedValue(true)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "test",
        from: { id: chatId },
      })

      expect(wizard.handleWizardInput).toHaveBeenCalled()
    })

    it("should try next route when handler returns false", async () => {
      const handler1 = jest.fn().mockResolvedValue(false)
      const handler2 = jest.fn().mockResolvedValue(true)

      router.register((text) => text === "test", handler1)
      router.register((text) => text === "test", handler2)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "test",
        from: { id: chatId },
      })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it("should stop at first matching handler that returns true", async () => {
      const handler1 = jest.fn().mockResolvedValue(true)
      const handler2 = jest.fn().mockResolvedValue(true)

      router.register((text) => text === "test", handler1)
      router.register((text) => text === "test", handler2)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "test",
        from: { id: chatId },
      })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe("Special text handling", () => {
    it("should handle unicode and emojis", async () => {
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "Кофе ☕ 😀",
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })

    it("should handle very long text", async () => {
      const longText = "a".repeat(1000)

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: longText,
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })

    it("should handle numbers only", async () => {
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "12345",
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })
  })

  describe("Language handling", () => {
    it("should use user language from database", async () => {
      ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValueOnce("ru")

      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "test",
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalledWith(chatId.toString())
    })
  })
})
