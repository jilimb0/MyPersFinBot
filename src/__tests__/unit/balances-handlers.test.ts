import {
  handleAddBalance,
  handleBalancesMenu,
} from "../../handlers/message/balances.handlers"
import * as menus from "../../menus-i18n"

jest.mock("../../menus-i18n")
jest.mock("../../wizards/wizards")

describe("Balances Handlers - Coverage", () => {
  let bot: any
  let wizard: any
  let context: any
  const chatId = 12345
  const userId = "user123"

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
    }
    wizard = {
      setState: jest.fn(),
      getBackButton: jest.fn().mockReturnValue({
        reply_markup: { keyboard: [[{ text: "Back" }]], resize_keyboard: true },
      }),
    }
    context = {
      bot,
      chatId,
      userId,
      lang: "en" as const,
      wizardManager: wizard,
    }
  })

  describe("handleBalancesMenu", () => {
    it("should show balances menu", async () => {
      const result = await handleBalancesMenu(context)

      expect(wizard.setState).toHaveBeenCalledWith(userId, {
        step: "BALANCE_LIST",
        data: {},
        returnTo: "balances",
        lang: "en",
      })
      expect(menus.showBalancesMenu).toHaveBeenCalledWith(
        wizard,
        chatId,
        userId,
        "en"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleAddBalance", () => {
    it("should start add balance wizard", async () => {
      const result = await handleAddBalance(context)

      expect(wizard.setState).toHaveBeenCalledWith(userId, {
        step: "BALANCE_NAME",
        data: {},
        returnTo: "balances",
        lang: "en",
      })
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.any(Object),
        })
      )
      expect(wizard.getBackButton).toHaveBeenCalledWith("en")
      expect(result).toBe(true)
    })
  })
})
