import {
  handleCustomMessageSave,
  handleCustomMessagesAction,
  handleCustomMessagesMenu,
} from "../../handlers/notification-template-handlers"
import { t } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getReminderSettings: jest.fn(),
    updateReminderSettings: jest.fn(),
  },
}))

jest.mock("../../constants", () => ({
  SETTINGS_KEYBOARD: { keyboard: [[{ text: "Settings" }]] },
}))

const { dbStorage } = jest.requireMock("../../database/storage-db")

class MockWizard {
  private state: any
  constructor(state?: any) {
    this.state = state || null
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
    return {}
  }
  async sendMessage() {}
}

describe("notification-template-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("handleCustomMessagesMenu builds state and menu", async () => {
    dbStorage.getReminderSettings.mockResolvedValue({
      customMessages: { debt: "D", goal: "G", income: "I" },
    })
    const wizard = new MockWizard({ lang: "en" })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    await handleCustomMessagesMenu(wizard as any, 1, "u1")
    expect(wizard.getState().step).toBe("CUSTOM_MESSAGES_MENU")
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleCustomMessagesAction returns false if not in menu", async () => {
    const wizard = new MockWizard({ step: "OTHER" })
    const res = await handleCustomMessagesAction(wizard as any, 1, "u1", "x")
    expect(res).toBe(false)
  })

  test("handleCustomMessagesAction edit debt/goal/income", async () => {
    const wizard = new MockWizard({ step: "CUSTOM_MESSAGES_MENU", lang: "en" })
    await handleCustomMessagesAction(
      wizard as any,
      1,
      "u1",
      t("en", "notifications.editDebtTemplate")
    )
    expect(wizard.getState().step).toBe("CUSTOM_MESSAGE_EDIT")
    expect(wizard.getState().data.type).toBe("debt")

    wizard.setState("u1", { step: "CUSTOM_MESSAGES_MENU", lang: "en" })
    await handleCustomMessagesAction(
      wizard as any,
      1,
      "u1",
      t("en", "notifications.editGoalTemplate")
    )
    expect(wizard.getState().data.type).toBe("goal")

    wizard.setState("u1", { step: "CUSTOM_MESSAGES_MENU", lang: "en" })
    await handleCustomMessagesAction(
      wizard as any,
      1,
      "u1",
      t("en", "notifications.editIncomeTemplate")
    )
    expect(wizard.getState().data.type).toBe("income")
  })

  test("handleCustomMessagesAction reset defaults", async () => {
    dbStorage.getReminderSettings.mockResolvedValue({
      customMessages: { debt: "x" },
    })
    const wizard = new MockWizard({ step: "CUSTOM_MESSAGES_MENU", lang: "en" })
    const res = await handleCustomMessagesAction(
      wizard as any,
      1,
      "u1",
      t("en", "notifications.resetToDefaults")
    )
    expect(res).toBe(true)
    expect(dbStorage.updateReminderSettings).toHaveBeenCalled()
    expect(wizard.getState()).toBe(null)
  })

  test("handleCustomMessageSave warns on missing placeholder", async () => {
    const wizard = new MockWizard({
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "debt", lang: "en" },
      lang: "en",
    })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    const res = await handleCustomMessageSave(
      wizard as any,
      1,
      "u1",
      "no placeholders"
    )
    expect(res).toBe(true)
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleCustomMessageSave returns false if settings missing", async () => {
    dbStorage.getReminderSettings.mockResolvedValue(null)
    const wizard = new MockWizard({
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "debt", lang: "en" },
      lang: "en",
    })
    const res = await handleCustomMessageSave(wizard as any, 1, "u1", "{name}")
    expect(res).toBe(false)
  })

  test("handleCustomMessageSave saves for each type", async () => {
    const settings = { customMessages: {} as any }
    dbStorage.getReminderSettings.mockResolvedValue(settings)
    const wizard = new MockWizard({
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "debt", lang: "en" },
      lang: "en",
    })
    await handleCustomMessageSave(wizard as any, 1, "u1", "{name}")
    expect(settings.customMessages.debt).toBe("{name}")

    dbStorage.getReminderSettings.mockResolvedValue({ customMessages: {} })
    wizard.setState("u1", {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "goal", lang: "en" },
      lang: "en",
    })
    await handleCustomMessageSave(wizard as any, 1, "u1", "{name}")

    dbStorage.getReminderSettings.mockResolvedValue({ customMessages: {} })
    wizard.setState("u1", {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "income", lang: "en" },
      lang: "en",
    })
    await handleCustomMessageSave(wizard as any, 1, "u1", "{name}")

    expect(dbStorage.updateReminderSettings).toHaveBeenCalledTimes(3)
  })
})
