import { dbStorage } from "../../database/storage-db"
import {
  handleAddDebt,
  handleDebtSelection,
  handleDebtsMenu,
} from "../../handlers/message/debts.handlers"
import * as menus from "../../menus-i18n"
import * as helpers from "../../wizards/helpers"

jest.mock("../../database/storage-db")
jest.mock("../../menus-i18n")
jest.mock("../../wizards/helpers")
jest.mock("../../wizards/wizards")

describe("Debts Handlers - Branch Coverage", () => {
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
      getState: jest.fn().mockReturnValue({ lang: "en", returnTo: "debts" }),
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

  describe("handleDebtsMenu", () => {
    it("should show debts menu", async () => {
      const result = await handleDebtsMenu(context)

      expect(wizard.setState).toHaveBeenCalledWith(userId, {
        step: "DEBT_EDIT_SELECT",
        data: {},
        returnTo: "debts",
        lang: "en",
      })
      expect(menus.showDebtsMenu).toHaveBeenCalledWith(
        bot,
        chatId,
        userId,
        "en"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleAddDebt", () => {
    it("should start debt creation wizard", async () => {
      const result = await handleAddDebt(context)

      expect(wizard.setState).toHaveBeenCalledWith(userId, {
        step: "DEBT_TYPE",
        data: {},
        returnTo: "debts",
        lang: "en",
      })
      expect(helpers.resendCurrentStepPrompt).toHaveBeenCalled()
      expect(result).toBe(true)
    })
  })

  describe("handleDebtSelection", () => {
    it("should return false when not in debts context", async () => {
      wizard.getState.mockReturnValueOnce({ returnTo: "goals" })

      const result = await handleDebtSelection(context)

      expect(result).toBe(false)
    })

    it("should return false when debt not found", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [{ name: "Other Debt", isPaid: false }],
      })

      const result = await handleDebtSelection({ ...context, text: "My Debt" })

      expect(result).toBe(false)
    })

    it("should handle debt with zero paid amount", async () => {
      const debt = {
        id: "debt1",
        name: "Credit card",
        amount: 1000,
        paidAmount: 0,
        type: "I_OWE",
        currency: "USD",
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [debt],
      })

      const result = await handleDebtSelection({
        ...context,
        text: "Credit card",
      })

      expect(wizard.goToStep).toHaveBeenCalledWith(userId, "DEBT_MENU", {
        debt,
        debtId: "debt1",
      })
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Credit card"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle debt with partial payment", async () => {
      const debt = {
        id: "debt2",
        name: "Loan from friend",
        amount: 5000,
        paidAmount: 2000,
        type: "I_OWE",
        currency: "EUR",
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [debt],
      })

      const result = await handleDebtSelection({
        ...context,
        text: "Loan from friend",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Loan from friend"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle fully paid debt", async () => {
      const debt = {
        id: "debt3",
        name: "Old loan",
        amount: 1500,
        paidAmount: 1500,
        type: "THEY_OWE",
        currency: "USD",
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [debt],
      })

      const result = await handleDebtSelection({
        ...context,
        text: "Old loan",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Old loan"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle debt with due date", async () => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 15)

      const debt = {
        id: "debt4",
        name: "Monthly payment",
        amount: 2000,
        paidAmount: 500,
        type: "I_OWE",
        currency: "GBP",
        dueDate: dueDate.toISOString(),
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [debt],
      })

      const result = await handleDebtSelection({
        ...context,
        text: "Monthly payment",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Monthly payment"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should handle debt without due date", async () => {
      const debt = {
        id: "debt5",
        name: "Casual debt",
        amount: 300,
        paidAmount: 100,
        type: "THEY_OWE",
        currency: "USD",
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [debt],
      })

      const result = await handleDebtSelection({
        ...context,
        text: "Casual debt",
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("Casual debt"),
        expect.anything()
      )
      expect(result).toBe(true)
    })

    it("should test formatDate with different locales", async () => {
      const debt = {
        id: "debt6",
        name: "Test Debt",
        amount: 1000,
        paidAmount: 500,
        type: "I_OWE",
        currency: "RUB",
        dueDate: new Date("2026-12-31").toISOString(),
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValue({
        debts: [debt],
      })

      // Test with different languages
      for (const lang of ["ru", "uk", "es", "pl"]) {
        await handleDebtSelection({
          ...context,
          lang: lang as any,
          text: "Test Debt",
        })
      }

      expect(bot.sendMessage).toHaveBeenCalledTimes(4)
    })

    it("should handle THEY_OWE debt type", async () => {
      const debt = {
        id: "debt7",
        name: "Money lent",
        amount: 800,
        paidAmount: 200,
        type: "THEY_OWE",
        currency: "USD",
        isPaid: false,
      }

      ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
        debts: [debt],
      })

      const result = await handleDebtSelection({
        ...context,
        text: "Money lent",
      })

      // Should use different emoji and action for THEY_OWE
      expect(bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })
  })
})
