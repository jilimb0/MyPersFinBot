import * as handlers from "../../handlers"
import { handleNLPInput, isNLPInput } from "../../handlers/message/nlp.handlers"

jest.mock("../../handlers", () => ({
  handleNLPInput: jest.fn().mockResolvedValue(undefined),
}))

describe("NLP Handlers - Coverage", () => {
  let bot: any
  let wizard: any
  const chatId = 12345
  const userId = "user123"

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {}
    wizard = {}
  })

  describe("isNLPInput", () => {
    it("should detect number followed by text", () => {
      expect(isNLPInput("100 food")).toBe(true)
      expect(isNLPInput("50 coffee")).toBe(true)
      expect(isNLPInput("5000 salary")).toBe(true)
    })

    it("should detect Russian spent keywords", () => {
      expect(isNLPInput("потратил 500")).toBe(true)
      expect(isNLPInput("Потратил на еду")).toBe(true)
    })

    it("should detect Ukrainian spent keywords", () => {
      expect(isNLPInput("витратив 300")).toBe(true)
    })

    it("should detect English spent keyword", () => {
      expect(isNLPInput("spent 200")).toBe(true)
      expect(isNLPInput("Spent on groceries")).toBe(true)
    })

    it("should detect received keywords", () => {
      expect(isNLPInput("получил 5000")).toBe(true)
      expect(isNLPInput("отримав 3000")).toBe(true)
      expect(isNLPInput("received 1000")).toBe(true)
    })

    it("should detect salary keyword", () => {
      expect(isNLPInput("зарплата 50000")).toBe(true)
    })

    it("should not detect non-NLP input", () => {
      expect(isNLPInput("hello")).toBe(false)
      expect(isNLPInput("test message")).toBe(false)
      expect(isNLPInput("food 100")).toBe(false) // wrong order
    })
  })

  describe("handleNLPInput", () => {
    it("should call handlers.handleNLPInput", async () => {
      await handleNLPInput(bot, chatId, userId, "100 food", wizard)

      expect(handlers.handleNLPInput).toHaveBeenCalledWith(
        bot,
        chatId,
        userId,
        "100 food",
        wizard
      )
    })

    it("should handle Russian text", async () => {
      await handleNLPInput(bot, chatId, userId, "потратил 500 на еду", wizard)

      expect(handlers.handleNLPInput).toHaveBeenCalled()
    })

    it("should handle Ukrainian text", async () => {
      await handleNLPInput(bot, chatId, userId, "витратив 300", wizard)

      expect(handlers.handleNLPInput).toHaveBeenCalled()
    })

    it("should handle English text", async () => {
      await handleNLPInput(bot, chatId, userId, "spent 200 on coffee", wizard)

      expect(handlers.handleNLPInput).toHaveBeenCalled()
    })
  })
})
