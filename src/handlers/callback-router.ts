import type { BotClient } from "@jilimb0/tgwrapper"
import { dbStorage as db } from "../database/storage-db"
import { resolveLanguage, t } from "../i18n"
import { sendPremiumRequiredMessage } from "../monetization/premium-gate"
import { safeAnswerCallback } from "../utils"
import type { WizardManager } from "../wizards/wizards"
import {
  handleSubscriptionBuy,
  handleSubscriptionCancelAbort,
  handleSubscriptionCancelConfirm,
  handleSubscriptionCancelPrompt,
  handleSubscriptionRefresh,
  handleSubscriptionResume,
  handleTrialCancel,
  handleTrialConfirm,
} from "./monetization-callback-handlers"
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
import { handleNLPCallback } from "./voice-handler"

export function registerCallbackRouter(
  bot: BotClient,
  wizardManager: WizardManager
) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id
    if (!chatId) return
    const userId = chatId.toString()
    await wizardManager.hydrateState(userId)
    const data = query.data || ""

    if (data.startsWith("tmpl_")) {
      const premiumEnabled = await db.canUsePremiumFeature(userId)
      if (!premiumEnabled) {
        let lang = resolveLanguage("en")
        try {
          lang = resolveLanguage(await db.getUserLanguage(userId))
        } catch {
          // keep default language
        }
        await safeAnswerCallback(bot, {
          callback_query_id: query.id,
        })
        await sendPremiumRequiredMessage(
          bot,
          chatId,
          lang,
          t(lang, "commands.monetization.featureTemplates")
        )
        return
      }
    }

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
        handle: async () =>
          handleReminderDone(bot, query, userId, chatId, data),
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
          handleTemplateUse(bot, query, userId, chatId, data, wizardManager),
      },
      {
        match: (value) => value.startsWith("tmpl_manage|"),
        handle: async () =>
          handleTemplateManage(bot, query, userId, chatId, data, wizardManager),
      },
      {
        match: (value) => value.startsWith("tmpl_del|"),
        handle: async () =>
          handleTemplateDelete(bot, query, userId, chatId, data, wizardManager),
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
        match: (value) => value.startsWith("nlp_"),
        handle: async () => handleNLPCallback(bot, query, wizardManager),
      },
      {
        match: (value) => value === "trial_confirm",
        handle: async () => handleTrialConfirm(bot, query, userId, chatId),
      },
      {
        match: (value) => value === "trial_cancel",
        handle: async () => handleTrialCancel(bot, query, userId, chatId),
      },
      {
        match: (value) => value === "sub_buy_month",
        handle: async () =>
          handleSubscriptionBuy(bot, query, userId, chatId, "monthly"),
      },
      {
        match: (value) => value === "sub_buy_year",
        handle: async () =>
          handleSubscriptionBuy(bot, query, userId, chatId, "yearly"),
      },
      {
        match: (value) => value === "sub_buy_lifetime",
        handle: async () =>
          handleSubscriptionBuy(bot, query, userId, chatId, "lifetime"),
      },
      {
        match: (value) => value === "sub_cancel_prompt",
        handle: async () =>
          handleSubscriptionCancelPrompt(bot, query, userId, chatId),
      },
      {
        match: (value) => value === "sub_cancel_confirm",
        handle: async () =>
          handleSubscriptionCancelConfirm(bot, query, userId, chatId),
      },
      {
        match: (value) => value === "sub_cancel_abort",
        handle: async () =>
          handleSubscriptionCancelAbort(bot, query, userId, chatId),
      },
      {
        match: (value) => value === "sub_refresh",
        handle: async () =>
          handleSubscriptionRefresh(bot, query, userId, chatId),
      },
      {
        match: (value) => value === "sub_resume",
        handle: async () =>
          handleSubscriptionResume(bot, query, userId, chatId),
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
