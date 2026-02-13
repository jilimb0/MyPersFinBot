import type TelegramBot from "node-telegram-bot-api"
import { dbStorage } from "../../database/storage-db"
import {
  handleAutoIncomeAccountSelect,
  handleAutoIncomeAmountInput,
  handleAutoIncomeDaySelect,
  handleAutoIncomeToggle,
} from "../../handlers/auto-income-handlers"
import { t } from "../../i18n"
import { showIncomeSourcesMenu } from "../../menus-i18n"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getBalancesList: jest.fn(),
  },
}))

const updateMock = jest.fn()

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({ update: updateMock })),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showIncomeSourcesMenu: jest.fn(),
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

const source = {
  id: "s1",
  name: "Salary",
  currency: "USD",
} as any

describe("auto-income-handlers", () => {
  const lang = "en"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("toggle enable with no balances and with balances", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("u1", { step: "INCOME_MENU", data: { source }, lang })
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([])
    const res1 = await handleAutoIncomeToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.income.enableAutoIncome")
    )
    expect(res1).toBe(true)
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash", currency: "USD" },
    ])

    const res2 = await handleAutoIncomeToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.income.enableAutoIncome")
    )
    expect(res2).toBe(true)
  })

  test("toggle disable", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("u1", { step: "INCOME_MENU", data: { source }, lang })

    const res = await handleAutoIncomeToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.income.disableAutoIncome")
    )
    expect(res).toBe(true)
    expect(updateMock).toHaveBeenCalled()
  })

  test("account select invalid and valid", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_INCOME_SELECT_ACCOUNT",
      data: { source },
      lang,
    })

    const bad = await handleAutoIncomeAccountSelect(wizard, 1, "u1", "Bad")
    expect(bad).toBe(true)

    const ok = await handleAutoIncomeAccountSelect(
      wizard,
      1,
      "u1",
      "Cash (USD)"
    )
    expect(ok).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_INCOME_ENTER_AMOUNT")
  })

  test("amount input invalid and valid", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_INCOME_ENTER_AMOUNT",
      data: { source, autoIncomeAccountId: "Cash" },
      lang,
    })

    const bad = await handleAutoIncomeAmountInput(wizard, 1, "u1", "0")
    expect(bad).toBe(true)

    const ok = await handleAutoIncomeAmountInput(wizard, 1, "u1", "50")
    expect(ok).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_INCOME_SELECT_DAY")
  })

  test("day select invalid and valid", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_INCOME_SELECT_DAY",
      data: {
        source,
        autoIncomeAccountId: "Cash",
        autoIncomeAmount: 10,
      },
      lang,
    })

    const bad = await handleAutoIncomeDaySelect(wizard, 1, "u1", "0")
    expect(bad).toBe(true)

    const ok = await handleAutoIncomeDaySelect(wizard, 1, "u1", "15")
    expect(ok).toBe(true)
    expect(showIncomeSourcesMenu).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })
})
