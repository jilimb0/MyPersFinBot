import type { BotClient } from "@jilimb0/tgwrapper"
import { registerCallbackRouter } from "../../handlers/callback-router"
import { getExpenseCategoryLabel } from "../../i18n"
import { ExpenseCategory } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../handlers/reminder-callback-handlers", () => ({
  handleReminderSnooze: jest.fn().mockResolvedValue(undefined),
  handleReminderDone: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../utils", () => ({
  safeAnswerCallback: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    canUsePremiumFeature: jest.fn().mockResolvedValue(true),
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

jest.mock("../../handlers/template-handlers", () => ({
  handleTemplateCancelEdit: jest.fn().mockResolvedValue(undefined),
  handleTemplateDelete: jest.fn().mockResolvedValue(undefined),
  handleTemplateEditAccount: jest.fn().mockResolvedValue(undefined),
  handleTemplateEditAmount: jest.fn().mockResolvedValue(undefined),
  handleTemplateManage: jest.fn().mockResolvedValue(undefined),
  handleTemplateSave: jest.fn().mockResolvedValue(undefined),
  handleTemplateSetAccount: jest.fn().mockResolvedValue(undefined),
  handleTemplateUse: jest.fn().mockResolvedValue(undefined),
  showTemplatesList: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../handlers/voice-handler", () => ({
  handleNLPCallback: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../handlers/monetization-callback-handlers", () => ({
  handleSubscriptionBuy: jest.fn().mockResolvedValue(undefined),
  handleSubscriptionCancelAbort: jest.fn().mockResolvedValue(undefined),
  handleSubscriptionCancelConfirm: jest.fn().mockResolvedValue(undefined),
  handleSubscriptionCancelPrompt: jest.fn().mockResolvedValue(undefined),
  handleSubscriptionOpen: jest.fn().mockResolvedValue(undefined),
  handleSubscriptionRefresh: jest.fn().mockResolvedValue(undefined),
  handleSubscriptionResume: jest.fn().mockResolvedValue(undefined),
  handleTrialCancel: jest.fn().mockResolvedValue(undefined),
  handleTrialConfirm: jest.fn().mockResolvedValue(undefined),
}))

import {
  handleReminderDone,
  handleReminderSnooze,
} from "../../handlers/reminder-callback-handlers"
import { handleSubscriptionOpen } from "../../handlers/monetization-callback-handlers"
import {
  handleTemplateCancelEdit,
  handleTemplateDelete,
  handleTemplateEditAccount,
  handleTemplateEditAmount,
  handleTemplateManage,
  handleTemplateSave,
  handleTemplateSetAccount,
  handleTemplateUse,
  showTemplatesList,
} from "../../handlers/template-handlers"
import { handleNLPCallback } from "../../handlers/voice-handler"
import { safeAnswerCallback } from "../../utils"

class MockBot {
  handlers: Record<string, (msg: any) => void> = {}
  on = jest.fn((event: string, handler: (msg: any) => void) => {
    this.handlers[event] = handler
  })
  sendMessage = jest.fn().mockResolvedValue({})
}

const createQuery = (data: string, chatId: number = 123) => ({
  id: "query-123",
  from: { id: chatId, is_bot: false, first_name: "Test" },
  message: {
    message_id: 1,
    chat: { id: chatId, type: "private" as const },
    date: Date.now(),
    text: "test",
  },
  chat_instance: "123",
  data,
})

/**
 * Comprehensive test suite for callback router.
 * Merged from callback-router.test.ts and callback-router-coverage.test.ts
 * All duplicate tests have been removed.
 */
describe("Callback router", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("registers callback_query handler", () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    expect(bot.on).toHaveBeenCalledWith("callback_query", expect.any(Function))
  })

  test("routes tx_cat to wizard", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const spy = jest.spyOn(wizard, "handleWizardInput")

    registerCallbackRouter(bot, wizard)

    const label = getExpenseCategoryLabel(
      "en",
      ExpenseCategory.FOOD_DINING,
      "short"
    )

    await (bot as any).handlers.callback_query({
      id: "cb-1",
      data: `tx_cat|${label}`,
      message: { chat: { id: 10 } },
    })

    expect(safeAnswerCallback).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(10, "10", label)
  })

  test("handles tx_cat callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tx_cat|Food")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(safeAnswerCallback).toHaveBeenCalled()
  })

  test("routes reminder callbacks", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    await (bot as any).handlers.callback_query({
      id: "cb-2",
      data: "reminder_snooze|rem-1|1h",
      message: { chat: { id: 11 } },
    })

    await (bot as any).handlers.callback_query({
      id: "cb-3",
      data: "reminder_done|rem-2",
      message: { chat: { id: 12 } },
    })

    expect(handleReminderSnooze).toHaveBeenCalled()
    expect(handleReminderDone).toHaveBeenCalled()
  })

  test("handles reminder_snooze callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("reminder_snooze|rem123|30")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleReminderSnooze).toHaveBeenCalled()
  })

  test("handles reminder_done callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("reminder_done|rem123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleReminderDone).toHaveBeenCalled()
  })

  test("handles tmpl_edit_amt callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_edit_amt|tpl123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateEditAmount).toHaveBeenCalled()
  })

  test("handles tmpl_cancel callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_cancel|tpl123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateCancelEdit).toHaveBeenCalled()
  })

  test("handles tmpl_save callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_save|exp|100|Food|USD|acc1")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateSave).toHaveBeenCalled()
  })

  test("handles tmpl_use callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_use|tpl123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateUse).toHaveBeenCalled()
  })

  test("handles tmpl_manage callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_manage|tpl123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateManage).toHaveBeenCalled()
  })

  test("handles tmpl_del callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_del|tpl123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateDelete).toHaveBeenCalled()
  })

  test("handles tmpl_edit_acc callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_edit_acc|tpl123")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateEditAccount).toHaveBeenCalled()
  })

  test("handles tmpl_set_acc callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_set_acc|tpl123|acc456")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleTemplateSetAccount).toHaveBeenCalled()
  })

  test("handles nlp callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("nlp_confirm")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleNLPCallback).toHaveBeenCalled()
  })

  test("handles tmpl_list callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("tmpl_list")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(showTemplatesList).toHaveBeenCalled()
  })

  test("handles sub_open callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    const query = createQuery("sub_open")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    expect(handleSubscriptionOpen).toHaveBeenCalled()
  })

  test("ignores callback without chatId", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const spy = jest.spyOn(wizard, "handleWizardInput")

    registerCallbackRouter(bot, wizard)

    const query = {
      id: "query-123",
      data: "test",
      message: undefined,
    }
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    // Should not call any handlers
    expect(spy).not.toHaveBeenCalled()
  })

  test("ignores unmatched callback", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const spy = jest.spyOn(wizard, "handleWizardInput")

    registerCallbackRouter(bot, wizard)

    const query = createQuery("unknown_callback")
    const callbackHandler = (bot as any).handlers.callback_query

    await callbackHandler(query)

    // Should not call any handler
    expect(handleTemplateUse).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })
})
