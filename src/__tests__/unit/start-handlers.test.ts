import { dbStorage } from "../../database/storage-db"
import { detectAndSetLanguage } from "../../handlers/language-handler"
import {
  handleStart,
  handleStartTracking,
} from "../../handlers/message/start.handlers"

jest.mock("../../database/storage-db")
jest.mock("../../handlers/language-handler")

describe("Start Handlers - Branch Coverage", () => {
  let bot: any
  let context: any
  const chatId = 12345
  const userId = "user123"

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
    }
    context = {
      bot,
      chatId,
      userId,
      lang: "en" as const,
      db: dbStorage,
      msg: {
        text: "/start",
        from: { language_code: "en" },
      },
    }
  })

  describe("handleStart", () => {
    it("should detect language on /start command", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [],
        transactions: [],
        debts: [],
        goals: [],
      })

      await handleStart(context)

      expect(detectAndSetLanguage).toHaveBeenCalledWith(userId, "en")
    })

    it("should show welcome back for existing user with balances", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [{ id: "acc1", name: "Cash" }],
        transactions: [],
        debts: [],
        goals: [],
      })

      const result = await handleStart(context)

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      )
      expect(result).toBe(true)
    })

    it("should show welcome back for user with transactions", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [],
        transactions: [{ id: "tx1" }],
        debts: [],
        goals: [],
      })

      const result = await handleStart(context)

      expect(bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it("should show welcome back for user with debts", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [],
        transactions: [],
        debts: [{ id: "debt1" }],
        goals: [],
      })

      const result = await handleStart(context)

      expect(bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it("should show welcome back for user with goals", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [],
        transactions: [],
        debts: [],
        goals: [{ id: "goal1" }],
      })

      const result = await handleStart(context)

      expect(bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it("should show welcome intro for new user with no data", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [],
        transactions: [],
        debts: [],
        goals: [],
      })

      const result = await handleStart(context)

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Welcome"),
        expect.objectContaining({
          parse_mode: "Markdown",
        })
      )
      expect(result).toBe(true)
    })

    it("should not detect language if message is not /start", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        balances: [],
        transactions: [],
        debts: [],
        goals: [],
      })

      await handleStart({
        ...context,
        msg: { text: "other", from: { language_code: "ru" } },
      })

      expect(detectAndSetLanguage).not.toHaveBeenCalled()
    })
  })

  describe("handleStartTracking", () => {
    it("should show quick start guide", async () => {
      const result = await handleStartTracking(context)

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.any(Object),
        })
      )
      expect(result).toBe(true)
    })
  })
})
