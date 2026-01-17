import { dbStorage as db } from "../database/storage-db"
import { formatMoney, safeAnswerCallback } from "../utils"
import type { WizardManager } from "../wizards/wizards"

import TelegramBot from "node-telegram-bot-api"
import { TransactionType, Currency, TransactionCategory } from "../types"

/**
 * Обработчик редактирования суммы шаблона
 */
export async function handleTemplateEditAmount(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizardManager: WizardManager
) {
  const templateId = data.replace("tmpl_edit_amt|", "")
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  if (!template) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "❌ Template not found", show_alert: true })
    return
  }

  wizardManager.setState(userId, {
    step: "TEMPLATE_EDIT_AMOUNT",
    data: { templateId },
    returnTo: "templates",
  })

  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(
    chatId,
    `💰 *Edit Amount*\n\nCurrent: ${formatMoney(template.amount, template.currency)}\n\nEnter new amount:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Cancel",
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
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string,
  wizardManager: WizardManager
) {
  const templateId = data.replace("tmpl_cancel|", "")

  wizardManager.clearState(userId)
  await safeAnswerCallback(bot, { callback_query_id: query.id })

  await showTemplateManageMenu(bot, chatId, userId, templateId)
}

export async function handleTemplateSave(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  data: string
) {
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parts = data.split("|")
  const kind = parts[1]
  const amountStr = parts[2]
  const category = decodeURIComponent(parts[3] || "")
  const currency = (parts[4] || defaultCurrency) as Currency
  const accountId = parts[5]
  const amount = Number(amountStr)

  if (!amount || !category || !kind) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "❌ Cannot save template", show_alert: true })
    return
  }

  const name = kind === "exp" ? `☕ ${category}` : `💰 ${category}`

  await db.addTemplate(userId, {
    name,
    category,
    amount,
    currency,
    accountId,
    type: kind === "exp" ? TransactionType.EXPENSE : TransactionType.INCOME,
  })

  await safeAnswerCallback(bot, { callback_query_id: query.id, text: "💾 Template saved", show_alert: false })
}

export async function handleTemplateUse(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const templateId = data.replace("tmpl_use|", "")
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  if (!template) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "❌ Template not found", show_alert: true })
    return
  }

  const balances = await db.getBalancesList(userId)

  if (balances.length === 0) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "⚠️ No balances found", show_alert: true })
    return
  }

  let smartAccount = template.accountId
  if (!smartAccount || !balances.find((b) => b.accountId === smartAccount)) {
    smartAccount =
      (await db.getSmartBalanceSelection(userId, template.category)) ||
      balances[0].accountId
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
  const text = `${emoji} ${formatted} — ${template.category}\nAccount: *${smartAccount}*`

  await safeAnswerCallback(bot, { callback_query_id: query.id, text: "✅ Transaction added", show_alert: false })
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown" })
}

export async function handleTemplateManage(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const templateId = data.replace("tmpl_manage|", "")
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  if (!template) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "❌ Template not found", show_alert: true })
    return
  }

  const formatted = formatMoney(template.amount, template.currency)
  const accountText = template.accountId
    ? `Account: ${template.accountId}`
    : "No default account"

  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(
    chatId,
    `⚙️ *Manage Template*\n\n` +
    `*${template.name}*\n` +
    `Amount: ${formatted}\n` +
    `${accountText}\n\n` +
    `Select action:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💰 Edit Amount",
              callback_data: `tmpl_edit_amt|${templateId}`,
            },
          ],
          [
            {
              text: "💳 Edit Account",
              callback_data: `tmpl_edit_acc|${templateId}`,
            },
          ],
          [
            {
              text: "🗑️ Delete",
              callback_data: `tmpl_del|${templateId}`,
            },
          ],
          [
            {
              text: "❌ Cancel",
              callback_data: `tmpl_list`,
            }
          ]
        ],
      },
    }
  )
}

export async function handleTemplateDelete(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const templateId = data.replace("tmpl_del|", "")
  const success = await db.deleteTemplate(userId, templateId)

  if (success) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "🗑️ Template deleted", show_alert: false })

    const templates = await db.getTemplates(userId)

    if (templates.length === 0) {
      await bot.sendMessage(
        chatId,
        "📋 *Templates*\n\nNo templates saved yet.\n\nUse `/expense` or `/income` and click \"💾 Save as template?\" to create templates.",
        { parse_mode: "Markdown" }
      )
    } else {
      const buttons: TelegramBot.InlineKeyboardButton[][] = templates.map(
        (tpl) => {
          const amountWithCurrency = formatMoney(tpl.amount, tpl.currency)
          return [
            {
              text: `${tpl.name} — ${amountWithCurrency}`,
              callback_data: `tmpl_use|${tpl.id}`,
            },
            {
              text: "⚙️ Manage",
              callback_data: `tmpl_manage|${tpl.id}`,
            },
          ]
        }
      )

      await bot.sendMessage(
        chatId,
        `📋 *Templates*\n\nClick to use or ⚙️ to manage:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: buttons,
          },
        }
      )
    }
  } else {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "❌ Template not found", show_alert: true })
  }
}

export async function handleTemplateEditAccount(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const templateId = data.replace("tmpl_edit_acc|", "")
  const balances = await db.getBalancesList(userId)

  if (balances.length === 0) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "⚠️ No balances found", show_alert: true })
    return
  }

  const buttons: TelegramBot.InlineKeyboardButton[][] = balances.map((bal) => [
    {
      text: `💳 ${bal.accountId} — ${formatMoney(bal.amount, bal.currency)}`,
      callback_data: `tmpl_set_acc|${templateId}|${bal.accountId}`,
    },
  ])

  buttons.push([
    {
      text: "❌ Cancel",
      callback_data: `tmpl_cancel|${templateId}`,
    },
  ])

  await safeAnswerCallback(bot, { callback_query_id: query.id })
  await bot.sendMessage(chatId, "💳 *Select default account:*", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: buttons,
    },
  })
}

export async function handleTemplateSetAccount(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const [_, templateId, accountId] = data.split("|")
  const success = await db.updateTemplateAccount(userId, templateId, accountId)

  if (success) {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "✅ Account updated", show_alert: false })
    await showTemplateManageMenu(bot, chatId, userId, templateId)
  } else {
    await safeAnswerCallback(bot, { callback_query_id: query.id, text: "❌ Failed to update", show_alert: true })
  }
}

export async function showTemplatesList(
  bot: TelegramBot,
  chatId: number,
  userId: string
) {
  const templates = await db.getTemplates(userId)

  if (templates.length === 0) {
    await bot.sendMessage(
      chatId,
      "📋 *Templates*\n\nNo templates saved yet.\n\nUse `/expense` or `/income` and click \"💾 Save as template?\" to create templates.",
      { parse_mode: "Markdown" }
    )
    return
  }

  const buttons: TelegramBot.InlineKeyboardButton[][] = templates.map((tpl) => {
    const amountWithCurrency = formatMoney(tpl.amount, tpl.currency)
    return [
      {
        text: `${tpl.name} — ${amountWithCurrency}`,
        callback_data: `tmpl_use|${tpl.id}`,
      },
      {
        text: "⚙️ Manage",
        callback_data: `tmpl_manage|${tpl.id}`,
      },
    ]
  })

  await bot.sendMessage(
    chatId,
    `📋 *Templates*\n\nClick to use or ⚙️ to manage:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  )
}

export async function showTemplateManageMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  templateId: string
) {
  const templates = await db.getTemplates(userId)
  const template = templates.find((t) => t.id === templateId)

  if (!template) {
    await bot.sendMessage(chatId, "❌ Template not found.")
    return
  }

  const formatted = formatMoney(template.amount, template.currency)
  const accountText = template.accountId
    ? `Account: ${template.accountId}`
    : "No default account"

  await bot.sendMessage(
    chatId,
    `⚙️ *Manage Template*\n\n` +
    `*${template.name}*\n` +
    `Amount: ${formatted}\n` +
    `${accountText}\n\n` +
    `Select action:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💰 Edit Amount",
              callback_data: `tmpl_edit_amt|${templateId}`,
            },
          ],
          [
            {
              text: "💳 Edit Account",
              callback_data: `tmpl_edit_acc|${templateId}`,
            },
          ],
          [
            {
              text: "🗑️ Delete",
              callback_data: `tmpl_del|${templateId}`,
            },
          ],
          [
            {
              text: "❌ Cancel",
              callback_data: `tmpl_list`,
            }
          ]
        ],
      },
    }
  )
}
