import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { registerCommands } from "../../commands"
import { dbStorage } from "../../database/storage-db"
import { registerCallbackRouter } from "../../handlers/callback-router"
import {
  handleCustomMessagesMenu,
  handleUploadStatement,
} from "../../handlers/message/settings-submenu.handlers"
import { handleVoiceMessage } from "../../handlers/voice-handler"
import { t } from "../../i18n"
import { sendPremiumRequiredMessage } from "../../monetization/premium-gate"
import { WizardManager } from "../../wizards/wizards"
import { MockRouterBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    canUsePremiumFeature: jest.fn().mockResolvedValue(false),
    checkAndConsumeUsage: jest.fn().mockResolvedValue({
      allowed: false,
      limit: 0,
      used: 0,
      remaining: 0,
    }),
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    getTopCategories: jest.fn().mockResolvedValue([]),
    getBalancesList: jest.fn().mockResolvedValue([]),
    getCurrencyDenominations: jest.fn().mockReturnValue([5, 10, 20]),
    getTransactionsPaginated: jest.fn().mockResolvedValue({
      transactions: [],
      total: 0,
      hasMore: false,
    }),
    getSubscriptionStatus: jest.fn().mockResolvedValue({
      tier: "free",
      premiumExpiresAt: null,
      trialStartedAt: null,
      trialExpiresAt: null,
      trialUsed: false,
      subscriptionPaused: false,
      pausedRemainingMs: 0,
      pausedTier: null,
    }),
  },
}))

describe("E2E premium gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("blocks voice input for free tier", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const msg = {
      chat: { id: 5001 },
      voice: { file_id: "voice-file-id" },
    } as unknown as Tg.Message

    await handleVoiceMessage(bot, msg, wizard)

    expect(bot.sendMessage).toHaveBeenCalledWith(
      5001,
      expect.stringContaining("Premium"),
      expect.any(Object)
    )
  })

  test("blocks command mode and templates for free tier", async () => {
    const bot = new MockRouterBot()
    registerCommands(bot as unknown as BotClient)

    const expenseHandler = bot.on.mock.calls.find((call: any) =>
      (call[1].__pattern?.source || "").includes("expense")
    )?.[1] as ((msg: Tg.Message, match?: RegExpExecArray | null) => Promise<void>) | undefined
    const templatesHandler = bot.on.mock.calls.find((call: any) =>
      (call[1].__pattern?.source || "").includes("templates")
    )?.[1] as ((msg: Tg.Message, match?: RegExpExecArray | null) => Promise<void>) | undefined

    if (!expenseHandler || !templatesHandler) {
      throw new Error("Command handlers not found")
    }

    await expenseHandler({ chat: { id: 5002 }, text: "/expense 50 food" } as Tg.Message)
    await templatesHandler({ chat: { id: 5002 } } as Tg.Message)

    const sentMessages = (bot.sendMessage as jest.Mock).mock.calls.map(
      (call) => call[1] as string
    )
    expect(sentMessages.some((m) => m.includes("Premium"))).toBe(true)
  })

  test("blocks import and custom messages for free tier", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const contextBase = {
      bot,
      msg: { chat: { id: 5003 } } as unknown as Tg.Message,
      chatId: 5003,
      userId: "5003",
      text: "",
      lang: "en" as const,
      wizardManager: wizard,
      db: dbStorage,
    }

    await handleUploadStatement(contextBase)
    await handleCustomMessagesMenu(contextBase)

    const lockedText = t("en", "commands.monetization.featureLocked", {
      feature: t("en", "commands.monetization.featureStatementImport"),
    })
    expect(bot.sendMessage).toHaveBeenCalledWith(
      5003,
      expect.stringContaining(lockedText),
      expect.any(Object)
    )
  })

  test("blocks export from analytics reports for free tier", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "5004"
    const chatId = 5004

    wizard.setState(userId, {
      step: "ANALYTICS_REPORTS_MENU",
      data: {},
      returnTo: "reports",
      lang: "en",
    })

    await wizard.handleWizardInput(chatId, userId, t("en", "buttons.exportCsv"))

    const expectedFeature = t("en", "commands.monetization.featureExport")
    expect(bot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining(expectedFeature),
      expect.any(Object)
    )
  })

  test("opens subscription view from premium-gate inline button", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    registerCallbackRouter(bot, wizard)

    await sendPremiumRequiredMessage(
      bot,
      5005,
      "en",
      t("en", "commands.monetization.featureVoice")
    )

    const firstCall = (bot.sendMessage as jest.Mock).mock.calls[0]
    const firstKeyboard = firstCall?.[2]?.reply_markup?.inline_keyboard as
      | Array<Array<{ callback_data?: string }>>
      | undefined
    const firstCallbackData = firstKeyboard?.flat().map((b) => b.callback_data)
    expect(firstCallbackData).toContain("sub_open")

    await (bot as any).handlers.callback_query({
      id: "cb-open-sub",
      data: "sub_open",
      message: {
        message_id: 10,
        chat: { id: 5005 },
      },
    })

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    const lastText = lastCall?.[1] as string
    const lastKeyboard = lastCall?.[2]?.reply_markup?.inline_keyboard as
      | Array<Array<{ callback_data?: string }>>
      | undefined
    const lastCallbackData = lastKeyboard?.flat().map((b) => b.callback_data)

    expect(lastText).toContain(t("en", "settings.subscriptionTitle"))
    expect(lastCallbackData).toContain("sub_refresh")
  })
})
