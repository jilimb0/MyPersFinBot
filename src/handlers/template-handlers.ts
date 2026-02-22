import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { dbStorage as db } from "../database/storage-db"
import { getCategoryLabel, type Language, resolveLanguage, t } from "../i18n"
import {
  type Currency,
  type TransactionCategory,
  TransactionType,
} from "../types"
import { escapeMarkdown, formatMoney, safeAnswerCallback } from "../utils"
import type { WizardManager } from "../wizards/wizards"

/**
 * Обработчик редактирования суммы шаблона
 */
export async function handleTemplateEditAmount(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const templateId = data.replace("tmpl_edit_amt|", "")
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (!template) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.templateNotFound"),
      show_alert: true,
    })
    return
  }

  wizard.setState(userId, {
    step: "TEMPLATE_EDIT_AMOUNT",
    data: { templateId },
    returnTo: "templates",
    lang,
  })

  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(
    chatId,
    t(lang, "templates.editAmount") +
      "\n\n" +
      t(lang, "common.current") +
      ": " +
      formatMoney(template.amount, template.currency) +
      "\n\n" +
      t(lang, "templates.enterNewAmount") +
      ":",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: t(lang, "common.cancel"),
              callback_data: `tmpl_cancel|${templateId}`,
            },
          ],
        ],
      },
    }
  )
}

/**
 * Обработчик отмены редактирования шаблона
 */
export async function handleTemplateCancelEdit(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const templateId = data.replace("tmpl_cancel|", "")

  wizard.clearState(userId)
  await safeAnswerCallback(bot, { callback_query_id: query.id })

  await showTemplateManageMenu(bot, chatId, userId, templateId!, wizard)
}

export async function handleTemplateSave(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  data: string,
  wizard: WizardManager
) {
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parts = data.split("|")
  const kind = parts[1]
  const amountStr = parts[2]
  const category = decodeURIComponent(parts[3] || "")
  const currency = (parts[4] || defaultCurrency) as Currency
  const accountId = parts[5]
  const amount = Number(amountStr)
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (!amount || !category || !kind) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.cannotSave"),
      show_alert: true,
    })
    return
  }

  const categoryLabel = getCategoryLabel(lang, category)
  const name = kind === "exp" ? `☕ ${categoryLabel}` : `💰 ${categoryLabel}`

  await db.addTemplate(userId, {
    name,
    category,
    amount,
    currency,
    accountId,
    type: kind === "exp" ? TransactionType.EXPENSE : TransactionType.INCOME,
  })

  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: t(lang, "templates.saved"),
    show_alert: false,
  })
}

export async function handleTemplateUse(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const templateId = data.replace("tmpl_use|", "")
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (!template) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.templateNotFound"),
      show_alert: true,
    })
    return
  }

  const balances = await db.getBalancesList(userId)

  if (balances.length === 0) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "warnings.noBalancesFound"),
      show_alert: true,
    })
    return
  }

  let smartAccount = template.accountId
  if (!smartAccount || !balances.find((b) => b.accountId === smartAccount)) {
    smartAccount =
      (await db.getSmartBalanceSelection(userId, template.category)) ||
      balances[0]?.accountId
  }

  await db.addTransaction(userId, {
    id: Date().toString(),
    date: new Date(),
    amount: template.amount,
    currency: template.currency,
    type: template.type,
    category: template.category as TransactionCategory,
    fromAccountId:
      template.type === TransactionType.EXPENSE ? smartAccount : undefined,
    toAccountId:
      template.type === TransactionType.INCOME ? smartAccount : undefined,
  })

  const formatted = formatMoney(template.amount, template.currency)
  const emoji = template.type === TransactionType.EXPENSE ? "💸" : "💰"
  const text = t(lang, "templates.useMessage", {
    emoji,
    amount: formatted,
    category: escapeMarkdown(getCategoryLabel(lang, template.category)),
    account: escapeMarkdown(smartAccount || ""),
  })

  await safeAnswerCallback(bot, {
    callback_query_id: query.id,
    text: t(lang, "templates.transactionAdded"),
    show_alert: false,
  })
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown" })
}

export async function handleTemplateManage(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const templateId = data.replace("tmpl_manage|", "")
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)
  if (!template) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.templateNotFound"),
      show_alert: true,
    })
    return
  }

  const formatted = formatMoney(template.amount, template.currency)
  const accountText = template.accountId
    ? t(lang, "templates.accountLine", {
        account: escapeMarkdown(template.accountId),
      })
    : t(lang, "templates.noDefaultAccount")

  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(
    chatId,
    `${t(lang, "templates.manageTitle")}\n\n` +
      `${t(lang, "templates.nameLine", {
        name: escapeMarkdown(template.name),
      })}\n` +
      `${t(lang, "templates.amountLine", { amount: formatted })}\n` +
      `${accountText}\n\n` +
      `${t(lang, "templates.selectAction")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: t(lang, "common.editAmount"),
              callback_data: `tmpl_edit_amt|${templateId}`,
            },
          ],
          [
            {
              text: t(lang, "common.editAccount"),
              callback_data: `tmpl_edit_acc|${templateId}`,
            },
          ],
          [
            {
              text: t(lang, "common.delete"),
              callback_data: `tmpl_del|${templateId}`,
            },
          ],
          [
            {
              text: t(lang, "common.cancel"),
              callback_data: "tmpl_list",
            },
          ],
        ],
      },
    }
  )
}

export async function handleTemplateDelete(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const templateId = data.replace("tmpl_del|", "")
  const success = await db.deleteTemplate(userId, templateId)
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (success) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "templates.deleted"),
      show_alert: false,
    })

    const templates = await db.getTemplates(userId)

    if (templates.length === 0) {
      await bot.sendMessage(
        chatId,
        `${t(lang, "commands.templates.empty", {
          saveAsTemplate: t(lang, "buttons.saveAsTemplate"),
        })}\n\n${t(lang, "templates.emptyHint")}`,
        { parse_mode: "Markdown" }
      )
    } else {
      const buttons: Tg.InlineKeyboardButton[][] = templates.map((tpl) => {
        const amountWithCurrency = formatMoney(tpl.amount, tpl.currency)
        return [
          {
            text: `${tpl.name} — ${amountWithCurrency}`,
            callback_data: `tmpl_use|${tpl.id}`,
          },
          {
            text: t(lang, "buttons.manage"),
            callback_data: `tmpl_manage|${tpl.id}`,
          },
        ]
      })

      await bot.sendMessage(chatId, t(lang, "commands.templates.listHint"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons,
        },
      })
    }
  } else {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.templateNotFound"),
      show_alert: true,
    })
  }
}

export async function handleTemplateEditAccount(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const templateId = data.replace("tmpl_edit_acc|", "")
  const balances = await db.getBalancesList(userId)

  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (balances.length === 0) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "warnings.noBalancesFound"),
      show_alert: true,
    })
    return
  }

  const buttons: Tg.InlineKeyboardButton[][] = balances.map((bal) => [
    {
      text: t(lang, "templates.balanceOption", {
        account: bal.accountId,
        amount: formatMoney(bal.amount, bal.currency),
      }),
      callback_data: `tmpl_set_acc|${templateId}|${bal.accountId}`,
    },
  ])

  buttons.push([
    {
      text: t(lang, "common.cancel"),
      callback_data: `tmpl_cancel|${templateId}`,
    },
  ])

  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(chatId, t(lang, "templates.selectDefaultAccount"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: buttons,
    },
  })
}

export async function handleTemplateSetAccount(
  bot: BotClient,
  query: Tg.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizard: WizardManager
) {
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)
  const [_, templateId, accountId] = data.split("|")
  const success = await db.updateTemplateAccount(
    userId,
    templateId!,
    accountId!
  )

  if (success) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "templates.accountUpdated"),
      show_alert: false,
    })
    await showTemplateManageMenu(bot, chatId, userId, templateId!, wizard)
  } else {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "templates.failedToUpdate"),
      show_alert: true,
    })
  }
}

export async function showTemplatesList(
  bot: BotClient,
  chatId: number,
  userId: string
) {
  const templates = await db.getTemplates(userId)
  let lang: Language = "en"
  try {
    lang = await db.getUserLanguage(userId)
  } catch {
    lang = "en"
  }

  if (templates.length === 0) {
    await bot.sendMessage(
      chatId,
      `${t(lang, "commands.templates.empty", {
        saveAsTemplate: t(lang, "buttons.saveAsTemplate"),
      })}\n\n${t(lang, "templates.emptyHint")}`,
      { parse_mode: "Markdown" }
    )
    return
  }

  const buttons: Tg.InlineKeyboardButton[][] = templates.map((tpl) => {
    const amountWithCurrency = formatMoney(tpl.amount, tpl.currency)
    return [
      {
        text: `${tpl.name} — ${amountWithCurrency}`,
        callback_data: `tmpl_use|${tpl.id}`,
      },
      {
        text: t(lang, "buttons.manage"),
        callback_data: `tmpl_manage|${tpl.id}`,
      },
    ]
  })

  await bot.sendMessage(chatId, t(lang, "commands.templates.listHint"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: buttons,
    },
  })
}

export async function showTemplateManageMenu(
  bot: BotClient,
  chatId: number,
  userId: string,
  templateId: string,
  wizard: WizardManager
) {
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  if (!template) {
    await bot.sendMessage(chatId, t(lang, "errors.templateNotFound"))
    return
  }

  const formatted = formatMoney(template.amount, template.currency)
  const accountText = template.accountId
    ? t(lang, "templates.accountLine", {
        account: escapeMarkdown(template.accountId),
      })
    : t(lang, "templates.noDefaultAccount")

  await bot.sendMessage(
    chatId,
    `${t(lang, "templates.manageTitle")}\n\n` +
      `${t(lang, "templates.nameLine", {
        name: escapeMarkdown(template.name),
      })}\n` +
      `${t(lang, "templates.amountLine", { amount: formatted })}\n` +
      `${accountText}\n\n` +
      `${t(lang, "templates.selectAction")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: t(lang, "common.editAmount"),
              callback_data: `tmpl_edit_amt|${templateId}`,
            },
          ],
          [
            {
              text: t(lang, "common.editAccount"),
              callback_data: `tmpl_edit_acc|${templateId}`,
            },
          ],
          [
            {
              text: t(lang, "common.delete"),
              callback_data: `tmpl_del|${templateId}`,
            },
          ],
          [
            {
              text: t(lang, "common.cancel"),
              callback_data: "tmpl_list",
            },
          ],
        ],
      },
    }
  )
}
