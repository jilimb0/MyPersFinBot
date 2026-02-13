import * as settingsHandlers from "../../handlers/message/settings.handlers"
import type { MessageContext } from "../../handlers/message/types"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
  },
}))

jest.mock("../../i18n", () => ({
  t: jest.fn((_lang, key) => key),
}))

jest.mock("../../i18n/keyboards", () => ({
  getSettingsKeyboard: jest.fn().mockReturnValue({
    keyboard: [],
    resize_keyboard: true,
  }),
}))

jest.mock("../../utils", () => ({
  escapeMarkdown: jest.fn((text) => text),
}))

import { dbStorage } from "../../database/storage-db"

const mockBot = {
  sendMessage: jest.fn().mockResolvedValue({}),
} as any

const mockWizardManager = {
  getState: jest.fn().mockReturnValue(null),
  goToStep: jest.fn().mockResolvedValue(undefined),
} as any

const createContext = (
  overrides?: Partial<MessageContext>
): MessageContext => ({
  bot: mockBot,
  msg: {
    message_id: 1,
    chat: { id: 123, type: "private" },
    date: Date.now(),
    text: "test",
  } as any,
  chatId: 123,
  userId: "123",
  text: "test",
  lang: "en" as const,
  wizardManager: mockWizardManager,
  db: dbStorage,
  ...overrides,
})

describe("Settings Handlers Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("handleSettingsMenu", () => {
    test("shows default settings menu", async () => {
      mockWizardManager.getState.mockReturnValueOnce(null)
      const context = createContext()

      await settingsHandlers.handleSettingsMenu(context)

      expect(dbStorage.getDefaultCurrency).toHaveBeenCalledWith("123")
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("settings.title"),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.any(Object),
        })
      )
    })

    test("shows goal advanced settings with deadline", async () => {
      const goal = {
        id: "goal1",
        name: "Save for vacation",
        targetAmount: 1000,
        currentAmount: 500,
        currency: "USD",
        deadline: new Date("2025-12-31"),
        autoDeposit: {
          enabled: true,
          amount: 100,
          frequency: "monthly" as const,
        },
      }

      mockWizardManager.getState.mockReturnValueOnce({
        step: "GOAL_MENU",
        data: { goal },
        lang: "en",
      })

      const context = createContext()
      await settingsHandlers.handleSettingsMenu(context)

      expect(mockWizardManager.goToStep).toHaveBeenCalledWith(
        "123",
        "GOAL_ADVANCED_MENU",
        { goal }
      )
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("advanced.title"),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.objectContaining({
            keyboard: expect.arrayContaining([
              expect.arrayContaining([{ text: "goals.changeDeadlineBtn" }]),
              expect.arrayContaining([{ text: "debts.disableReminders" }]),
              expect.arrayContaining([{ text: "goals.disableAutoDeposit" }]),
            ]),
          }),
        })
      )
    })

    test("shows goal advanced settings without deadline", async () => {
      const goal = {
        id: "goal1",
        name: "Save for vacation",
        targetAmount: 1000,
        currentAmount: 500,
        currency: "USD",
        deadline: null,
        autoDeposit: {
          enabled: false,
          amount: 100,
          frequency: "monthly" as const,
        },
      }

      mockWizardManager.getState.mockReturnValueOnce({
        step: "GOAL_MENU",
        data: { goal },
        lang: "en",
      })

      const context = createContext()
      await settingsHandlers.handleSettingsMenu(context)

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("advanced.title"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.arrayContaining([
              expect.arrayContaining([{ text: "goals.setDeadlineBtn" }]),
              expect.arrayContaining([{ text: "goals.enableAutoDeposit" }]),
            ]),
          }),
        })
      )
    })

    test("shows debt advanced settings with due date", async () => {
      const debt = {
        id: "debt1",
        name: "Credit card",
        totalAmount: 1000,
        remainingAmount: 500,
        currency: "USD",
        dueDate: new Date("2025-12-31"),
        autoPayment: {
          enabled: true,
          amount: 100,
          frequency: "monthly" as const,
          accountId: "acc1",
        },
      }

      mockWizardManager.getState.mockReturnValueOnce({
        step: "DEBT_MENU",
        data: { debt },
        lang: "en",
      })

      const context = createContext()
      await settingsHandlers.handleSettingsMenu(context)

      expect(mockWizardManager.goToStep).toHaveBeenCalledWith(
        "123",
        "DEBT_ADVANCED_MENU",
        { debt }
      )
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("advanced.title"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.arrayContaining([
              expect.arrayContaining([{ text: "debts.changeDueDate" }]),
              expect.arrayContaining([{ text: "debts.disableReminders" }]),
              expect.arrayContaining([{ text: "debts.disableAutoPayment" }]),
            ]),
          }),
        })
      )
    })

    test("shows debt advanced settings without due date", async () => {
      const debt = {
        id: "debt1",
        name: "Credit card",
        totalAmount: 1000,
        remainingAmount: 500,
        currency: "USD",
        dueDate: null,
        autoPayment: {
          enabled: false,
          amount: 100,
          frequency: "monthly" as const,
          accountId: "acc1",
        },
      }

      mockWizardManager.getState.mockReturnValueOnce({
        step: "DEBT_MENU",
        data: { debt },
        lang: "en",
      })

      const context = createContext()
      await settingsHandlers.handleSettingsMenu(context)

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("advanced.title"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.arrayContaining([
              expect.arrayContaining([{ text: "debts.setDueDate" }]),
              expect.arrayContaining([{ text: "debts.enableAutoPayment" }]),
            ]),
          }),
        })
      )
    })
  })
})
