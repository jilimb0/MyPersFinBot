import { dbStorage } from "../../database/storage-db"
import {
  handleGoalDepositAccount,
  handleGoalDepositAmount,
  handleGoalInput,
} from "../../handlers/goal-handlers"
import * as handlers from "../../handlers/index"
import * as menusI18n from "../../menus-i18n"
import * as validators from "../../validators"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getUserData: jest.fn(),
    addGoal: jest.fn(),
    getBalancesList: jest.fn(),
    depositToGoal: jest.fn(),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showGoalsMenu: jest.fn(),
}))

jest.mock("../../utils", () => ({
  escapeMarkdown: jest.fn((text) => text),
  formatAmount: jest.fn((amount) => `${amount}`),
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
const mockAddGoal = dbStorage.addGoal as jest.MockedFunction<
  typeof dbStorage.addGoal
>
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockDepositToGoal = dbStorage.depositToGoal as jest.MockedFunction<
  typeof dbStorage.depositToGoal
>
const mockShowGoalsMenu = menusI18n.showGoalsMenu as jest.MockedFunction<
  typeof menusI18n.showGoalsMenu
>
const mockHandleTxAccount = handlers.handleTxAccount as jest.MockedFunction<
  typeof handlers.handleTxAccount
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
    this.state = {
      ...this.state,
      step,
      data: { ...this.state?.data, ...data },
    }
  }
  getBot() {
    return this.bot as any
  }
}

describe("goal-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
  })

  describe("handleGoalInput", () => {
    test("shows error for invalid format", async () => {
      const wizard = new MockWizard({ lang: "en" }) as any
      jest.spyOn(validators, "parseGoalInput").mockReturnValue(null)
      jest
        .spyOn(validators, "getValidationErrorMessage")
        .mockReturnValue("Invalid format")
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalInput(wizard, 1, "u1", "invalid")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error for duplicate goal name", async () => {
      const wizard = new MockWizard({ lang: "en" }) as any
      jest.spyOn(validators, "parseGoalInput").mockReturnValue({
        name: "Vacation",
        targetAmount: 1000,
        currency: "USD",
      })
      mockGetUserData.mockResolvedValue({
        goals: [{ name: "Vacation", status: "ACTIVE" }],
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalInput(wizard, 1, "u1", "Vacation 1000")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("creates goal and asks for deadline", async () => {
      const wizard = new MockWizard({ lang: "en" }) as any
      jest.spyOn(validators, "parseGoalInput").mockReturnValue({
        name: "Vacation",
        targetAmount: 1000,
        currency: "USD",
      })
      mockGetUserData.mockResolvedValue({ goals: [] } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalInput(wizard, 1, "u1", "Vacation 1000")
      expect(mockAddGoal).toHaveBeenCalled()
      expect(sendSpy).toHaveBeenCalled()
      expect(wizard.getState()?.step).toBe("GOAL_ASK_DEADLINE")
    })
  })

  describe("handleGoalDepositAmount", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleGoalDepositAmount(wizard, 1, "u1", "100")
      expect(result).toBe(false)
    })

    test("shows error if goal data missing", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAmount(wizard, 1, "u1", "100")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowGoalsMenu).toHaveBeenCalled()
    })

    test("shows error for invalid amount", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { targetAmount: 1000, currentAmount: 0, currency: "USD" },
        },
      }) as any
      jest.spyOn(validators, "parseAmountWithCurrency").mockReturnValue(null)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAmount(wizard, 1, "u1", "abc")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error for zero or negative amount", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { targetAmount: 1000, currentAmount: 0, currency: "USD" },
        },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: -50, currency: "USD" })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAmount(wizard, 1, "u1", "-50")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error if amount exceeds remaining", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { targetAmount: 1000, currentAmount: 500, currency: "USD" },
        },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 600, currency: "USD" })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAmount(wizard, 1, "u1", "600")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error if no balances", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { targetAmount: 1000, currentAmount: 0, currency: "USD" },
        },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetBalancesList.mockResolvedValue([])
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAmount(wizard, 1, "u1", "100")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("proceeds to account selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { targetAmount: 1000, currentAmount: 0, currency: "USD" },
        },
      }) as any
      jest
        .spyOn(validators, "parseAmountWithCurrency")
        .mockReturnValue({ amount: 100, currency: "USD" })
      mockGetBalancesList.mockResolvedValue([{ accountId: "Cash" }] as any)
      await handleGoalDepositAmount(wizard, 1, "u1", "100")
      expect(wizard.getState()?.step).toBe("GOAL_DEPOSIT_ACCOUNT")
      expect(mockHandleTxAccount).toHaveBeenCalled()
    })
  })

  describe("handleGoalDepositAccount", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null) as any
      const result = await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(result).toBe(false)
    })

    test("shows error if goal or amount missing", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} }) as any
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowGoalsMenu).toHaveBeenCalled()
    })

    test("shows error if account not found", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { id: "g1", targetAmount: 1000, currency: "USD" },
          depositAmount: 100,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([])
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("shows error if insufficient funds", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { id: "g1", targetAmount: 1000, currency: "USD" },
          depositAmount: 100,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 50, currency: "USD" },
      ] as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("deposits successfully", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { id: "g1", targetAmount: 1000, currency: "USD" },
          depositAmount: 100,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 200, currency: "USD" },
      ] as any)
      mockDepositToGoal.mockResolvedValue({ success: true } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(mockDepositToGoal).toHaveBeenCalled()
      expect(sendSpy).toHaveBeenCalled()
      expect(mockShowGoalsMenu).toHaveBeenCalled()
    })

    test("handles deposit failure", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { id: "g1", targetAmount: 1000, currency: "USD" },
          depositAmount: 100,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 200, currency: "USD" },
      ] as any)
      mockDepositToGoal.mockResolvedValue({
        success: false,
        message: "Deposit failed",
      } as any)
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("handles starred account names", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { id: "g1", targetAmount: 1000, currency: "USD" },
          depositAmount: 100,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 200, currency: "USD" },
      ] as any)
      mockDepositToGoal.mockResolvedValue({ success: true } as any)
      await handleGoalDepositAccount(wizard, 1, "u1", "⭐ Cash (200 USD)")
      expect(mockDepositToGoal).toHaveBeenCalled()
    })

    test("handles payAmount field", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goal: { id: "g1", targetAmount: 1000, currency: "USD" },
          payAmount: 100,
        },
      }) as any
      mockGetBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 200, currency: "USD" },
      ] as any)
      mockDepositToGoal.mockResolvedValue({ success: true } as any)
      await handleGoalDepositAccount(wizard, 1, "u1", "Cash")
      expect(mockDepositToGoal).toHaveBeenCalled()
    })
  })
})
