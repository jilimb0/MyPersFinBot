import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { SETTINGS_KEYBOARD } from "../constants"
import { t } from "../i18n"

// Show custom messages menu
export async function handleCustomMessagesMenu(
  wizardManager: WizardManager,
  chatId: number,
  userId: string
): Promise<void> {
  const state = wizardManager.getState(userId)
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
  msg += customMessages.goal || "_Using default template_\n"
  msg += "\n"

  msg += t(state?.lang || "en", "notifications.incomeReminder")
  msg += customMessages.income || "_Using default template_\n"
  msg += "\n\n"

  msg += t(state?.lang || "en", "notifications.availablePlaceholders") + "\n"
  msg += "`{name}` - Name\n"
  msg += "`{amount}` - Amount\n"
  msg += "`{currency}` - Currency\n"
  msg += "`{dueDate}` - Due date\n"
  msg += "`{remaining}` - Remaining amount\n"
  msg += "`{target}` - Target amount\n"
  msg += "`{monthlyAmount}` - Monthly payment\n"
  msg += "`{monthsLeft}` - Months remaining\n"

  wizardManager.setState(userId, {
    step: "CUSTOM_MESSAGES_MENU",
    data: {},
    returnTo: "advanced",
  })

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: t(state?.lang || "en", "notifications.editDebtTemplate") }],
        [{ text: t(state?.lang || "en", "notifications.editGoalTemplate") }],
        [{ text: t(state?.lang || "en", "notifications.editIncomeTemplate") }],
        [{ text: t(state?.lang || "en", "notifications.resetToDefaults") }],
        [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
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
  const lang = state?.lang || "en"
  if (text === t(state?.lang || "en", "notifications.editDebtTemplate")) {
    wizardManager.setState(userId, {
      step: "CUSTOM_MESSAGE_EDIT",
      data: { type: "debt" },
      returnTo: "settings",
    })

    await wizardManager.sendMessage(
      chatId,
      "📝 *Enter custom debt reminder template:*\n\n" +
        "Example:\n" +
        "`💸 Pay {name}: {remaining} {currency} due {dueDate}`\n\n" +
        "Available placeholders:\n" +
        "`{name}`, `{amount}`, `{currency}`, `{dueDate}`, `{remaining}`, `{monthlyAmount}`, `{monthsLeft}`",
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
    })

    await wizardManager.sendMessage(
      chatId,
      "📝 *Enter custom goal reminder template:*\n\n" +
        "Example:\n" +
        "`🎯 Goal progress: {name} - {remaining} {currency} left (target: {target} {currency})`\n\n" +
        "Available placeholders:\n" +
        "`{name}`, `{amount}`, `{currency}`, `{remaining}`, `{target}`",
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
    })

    await wizardManager.sendMessage(
      chatId,
      "📝 *Enter custom income reminder template:*\n\n" +
        "Example:\n" +
        "`💰 Expected income: {name} - {amount} {currency} due today`\n\n" +
        "Available placeholders:\n" +
        "`{name}`, `{amount}`, `{currency}`",
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
    `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} template saved!\n\n` +
      `Template: ${text}`,
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )

  wizardManager.clearState(userId)
  return true
}
