import { dbStorage } from "../../database/storage-db"
import {
  handleDebtCreateDetails,
  handleDebtPartialAccount,
  handleDebtPartialAmount,
} from "../../handlers/debt-handlers"
import * as menusI18n from "../../menus-i18n"
import * as validators from "../../validators"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getUserData: jest.fn(),
    getBalancesList: jest.fn(),
    updateDebtAmount: jest.fn(),
    getDebtById: jest.fn(),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showDebtsMenu: jest.fn(),
}))

jest.mock("../../utils", () => ({
  escapeMarkdown: jest.fn((text) => text),
  formatMoney: jest.fn((amount, currency) => `${amount} ${currency}`),
  handleInsufficientFunds: jest.fn(() => "Insufficient funds"),
}))

jest.mock("../../handlers/index", () => ({
  handleTxAccount: jest.fn(),
}))

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockUpdateDebtAmount = dbStorage.updateDebtAmount as jest.MockedFunction<
  typeof dbStorage.updateDebtAmount
>
const mockGetDebtById = dbStorage.getDebtById as jest.MockedFunction<
  typeof dbStorage.getDebtById
>
const mockShowDebtsMenu = menusI18n.showDebtsMenu as jest.MockedFunction<
  typeof menusI18n.showDebtsMenu
>

class MockBot {
  sendMessage = jest.fn()
}

class MockWizard {
  private state: any
  private bot: MockBot
  constructor(state?: any) {
    this.state = state || null
    this.bot = new MockBot()
  }
  getState() {
    return this.state
  }
  setState(_: string, next: any) {
    this.state = next
  }
  clearState() {
    this.state = null
  }
  getBackButton() {
    return { reply_markup: { keyboard: [[{ text: "Back" }]] } }
  }
  async sendMessage(...args: any[]) {
    return this.bot.sendMessage(...args)
  }
  async goToStep(_: string, step: string, data: any) {
    this.state = { ...this.state, step, data: { ...this.state?.data, ...data } }
  }
  getBot() {
    return this.bot as any
  }
}

describe("debt-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
  })

  describe("handleDebtCreateDetails", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleDebtCreateDetails(wizard, 1, "u1", "Test 100")
      expect(result).toBe(false)
    })

    test("handles zero amount", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: "I_OWE" },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 0, currency: "USD" })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "Test 0")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("handles already paid duplicate debt", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: "I_OWE" },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetUserData.mockResolvedValue({
        debts: [{ name: "Test", isPaid: true }],
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "Test 100")
      expect(sendSpy).toHaveBeenCalled()
      expect(wizard.getState()?.step).toBe("DEBT_ASK_DUE_DATE")
    })

    test("shows error if type not found", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "Test 100")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowDebtsMenu).toHaveBeenCalled()
    })

    test("shows error for invalid format", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: "I_OWE" },
      }) as any
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "OnlyName")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error for invalid amount", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: "I_OWE" },
      }) as any
      jest.spyOn(validators, "parseAmountWithCurrency").mockReturnValue(null)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "Test abc")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error for duplicate debt name", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: "I_OWE" },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetUserData.mockResolvedValue({
        debts: [{ name: "Test", isPaid: false }],
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "Test 100")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("creates debt and asks for due date", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { type: "I_OWE" },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetUserData.mockResolvedValue({ debts: [] } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtCreateDetails(wizard, 1, "u1", "Test 100")
      expect(sendSpy).toHaveBeenCalled()
      expect(wizard.getState()?.step).toBe("DEBT_ASK_DUE_DATE")
    })
  })

  describe("handleDebtPartialAmount", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleDebtPartialAmount(wizard, 1, "u1", "50")
      expect(result).toBe(false)
    })

    test("shows error if debt data missing", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAmount(wizard, 1, "u1", "50")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowDebtsMenu).toHaveBeenCalled()
    })

    test("shows error for invalid amount format", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { amount: 100, paidAmount: 0, currency: "USD" } },
      }) as any
      jest.spyOn(validators, "parseAmountWithCurrency").mockReturnValue(null)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAmount(wizard, 1, "u1", "abc")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error for zero or negative amount", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { amount: 100, paidAmount: 0, currency: "USD" } },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: -10, currency: "USD" })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAmount(wizard, 1, "u1", "-10")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error if amount exceeds remaining", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { amount: 100, paidAmount: 50, currency: "USD" } },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 60, currency: "USD" })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAmount(wizard, 1, "u1", "60")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error if no balances", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { amount: 100, paidAmount: 0, currency: "USD" } },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 50, currency: "USD" })
      mockGetBalancesList.mockResolvedValue([])
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAmount(wizard, 1, "u1", "50")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("proceeds to account selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { amount: 100, paidAmount: 0, currency: "USD" } },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 50, currency: "USD" })
      mockGetBalancesList.mockResolvedValue([{ accountId: "Cash" }] as any)
      await handleDebtPartialAmount(wizard, 1, "u1", "50")
      expect(wizard.getState()?.step).toBe("DEBT_PARTIAL_ACCOUNT")
    })
  })

  describe("handleDebtPartialAccount", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(result).toBe(false)
    })

    test("shows error if debt or amount missing", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowDebtsMenu).toHaveBeenCalled()
    })

    test("shows error if account not found", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          debt: { id: "d1", amount: 100, type: "I_OWE", currency: "USD" },
          payAmount: 50,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([])
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error if insufficient funds", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          debt: { id: "d1", amount: 100, type: "I_OWE", currency: "USD" },
          payAmount: 50,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 20, currency: "USD" },
      ] as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("records payment successfully", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          debt: { id: "d1", amount: 100, type: "I_OWE", currency: "USD" },
          payAmount: 50,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
      ] as any)
      mockUpdateDebtAmount.mockResolvedValue({ success: true } as any)
      mockGetDebtById.mockResolvedValue({
        id: "d1",
        amount: 100,
        paidAmount: 50,
        isPaid: false,
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockUpdateDebtAmount).toHaveBeenCalled()
      expect(mockShowDebtsMenu).toHaveBeenCalled()
    })

    test("handles fully paid debt", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          debt: { id: "d1", amount: 100, type: "I_OWE", currency: "USD" },
          payAmount: 50,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
      ] as any)
      mockUpdateDebtAmount.mockResolvedValue({ success: true } as any)
      mockGetDebtById.mockResolvedValue({
        id: "d1",
        amount: 100,
        paidAmount: 100,
        isPaid: true,
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowDebtsMenu).toHaveBeenCalled()
    })

    test("handles update failure", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          debt: { id: "d1", amount: 100, type: "I_OWE", currency: "USD" },
          payAmount: 50,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
      ] as any)
      mockUpdateDebtAmount.mockResolvedValue({
        success: false,
        message: "Update failed",
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtPartialAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("handles starred account names", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          debt: { id: "d1", amount: 100, type: "OWES_ME", currency: "USD" },
          payAmount: 50,
        },
      }) as any
      mockUpdateDebtAmount.mockResolvedValue({ success: true } as any)
      mockGetDebtById.mockResolvedValue({
        id: "d1",
        amount: 100,
        paidAmount: 50,
        isPaid: false,
      } as any)
      await handleDebtPartialAccount(wizard, 1, "u1", "⭐ Cash (100 USD)")
      expect(mockUpdateDebtAmount).toHaveBeenCalled()
    })
  })
})
