import TelegramBot from "node-telegram-bot-api"
import type { WizardManager } from "../wizards/wizards"
import { safeAnswerCallback } from "../utils"
import {
  handleReminderDone,
  handleReminderSnooze,
} from "./reminder-callback-handlers"
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
} from "./template-handlers"

export function registerCallbackRouter(
  bot: TelegramBot,
  wizardManager: WizardManager
) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id
    if (!chatId) return
    const userId = chatId.toString()
    const data = query.data || ""

    const routes: Array<{
      match: (value: string) => boolean
      handle: () => Promise<void>
    }> = [
      {
        match: (value) => value.startsWith("tx_cat|"),
        handle: async () => {
          const category = data.replace("tx_cat|", "")
          await safeAnswerCallback(bot, { callback_query_id: query.id })
          await wizardManager.handleWizardInput(chatId, userId, category)
        },
      },
      {
        match: (value) => value.startsWith("reminder_snooze|"),
        handle: async () =>
          handleReminderSnooze(bot, query, userId, chatId, data),
      },
      {
        match: (value) => value.startsWith("reminder_done|"),
        handle: async () => handleReminderDone(bot, query, userId, chatId, data),
      },
      {
        match: (value) => value.startsWith("tmpl_edit_amt|"),
        handle: async () =>
          handleTemplateEditAmount(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value.startsWith("tmpl_cancel|"),
        handle: async () =>
          handleTemplateCancelEdit(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value.startsWith("tmpl_save|"),
        handle: async () =>
          handleTemplateSave(bot, query, userId, data, wizardManager),
      },
      {
        match: (value) => value.startsWith("tmpl_use|"),
        handle: async () =>
          handleTemplateUse(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value.startsWith("tmpl_manage|"),
        handle: async () =>
          handleTemplateManage(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value.startsWith("tmpl_del|"),
        handle: async () =>
          handleTemplateDelete(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value.startsWith("tmpl_edit_acc|"),
        handle: async () =>
          handleTemplateEditAccount(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value.startsWith("tmpl_set_acc|"),
        handle: async () =>
          handleTemplateSetAccount(
            bot,
            query,
            userId,
            chatId,
            data,
            wizardManager
          ),
      },
      {
        match: (value) => value === "tmpl_list",
        handle: async () => showTemplatesList(bot, chatId, userId),
      },
    ]

    const route = routes.find((entry) => entry.match(data))
    if (route) {
      await route.handle()
    }
  })
}
