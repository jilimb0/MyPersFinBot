import type { BotClient } from "@jilimb0/tgwrapper"
import {
  handleBack,
  handleCancel,
  handleMainMenu,
  handleNoCancel,
} from "../../handlers/message/navigation.handlers"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn(),
  showBalancesMenu: jest.fn(),
  showDebtsMenu: jest.fn(),
  showGoalsMenu: jest.fn(),
  showAutomationMenu: jest.fn(),
  showAdvancedMenu: jest.fn(),
}))

jest.mock("../../i18n/keyboards", () => ({
  getMainMenuKeyboard: jest
    .fn()
    .mockReturnValue({ keyboard: [[{ text: "Main" }]], resize_keyboard: true }),
  getSettingsKeyboard: jest.fn().mockReturnValue({
    keyboard: [[{ text: "Settings" }]],
    resize_keyboard: true,
  }),
  getStatsKeyboard: jest.fn().mockReturnValue({
    keyboard: [[{ text: "Stats" }]],
    resize_keyboard: true,
  }),
  getBackAndMainKeyboard: jest.fn().mockReturnValue({
    keyboard: [[{ text: "Back" }, { text: "Main" }]],
    resize_keyboard: true,
  }),
  getAnalyticsKeyboard: jest.fn().mockReturnValue({
    keyboard: [[{ text: "Analytics" }]],
    resize_keyboard: true,
  }),
}))

import type { Language } from "../../i18n"
import { getSettingsKeyboard } from "../../i18n/keyboards"
import * as menus from "../../menus-i18n"

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Navigation handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("handleBack clears wizard and returns to main", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("1", {
      step: "TX_AMOUNT",
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    const context = {
      bot,
      chatId: 1,
      userId: "1",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(wizard.getState("1")).toBeUndefined()
  })

  test("handleMainMenu clears wizard state", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("2", {
      step: "TX_AMOUNT",
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    const context = {
      bot,
      chatId: 2,
      userId: "2",
      lang: "uk",
      wizardManager: wizard,
    } as any

    await handleMainMenu(context)

    expect(wizard.getState("2")).toBeUndefined()
  })

  test("handleBack returns to balances menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("3", {
      step: "BALANCE_EDIT",
      data: {},
      returnTo: "balances",
      lang: "en",
    })

    const context = {
      bot,
      chatId: 3,
      userId: "3",
      lang: "en",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(menus.showBalancesMenu).toHaveBeenCalled()
    expect(wizard.getState("3")).toBeUndefined()
  })

  test("handleBack returns to debts menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("4", {
      step: "DEBT_ADD",
      data: {},
      returnTo: "debts",
      lang: "en",
    })

    const context = {
      bot,
      chatId: 4,
      userId: "4",
      lang: "en",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(menus.showDebtsMenu).toHaveBeenCalled()
  })

  test("handleBack returns to goals menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("5", {
      step: "GOAL_ADD",
      data: {},
      returnTo: "goals",
      lang: "en",
    })

    const context = {
      bot,
      chatId: 5,
      userId: "5",
      lang: "en",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(menus.showGoalsMenu).toHaveBeenCalled()
  })

  test("handleBack returns to settings menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("6", {
      step: "CURRENCY_SELECT",
      data: {},
      returnTo: "settings",
      lang: "en",
    })

    const context = {
      bot,
      chatId: 6,
      userId: "6",
      lang: "en",
      wizardManager: wizard,
      db: {
        getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
      },
    } as any

    await handleBack(context)

    expect(bot.sendMessage).toHaveBeenCalled()
    expect(getSettingsKeyboard).toHaveBeenCalled()
  })

  test("handleBack returns to automation menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("7", {
      step: "AUTO_INCOME",
      data: {},
      returnTo: "automation",
      lang: "en",
    })

    const context = {
      bot,
      chatId: 7,
      userId: "7",
      lang: "en",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(menus.showAutomationMenu).toHaveBeenCalled()
  })

  test("handleBack returns to advanced menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("8", {
      step: "UPLOAD_STATEMENT",
      data: {},
      returnTo: "advanced",
      lang: "en",
    })

    const context = {
      bot,
      chatId: 8,
      userId: "8",
      lang: "en",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(menus.showAdvancedMenu).toHaveBeenCalled()
  })

  test("handleBack with no returnTo goes to main menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    wizard.setState("9", {
      step: "SOME_STEP",
      data: {},
      lang: "en",
    })

    const context = {
      bot,
      chatId: 9,
      userId: "9",
      lang: "en",
      wizardManager: wizard,
    } as any

    await handleBack(context)

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("handleCancel sends cancelled message", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const context = {
      bot,
      chatId: 10,
      userId: "10",
      lang: "en",
      wizardManager: wizard,
    } as any

    const result = await handleCancel(context)

    expect(bot.sendMessage).toHaveBeenCalled()
    expect(getSettingsKeyboard).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test("handleNoCancel shows advanced menu", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const context = {
      bot,
      chatId: 11,
      userId: "11",
      lang: "en",
      wizardManager: wizard,
    } as any

    const result = await handleNoCancel(context)

    expect(bot.sendMessage).toHaveBeenCalled()
    expect(menus.showAdvancedMenu).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test("handleBack works with different languages", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const languages = ["en", "ru", "uk", "es", "pl"]

    for (const lang of languages) {
      jest.clearAllMocks()
      wizard.setState(`user-${lang}`, {
        step: "TX_AMOUNT",
        data: {},
        returnTo: "balances",
        lang: lang as Language,
      })

      const context = {
        bot,
        chatId: 100,
        userId: `user-${lang}`,
        lang,
        wizardManager: wizard,
      } as any

      await handleBack(context)

      expect(menus.showBalancesMenu).toHaveBeenCalledWith(
        wizard,
        100,
        `user-${lang}`,
        lang
      )
    }
  })

  test("handleMainMenu works with different users", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userIds = ["user1", "user2", "user3"]

    for (const userId of userIds) {
      jest.clearAllMocks()
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: {},
        lang: "en",
      })

      const context = {
        bot,
        chatId: 200,
        userId,
        lang: "en",
        wizardManager: wizard,
      } as any

      await handleMainMenu(context)

      expect(wizard.getState(userId)).toBeUndefined()
      expect(bot.sendMessage).toHaveBeenCalled()
    }
  })
})
