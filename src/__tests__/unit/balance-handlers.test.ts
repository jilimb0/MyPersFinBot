import * as handlers from "../../handlers/balance-handlers"
import { t } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalance: jest.fn(),
    addBalance: jest.fn(),
    getBalancesList: jest.fn(),
    safeUpdateBalance: jest.fn(),
    renameBalance: jest.fn(),
    convertBalanceAmount: jest.fn(),
    deleteBalance: jest.fn(),
    addTransaction: jest.fn(),
  },
}))

jest.mock("../../validators", () => ({
  parseBalanceInput: jest.fn(),
  parseAmountWithCurrency: jest.fn(),
  getValidationErrorMessage: jest.fn(() => "invalid"),
}))

jest.mock("../../menus-i18n", () => ({
  showBalancesMenu: jest.fn(),
}))

const { dbStorage } = jest.requireMock("../../database/storage-db")
const validators = jest.requireMock("../../validators")
const { showBalancesMenu } = jest.requireMock("../../menus-i18n")

class MockWizard {
  private state: any
  constructor(state: any) {
    this.state = state
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
  getBot() {
    return {}
  }
  getBackButton() {
    return {}
  }
  async sendMessage() {}
  async goToStep() {}
}

describe("balance-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dbStorage.getDefaultCurrency.mockResolvedValue("USD")
    dbStorage.getBalancesList.mockResolvedValue([])
  })

  describe("handleBalanceCreate", () => {
    test("creates without currency when matches", async () => {
      validators.parseBalanceInput.mockReturnValue(null)
      const wizard = new MockWizard({})
      await handlers.handleBalanceCreate(
        wizard as any,
        1,
        "u1",
        "Cash 10",
        "en"
      )
      expect(dbStorage.addBalance).toHaveBeenCalled()
      expect(showBalancesMenu).toHaveBeenCalled()
    })

    test("rejects duplicate without currency", async () => {
      validators.parseBalanceInput.mockReturnValue(null)
      dbStorage.getBalance.mockResolvedValue({ amount: 5 })
      const wizard = new MockWizard({})
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handlers.handleBalanceCreate(
        wizard as any,
        1,
        "u1",
        "Cash 10",
        "en"
      )
      expect(sendSpy).toHaveBeenCalled()
      expect(dbStorage.addBalance).not.toHaveBeenCalled()
    })

    test("creates when only name provided", async () => {
      validators.parseBalanceInput.mockReturnValue(null)
      dbStorage.getBalance.mockResolvedValue(null)
      const wizard = new MockWizard({})
      await handlers.handleBalanceCreate(wizard as any, 1, "u1", "Wallet", "en")
      expect(dbStorage.addBalance).toHaveBeenCalled()
    })

    test("invalid input sends validation error", async () => {
      validators.parseBalanceInput.mockReturnValue(null)
      const wizard = new MockWizard({})
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handlers.handleBalanceCreate(
        wizard as any,
        1,
        "u1",
        "123 abc",
        "en"
      )
      expect(sendSpy).toHaveBeenCalledWith(1, "invalid", expect.anything())
    })

    test("creates with parsed input", async () => {
      validators.parseBalanceInput.mockReturnValue({
        accountId: "Card",
        amount: 100,
        currency: "USD",
      })
      dbStorage.getBalance.mockResolvedValue(null)
      const wizard = new MockWizard({})
      await handlers.handleBalanceCreate(
        wizard as any,
        1,
        "u1",
        "Card 100 USD",
        "en"
      )
      expect(dbStorage.addBalance).toHaveBeenCalled()
    })
  })

  describe("handleBalanceSelection", () => {
    test("returns false if no state", async () => {
      const wizard = new MockWizard(null)
      await expect(
        handlers.handleBalanceSelection(wizard as any, 1, "u1", "Cash (USD)")
      ).resolves.toBe(false)
    })

    test("returns false on invalid format", async () => {
      const wizard = new MockWizard({ lang: "en" })
      await expect(
        handlers.handleBalanceSelection(wizard as any, 1, "u1", "Cash")
      ).resolves.toBe(false)
    })

    test("not found shows error", async () => {
      dbStorage.getBalance.mockResolvedValue(null)
      const wizard = new MockWizard({ lang: "en" })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handlers.handleBalanceSelection(
        wizard as any,
        1,
        "u1",
        "Cash (USD)"
      )
      expect(sendSpy).toHaveBeenCalledWith(
        1,
        t("en", "errors.notFound"),
        expect.anything()
      )
    })

    test("found balance shows edit menu", async () => {
      dbStorage.getBalance.mockResolvedValue({ amount: 10 })
      const wizard = new MockWizard({ lang: "en" })
      const goSpy = jest.spyOn(wizard, "goToStep")
      await handlers.handleBalanceSelection(
        wizard as any,
        1,
        "u1",
        "Cash (USD)"
      )
      expect(goSpy).toHaveBeenCalled()
    })
  })

  describe("handleBalanceEditMenu", () => {
    test("back returns to balances menu", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", currentAmount: 10 },
      })
      await handlers.handleBalanceEditMenu(
        wizard as any,
        1,
        "u1",
        t("en", "common.back")
      )
      expect(showBalancesMenu).toHaveBeenCalled()
    })

    test("set to zero path with other balances", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", currency: "USD" },
        { accountId: "Card", currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", currentAmount: 10 },
      })
      const goSpy = jest.spyOn(wizard, "goToStep")
      await handlers.handleBalanceEditMenu(
        wizard as any,
        1,
        "u1",
        t("en", "balances.setToZero")
      )
      expect(goSpy).toHaveBeenCalled()
    })

    test("delete path", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", currentAmount: 0 },
      })
      await handlers.handleBalanceEditMenu(
        wizard as any,
        1,
        "u1",
        t("en", "common.delete")
      )
      expect(wizard.getState().data.accountId).toBe("Cash")
    })

    test("numeric input goes to confirm amount", async () => {
      validators.parseAmountWithCurrency.mockReturnValue({ amount: 20 })
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", currentAmount: 10 },
      })
      const goSpy = jest.spyOn(wizard, "goToStep")
      await handlers.handleBalanceEditMenu(wizard as any, 1, "u1", "20")
      expect(goSpy).toHaveBeenCalledWith("u1", "BALANCE_CONFIRM_AMOUNT", {
        accountId: "Cash",
        currency: "USD",
        newAmount: 20,
        currentAmount: 10,
      })
    })

    test("rename duplicate rejected", async () => {
      validators.parseAmountWithCurrency.mockReturnValue(null)
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "New", currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", currentAmount: 10 },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handlers.handleBalanceEditMenu(wizard as any, 1, "u1", "New")
      expect(sendSpy).toHaveBeenCalled()
    })
  })

  describe("handleBalanceConfirmAmount", () => {
    test("yes updates balance", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", newAmount: 20 },
      })
      await handlers.handleBalanceConfirmAmount(
        wizard as any,
        1,
        "u1",
        t("en", "common.yes")
      )
      expect(dbStorage.safeUpdateBalance).toHaveBeenCalled()
    })

    test("no returns to edit menu", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          newAmount: 20,
          currentAmount: 10,
        },
      })
      await handlers.handleBalanceConfirmAmount(
        wizard as any,
        1,
        "u1",
        t("en", "common.no")
      )
      expect(wizard.getState().data.currentAmount).toBe(10)
    })

    test("fallback returns to edit menu", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          newAmount: 20,
          currentAmount: 10,
        },
      })
      await handlers.handleBalanceConfirmAmount(wizard as any, 1, "u1", "maybe")
      expect(wizard.getState().data.currentAmount).toBe(10)
    })
  })

  describe("handleBalanceConfirmRename", () => {
    test("yes renames balance", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          newName: "Wallet",
          currentAmount: 10,
        },
      })
      await handlers.handleBalanceConfirmRename(
        wizard as any,
        1,
        "u1",
        t("en", "common.yes")
      )
      expect(dbStorage.renameBalance).toHaveBeenCalled()
    })

    test("no returns to edit menu", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          newName: "Wallet",
          currentAmount: 10,
        },
      })
      await handlers.handleBalanceConfirmRename(
        wizard as any,
        1,
        "u1",
        t("en", "common.no")
      )
      expect(wizard.getState().data.currentAmount).toBe(10)
    })
  })

  describe("handleBalanceSetToZero", () => {
    test("yes sets to zero", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          amount: 10,
          hasOtherBalances: false,
        },
      })
      await handlers.handleBalanceSetToZero(
        wizard as any,
        1,
        "u1",
        t("en", "common.yesSetToZero")
      )
      expect(dbStorage.convertBalanceAmount).toHaveBeenCalled()
    })

    test("transfer path", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", currency: "USD" },
        { accountId: "Card", currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          amount: 10,
          hasOtherBalances: true,
        },
      })
      await handlers.handleBalanceSetToZero(
        wizard as any,
        1,
        "u1",
        t("en", "balances.transferToAnother")
      )
      expect(wizard.getState().data.accountId).toBe("Cash")
    })
  })

  describe("handleBalanceDelete", () => {
    test("yes deletes", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          amount: 0,
          hasOtherBalances: false,
        },
      })
      await handlers.handleBalanceDelete(
        wizard as any,
        1,
        "u1",
        t("en", "balances.yesDelete")
      )
      expect(dbStorage.deleteBalance).toHaveBeenCalled()
    })

    test("transfer path", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", currency: "USD" },
        { accountId: "Card", currency: "USD" },
      ])
      const wizard = new MockWizard({
        lang: "en",
        data: {
          accountId: "Cash",
          currency: "USD",
          amount: 10,
          hasOtherBalances: true,
        },
      })
      await handlers.handleBalanceDelete(
        wizard as any,
        1,
        "u1",
        t("en", "balances.transferToAnother")
      )
      expect(wizard.getState().data.accountId).toBe("Cash")
    })
  })

  describe("handleBalanceDeleteSelectTarget", () => {
    test("invalid selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", amount: 10 },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handlers.handleBalanceDeleteSelectTarget(
        wizard as any,
        1,
        "u1",
        "bad"
      )
      expect(sendSpy).toHaveBeenCalled()
    })

    test("valid transfer selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", amount: 10 },
      })
      await handlers.handleBalanceDeleteSelectTarget(
        wizard as any,
        1,
        "u1",
        "Card USD"
      )
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(dbStorage.safeUpdateBalance).toHaveBeenCalled()
      expect(dbStorage.deleteBalance).toHaveBeenCalled()
    })
  })

  describe("handleBalanceZeroSelectTarget", () => {
    test("invalid selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", amount: 10 },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handlers.handleBalanceZeroSelectTarget(
        wizard as any,
        1,
        "u1",
        "bad"
      )
      expect(sendSpy).toHaveBeenCalled()
    })

    test("valid transfer selection", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { accountId: "Cash", currency: "USD", amount: 10 },
      })
      await handlers.handleBalanceZeroSelectTarget(
        wizard as any,
        1,
        "u1",
        "Card USD"
      )
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(dbStorage.convertBalanceAmount).toHaveBeenCalled()
      expect(dbStorage.safeUpdateBalance).toHaveBeenCalled()
    })
  })
})
