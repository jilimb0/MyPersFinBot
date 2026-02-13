import { handleDebtAdvancedMenu, handleGoalAdvancedMenu } from "../../handlers"
import { t } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    updateDebtDueDate: jest.fn(),
    updateGoalDeadline: jest.fn(),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showDebtsMenu: jest.fn(),
  showGoalsMenu: jest.fn(),
}))

describe("advanced-menu-handlers", () => {
  const makeWizard = (state: any) => ({
    getState: jest.fn().mockReturnValue(state),
    sendMessage: jest.fn(),
    clearState: jest.fn(),
    goToStep: jest.fn(),
    getBot: jest.fn().mockReturnValue({}),
  })

  describe("handleDebtAdvancedMenu", () => {
    test("handles missing debt", async () => {
      const wizard = makeWizard({ lang: "en", data: {} })
      const result = await handleDebtAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        "x"
      )
      expect(result).toBe(true)
      expect(wizard.clearState).toHaveBeenCalled()
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("handles due date prompt (set)", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { debt: { id: "d1" } },
      })
      const result = await handleDebtAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        t("en", "debts.setDueDate")
      )
      expect(result).toBe(true)
      expect(wizard.goToStep).toHaveBeenCalledWith(
        "user-1",
        "DEBT_EDIT_DUE_DATE",
        { debt: { id: "d1" } }
      )
    })

    test("handles disable reminders", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { debt: { id: "d2" } },
      })
      const result = await handleDebtAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        t("en", "debts.disableReminders")
      )
      expect(result).toBe(true)
      expect(wizard.clearState).toHaveBeenCalled()
    })

    test("handles auto payment toggle", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { debt: { id: "d3" } },
      })
      const result = await handleDebtAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        t("en", "autoFeatures.enableAutoPayment")
      )
      expect(result).toBe(true)
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("falls through to default", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { debt: { id: "d4" } },
      })
      const result = await handleDebtAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        "some other text"
      )
      expect(result).toBe(false)
      expect(wizard.goToStep).toHaveBeenCalledWith("user-1", "DEBT_MENU", {
        debt: { id: "d4" },
      })
    })
  })

  describe("handleGoalAdvancedMenu", () => {
    test("handles missing goal", async () => {
      const wizard = makeWizard({ lang: "en", data: {} })
      const result = await handleGoalAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        "x"
      )
      expect(result).toBe(true)
      expect(wizard.clearState).toHaveBeenCalled()
    })

    test("handles deadline prompt (set)", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { goal: { id: "g1" } },
      })
      const result = await handleGoalAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        t("en", "autoFeatures.setDeadline")
      )
      expect(result).toBe(true)
      expect(wizard.goToStep).toHaveBeenCalledWith(
        "user-1",
        "GOAL_EDIT_DEADLINE",
        { goal: { id: "g1" } }
      )
    })

    test("handles disable reminders", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { goal: { id: "g2" } },
      })
      const result = await handleGoalAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        t("en", "goals.disableReminders")
      )
      expect(result).toBe(true)
      expect(wizard.clearState).toHaveBeenCalled()
    })

    test("handles auto deposit toggle", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { goal: { id: "g3" } },
      })
      const result = await handleGoalAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        t("en", "autoFeatures.enableAutoDeposit")
      )
      expect(result).toBe(true)
      expect(wizard.sendMessage).toHaveBeenCalled()
    })

    test("falls through to default", async () => {
      const wizard = makeWizard({
        lang: "en",
        data: { goal: { id: "g4" } },
      })
      const result = await handleGoalAdvancedMenu(
        wizard as any,
        1,
        "user-1",
        "some other text"
      )
      expect(result).toBe(false)
      expect(wizard.goToStep).toHaveBeenCalledWith("user-1", "GOAL_MENU", {
        goal: { id: "g4" },
      })
    })
  })
})
