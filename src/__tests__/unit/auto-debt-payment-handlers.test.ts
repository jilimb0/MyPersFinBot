import type { BotClient } from "@jilimb0/tgwrapper"
import { dbStorage } from "../../database/storage-db"
import {
  handleAutoPaymentAccountSelect,
  handleAutoPaymentAmountInput,
  handleAutoPaymentDaySelect,
  handleAutoPaymentToggle,
} from "../../handlers/auto-debt-payment-handlers"
import { t } from "../../i18n"
import { showDebtsMenu } from "../../menus-i18n"
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
  showDebtsMenu: jest.fn(),
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

const debt = {
  id: "d1",
  name: "Debt",
  counterparty: "Bob",
  type: "I_OWE",
  amount: 100,
  paidAmount: 0,
  currency: "USD",
} as any

describe("auto-debt-payment-handlers", () => {
  const lang = "en"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("toggle enable with no balances and with balances", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", { step: "DEBT_MENU", data: { debt }, lang })
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([])
    const res1 = await handleAutoPaymentToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.debt.enableAutoPayment")
    )
    expect(res1).toBe(true)
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash", currency: "USD" },
    ])

    const res2 = await handleAutoPaymentToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.debt.enableAutoPayment")
    )
    expect(res2).toBe(true)
  })

  test("toggle disable", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", { step: "DEBT_MENU", data: { debt }, lang })

    const res = await handleAutoPaymentToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.debt.disableAutoPayment")
    )
    expect(res).toBe(true)
    expect(updateMock).toHaveBeenCalled()
  })

  test("account select invalid and valid", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_PAYMENT_SELECT_ACCOUNT",
      data: { debt },
      lang,
    })

    const bad = await handleAutoPaymentAccountSelect(wizard, 1, "u1", "Bad")
    expect(bad).toBe(true)

    const ok = await handleAutoPaymentAccountSelect(
      wizard,
      1,
      "u1",
      "Cash (USD)"
    )
    expect(ok).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_PAYMENT_ENTER_AMOUNT")
  })

  test("amount input invalid/too large and valid", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_PAYMENT_ENTER_AMOUNT",
      data: { debt, autoPaymentAccountId: "Cash" },
      lang,
    })

    const bad = await handleAutoPaymentAmountInput(wizard, 1, "u1", "0")
    expect(bad).toBe(true)

    const tooLarge = await handleAutoPaymentAmountInput(wizard, 1, "u1", "1000")
    expect(tooLarge).toBe(true)

    const ok = await handleAutoPaymentAmountInput(wizard, 1, "u1", "10")
    expect(ok).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_PAYMENT_SELECT_DAY")
  })

  test("day select invalid and valid", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_PAYMENT_SELECT_DAY",
      data: {
        debt,
        autoPaymentAccountId: "Cash",
        autoPaymentAmount: 10,
      },
      lang,
    })

    const bad = await handleAutoPaymentDaySelect(wizard, 1, "u1", "0")
    expect(bad).toBe(true)

    const ok = await handleAutoPaymentDaySelect(wizard, 1, "u1", "15")
    expect(ok).toBe(true)
    expect(showDebtsMenu).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })
})
