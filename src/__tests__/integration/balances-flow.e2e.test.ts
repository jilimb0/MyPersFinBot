import type TelegramBot from "node-telegram-bot-api"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    getBalance: jest.fn(),
    addBalance: jest.fn(),
    renameBalance: jest.fn(),
    safeUpdateBalance: jest.fn(),
    deleteBalance: jest.fn(),
    addTransaction: jest.fn(),
    convertBalanceAmount: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockGetBalance = dbStorage.getBalance as jest.MockedFunction<
  typeof dbStorage.getBalance
>
const mockAddBalance = dbStorage.addBalance as jest.MockedFunction<
  typeof dbStorage.addBalance
>
const mockRenameBalance = dbStorage.renameBalance as jest.MockedFunction<
  typeof dbStorage.renameBalance
>
const mockSafeUpdateBalance =
  dbStorage.safeUpdateBalance as jest.MockedFunction<
    typeof dbStorage.safeUpdateBalance
  >
const mockDeleteBalance = dbStorage.deleteBalance as jest.MockedFunction<
  typeof dbStorage.deleteBalance
>
const mockAddTransaction = dbStorage.addTransaction as jest.MockedFunction<
  typeof dbStorage.addTransaction
>
const mockConvertBalanceAmount =
  dbStorage.convertBalanceAmount as jest.MockedFunction<
    typeof dbStorage.convertBalanceAmount
  >

describe("E2E balances flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 100,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
      {
        accountId: "Card",
        amount: 50,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
    ])
    mockGetBalance.mockResolvedValue({
      accountId: "Cash",
      amount: 100,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    })
  })

  test("add balance flow: list -> create", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-b1"
    const chatId = 501
    const lang = "uk"

    wizard.setState(userId, {
      step: "BALANCE_LIST",
      data: {},
      returnTo: "balances",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "buttons.addBalance")
    )
    let state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_CREATE")

    mockGetBalance.mockResolvedValueOnce(undefined)
    await wizard.handleWizardInput(chatId, userId, "Cash 100 USD")
    expect(mockAddBalance).toHaveBeenCalledWith(userId, {
      accountId: "Cash",
      amount: 100,
      currency: "USD",
    })
    state = wizard.getState(userId)
    expect(state).toBeUndefined()
  })

  test("rename balance flow: edit -> confirm rename", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-b2"
    const chatId = 502
    const lang = "uk"

    wizard.setState(userId, {
      step: "BALANCE_EDIT_MENU",
      data: { accountId: "Cash", currency: "USD", currentAmount: 100 },
      returnTo: "balances",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, "Wallet")
    const state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_CONFIRM_RENAME")

    await wizard.handleWizardInput(chatId, userId, t(lang, "common.yes"))
    expect(mockRenameBalance).toHaveBeenCalledWith(
      userId,
      "Cash",
      "USD",
      "Wallet"
    )
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("delete balance transfer flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-b3"
    const chatId = 503
    const lang = "uk"

    wizard.setState(userId, {
      step: "BALANCE_EDIT_MENU",
      data: { accountId: "Cash", currency: "USD", currentAmount: 100 },
      returnTo: "balances",
      lang,
    })

    await wizard.handleWizardInput(chatId, userId, t(lang, "common.delete"))
    let state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_DELETE_CONFIRM")

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "balances.transferToAnother")
    )
    state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_DELETE_SELECT_TARGET")

    await wizard.handleWizardInput(chatId, userId, "Card USD")
    expect(mockAddTransaction).toHaveBeenCalled()
    expect(mockSafeUpdateBalance).toHaveBeenCalledWith(
      userId,
      "Cash",
      -100,
      "USD"
    )
    expect(mockSafeUpdateBalance).toHaveBeenCalledWith(
      userId,
      "Card",
      100,
      "USD"
    )
    expect(mockDeleteBalance).toHaveBeenCalledWith(userId, "Cash", "USD")
    expect(wizard.getState(userId)).toBeUndefined()
  })

  test("set balance to zero transfer flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-b4"
    const chatId = 504
    const lang = "uk"

    wizard.setState(userId, {
      step: "BALANCE_EDIT_MENU",
      data: { accountId: "Cash", currency: "USD", currentAmount: 100 },
      returnTo: "balances",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "balances.setToZero")
    )
    let state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_SET_ZERO_CONFIRM")

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "balances.transferToAnother")
    )
    state = wizard.getState(userId)
    expect(state?.step).toBe("BALANCE_ZERO_SELECT_TARGET")

    await wizard.handleWizardInput(chatId, userId, "Card USD")
    expect(mockConvertBalanceAmount).toHaveBeenCalledWith(
      userId,
      "Cash",
      "USD",
      0
    )
    expect(mockSafeUpdateBalance).toHaveBeenCalledWith(
      userId,
      "Card",
      100,
      "USD"
    )
    expect(wizard.getState(userId)).toBeUndefined()
  })
})
