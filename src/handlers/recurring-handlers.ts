import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { recurringManager } from "../services/recurring-manager"
import { TransactionType, TransactionCategory } from "../types"
import * as validators from "../validators"
import { SETTINGS_KEYBOARD } from "../constants"
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

  let msg = t(lang, 'recurring.title') + "\n\n"

  if (!recurring.length) {
    msg += t(lang, 'recurring.noTransactions') + "\n\n"
    msg += t(lang, 'recurring.setupInfo')
    msg += "• Monthly rent\n"
    msg += "• Subscriptions (Netflix, Spotify)\n"
    msg += "• Utilities (electricity, internet)\n"
    msg += "• Salary income\n\n"
    msg += t(lang, 'recurring.tapToStart')
  } else {
    msg += t(lang, 'recurring.yourTransactions') + "\n\n"
    recurring.forEach((r, idx) => {
      const typeEmoji = r.type === TransactionType.EXPENSE ? "💸" : "💰"
      const statusEmoji = r.isActive ? "▶️" : "⏸"
      const freqLabel = r.frequency === "MONTHLY" ? "monthly" : r.frequency.toLowerCase()

      msg += `${idx + 1}. ${statusEmoji} ${typeEmoji} *${r.description || "Unnamed"}*\n`
      msg += `   ${r.amount} ${r.currency} — ${freqLabel}\n`
      msg += `   Next: ${dayjs(r.nextExecutionDate).format("DD.MM.YYYY")}\n\n`
    })
    msg += "\n" + t(lang, 'recurring.tapToManage')
  }

  const buttons: TelegramBot.KeyboardButton[][] = []

  // Add buttons for each recurring transaction
  recurring.forEach((r) => {
    const typeEmoji = r.type === TransactionType.EXPENSE ? "💸" : "💰"
    buttons.push([{ text: `${typeEmoji} ${r.description || "Unnamed"}` }])
  })

  buttons.push([{ text: t(lang, 'recurring.addRecurring') }])
  buttons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

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
  const lang = state.lang || 'en';
  const recurring = await recurringManager.getUserRecurring(userId)
  const selected = recurring.find(
    (r) => `${r.type === TransactionType.EXPENSE ? "💸" : "💰"} ${r.description || "Unnamed"}` === text
  )

  if (!selected) return false

  wizardManager.setState(userId, {
    step: "RECURRING_ITEM_MENU",
    data: { recurringId: selected.id, recurring: selected },
    returnTo: "recurring",
  })

  const typeEmoji = selected.type === TransactionType.EXPENSE ? "💸" : "💰"
  const statusEmoji = selected.isActive ? "▶️ Active" : "⏸ Paused"
  const freqLabel = selected.frequency === "MONTHLY" ? "Monthly" : selected.frequency

  let msg = `${typeEmoji} *${selected.description || "Unnamed"}*\n\n`
  msg += `Status: ${statusEmoji}\n`
  msg += `Amount: ${selected.amount} ${selected.currency}\n`
  msg += `Account: ${selected.accountId}\n`
  msg += `Frequency: ${freqLabel}\n`
  msg += `Day: ${selected.dayOfMonth || "N/A"}\n`
  msg += `Next execution: ${dayjs(selected.nextExecutionDate).format("DD.MM.YYYY")}\n`

  const buttons: TelegramBot.KeyboardButton[][] = [
    [{ text: selected.isActive ? "⏸ Pause" : "▶️ Resume" }],
    [{ text: t(lang, 'common.delete') }],
    [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
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
  const lang = state.lang || 'en';
  const recurringId = state.data.recurringId
  const recurring = state.data.recurring

  if (text === "⏸ Pause" || text === "▶️ Resume") {
    const newStatus = text === "▶️ Resume"
    await recurringManager.toggleRecurring(recurringId, newStatus)

    await wizardManager.sendMessage(
      chatId,
      t(lang, newStatus ? 'recurring.resumed' : 'recurring.paused'),
      {
        reply_markup: SETTINGS_KEYBOARD,
      }
    )

    wizardManager.clearState(userId)
    return true
  }

  if (text === t(lang, 'common.delete')) {
    wizardManager.setState(userId, {
      step: "RECURRING_DELETE_CONFIRM",
      data: { recurringId, recurring },
      returnTo: "recurring",
    })

    await wizardManager.sendMessage(
      chatId,
      `⚠️ *Delete Recurring Transaction?*\n\n` +
      `This will delete: *${recurring.description || "Unnamed"}*\n` +
      `Amount: ${recurring.amount} ${recurring.currency}\n\n` +
      `Are you sure?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, 'common.yesDelete') }],
            [{ text: t(lang, 'common.cancel') }],
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
  const lang = state.lang || 'en';
  if (text === t(lang, 'common.yesDelete')) {
    await recurringManager.deleteRecurring(state.data.recurringId)

    await wizardManager.sendMessage(
      chatId,
      t(lang, 'recurring.deleted'),
      {
        reply_markup: SETTINGS_KEYBOARD,
      }
    )

    wizardManager.clearState(userId)
    return true
  }

  if (text === t(lang, 'common.cancel')) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, 'common.cancelled'),
      {
        reply_markup: SETTINGS_KEYBOARD,
      }
    )

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
  const lang = state.lang || 'en';
  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_DESCRIPTION",
    data: {},
    returnTo: "recurring",
  })

  await wizardManager.sendMessage(
    chatId,
    t(lang, 'recurring.newTransaction') + "\n\n" +
    t(lang, 'recurring.enterDescription') + "\n\n" +
    "*Examples:*\n" +
    "• Rent\n" +
    "• Netflix Subscription\n" +
    "• Salary\n" +
    "• Electricity Bill",
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
  const lang = state.lang || 'en';
  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_TYPE",
    data: { ...state.data, description: text },
    returnTo: "recurring",
  })

  await wizardManager.sendMessage(
    chatId,
    t(lang, 'recurring.selectType'),
    {
      reply_markup: {
        keyboard: [
          [{ text: t(lang, 'recurring.expense') }, { text: t(lang, 'recurring.income') }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

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
  const lang = state.lang || 'en';
  let type: TransactionType
  if (text === t(lang, 'recurring.expense')) {
    type = TransactionType.EXPENSE
  } else if (text === t(lang, 'recurring.income')) {
    type = TransactionType.INCOME
  } else {
    return false
  }

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_AMOUNT",
    data: { ...state.data, type },
    returnTo: "recurring",
  })

  const currency = await db.getDefaultCurrency(userId)

  await wizardManager.sendMessage(
    chatId,
    `💵 Enter amount:\n\nExamples: 1000, 1000 ${currency}`,
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
  const lang = state.lang || 'en';
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)

  if (!parsed || parsed.amount <= 0) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, 'errors.invalidAmountTryAgain'),
      wizardManager.getBackButton(lang)
    )
    return true
  }

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_ACCOUNT",
    data: {
      ...state.data,
      amount: parsed.amount,
      currency: parsed.currency,
    },
    returnTo: "recurring",
  })

  const balances = await db.getBalancesList(userId)

  if (!balances.length) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, 'recurring.noAccountsCreate'),
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
  buttons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

  await wizardManager.sendMessage(
    chatId,
    t(lang, 'common.selectAccount'),
    {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
      },
    }
  )

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

  const lang = state.lang || 'en';
  const accountId = text.replace("💳 ", "")
  const balances = await db.getBalancesList(userId)
  const account = balances.find((b) => b.accountId === accountId)

  if (!account) return false

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_CATEGORY",
    data: { ...state.data, accountId },
    returnTo: "recurring",
  })

  const categories = await db.getTopCategories(userId, state.data.type)


  const buttons: TelegramBot.KeyboardButton[][] = []
  for (let i = 0; i < categories.length; i += 2) {
    buttons.push(
      categories.slice(i, i + 2).map((cat) => ({ text: cat }))
    )
  }
  buttons.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

  await wizardManager.sendMessage(
    chatId,
    t(lang, 'recurring.selectCategory'),
    {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
      },
    }
  )

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
  const lang = state.lang || 'en';
  const validCategories = await db.getTopCategories(userId, state.data.type)

  if (!validCategories.includes(text as TransactionCategory)) return false

  wizardManager.setState(userId, {
    step: "RECURRING_CREATE_DAY",
    data: { ...state.data, category: text as TransactionCategory },
    returnTo: "recurring",
  })

  await wizardManager.sendMessage(
    chatId,
    t(lang, 'recurring.enterDayPrompt') +
    "Examples:\n" +
    "• 1 (first day of month)\n" +
    "• 15 (mid-month)\n" +
    "• 28 (safe for all months)",
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
  const lang = state.lang || 'en';
  const day = parseInt(text)
  if (isNaN(day) || day < 1 || day > 31) {
    await wizardManager.sendMessage(
      chatId,
      t(lang, 'errors.invalidDay'),
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
    type: state.data.type,
    amount: state.data.amount,
    currency: state.data.currency,
    category: state.data.category,
    accountId: state.data.accountId,
    description: state.data.description,
    frequency: "MONTHLY",
    startDate: nextDate.toDate(),
    dayOfMonth: day,
    isActive: true,
    autoExecute: true,
  })

  const typeEmoji = state.data.type === TransactionType.EXPENSE ? "💸" : "💰"

  await wizardManager.sendMessage(
    chatId,
    `✅ *Recurring transaction created!*\n\n` +
    `${typeEmoji} ${state.data.description}\n` +
    `Amount: ${state.data.amount} ${state.data.currency}\n` +
    `Account: ${state.data.accountId}\n` +
    `Day: ${day} of each month\n` +
    `Next: ${nextDate.format("DD.MM.YYYY")}`,
    {
      parse_mode: "Markdown",
      reply_markup: SETTINGS_KEYBOARD,
    }
  )

  wizardManager.clearState(userId)
  return true
}
