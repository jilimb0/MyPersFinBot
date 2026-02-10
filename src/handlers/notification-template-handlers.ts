import { SETTINGS_KEYBOARD } from "../constants"
import { dbStorage as db } from "../database/storage-db"
import { resolveLanguage, t } from "../i18n"
import { escapeMarkdown } from "../utils"
import type { WizardManager } from "../wizards/wizards"

// Show custom messages menu
export async function handleCustomMessagesMenu(
  wizardManager: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const state = wizardManager.getState(userId)
  const lang = resolveLanguage(state?.lang)
  const settings = await db.getReminderSettings(userId)
  const customMessages = settings?.customMessages || {}

  let msg = `${t(lang, "notifications.customMessagesTitle")}\n\n`
  msg += `${t(lang, "notifications.customizeReminders")}\n\n`

  msg += t(lang, "notifications.debtReminder")
  msg += `${
    customMessages.debt
      ? escapeMarkdown(customMessages.debt)
      : t(lang, "notifications.usingDefaultTemplate")
  }\n`
  msg += "\n"

  msg += t(lang, "notifications.goalReminder")
  msg += `${
    customMessages.goal
      ? escapeMarkdown(customMessages.goal)
      : t(lang, "notifications.usingDefaultTemplate")
  }\n`
  msg += "\n"

  msg += t(lang, "notifications.incomeReminder")
  msg += `${
    customMessages.income
      ? escapeMarkdown(customMessages.income)
      : t(lang, "notifications.usingDefaultTemplate")
  }\n`
  msg += "\n\n"

  msg += `${t(lang, "notifications.availablePlaceholders")}\n`
  msg += `${t(lang, "notifications.placeholders.name")}\n`
  msg += `${t(lang, "notifications.placeholders.amount")}\n`
  msg += `${t(lang, "notifications.placeholders.currency")}\n`
  msg += `${t(lang, "notifications.placeholders.dueDate")}\n`
  msg += `${t(lang, "notifications.placeholders.remaining")}\n`
  msg += `${t(lang, "notifications.placeholders.target")}\n`
  msg += `${t(lang, "notifications.placeholders.monthlyAmount")}\n`
  msg += `${t(lang, "notifications.placeholders.monthsLeft")}\n`

  wizardManager.setState(userId, {
    step: "CUSTOM_MESSAGES_MENU",
    data: {},
    returnTo: "advanced",
    lang,
  })

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: t(lang, "notifications.editDebtTemplate") }],
        [{ text: t(lang, "notifications.editGoalTemplate") }],
        [{ text: t(lang, "notifications.editIncomeTemplate") }],
        [{ text: t(lang, "notifications.resetToDefaults") }],
        [
          { text: t(lang, "common.back") },
          { text: t(lang, "mainMenu.mainMenuButton") },
        ],
      ],
      resize_keyboard: true,
    },
  })
}

// Handle menu selection
export async function handleCustomMessagesAction(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state || state.step !== "CUSTOM_MESSAGES_MENU") return false
  const lang = resolveLanguage(state?.lang)
  if (text === t(lang, "notifications.editDebtTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "debt" },
      returnTo: "settings",
      lang,
    })

    await wizardManager.sendMessage(
      chatId,
      t(lang, "common.enterCustomDebtReminder") +
        t(lang, "notifications.exampleTitle") +
        "\n" +
        t(lang, "notifications.examples.debt") +
        "\n\n" +
        t(lang, "notifications.availablePlaceholders") +
        "\n" +
        t(lang, "notifications.placeholdersList.debt"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  if (text === t(lang, "notifications.editGoalTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "goal" },
      returnTo: "settings",
      lang,
    })

    await wizardManager.sendMessage(
      chatId,
      t(lang, "common.enterCustomGoalReminder") +
        t(lang, "notifications.exampleTitle") +
        "\n" +
        t(lang, "notifications.examples.goal") +
        "\n\n" +
        t(lang, "notifications.availablePlaceholders") +
        "\n" +
        t(lang, "notifications.placeholdersList.goal"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  if (text === t(lang, "notifications.editIncomeTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "income" },
      returnTo: "settings",
      lang,
    })

    await wizardManager.sendMessage(
      chatId,
      t(lang, "common.enterCustomIncomeReminder") +
        t(lang, "notifications.exampleTitle") +
        "\n" +
        t(lang, "notifications.examples.income") +
        "\n\n" +
        t(lang, "notifications.availablePlaceholders") +
        "\n" +
        t(lang, "notifications.placeholdersList.income"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  if (text === t(lang, "notifications.resetToDefaults")) {
    const settings = await db.getReminderSettings(userId)
    if (settings) {
      settings.customMessages = undefined
      await db.updateReminderSettings(userId, settings)
    }

    await wizardManager.sendMessage(
      chatId,
      t(lang, "notifications.templatesReset"),
      { reply_markup: SETTINGS_KEYBOARD }
    )
    wizardManager.clearState(userId)
    return true
  }

  return false
}

// Save custom message template
export async function handleCustomMessageSave(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state || state.step !== "CUSTOM_MESSAGE_EDIT") return false

  if (!state.data) return true
  const { type, lang } = state.data

  // Validate template has at least one placeholder
  if (!text.includes("{") || !text.includes("}")) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, "notifications.templatePlaceholderWarning"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  // Get current settings
  const settings = await db.getReminderSettings(userId)
  if (!settings) return false

  // Update custom message
  if (!settings.customMessages) {
    settings.customMessages = {}
  }

  if (type === "debt") {
    settings.customMessages.debt = text
  } else if (type === "goal") {
    settings.customMessages.goal = text
  } else if (type === "income") {
    settings.customMessages.income = text
  }

  await db.updateReminderSettings(userId, settings)

  await wizardManager.sendMessage(
    chatId,
    t(lang, "notifications.templateSaved", {
      type: t(lang, `notifications.templateTypes.${type}`),
      template: escapeMarkdown(text),
    }),
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )

  wizardManager.clearState(userId)
  return true
}
