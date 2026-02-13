import { dbStorage } from "../../database/storage-db"
import {
  handleAddGoal,
  handleGoalSelection,
  handleGoalsMenu,
} from "../../handlers/message/goals.handlers"
import * as menus from "../../menus-i18n"
import * as helpers from "../../wizards/helpers"

jest.mock("../../database/storage-db")
jest.mock("../../menus-i18n")
jest.mock("../../wizards/helpers")
jest.mock("../../wizards/wizards")

describe("Goals Handlers - Branch Coverage", () => {
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
      getState: jest.fn().mockReturnValue({ lang: "en", returnTo: "goals" }),
      goToStep: jest.fn(),
    }
    context = {
      bot,
      chatId,
      userId,
      lang: "en" as const,
      wizardManager: wizard,
      db: dbStorage,
      text: "",
    }
  })

  describe("handleGoalsMenu", () => {
    it("should show goals menu", async () => {
      const result = await handleGoalsMenu(context)

      expect(wizard.setState).toHaveBeenCalledWith(userId, {
        step: "NONE",
        data: {},
        returnTo: "goals",
        lang: "en",
      })
      expect(menus.showGoalsMenu).toHaveBeenCalledWith(
        bot,
        chatId,
        userId,
        "en"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleAddGoal", () => {
    it("should start goal creation wizard", async () => {
      const result = await handleAddGoal(context)

      expect(wizard.setState).toHaveBeenCalledWith(userId, {
        step: "GOAL_INPUT",
        data: {},
        returnTo: "goals",
        lang: "en",
      })
      expect(helpers.resendCurrentStepPrompt).toHaveBeenCalled()
      expect(result).toBe(true)
    })
  })

  describe("handleGoalSelection", () => {
    it("should return false when not in goals context", async () => {
      wizard.getState.mockReturnValueOnce({ returnTo: "debts" })

      const result = await handleGoalSelection(context)

      expect(result).toBe(false)
    })

    it("should return false when goal not found", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [{ name: "Other Goal", status: "ACTIVE" }],
      })

      const result = await handleGoalSelection({ ...context, text: "My Goal" })

      expect(result).toBe(false)
    })

    it("should handle goal with zero current amount", async () => {
      const goal = {
        id: "goal1",
        name: "Save for vacation",
        targetAmount: 1000,
        currentAmount: 0,
        currency: "USD",
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [goal],
      })

      const result = await handleGoalSelection({
        ...context,
        text: "Save for vacation",
      })

      expect(wizard.goToStep).toHaveBeenCalledWith(userId, "GOAL_MENU", {
        goal,
        goalId: "goal1",
      })
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Save for vacation"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle goal with partial progress", async () => {
      const goal = {
        id: "goal2",
        name: "Emergency fund",
        targetAmount: 5000,
        currentAmount: 2500,
        currency: "EUR",
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [goal],
      })

      const result = await handleGoalSelection({
        ...context,
        text: "Emergency fund",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Emergency fund"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle completed goal", async () => {
      const goal = {
        id: "goal3",
        name: "New laptop",
        targetAmount: 1500,
        currentAmount: 1600,
        currency: "USD",
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [goal],
      })

      const result = await handleGoalSelection({
        ...context,
        text: "New laptop",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("New laptop"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle goal with future deadline", async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const goal = {
        id: "goal4",
        name: "Car down payment",
        targetAmount: 10000,
        currentAmount: 5000,
        currency: "USD",
        deadline: futureDate.toISOString(),
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [goal],
      })

      const result = await handleGoalSelection({
        ...context,
        text: "Car down payment",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Car down payment"),
        expect.anything()
      )
      // Should show days left
      expect(result).toBe(true)
    })

    it("should handle goal with passed deadline", async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      const goal = {
        id: "goal5",
        name: "Holiday gift",
        targetAmount: 500,
        currentAmount: 300,
        currency: "GBP",
        deadline: pastDate.toISOString(),
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [goal],
      })

      const result = await handleGoalSelection({
        ...context,
        text: "Holiday gift",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Holiday gift"),
        expect.anything()
      )
      // Should show deadline passed message
      expect(result).toBe(true)
    })

    it("should show set deadline button when no deadline", async () => {
      const goal = {
        id: "goal6",
        name: "Rainy day fund",
        targetAmount: 3000,
        currentAmount: 1000,
        currency: "USD",
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        goals: [goal],
      })

      const result = await handleGoalSelection({
        ...context,
        text: "Rainy day fund",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.anything(),
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

    it("should test formatDate with different locales", async () => {
      const goal = {
        id: "goal7",
        name: "Test Goal",
        targetAmount: 1000,
        currentAmount: 500,
        currency: "RUB",
        deadline: new Date("2026-12-31").toISOString(),
        status: "ACTIVE",
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValue({
        goals: [goal],
      })

      // Test with different languages
      for (const lang of ["ru", "uk", "es", "pl"]) {
        await handleGoalSelection({
          ...context,
          lang: lang as any,
          text: "Test Goal",
        })
      }

      expect(bot.sendMessage).toHaveBeenCalledTimes(4)
    })
  })
})
