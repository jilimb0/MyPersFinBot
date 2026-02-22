import type TelegramBot from "node-telegram-bot-api"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue({
        id: "user-n1",
        reminderSettings: {
          enabled: false,
          time: "09:00",
          timezone: "Asia/Tbilisi",
          channels: { telegram: true },
          notifyBefore: { debts: 3, goals: 7, income: 1 },
        },
      }),
      update: jest.fn().mockResolvedValue({}),
    })),
  },
}))

describe("E2E notifications flow", () => {
  test("toggle notifications and return to menu", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-n1"
    const chatId = 801
    const lang = "uk"

    wizard.setState(userId, {
      step: "NOTIFICATIONS_MENU",
      data: {},
      returnTo: "automation",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "wizard.notifications.enable")
    )

    const state = wizard.getState(userId)
    expect(state?.step).toBe("NOTIFICATIONS_MENU")
  })

  test("change reminder time flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-n2"
    const chatId = 802
    const lang = "uk"

    wizard.setState(userId, {
      step: "NOTIFICATIONS_MENU",
      data: {},
      returnTo: "automation",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "wizard.notifications.changeTime")
    )

    let state = wizard.getState(userId)
    expect(state?.step).toBe("REMINDER_TIME_SELECT")

    await wizard.handleWizardInput(chatId, userId, "10:00")
    state = wizard.getState(userId)
    expect(state).toBeUndefined()
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("change timezone flow", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "user-n3"
    const chatId = 803
    const lang = "uk"

    wizard.setState(userId, {
      step: "NOTIFICATIONS_MENU",
      data: {},
      returnTo: "automation",
      lang,
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t(lang, "buttons.changeTimezone")
    )

    let state = wizard.getState(userId)
    expect(state?.step).toBe("REMINDER_TIMEZONE_SELECT")

    await wizard.handleWizardInput(chatId, userId, "Europe/Kyiv")
    state = wizard.getState(userId)
    expect(state).toBeUndefined()
    expect(bot.sendMessage).toHaveBeenCalled()
  })
})
