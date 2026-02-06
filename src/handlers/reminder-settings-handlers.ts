/**
 * Reminder Settings Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { AppDataSource } from "../database/data-source"
import { User } from "../database/entities/User"
import { ReminderSettings } from "../types"
import { t } from "../i18n"
import { getReminderTimeKeyboard } from "../i18n/keyboards"

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
    `${t(lang, "reminders.settingsTitle")}\n\n` +
    `${t(lang, "reminders.statusLine", {
      status: settings.enabled
        ? t(lang, "common.enabled")
        : t(lang, "common.disabled"),
    })}\n` +
    `${t(lang, "reminders.timeLine", { time: settings.time })}\n` +
    `${t(lang, "reminders.timezoneLine", { timezone: settings.timezone })}\n\n` +
    `${t(lang, "reminders.notifyBeforeTitle")}\n` +
    `${t(lang, "reminders.notifyBeforeDebts", {
      days: settings.notifyBefore.debts,
    })}\n` +
    `${t(lang, "reminders.notifyBeforeGoals", {
      days: settings.notifyBefore.goals,
    })}\n` +
    `${t(lang, "reminders.notifyBeforeIncome", {
      days: settings.notifyBefore.income,
    })}\n\n` +
    `${t(lang, "reminders.changePrompt")}`

  await wizard.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [
          {
            text: settings.enabled
              ? t(lang, "wizard.notifications.disable")
              : t(lang, "wizard.notifications.enable"),
          },
        ],
        [{ text: t(lang, "wizard.notifications.changeTime") }],
        [{ text: t(lang, "buttons.changeTimezone") }],
        [
          { text: t(lang, "common.back") },
          { text: t(lang, "mainMenu.mainMenuButton") },
        ],
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
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"

  if (!user) return false

  const currentSettings = user.reminderSettings || {
    enabled: false,
    time: "09:00",
    timezone: "Asia/Tbilisi",
    channels: { telegram: true },
    notifyBefore: { debts: 3, goals: 7, income: 1 },
  }

  const newEnabled = text === t(lang, "wizard.notifications.enable")

  const updatedSettings: ReminderSettings = {
    ...currentSettings,
    enabled: newEnabled,
  }

  await userRepo.update({ id: userId }, { reminderSettings: updatedSettings })

  await wizard.sendMessage(
    chatId,
    t(lang, "reminders.toggledMessage", {
      status: newEnabled
        ? t(lang, "common.enabled")
        : t(lang, "common.disabled"),
    }),
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
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"

  const currentTime = user?.reminderSettings?.time || "09:00"

  await wizard.goToStep(userId, "REMINDER_TIME_SELECT", {})

  await wizard.sendMessage(
    chatId,
    `${t(lang, "reminders.changeTimeTitle")}\n\n` +
      `${t(lang, "reminders.currentTimeLine", { time: currentTime })}\n\n` +
      `${t(lang, "reminders.selectTimePrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: getReminderTimeKeyboard(lang),
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
      t(lang, "errors.invalidTimeFormat"),
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
    t(lang, "reminders.timeUpdatedMessage", { time: text }),
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
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"

  const currentTimezone = user?.reminderSettings?.timezone || "Asia/Tbilisi"

  await wizard.goToStep(userId, "REMINDER_TIMEZONE_SELECT", {})

  await wizard.sendMessage(
    chatId,
    `${t(lang, "reminders.changeTimezoneTitle")}\n\n` +
      `${t(lang, "reminders.currentTimezoneLine", {
        timezone: currentTimezone,
      })}\n\n` +
      `${t(lang, "reminders.selectTimezonePrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: t(lang, "reminders.timezoneOptions.tbilisi") }],
          [{ text: t(lang, "reminders.timezoneOptions.kyiv") }],
          [{ text: t(lang, "reminders.timezoneOptions.warsaw") }],
          [{ text: t(lang, "reminders.timezoneOptions.london") }],
          [{ text: t(lang, "reminders.timezoneOptions.newYork") }],
          [{ text: t(lang, "reminders.timezoneOptions.losAngeles") }],
          [
            { text: t(lang, "common.back") },
            { text: t(lang, "mainMenu.mainMenuButton") },
          ],
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
      t(lang, "errors.invalidTimezone"),
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
    t(lang, "reminders.timezoneUpdatedMessage", {
      timezone: timezone || "",
      time: currentSettings.time,
    }),
    { parse_mode: "Markdown" }
  )

  wizard.clearState(userId)
  return await handleNotificationsMenu(wizard, chatId, userId)
}
