/**
 * Reminder Settings Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { AppDataSource } from "../database/data-source"
import { User } from "../database/entities/User"
import { ReminderSettings } from "../types"
import { t } from "../i18n"

/**
 * Show notifications settings menu
 */
export async function handleNotificationsMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<boolean> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { id: userId } })
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"

  const settings = user?.reminderSettings || {
    enabled: false,
    time: "09:00",
    timezone: "Asia/Tbilisi",
    channels: { telegram: true },
    notifyBefore: { debts: 3, goals: 7, income: 1 },
  }

  const msg =
    `🔔 *Notification Settings*\n\n` +
    `Status: ${settings.enabled ? t(lang, "common.enabled") : t(lang, "common.disabled")}\n` +
    `Time: ${settings.time}\n` +
    `Timezone: ${settings.timezone}\n\n` +
    `*Notify Before:*\n` +
    `• Debts: ${settings.notifyBefore.debts} days\n` +
    `• Goals: ${settings.notifyBefore.goals} days\n` +
    `• Income: ${settings.notifyBefore.income} days\n\n` +
    `What would you like to change?`

  await wizard.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [
          {
            text: settings.enabled
              ? "❌ Disable Notifications"
              : "✅ Enable Notifications",
          },
        ],
        [{ text: "⏰ Change Time" }],
        [{ text: "🌍 Change Timezone" }],
        [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
      ],
      resize_keyboard: true,
    },
  })

  return true
}

/**
 * Toggle notifications on/off
 */
export async function handleNotificationsToggle(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { id: userId } })

  if (!user) return false

  const currentSettings = user.reminderSettings || {
    enabled: false,
    time: "09:00",
    timezone: "Asia/Tbilisi",
    channels: { telegram: true },
    notifyBefore: { debts: 3, goals: 7, income: 1 },
  }

  const newEnabled = text === "✅ Enable Notifications"

  const updatedSettings: ReminderSettings = {
    ...currentSettings,
    enabled: newEnabled,
  }

  await userRepo.update({ id: userId }, { reminderSettings: updatedSettings })

  await wizard.sendMessage(
    chatId,
    `✅ Notifications ${newEnabled ? "enabled" : "disabled"}!`,
    { parse_mode: "Markdown" }
  )

  return await handleNotificationsMenu(wizard, chatId, userId)
}

/**
 * Show time selection menu
 */
export async function handleReminderTimeSelect(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<boolean> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { id: userId } })

  const currentTime = user?.reminderSettings?.time || "09:00"

  await wizard.goToStep(userId, "REMINDER_TIME_SELECT", {})

  await wizard.sendMessage(
    chatId,
    `⏰ *Change Reminder Time*\n\n` +
      `Current: ${currentTime}\n\n` +
      `Select a time for daily reminders:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "06:00" }, { text: "07:00" }, { text: "08:00" }],
          [{ text: "09:00" }, { text: "10:00" }, { text: "11:00" }],
          [{ text: "12:00" }, { text: "14:00" }, { text: "16:00" }],
          [{ text: "18:00" }, { text: "20:00" }, { text: "21:00" }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

/**
 * Save selected time
 */
export async function handleReminderTimeSave(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  if (!timeRegex.test(text)) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid time format. Please select from the options or enter in HH:MM format (e.g., 09:00).",
      wizard.getBackButton(lang)
    )
    return true
  }

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { id: userId } })

  if (!user) return false

  const currentSettings = user.reminderSettings || {
    enabled: true,
    time: "09:00",
    timezone: "Asia/Tbilisi",
    channels: { telegram: true },
    notifyBefore: { debts: 3, goals: 7, income: 1 },
  }

  const updatedSettings: ReminderSettings = {
    ...currentSettings,
    time: text,
  }

  await userRepo.update({ id: userId }, { reminderSettings: updatedSettings })

  await wizard.sendMessage(
    chatId,
    `✅ Reminder time updated to ${text}!\n\n` +
      `You will receive daily notifications at this time.`,
    { parse_mode: "Markdown" }
  )

  wizard.clearState(userId)
  return await handleNotificationsMenu(wizard, chatId, userId)
}

/**
 * Show timezone selection menu
 */
export async function handleTimezoneSelect(
  wizard: WizardManager,
  chatId: number,
  userId: string
): Promise<boolean> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { id: userId } })

  const currentTimezone = user?.reminderSettings?.timezone || "Asia/Tbilisi"

  await wizard.goToStep(userId, "REMINDER_TIMEZONE_SELECT", {})

  await wizard.sendMessage(
    chatId,
    `🌍 *Change Timezone*\n\n` +
      `Current: ${currentTimezone}\n\n` +
      `Select your timezone:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "🇬🇪 Asia/Tbilisi (GMT+4)" }],
          [{ text: "🇺🇦 Europe/Kyiv (GMT+2)" }],
          [{ text: "🇵🇱 Europe/Warsaw (GMT+1)" }],
          [{ text: "🇬🇧 Europe/London (GMT+0)" }],
          [{ text: "🇺🇸 America/New_York (GMT-5)" }],
          [{ text: "🇺🇸 America/Los_Angeles (GMT-8)" }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

/**
 * Save selected timezone
 */
export async function handleTimezoneSave(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"
  const match = text.match(/([A-Za-z_]+\/[A-Za-z_]+)/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      "❌ Invalid timezone. Please select from the options.",
      wizard.getBackButton(lang)
    )
    return true
  }

  const timezone = match[1]

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOne({ where: { id: userId } })

  if (!user) return false

  const currentSettings = user.reminderSettings || {
    enabled: true,
    time: "09:00",
    timezone: "Asia/Tbilisi",
    channels: { telegram: true },
    notifyBefore: { debts: 3, goals: 7, income: 1 },
  }

  const updatedSettings: ReminderSettings = {
    ...currentSettings,
    timezone: timezone || "UTC",
  }

  await userRepo.update({ id: userId }, { reminderSettings: updatedSettings })

  await wizard.sendMessage(
    chatId,
    `✅ Timezone updated to ${timezone}!\n\n` +
      `Your reminder time (${currentSettings.time}) will be based on this timezone.`,
    { parse_mode: "Markdown" }
  )

  wizard.clearState(userId)
  return await handleNotificationsMenu(wizard, chatId, userId)
}
