import type { BotClient } from "@jilimb0/tgwrapper"
import { dbStorage } from "../../database/storage-db"
import {
  handleAutoDepositAccountSelect,
  handleAutoDepositAmountInput,
  handleAutoDepositDayMonthlySelect,
  handleAutoDepositDayWeeklySelect,
  handleAutoDepositFrequencySelect,
  handleAutoDepositToggle,
} from "../../handlers/auto-deposit-handlers"
import { t } from "../../i18n"
import { showGoalsMenu } from "../../menus-i18n"
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
  showGoalsMenu: jest.fn(),
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

const goal = {
  id: "g1",
  name: "Goal",
  currency: "USD",
} as any

describe("auto-deposit-handlers", () => {
  const lang = "en"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("toggle enable with no balances and with balances", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", { step: "GOAL_MENU", data: { goal }, lang })
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([])
    const res1 = await handleAutoDepositToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.goal.enableAutoDeposit")
    )
    expect(res1).toBe(true)
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash", currency: "USD" },
    ])

    const res2 = await handleAutoDepositToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.goal.enableAutoDeposit")
    )
    expect(res2).toBe(true)
  })

  test("toggle disable", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", { step: "GOAL_MENU", data: { goal }, lang })

    const res = await handleAutoDepositToggle(
      wizard,
      1,
      "u1",
      t(lang, "wizard.goal.disableAutoDeposit")
    )
    expect(res).toBe(true)
    expect(updateMock).toHaveBeenCalled()
  })

  test("account select invalid and valid", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_DEPOSIT_SELECT_ACCOUNT",
      data: { goal },
      lang,
    })

    const bad = await handleAutoDepositAccountSelect(wizard, 1, "u1", "Bad")
    expect(bad).toBe(true)

    const ok = await handleAutoDepositAccountSelect(
      wizard,
      1,
      "u1",
      "Cash (USD)"
    )
    expect(ok).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_DEPOSIT_ENTER_AMOUNT")
  })

  test("amount input invalid and valid", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_DEPOSIT_ENTER_AMOUNT",
      data: { goal, autoDepositAccountId: "Cash" },
      lang,
    })

    const bad = await handleAutoDepositAmountInput(wizard, 1, "u1", "0")
    expect(bad).toBe(true)

    const ok = await handleAutoDepositAmountInput(wizard, 1, "u1", "50")
    expect(ok).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_DEPOSIT_SELECT_FREQUENCY")
  })

  test("frequency select weekly/monthly", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_DEPOSIT_SELECT_FREQUENCY",
      data: { goal, autoDepositAccountId: "Cash", autoDepositAmount: 10 },
      lang,
    })

    const weekly = await handleAutoDepositFrequencySelect(
      wizard,
      1,
      "u1",
      t(lang, "buttons.weekly")
    )
    expect(weekly).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_DEPOSIT_SELECT_DAY_WEEKLY")

    wizard.setState("u1", {
      step: "AUTO_DEPOSIT_SELECT_FREQUENCY",
      data: { goal, autoDepositAccountId: "Cash", autoDepositAmount: 10 },
      lang,
    })

    const monthly = await handleAutoDepositFrequencySelect(
      wizard,
      1,
      "u1",
      t(lang, "buttons.monthly")
    )
    expect(monthly).toBe(true)
    expect(wizard.getState("u1")?.step).toBe("AUTO_DEPOSIT_SELECT_DAY_MONTHLY")
  })

  test("weekly and monthly day select", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("u1", {
      step: "AUTO_DEPOSIT_SELECT_DAY_WEEKLY",
      data: {
        goal,
        autoDepositAccountId: "Cash",
        autoDepositAmount: 10,
      },
      lang,
    })

    const badWeekly = await handleAutoDepositDayWeeklySelect(
      wizard,
      1,
      "u1",
      "Nope"
    )
    expect(badWeekly).toBe(true)

    const okWeekly = await handleAutoDepositDayWeeklySelect(
      wizard,
      1,
      "u1",
      t(lang, "wizard.days.Monday")
    )
    expect(okWeekly).toBe(true)
    expect(showGoalsMenu).toHaveBeenCalled()

    wizard.setState("u1", {
      step: "AUTO_DEPOSIT_SELECT_DAY_MONTHLY",
      data: {
        goal,
        autoDepositAccountId: "Cash",
        autoDepositAmount: 10,
      },
      lang,
    })

    const badMonthly = await handleAutoDepositDayMonthlySelect(
      wizard,
      1,
      "u1",
      "0"
    )
    expect(badMonthly).toBe(true)

    const okMonthly = await handleAutoDepositDayMonthlySelect(
      wizard,
      1,
      "u1",
      "15"
    )
    expect(okMonthly).toBe(true)
    expect(showGoalsMenu).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })
})
