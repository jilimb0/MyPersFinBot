import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { recurringManager } from "../services/recurring-manager"
import { TransactionType, TransactionCategory } from "../types"
import * as validators from "../validators"
import { SETTINGS_KEYBOARD } from "../constants"
import { formatDateDisplay } from "../utils"
import dayjs from "dayjs"
import { Language, t } from "../i18n"

// Show recurring transactions menu
export async function handleRecurringMenu(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  lang: Language
): Promise<boolean> {
  const recurring = await recurringManager.getUserRecurring(userId)

  let msg = t(lang, "recurring.title") + "\n\n"

  if (!recurring.length) {
    msg += t(lang, "recurring.noTransactions") + "\n\n"
    msg += t(lang, "recurring.setupInfo") + "\n"
    msg += t(lang, "recurring.setupExamples") + "\n\n"
    msg += t(lang, "recurring.tapToStart")
  } else {
    msg += t(lang, "recurring.yourTransactions") + "\n\n"
    recurring.forEach((r, idx) => {
      const typeEmoji = r.type === TransactionType.EXPENSE ? "💸" : "💰"
      const statusEmoji = r.isActive ? "▶️" : "⏸"
      const freqLabel = t(
        lang,
        `recurring.frequency.${r.frequency.toLowerCase()}`
      )
      const name = r.description || t(lang, "recurring.unnamed")

      msg += `${idx + 1}. ${statusEmoji} ${typeEmoji} *${name}*\n`
      msg += `   ${t(lang, "recurring.listItemAmountLine", {
        amount: r.amount,
        currency: r.currency,
        frequency: freqLabel,
      })}\n`
      msg += `   ${t(lang, "recurring.listItemNextLine", {
        date: formatDateDisplay(r.nextExecutionDate),
      })}\n\n`
    })
    msg += "\n" + t(lang, "recurring.tapToManage")
  }

  const buttons: TelegramBot.KeyboardButton[][] = []

  // Add buttons for each recurring transaction
  recurring.forEach((r) => {
    const typeEmoji = r.type === TransactionType.EXPENSE ? "💸" : "💰"
    const name = r.description || t(lang, "recurring.unnamed")
    buttons.push([{ text: `${typeEmoji} ${name}` }])
  })

  buttons.push([{ text: t(lang, "buttons.addRecurring") }])
  buttons.push([
    { text: t(lang, "common.back") },
    { text: t(lang, "mainMenu.mainMenuButton") },
  ])

  wizardManager.setState(userId, {
    step: "RECURRING_MENU",
    data: {},
    returnTo: "automation",
  })

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true,
    },
  })

  return true
}

// Handle recurring transaction selection
export async function handleRecurringSelect(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  const lang = state?.lang || "en"
  const recurring = await recurringManager.getUserRecurring(userId)
  const selected = recurring.find(
    (r) =>
      `${r.type === TransactionType.EXPENSE ? "💸" : "💰"} ${r.description || t(lang, "recurring.unnamed")}` ===
      text
  )

  if (!selected) return false

  wizardManager.setState(userId, {
    step: "RECURRING_ITEM_MENU",
    data: { recurringId: selected.id, recurring: selected },
    returnTo: "recurring",
  })

  const typeEmoji = selected.type === TransactionType.EXPENSE ? "💸" : "💰"
  const statusLabel = selected.isActive
    ? t(lang, "recurring.statusActive")
    : t(lang, "recurring.statusPaused")
  const freqLabel = t(
    lang,
    `recurring.frequency.${selected.frequency.toLowerCase()}`
  )
  const name = selected.description || t(lang, "recurring.unnamed")

  let msg = `${t(lang, "recurring.detailsTitle", {
    emoji: typeEmoji,
    name,
  })}\n\n`
  msg += `${t(lang, "recurring.statusLine", { status: statusLabel })}\n`
  msg += `${t(lang, "recurring.amountLine", {
    amount: selected.amount,
    currency: selected.currency,
  })}\n`
  msg += `${t(lang, "recurring.accountLine", {
    account: selected.accountId,
  })}\n`
  msg += `${t(lang, "recurring.frequencyLine", {
    frequency: freqLabel,
  })}\n`
  msg += `${t(lang, "recurring.dayLine", {
    day: selected.dayOfMonth || t(lang, "common.notAvailable"),
  })}\n`
  msg += `${t(lang, "recurring.nextExecutionLine", {
    date: formatDateDisplay(selected.nextExecutionDate),
  })}\n`

  const buttons: TelegramBot.KeyboardButton[][] = [
    [
      {
        text: selected.isActive
          ? t(lang, "recurring.pauseButton")
          : t(lang, "recurring.resumeButton"),
      },
    ],
    [{ text: t(lang, "common.delete") }],
    [
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ],
  ]

  await wizardManager.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true,
    },
  })

  return true
}

// Handle recurring item actions
export async function handleRecurringItemAction(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state?.data?.recurringId) return false
  const lang = state?.lang || "en"
  const recurringId = state?.data?.recurringId
  const recurring = state?.data?.recurring

  if (
    text === t(lang, "recurring.pauseButton") ||
    text === t(lang, "recurring.resumeButton")
  ) {
    const newStatus = text === t(lang, "recurring.resumeButton")
    await recurringManager.toggleRecurring(recurringId, newStatus)

    await wizardManager.sendMessage(
      chatId,
      t(lang, newStatus ? "recurring.resumed" : "recurring.paused"),
      {
        reply_markup: SETTINGS_KEYBOARD,
      }
    )

    wizardManager.clearState(userId)
    return true
  }

  if (text === t(lang, "common.delete")) {
    wizardManager.setState(userId, {
      step: "RECURRING_DELETE_CONFIRM",
      data: { recurringId, recurring },
      returnTo: "recurring",
    })

    await wizardManager.sendMessage(
      chatId,
      `${t(lang, "recurring.deleteConfirmTitle")}\n\n` +
        t(lang, "recurring.deleteConfirmBody", {
          name: recurring.description || t(lang, "recurring.unnamed"),
          amount: recurring.amount,
          currency: recurring.currency,
        }),
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "common.yesDelete") }],
            [{ text: t(lang, "common.cancel") }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  return false
}

// Confirm delete
export async function handleRecurringDeleteConfirm(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state?.data?.recurringId) return false
  const lang = state?.lang || "en"
  if (text === t(lang, "common.yesDelete")) {
    await recurringManager.deleteRecurring(state?.data?.recurringId)

    await wizardManager.sendMessage(chatId, t(lang, "recurring.deleted"), {
      reply_markup: SETTINGS_KEYBOARD,
    })

    wizardManager.clearState(userId)
    return true
  }

  if (text === t(lang, "common.cancel")) {
    await wizardManager.sendMessage(chatId, t(lang, "common.cancelled"), {
      reply_markup: SETTINGS_KEYBOARD,
    })

    wizardManager.clearState(userId)
    return true
  }

  return false
}

// Start creating recurring transaction
export async function handleRecurringCreateStart(
  wizardManager: WizardManager,
  chatId: number,
  userId: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  const lang = state?.lang || "en"
  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_DESCRIPTION",
    data: {},
    returnTo: "recurring",
  })

  await wizardManager.sendMessage(
    chatId,
    t(lang, "recurring.newTransaction") +
      "\n\n" +
      t(lang, "recurring.enterDescription") +
      "\n\n" +
      t(lang, "recurring.descriptionExamples"),
    {
      parse_mode: "Markdown",
      ...wizardManager.getBackButton(lang),
    }
  )

  return true
}

// Handle description input
export async function handleRecurringDescription(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_TYPE",
    data: { ...state?.data, description: text },
    returnTo: "recurring",
  })

  await wizardManager.sendMessage(chatId, t(lang, "recurring.selectType"), {
    reply_markup: {
      keyboard: [
        [
          { text: t(lang, "recurring.expense") },
          { text: t(lang, "recurring.income") },
        ],
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

// Handle type selection
export async function handleRecurringType(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  let type: TransactionType
  if (text === t(lang, "recurring.expense")) {
    type = TransactionType.EXPENSE
  } else if (text === t(lang, "recurring.income")) {
    type = TransactionType.INCOME
  } else {
    return false
  }

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_AMOUNT",
    data: { ...state?.data, type },
    returnTo: "recurring",
  })

  const currency = await db.getDefaultCurrency(userId)

  await wizardManager.sendMessage(
    chatId,
    t(lang, "recurring.enterAmountPrompt", { currency }),
    wizardManager.getBackButton(lang)
  )

  return true
}

// Handle amount input
export async function handleRecurringAmount(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)

  if (!parsed || parsed.amount <= 0) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, "errors.invalidAmount"),
      wizardManager.getBackButton(lang)
    )
    return true
  }

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_ACCOUNT",
    data: {
      ...state?.data,
      amount: parsed.amount,
      currency: parsed.currency,
    },
    returnTo: "recurring",
  })

  const balances = await db.getBalancesList(userId)

  if (!balances.length) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, "recurring.noAccountsCreate"),
      {
        reply_markup: SETTINGS_KEYBOARD,
      }
    )
    wizardManager.clearState(userId)
    return true
  }

  const buttons: TelegramBot.KeyboardButton[][] = balances.map((bal) => [
    { text: `💳 ${bal.accountId}` },
  ])
  buttons.push([
    { text: t(lang, "common.back") },
    { text: t(lang, "mainMenu.mainMenuButton") },
  ])

  await wizardManager.sendMessage(chatId, t(lang, "common.selectAccount"), {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true,
    },
  })

  return true
}

// Handle account selection
export async function handleRecurringAccount(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state) return false

  const lang = state?.lang || "en"
  const accountId = text.replace("💳 ", "")
  const balances = await db.getBalancesList(userId)
  const account = balances.find((b) => b.accountId === accountId)

  if (!account) return false

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_CATEGORY",
    data: { ...state?.data, accountId },
    returnTo: "recurring",
  })

  const categories = await db.getTopCategories(userId, state?.data?.type)

  const buttons: TelegramBot.KeyboardButton[][] = []
  for (let i = 0; i < categories.length; i += 2) {
    buttons.push(categories.slice(i, i + 2).map((cat) => ({ text: cat })))
  }
  buttons.push([
    { text: t(lang, "common.back") },
    { text: t(lang, "mainMenu.mainMenuButton") },
  ])

  await wizardManager.sendMessage(chatId, t(lang, "recurring.selectCategory"), {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true,
    },
  })

  return true
}

// Handle category selection
export async function handleRecurringCategory(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  const validCategories = await db.getTopCategories(userId, state?.data?.type)

  if (!validCategories.includes(text as TransactionCategory)) return false

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_DAY",
    data: { ...state?.data, category: text as TransactionCategory },
    returnTo: "recurring",
  })

  await wizardManager.sendMessage(
    chatId,
    `${t(lang, "recurring.enterDayPrompt")}\n${t(
      lang,
      "recurring.dayExamples"
    )}`,
    {
      parse_mode: "Markdown",
      ...wizardManager.getBackButton(lang),
    }
  )

  return true
}

// Handle day input and create recurring
export async function handleRecurringDay(
  wizardManager: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizardManager.getState(userId)
  if (!state) return false
  const lang = state?.lang || "en"
  const day = parseInt(text)
  if (isNaN(day) || day < 1 || day > 31) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, "errors.invalidDay"),
      wizardManager.getBackButton(lang)
    )
    return true
  }

  // Calculate next execution date
  let nextDate = dayjs().date(day)
  if (nextDate.isBefore(dayjs(), "day")) {
    nextDate = nextDate.add(1, "month")
  }

  // Create recurring transaction
  await recurringManager.createRecurring({
    userId,
    type: state?.data?.type,
    amount: state?.data?.amount,
    currency: state?.data?.currency,
    category: state?.data?.category,
    accountId: state?.data?.accountId,
    description: state?.data?.description,
    frequency: "MONTHLY",
    startDate: nextDate.toDate(),
    dayOfMonth: day,
    isActive: true,
    autoExecute: true,
  })

  const typeEmoji = state?.data?.type === TransactionType.EXPENSE ? "💸" : "💰"

  await wizardManager.sendMessage(
    chatId,
    `${t(lang, "recurring.createdTitle")}\n\n` +
      `${typeEmoji} ${state?.data?.description}\n` +
      `${t(lang, "recurring.amountLine", {
        amount: state?.data?.amount,
        currency: state?.data?.currency,
      })}\n` +
      `${t(lang, "recurring.accountLine", {
        account: state?.data?.accountId,
      })}\n` +
      `${t(lang, "recurring.dayOfMonthLine", { day })}\n` +
      `${t(lang, "recurring.nextLine", {
        date: formatDateDisplay(nextDate.toDate()),
      })}`,
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )

  wizardManager.clearState(userId)
  return true
}
