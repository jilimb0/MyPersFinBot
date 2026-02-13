import { dbStorage } from "../../database/storage-db"
import { handleSettingsMenu } from "../../handlers/message/settings.handlers"

jest.mock("../../database/storage-db")
jest.mock("../../wizards/wizards")

describe("Settings Handlers - Branch Coverage", () => {
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
      getState: jest.fn().mockReturnValue(null),
      goToStep: jest.fn(),
    }
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")

    context = {
      bot,
      chatId,
      userId,
      lang: "en" as const,
      wizardManager: wizard,
      db: dbStorage,
    }
  })

  describe("handleSettingsMenu", () => {
    it("should show default settings menu", async () => {
      const result = await handleSettingsMenu(context)

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Settings"),
        expect.objectContaining({
          parse_mode: "Markdown",
        })
      )
      expect(result).toBe(true)
    })

    it("should handle goal advanced menu with deadline", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "GOAL_MENU",
        data: {
          goal: {
            name: "My Goal",
            deadline: "2026-12-31",
            autoDeposit: { enabled: true },
          },
        },
      })

      const result = await handleSettingsMenu(context)

      expect(wizard.goToStep).toHaveBeenCalledWith(
        userId,
        "GOAL_ADVANCED_MENU",
        expect.any(Object)
      )
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: expect.any(String) }),
              ]),
            ]),
          }),
        })
      )
      expect(result).toBe(true)
    })

    it("should handle goal advanced menu without deadline", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "GOAL_MENU",
        data: {
          goal: {
            name: "My Goal",
            autoDeposit: { enabled: false },
          },
        },
      })

      const result = await handleSettingsMenu(context)

      expect(wizard.goToStep).toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it("should handle goal with auto deposit enabled", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "GOAL_MENU",
        data: {
          goal: {
            name: "Savings Goal",
            deadline: "2026-12-31",
            autoDeposit: { enabled: true },
          },
        },
      })

      await handleSettingsMenu(context)

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      )
    })

    it("should handle goal with auto deposit disabled", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "GOAL_MENU",
        data: {
          goal: {
            name: "Savings Goal",
            autoDeposit: { enabled: false },
          },
        },
      })

      await handleSettingsMenu(context)

      expect(bot.sendMessage).toHaveBeenCalled()
    })

    it("should handle debt advanced menu with due date", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "DEBT_MENU",
        data: {
          debt: {
            name: "My Debt",
            dueDate: "2026-06-30",
            autoPayment: { enabled: true },
          },
        },
      })

      await handleSettingsMenu(context)

      expect(wizard.goToStep).toHaveBeenCalledWith(
        userId,
        "DEBT_ADVANCED_MENU",
        expect.any(Object)
      )
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.any(Array),
          }),
        })
      )
    })

    it("should handle debt advanced menu without due date", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "DEBT_MENU",
        data: {
          debt: {
            name: "My Debt",
            autoPayment: { enabled: false },
          },
        },
      })

      await handleSettingsMenu(context)

      expect(wizard.goToStep).toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalled()
    })

    it("should handle debt with auto payment enabled", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "DEBT_MENU",
        data: {
          debt: {
            name: "Credit Card",
            dueDate: "2026-07-15",
            autoPayment: { enabled: true },
          },
        },
      })

      await handleSettingsMenu(context)

      expect(bot.sendMessage).toHaveBeenCalled()
    })

    it("should handle debt with auto payment disabled", async () => {
      wizard.getState.mockReturnValueOnce({
        step: "DEBT_MENU",
        data: {
          debt: {
            name: "Credit Card",
            autoPayment: { enabled: false },
          },
        },
      })

      await handleSettingsMenu(context)

      expect(bot.sendMessage).toHaveBeenCalled()
    })
  })
})
