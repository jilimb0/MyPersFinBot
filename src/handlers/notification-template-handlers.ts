import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { SETTINGS_KEYBOARD } from "../constants"
import { resolveLanguage, t } from "../i18n"

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

  let msg = t(state?.lang || "en", "notifications.customMessagesTitle") + "\n\n"
  msg += t(state?.lang || "en", "notifications.customizeReminders") + "\n\n"

  msg += t(state?.lang || "en", "notifications.debtReminder")
  msg +=
    customMessages.debt ||
    t(state?.lang || "en", "notifications.usingDefaultTemplate") + "\n"
  msg += "\n"

  msg += t(state?.lang || "en", "notifications.goalReminder")
  msg +=
    customMessages.goal ||
    t(state?.lang || "en", "notifications.usingDefaultTemplate") + "\n"
  msg += "\n"

  msg += t(state?.lang || "en", "notifications.incomeReminder")
  msg +=
    customMessages.income ||
    t(state?.lang || "en", "notifications.usingDefaultTemplate") + "\n"
  msg += "\n\n"

  msg += t(state?.lang || "en", "notifications.availablePlaceholders") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.name") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.amount") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.currency") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.dueDate") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.remaining") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.target") + "\n"
  msg +=
    t(state?.lang || "en", "notifications.placeholders.monthlyAmount") + "\n"
  msg += t(state?.lang || "en", "notifications.placeholders.monthsLeft") + "\n"

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
        [{ text: t(state?.lang || "en", "notifications.editDebtTemplate") }],
        [{ text: t(state?.lang || "en", "notifications.editGoalTemplate") }],
        [{ text: t(state?.lang || "en", "notifications.editIncomeTemplate") }],
        [{ text: t(state?.lang || "en", "notifications.resetToDefaults") }],
        [
          { text: t(state?.lang || "en", "common.back") },
          { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
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
  if (text === t(state?.lang || "en", "notifications.editDebtTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "debt" },
      returnTo: "settings",
      lang,
    })

    await wizardManager.sendMessage(
      chatId,
      t(state?.lang || "en", "common.enterCustomDebtReminder") +
        t(state?.lang || "en", "notifications.exampleTitle") +
        "\n" +
        t(state?.lang || "en", "notifications.examples.debt") +
        "\n\n" +
        t(state?.lang || "en", "notifications.availablePlaceholders") +
        "\n" +
        t(state?.lang || "en", "notifications.placeholdersList.debt"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  if (text === t(state?.lang || "en", "notifications.editGoalTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "goal" },
      returnTo: "settings",
      lang,
    })

    await wizardManager.sendMessage(
      chatId,
      t(state?.lang || "en", "common.enterCustomGoalReminder") +
        t(state?.lang || "en", "notifications.exampleTitle") +
        "\n" +
        t(state?.lang || "en", "notifications.examples.goal") +
        "\n\n" +
        t(state?.lang || "en", "notifications.availablePlaceholders") +
        "\n" +
        t(state?.lang || "en", "notifications.placeholdersList.goal"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  if (text === t(state?.lang || "en", "notifications.editIncomeTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "income" },
      returnTo: "settings",
      lang,
    })

    await wizardManager.sendMessage(
      chatId,
      t(state?.lang || "en", "common.enterCustomIncomeReminder") +
        t(state?.lang || "en", "notifications.exampleTitle") +
        "\n" +
        t(state?.lang || "en", "notifications.examples.income") +
        "\n\n" +
        t(state?.lang || "en", "notifications.availablePlaceholders") +
        "\n" +
        t(state?.lang || "en", "notifications.placeholdersList.income"),
      {
        parse_mode: "Markdown",
        ...wizardManager.getBackButton(lang),
      }
    )
    return true
  }

  if (text === t(state?.lang || "en", "notifications.resetToDefaults")) {
    const settings = await db.getReminderSettings(userId)
    if (settings) {
      settings.customMessages = undefined
      await db.updateReminderSettings(userId, settings)
    }

    await wizardManager.sendMessage(
      chatId,
      t(state?.lang || "en", "notifications.templatesReset"),
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
      t(state?.lang || "en", "notifications.templatePlaceholderWarning"),
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
    t(state?.lang || "en", "notifications.templateSaved", {
      type: t(state?.lang || "en", `notifications.templateTypes.${type}`),
      template: text,
    }),
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )

  wizardManager.clearState(userId)
  return true
}
