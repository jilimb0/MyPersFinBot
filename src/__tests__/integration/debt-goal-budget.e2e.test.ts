import type { BotClient } from "@jilimb0/tgwrapper"
import { getExpenseCategoryLabel, t } from "../../i18n"
import { ExpenseCategory } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getUserData: jest.fn(),
    addGoal: jest.fn(),
    getCategoryBudgets: jest.fn(),
    setCategoryBudget: jest.fn(),
    clearCategoryBudget: jest.fn(),
    getBalancesList: jest.fn(),
    updateDebtAmount: jest.fn(),
    getDebtById: jest.fn(),
    depositToGoal: jest.fn(),
    updateGoalDeadline: jest.fn(),
    updateGoalTargetAmount: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(null),
    })),
  },
}))
jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    createGoalReminder: jest.fn(),
    deleteRemindersForEntity: jest.fn(),
  },
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
const mockGetCategoryBudgets =
  dbStorage.getCategoryBudgets as jest.MockedFunction<
    typeof dbStorage.getCategoryBudgets
  >
const mockSetCategoryBudget =
  dbStorage.setCategoryBudget as jest.MockedFunction<
    typeof dbStorage.setCategoryBudget
  >
const mockClearCategoryBudget =
  dbStorage.clearCategoryBudget as jest.MockedFunction<
    typeof dbStorage.clearCategoryBudget
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
const mockDepositToGoal = dbStorage.depositToGoal as jest.MockedFunction<
  typeof dbStorage.depositToGoal
>
const mockUpdateGoalDeadline =
  dbStorage.updateGoalDeadline as jest.MockedFunction<
    typeof dbStorage.updateGoalDeadline
  >
const mockUpdateGoalTargetAmount =
  dbStorage.updateGoalTargetAmount as jest.MockedFunction<
    typeof dbStorage.updateGoalTargetAmount
  >

describe("E2E debt/goal/budget flows", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetUserData.mockResolvedValue({
      balances: [],
      transactions: [],
      debts: [],
      goals: [],
      budgets: [],
      incomeSources: [],
      templates: [],
      defaultCurrency: "USD",
    })
    mockGetCategoryBudgets.mockResolvedValue({})
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 500,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
    ])
    mockUpdateDebtAmount.mockResolvedValue({ success: true })
    mockGetDebtById.mockResolvedValue({
      id: "debt-1",
      name: "John",
      amount: 100,
      paidAmount: 20,
      currency: "USD",
      type: "I_OWE",
      counterparty: "John",
      isPaid: false,
    })
    mockDepositToGoal.mockResolvedValue({ success: true })
    mockUpdateGoalDeadline.mockResolvedValue()
    mockUpdateGoalTargetAmount.mockResolvedValue()
  })

  test("debt add flow: type -> details -> ask due date", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 401
    const lang = "uk"

    wizard.setState(userId, {
      step: "DEBT_TYPE",
      data: {},
      returnTo: "debts",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, t(lang, "buttons.iOwe"))

    let state = wizard.getState(userId)
    expect(state?.step).toBe("DEBT_CREATE_DETAILS")

    await wizard.handleWizardInput(chatId, userId, "John 100")

    state = wizard.getState(userId)
    expect(state?.step).toBe("DEBT_ASK_DUE_DATE")
  })

  test("goal add flow: input -> ask deadline", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-2"
    const chatId = 402
    const lang = "uk"

    wizard.setState(userId, {
      step: "GOAL_INPUT",
      data: {},
      returnTo: "goals",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "Laptop 2000")

    const state = wizard.getState(userId)
    expect(state?.step).toBe("GOAL_ASK_DEADLINE")
    expect(mockAddGoal).toHaveBeenCalled()
  })

  test("budget flow: menu -> select category -> set limit", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-3"
    const chatId = 403
    const lang = "uk"

    wizard.setState(userId, {
      step: "BUDGET_MENU",
      data: {},
      returnTo: "budgets",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "buttons.addEditBudget")
    )

    let state = wizard.getState(userId)
    expect(state?.step).toBe("BUDGET_SELECT_CATEGORY")

    const categoryLabel = getExpenseCategoryLabel(
      lang,
      ExpenseCategory.FOOD_DINING,
      "short"
    )

    await wizard.handleWizardInput(chatId, userId, categoryLabel)
    state = wizard.getState(userId)
    expect(state?.step).toBe("BUDGET_CATEGORY_MENU")

    await wizard.handleWizardInput(chatId, userId, "100")
    expect(mockSetCategoryBudget).toHaveBeenCalledWith(
      userId,
      ExpenseCategory.FOOD_DINING,
      100,
      "USD"
    )
  })

  test("debt partial payment flow: amount -> account -> update", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-4"
    const chatId = 404
    const lang = "uk"

    wizard.setState(userId, {
      step: "DEBT_PARTIAL_AMOUNT",
      data: {
        debt: {
          id: "debt-1",
          name: "John",
          amount: 100,
          paidAmount: 0,
          currency: "USD",
          type: "I_OWE",
          counterparty: "John",
          isPaid: false,
        },
      },
      returnTo: "debts",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "20")
    let state = wizard.getState(userId)
    expect(state?.step).toBe("DEBT_PARTIAL_ACCOUNT")

    await wizard.handleWizardInput(chatId, userId, "Cash")
    state = wizard.getState(userId)
    expect(state).toBeUndefined()
    expect(mockUpdateDebtAmount).toHaveBeenCalledWith(
      userId,
      "debt-1",
      20,
      "Cash",
      "USD"
    )
  })

  test("debt full payment flow: closes debt when remaining is zero", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-4b"
    const chatId = 4041
    const lang = "uk"

    mockGetDebtById.mockResolvedValueOnce({
      id: "debt-2",
      name: "Alice",
      amount: 100,
      paidAmount: 100,
      currency: "USD",
      type: "I_OWE",
      counterparty: "Alice",
      isPaid: true,
    })

    wizard.setState(userId, {
      step: "DEBT_PARTIAL_AMOUNT",
      data: {
        debt: {
          id: "debt-2",
          name: "Alice",
          amount: 100,
          paidAmount: 0,
          currency: "USD",
          type: "I_OWE",
          counterparty: "Alice",
          isPaid: false,
        },
      },
      returnTo: "debts",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "100")
    await wizard.handleWizardInput(chatId, userId, "Cash")

    expect(mockUpdateDebtAmount).toHaveBeenCalledWith(
      userId,
      "debt-2",
      100,
      "Cash",
      "USD"
    )
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("goal deposit flow: amount -> account -> deposit", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-5"
    const chatId = 405
    const lang = "uk"

    wizard.setState(userId, {
      step: "GOAL_DEPOSIT_AMOUNT",
      data: {
        goal: {
          id: "goal-1",
          name: "Laptop",
          targetAmount: 1000,
          currentAmount: 0,
          currency: "USD",
          status: "IN_PROGRESS",
        },
      },
      returnTo: "goals",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "50")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("GOAL_DEPOSIT_ACCOUNT")

    await wizard.handleWizardInput(chatId, userId, "Cash")
    expect(mockDepositToGoal).toHaveBeenCalledWith(
      userId,
      "goal-1",
      50,
      "Cash",
      "USD"
    )
  })

  test("goal complete flow: confirm complete closes goal when remaining is zero", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-5b"
    const chatId = 4051
    const lang = "uk"

    mockGetUserData.mockResolvedValueOnce({
      balances: [],
      transactions: [],
      debts: [],
      goals: [
        {
          id: "goal-2",
          name: "Phone",
          targetAmount: 100,
          currentAmount: 100,
          currency: "USD",
          status: "ACTIVE",
        },
      ],
      budgets: [],
      incomeSources: [],
      templates: [],
      defaultCurrency: "USD",
    })

    wizard.setState(userId, {
      step: "GOAL_COMPLETE_CONFIRM",
      data: {
        goal: {
          id: "goal-2",
          name: "Phone",
          targetAmount: 100,
          currentAmount: 100,
          currency: "USD",
          status: "ACTIVE",
        },
        newTargetAmount: 100,
      },
      returnTo: "goals",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "wizard.goal.confirmCompleteYes")
    )

    expect(mockUpdateGoalTargetAmount).toHaveBeenCalledWith(
      userId,
      "goal-2",
      100
    )
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("goal deadline change flow: set new date", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-5c"
    const chatId = 4052
    const lang = "uk"

    wizard.setState(userId, {
      step: "GOAL_EDIT_DEADLINE",
      data: {
        goal: {
          id: "goal-3",
          name: "Trip",
          targetAmount: 500,
          currentAmount: 100,
          currency: "USD",
          status: "ACTIVE",
        },
      },
      returnTo: "goals",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "31.12.2099")
    expect(mockUpdateGoalDeadline).toHaveBeenCalledWith(
      userId,
      "goal-3",
      expect.any(Date)
    )
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("budget flow: clear limit", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-6"
    const chatId = 406
    const lang = "uk"

    wizard.setState(userId, {
      step: "BUDGET_CATEGORY_MENU",
      data: { category: ExpenseCategory.TRANSPORTATION },
      returnTo: "budgets",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "buttons.clearLimit")
    )
    expect(mockClearCategoryBudget).toHaveBeenCalledWith(
      userId,
      ExpenseCategory.TRANSPORTATION
    )
  })

  test("budget flow: edit limit with currency", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-7"
    const chatId = 407
    const lang = "uk"

    wizard.setState(userId, {
      step: "BUDGET_CATEGORY_MENU",
      data: { category: ExpenseCategory.ENTERTAINMENT },
      returnTo: "budgets",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "120 EUR")
    expect(mockSetCategoryBudget).toHaveBeenCalledWith(
      userId,
      ExpenseCategory.ENTERTAINMENT,
      120,
      "EUR"
    )
  })
})
