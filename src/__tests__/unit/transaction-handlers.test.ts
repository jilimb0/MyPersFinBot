import * as handlers from "../../handlers/transaction-handlers"
import { IncomeCategory, InternalCategory, TransactionType } from "../../types"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    getBalancesList: jest.fn().mockResolvedValue([]),
    getBalanceAmount: jest.fn().mockResolvedValue(null),
    addTransaction: jest.fn().mockResolvedValue({ id: "tx1" }),
    applyExpenseToBudgets: jest.fn().mockResolvedValue({ overLimit: false }),
    setCategoryPreferredAccount: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock("../../validators", () => ({
  parseAmountWithCurrency: jest.fn(),
  validateExpenseCategory: jest.fn(),
  validateIncomeCategory: jest.fn(),
}))

jest.mock("../../wizards/helpers", () => ({
  resendCurrentStepPrompt: jest.fn(),
}))

jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn(),
  showBalancesMenu: jest.fn(),
}))

jest.mock("../../handlers/quick-actions-handlers", () => ({
  QuickActionsHandlers: {
    handleQuickCategory: jest
      .fn()
      .mockResolvedValue({ handled: false, showAllCategories: false }),
    showAllCategories: jest.fn().mockResolvedValue(undefined),
    handleQuickAccount: jest.fn().mockResolvedValue(false),
    getLastUsedAccount: jest.fn().mockResolvedValue(null),
  },
}))

import { dbStorage } from "../../database/storage-db"
import { QuickActionsHandlers } from "../../handlers/quick-actions-handlers"
import { showBalancesMenu, showMainMenu } from "../../menus-i18n"

const validators = jest.requireMock("../../validators")
const helpers = jest.requireMock("../../wizards/helpers")

class MockWizard {
  private state: any
  sendMessage = jest.fn().mockResolvedValue({})
  goToStep = jest.fn().mockResolvedValue(undefined)

  constructor(state: any) {
    this.state = state
  }
  getState() {
    return this.state
  }
  setState(_userId: string, newState: any) {
    this.state = newState
  }
  clearState() {
    this.state = null
  }
  getBot() {
    return {}
  }
  getBackButton() {
    return {}
  }
}

describe("Transaction handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
  })

  describe("handleTxCategory", () => {
    test("returns false when no state", async () => {
      const wizard = new MockWizard(null)
      const result = await handlers.handleTxCategory(
        wizard as any,
        1,
        "u1",
        "Food"
      )
      expect(result).toBe(false)
    })

    test("shows all categories when quick result says so", async () => {
      ;(
        QuickActionsHandlers.handleQuickCategory as jest.Mock
      ).mockResolvedValueOnce({
        showAllCategories: true,
        handled: false,
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      const result = await handlers.handleTxCategory(
        wizard as any,
        1,
        "u1",
        "All"
      )
      expect(QuickActionsHandlers.showAllCategories).toHaveBeenCalled()
      expect(wizard.getState().data.showedAllCategories).toBe(true)
      expect(result).toBe(true)
    })

    test("returns early when quick handled", async () => {
      ;(
        QuickActionsHandlers.handleQuickCategory as jest.Mock
      ).mockResolvedValueOnce({
        showAllCategories: false,
        handled: true,
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      const result = await handlers.handleTxCategory(
        wizard as any,
        1,
        "u1",
        "Food"
      )
      expect(result).toBe(true)
    })

    test("shows error for invalid expense category", async () => {
      ;(
        QuickActionsHandlers.handleQuickCategory as jest.Mock
      ).mockResolvedValueOnce({
        showAllCategories: false,
        handled: false,
      })
      validators.validateExpenseCategory.mockReturnValue(null)
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      await handlers.handleTxCategory(wizard as any, 1, "u1", "InvalidCat")
      expect(wizard.sendMessage).toHaveBeenCalled()
      expect(wizard.getState().data.showedAllCategories).toBe(true)
    })

    test("proceeds to account step for valid expense category", async () => {
      ;(
        QuickActionsHandlers.handleQuickCategory as jest.Mock
      ).mockResolvedValueOnce({
        showAllCategories: false,
        handled: false,
      })
      validators.validateExpenseCategory.mockReturnValue("FOOD_DINING")
      ;(
        QuickActionsHandlers.handleQuickAccount as jest.Mock
      ).mockResolvedValueOnce(false)
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      await handlers.handleTxCategory(wizard as any, 1, "u1", "Food")
      expect(wizard.goToStep).toHaveBeenCalledWith("u1", "TX_ACCOUNT", {
        category: "FOOD_DINING",
      })
    })

    test("proceeds to account step for valid income category", async () => {
      ;(
        QuickActionsHandlers.handleQuickCategory as jest.Mock
      ).mockResolvedValueOnce({
        showAllCategories: false,
        handled: false,
      })
      validators.validateIncomeCategory.mockReturnValue(IncomeCategory.SALARY)
      ;(
        QuickActionsHandlers.handleQuickAccount as jest.Mock
      ).mockResolvedValueOnce(false)
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.INCOME },
      })
      await handlers.handleTxCategory(wizard as any, 1, "u1", "Salary")
      expect(wizard.goToStep).toHaveBeenCalled()
    })

    test("clears showedAllCategories after goToStep", async () => {
      ;(
        QuickActionsHandlers.handleQuickCategory as jest.Mock
      ).mockResolvedValueOnce({
        showAllCategories: false,
        handled: false,
      })
      validators.validateExpenseCategory.mockReturnValue("FOOD_DINING")
      ;(
        QuickActionsHandlers.handleQuickAccount as jest.Mock
      ).mockResolvedValueOnce(false)
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE, showedAllCategories: true },
      })
      await handlers.handleTxCategory(wizard as any, 1, "u1", "Food")
      expect(wizard.goToStep).toHaveBeenCalled()
    })
  })

  describe("handleTxAmount", () => {
    test("shows error for invalid amount", async () => {
      validators.parseAmountWithCurrency.mockReturnValue(null)
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "abc")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("handles negative expense as refund", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({
        amount: -50,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "-50")
      expect(wizard.sendMessage).toHaveBeenCalled()
      expect(wizard.goToStep).toHaveBeenCalledWith("u1", "TX_CONFIRM_REFUND", {
        amount: 50,
        currency: "USD",
      })
    })

    test("rejects negative income", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({
        amount: -100,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.INCOME },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "-100")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("rejects negative transfer", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({
        amount: -10,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.TRANSFER },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "-10")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("sets transfer step for positive transfer amount", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({
        amount: 100,
        currency: "EUR",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.TRANSFER },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "100")
      expect(wizard.goToStep).toHaveBeenCalledWith("u1", "TX_ACCOUNT", {
        amount: 100,
        currency: "EUR",
        category: InternalCategory.TRANSFER,
      })
      expect(helpers.resendCurrentStepPrompt).toHaveBeenCalled()
    })

    test("sets category step for positive expense", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({
        amount: 25,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "25")
      expect(wizard.goToStep).toHaveBeenCalledWith("u1", "TX_CATEGORY", {
        amount: 25,
        currency: "USD",
      })
      expect(helpers.resendCurrentStepPrompt).toHaveBeenCalled()
    })

    test("clears previous state flags", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({
        amount: 50,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          topCategoriesShown: true,
          accountsShown: true,
          toAccountsShown: true,
          showedAllCategories: true,
        },
      })
      await handlers.handleTxAmount(wizard as any, 1, "u1", "50")
      const state = wizard.getState()
      expect(state.data.topCategoriesShown).toBeUndefined()
      expect(state.data.accountsShown).toBeUndefined()
      expect(state.data.toAccountsShown).toBeUndefined()
      expect(state.data.showedAllCategories).toBeUndefined()
    })
  })

  describe("handleTxAccount", () => {
    test("returns false when no state", async () => {
      const wizard = new MockWizard(null)
      const result = await handlers.handleTxAccount(
        wizard as any,
        1,
        "u1",
        "Cash"
      )
      expect(result).toBe(false)
    })

    test("shows accounts list first time", async () => {
      ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Select account")
      expect(dbStorage.getBalancesList).toHaveBeenCalled()
      expect(wizard.sendMessage).toHaveBeenCalled()
      expect(wizard.getState().data.accountsShown).toBe(true)
    })

    test("shows only positive balances for transfer", async () => {
      ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValue([
        { accountId: "Cash", amount: 0, currency: "USD" },
        { accountId: "Card", amount: -10, currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.TRANSFER },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Select")
      expect(wizard.sendMessage).toHaveBeenCalled()
      expect(wizard.getState()).toBeNull()
    })

    test("shows last used account with star", async () => {
      ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
        { accountId: "Card", amount: 50, currency: "USD" },
      ])
      ;(QuickActionsHandlers.getLastUsedAccount as jest.Mock).mockResolvedValue(
        "Cash"
      )
      const wizard = new MockWizard({
        lang: "en",
        data: { txType: TransactionType.EXPENSE, category: "FOOD_DINING" },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Select")
      expect(QuickActionsHandlers.getLastUsedAccount).toHaveBeenCalled()
    })

    test("shows error when account not found", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue(null)
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 50,
          currency: "USD",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Unknown (USD)")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("shows error for currency mismatch", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 100,
        currency: "EUR",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 50,
          currency: "USD",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Cash (EUR)")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("shows error for insufficient funds", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 10,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 50,
          currency: "USD",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Cash (USD)")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("processes refund as income transaction", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 100,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 30,
          currency: "USD",
          isRefund: true,
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Cash (USD)")
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(showMainMenu).toHaveBeenCalled()
      expect(wizard.getState()).toBeNull()
    })

    test("goes to to-account step for transfer", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 200,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.TRANSFER,
          accountsShown: true,
          amount: 50,
          currency: "USD",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Cash (USD)")
      expect(wizard.goToStep).toHaveBeenCalledWith("u1", "TX_TO_ACCOUNT", {
        fromAccountId: "Cash",
      })
    })

    test("warns about budget exceeded", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 500,
        currency: "USD",
      })
      ;(dbStorage.applyExpenseToBudgets as jest.Mock).mockResolvedValue({
        overLimit: true,
        limit: 100,
        remaining: -50,
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 150,
          currency: "USD",
          category: "FOOD_DINING",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Cash (USD)")
      expect(wizard.sendMessage).toHaveBeenCalled()
      expect(dbStorage.addTransaction).toHaveBeenCalled()
    })

    test("adds expense transaction successfully", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 500,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 25,
          currency: "USD",
          category: "FOOD_DINING",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Cash (USD)")
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(dbStorage.setCategoryPreferredAccount).toHaveBeenCalled()
      expect(wizard.getState()).toBeNull()
    })

    test("adds income transaction successfully", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 100,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.INCOME,
          accountsShown: true,
          amount: 1000,
          currency: "USD",
          category: IncomeCategory.SALARY,
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "Card (USD)")
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(dbStorage.setCategoryPreferredAccount).toHaveBeenCalled()
    })

    test("handles account with star prefix", async () => {
      ;(dbStorage.getBalanceAmount as jest.Mock).mockResolvedValue({
        amount: 100,
        currency: "USD",
      })
      const wizard = new MockWizard({
        lang: "en",
        data: {
          txType: TransactionType.EXPENSE,
          accountsShown: true,
          amount: 20,
          currency: "USD",
          category: "FOOD_DINING",
        },
      })
      await handlers.handleTxAccount(wizard as any, 1, "u1", "⭐ Cash (USD)")
      expect(dbStorage.getBalanceAmount).toHaveBeenCalledWith("u1", "Cash")
      expect(dbStorage.addTransaction).toHaveBeenCalled()
    })
  })

  describe("handleTxToAccount", () => {
    test("returns false when no state", async () => {
      const wizard = new MockWizard(null)
      const result = await handlers.handleTxToAccount(
        wizard as any,
        1,
        "u1",
        "Card"
      )
      expect(result).toBe(false)
    })

    test("shows to-accounts list first time", async () => {
      ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
        { accountId: "Card", amount: 50, currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: {
          fromAccountId: "Cash",
          amount: 50,
          currency: "USD",
        },
      })
      await handlers.handleTxToAccount(wizard as any, 1, "u1", "Select")
      expect(dbStorage.getBalancesList).toHaveBeenCalled()
      expect(wizard.sendMessage).toHaveBeenCalled()
      expect(wizard.getState().data.toAccountsShown).toBe(true)
    })

    test("filters out source account from list", async () => {
      ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValue([
        { accountId: "Cash", amount: 100, currency: "USD" },
        { accountId: "Card", amount: 50, currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: {
          fromAccountId: "Cash",
        },
      })
      await handlers.handleTxToAccount(wizard as any, 1, "u1", "Select")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("shows error for same account transfer", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          toAccountsShown: true,
          fromAccountId: "Cash",
          amount: 50,
          currency: "USD",
        },
      })
      await handlers.handleTxToAccount(wizard as any, 1, "u1", "Cash (USD)")
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("creates transfer transaction successfully", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          toAccountsShown: true,
          fromAccountId: "Cash",
          amount: 75,
          currency: "USD",
        },
      })
      await handlers.handleTxToAccount(wizard as any, 1, "u1", "Card (USD)")
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(showBalancesMenu).toHaveBeenCalled()
      expect(wizard.getState()).toBeNull()
    })
  })
})
