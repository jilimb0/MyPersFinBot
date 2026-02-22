import type TelegramBot from "@telegram-api"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getReminderSettings: jest.fn(),
    updateReminderSettings: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetReminderSettings =
  dbStorage.getReminderSettings as jest.MockedFunction<
    typeof dbStorage.getReminderSettings
  >
const mockUpdateReminderSettings =
  dbStorage.updateReminderSettings as jest.MockedFunction<
    typeof dbStorage.updateReminderSettings
  >

describe("E2E custom messages flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetReminderSettings.mockResolvedValue({
      enabled: true,
      time: "09:00",
      timezone: "Asia/Tbilisi",
      channels: { telegram: true },
      notifyBefore: { debts: 3, goals: 7, income: 1 },
      customMessages: {
        debt: "Debt {amount}",
        goal: "Goal {amount}",
        income: "Income {amount}",
      },
    })
  })

  test("custom message edit flow (debt)", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-c1"
    const chatId = 1101
    const lang = "uk"

    wizard.setState(userId, {
      step: "CUSTOM_MESSAGES_MENU",
      data: {},
      returnTo: "advanced",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "notifications.editDebtTemplate")
    )

    let state = wizard.getState(userId)
    expect(state?.step).toBe("CUSTOM_MESSAGE_EDIT")

    await wizard.handleWizardInput(chatId, userId, "Нагадування {amount}")
    expect(mockUpdateReminderSettings).toHaveBeenCalled()
    state = wizard.getState(userId)
    expect(state?.step).toBeUndefined()
  })
})
