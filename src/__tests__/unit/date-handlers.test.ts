import {
  handleDebtDueDate,
  handleDebtDueDateEdit,
  handleGoalDeadline,
  handleGoalDeadlineEdit,
  handleIncomeExpectedDate,
} from "../../handlers/date-handlers"
import { t } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    addDebt: jest.fn(),
    updateDebtDueDate: jest.fn(),
    updateGoalDeadline: jest.fn(),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showDebtsMenu: jest.fn(),
  showGoalsMenu: jest.fn(),
  showIncomeSourcesMenu: jest.fn(),
}))

jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    createDebtReminder: jest.fn(),
    createGoalReminder: jest.fn(),
    createIncomeReminder: jest.fn(),
  },
}))

const repoMock = {
  update: jest.fn(),
  findOne: jest.fn(),
}

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(() => repoMock),
  },
}))

const { dbStorage } = jest.requireMock("../../database/storage-db")
const { showDebtsMenu, showGoalsMenu, showIncomeSourcesMenu } =
  jest.requireMock("../../menus-i18n")
const { reminderManager } = jest.requireMock("../../services/reminder-manager")

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

describe("date-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    repoMock.update.mockResolvedValue(undefined)
    repoMock.findOne.mockResolvedValue({ id: "x", userId: "u1" })
  })

  describe("handleDebtDueDate", () => {
    test("returns false with no state", async () => {
      const wizard = new MockWizard(null)
      await expect(
        handleDebtDueDate(wizard as any, 1, "u1", "x")
      ).resolves.toBe(false)
    })

    test("handles missing debt data", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtDueDate(wizard as any, 1, "u1", "x")
      expect(sendSpy).toHaveBeenCalled()
      expect(showDebtsMenu).toHaveBeenCalled()
    })

    test("invalid date format shows error", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { name: "A", amount: 10, currency: "USD", type: "I_OWE" },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtDueDate(wizard as any, 1, "u1", "bad")
      expect(sendSpy).toHaveBeenCalled()
      expect(dbStorage.addDebt).not.toHaveBeenCalled()
    })

    test("past due date goes to confirm step", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { name: "A", amount: 10, currency: "USD", type: "I_OWE" },
      })
      const goSpy = jest.spyOn(wizard, "goToStep")
      await handleDebtDueDate(wizard as any, 1, "u1", "01.01.2000")
      expect(goSpy).toHaveBeenCalled()
      expect(dbStorage.addDebt).not.toHaveBeenCalled()
    })

    test("skip date creates debt without reminder", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { name: "A", amount: 10, currency: "USD", type: "I_OWE" },
      })
      await handleDebtDueDate(wizard as any, 1, "u1", t("en", "common.skip"))
      expect(dbStorage.addDebt).toHaveBeenCalled()
      expect(repoMock.update).not.toHaveBeenCalled()
      expect(showDebtsMenu).toHaveBeenCalled()
    })

    test("valid future date creates reminder", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { name: "A", amount: 10, currency: "USD", type: "I_OWE" },
      })
      await handleDebtDueDate(wizard as any, 1, "u1", "01.01.2099")
      expect(dbStorage.addDebt).toHaveBeenCalled()
      expect(repoMock.update).toHaveBeenCalled()
      expect(reminderManager.createDebtReminder).toHaveBeenCalled()
    })
  })

  describe("handleDebtDueDateEdit", () => {
    test("returns false with missing debt", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} })
      await expect(
        handleDebtDueDateEdit(wizard as any, 1, "u1", "01.01.2026")
      ).resolves.toBe(false)
    })

    test("invalid format shows error", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { id: "d1" } },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleDebtDueDateEdit(wizard as any, 1, "u1", "bad")
      expect(sendSpy).toHaveBeenCalled()
    })

    test("past date asks confirmation", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { id: "d1" } },
      })
      await handleDebtDueDateEdit(wizard as any, 1, "u1", "01.01.2000")
      const state = wizard.getState()
      expect(state.data.newDueDate).toBeInstanceOf(Date)
    })

    test("valid date updates and creates reminder", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { debt: { id: "d1" } },
      })
      await handleDebtDueDateEdit(wizard as any, 1, "u1", "01.01.2099")
      expect(dbStorage.updateDebtDueDate).toHaveBeenCalled()
      expect(reminderManager.createDebtReminder).toHaveBeenCalled()
      expect(showDebtsMenu).toHaveBeenCalled()
    })
  })

  describe("handleGoalDeadline", () => {
    test("missing goal data path", async () => {
      const wizard = new MockWizard({ lang: "en", data: {} })
      await handleGoalDeadline(wizard as any, 1, "u1", "x")
      expect(showGoalsMenu).toHaveBeenCalled()
    })

    test("skip deadline creates without reminder", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goalId: "g1",
          name: "Goal",
          targetAmount: 100,
          currency: "USD",
        },
      })
      await handleGoalDeadline(wizard as any, 1, "u1", t("en", "common.skip"))
      expect(repoMock.update).not.toHaveBeenCalled()
      expect(showGoalsMenu).toHaveBeenCalled()
    })

    test("invalid date format shows example", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          goalId: "g1",
          name: "Goal",
          targetAmount: 100,
          currency: "USD",
        },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleGoalDeadline(wizard as any, 1, "u1", "bad")
      expect(sendSpy).toHaveBeenCalled()
    })
  })

  describe("handleGoalDeadlineEdit", () => {
    test("rejects past date", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: { goal: { id: "g1" } },
      })
      await handleGoalDeadlineEdit(wizard as any, 1, "u1", "01.01.2000")
      expect(dbStorage.updateGoalDeadline).not.toHaveBeenCalled()
    })
  })

  describe("handleIncomeExpectedDate", () => {
    test("invalid day shows error", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          incomeId: "i1",
          name: "Salary",
          expectedAmount: 100,
          currency: "USD",
        },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleIncomeExpectedDate(wizard as any, 1, "u1", "40")
      expect(sendSpy).toHaveBeenCalled()
      expect(repoMock.update).not.toHaveBeenCalled()
    })

    test("skip expected date", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          incomeId: "i1",
          name: "Salary",
          expectedAmount: 100,
          currency: "USD",
        },
      })
      await handleIncomeExpectedDate(
        wizard as any,
        1,
        "u1",
        t("en", "common.skip")
      )
      expect(repoMock.update).not.toHaveBeenCalled()
      expect(showIncomeSourcesMenu).toHaveBeenCalled()
    })

    test("valid expected day creates reminder", async () => {
      const wizard = new MockWizard({
        lang: "en",
        data: {
          incomeId: "i1",
          name: "Salary",
          expectedAmount: 100,
          currency: "USD",
        },
      })
      await handleIncomeExpectedDate(wizard as any, 1, "u1", "15")
      expect(repoMock.update).toHaveBeenCalled()
      expect(reminderManager.createIncomeReminder).toHaveBeenCalled()
      expect(showIncomeSourcesMenu).toHaveBeenCalled()
    })
  })
})
