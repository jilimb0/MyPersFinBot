import {
  handleNotificationsMenu,
  handleNotificationsToggle,
  handleReminderTimeSave,
  handleReminderTimeSelect,
  handleTimezoneSave,
  handleTimezoneSelect,
} from "../../handlers/reminder-settings-handlers"
import { t } from "../../i18n"

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}))

jest.mock("../../i18n/keyboards", () => ({
  getReminderTimeKeyboard: jest.fn(() => ({ keyboard: [[{ text: "09:00" }]] })),
}))

const { AppDataSource } = jest.requireMock("../../database/data-source")

const repoMock = {
  findOne: jest.fn(),
  update: jest.fn(),
}

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
  async goToStep() {}
}

describe("reminder-settings-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AppDataSource.getRepository.mockReturnValue(repoMock)
  })

  test("handleNotificationsMenu renders with defaults", async () => {
    repoMock.findOne.mockResolvedValue({ id: "u1" })
    const wizard = new MockWizard({ lang: "en" })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    const res = await handleNotificationsMenu(wizard as any, 1, "u1")
    expect(res).toBe(true)
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleNotificationsToggle returns false if user missing", async () => {
    repoMock.findOne.mockResolvedValue(null)
    const wizard = new MockWizard({ lang: "en" })
    const res = await handleNotificationsToggle(
      wizard as any,
      1,
      "u1",
      t("en", "wizard.notifications.enable")
    )
    expect(res).toBe(false)
  })

  test("handleNotificationsToggle enables and shows menu", async () => {
    repoMock.findOne.mockResolvedValue({
      id: "u1",
      reminderSettings: {
        enabled: false,
        time: "09:00",
        timezone: "UTC",
        notifyBefore: { debts: 3, goals: 7, income: 1 },
      },
    })
    const wizard = new MockWizard({ lang: "en" })
    const res = await handleNotificationsToggle(
      wizard as any,
      1,
      "u1",
      t("en", "wizard.notifications.enable")
    )
    expect(res).toBe(true)
    expect(repoMock.update).toHaveBeenCalled()
  })

  test("handleReminderTimeSelect shows keyboard", async () => {
    repoMock.findOne.mockResolvedValue({
      id: "u1",
      reminderSettings: { time: "10:00" },
    })
    const wizard = new MockWizard({ lang: "en" })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    await handleReminderTimeSelect(wizard as any, 1, "u1")
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleReminderTimeSave invalid format", async () => {
    const wizard = new MockWizard({ lang: "en" })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    const res = await handleReminderTimeSave(wizard as any, 1, "u1", "bad")
    expect(res).toBe(true)
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleReminderTimeSave valid", async () => {
    repoMock.findOne.mockResolvedValue({
      id: "u1",
      reminderSettings: { notifyBefore: { debts: 3, goals: 7, income: 1 } },
    })
    const wizard = new MockWizard({ lang: "en" })
    const res = await handleReminderTimeSave(wizard as any, 1, "u1", "10:30")
    expect(res).toBe(true)
    expect(repoMock.update).toHaveBeenCalled()
  })

  test("handleTimezoneSelect shows menu", async () => {
    repoMock.findOne.mockResolvedValue({ id: "u1", reminderSettings: {} })
    const wizard = new MockWizard({ lang: "en" })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    const res = await handleTimezoneSelect(wizard as any, 1, "u1")
    expect(res).toBe(true)
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleTimezoneSave invalid format", async () => {
    const wizard = new MockWizard({ lang: "en" })
    const sendSpy = jest.spyOn(wizard, "sendMessage")
    const res = await handleTimezoneSave(wizard as any, 1, "u1", "bad")
    expect(res).toBe(true)
    expect(sendSpy).toHaveBeenCalled()
  })

  test("handleTimezoneSave valid", async () => {
    repoMock.findOne.mockResolvedValue({
      id: "u1",
      reminderSettings: {
        time: "09:00",
        timezone: "UTC",
        notifyBefore: { debts: 3, goals: 7, income: 1 },
      },
    })
    const wizard = new MockWizard({ lang: "en" })
    const res = await handleTimezoneSave(
      wizard as any,
      1,
      "u1",
      "Europe/London"
    )
    expect(res).toBe(true)
    expect(repoMock.update).toHaveBeenCalled()
  })
})
