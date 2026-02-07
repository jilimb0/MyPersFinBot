/**
 * Goal Auto-Deposit Handlers
 */

import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import { showGoalsMenu } from "../menus-i18n"
import { AppDataSource } from "../database/data-source"
import { Goal as GoalEntity } from "../database/entities/Goal"
import { Goal } from "../types"
import { t } from "../i18n"

/**
 * Handle auto-deposit enable/disable toggle
 */
export async function handleAutoDepositToggle(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false
  const lang = state?.lang || "en"

  const goal = state?.data?.goal as Goal

  if (text === t(lang, "wizard.goal.enableAutoDeposit")) {
    // Start auto-deposit setup wizard
    wizard.setState(userId, {
      ...state,
      lang: state.lang,
      step: "AUTO_DEPOSIT_SELECT_ACCOUNT",
    })

    const balances = await db.getBalancesList(userId)

    if (balances.length === 0) {
      await wizard.sendMessage(
        chatId,
        t(lang, "errors.noAccountsFound"),
        wizard.getBackButton(lang)
      )
      return true
    }

    const accountButtons = balances.map((b) => [
      {
        text: `${b.accountId} (${b.currency})`,
      },
    ])
    accountButtons.push([
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ])

    await wizard.sendMessage(
      chatId,
      `${t(lang, "autoDeposit.setupTitle")}\n\n` +
        `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n\n` +
        `${t(lang, "autoDeposit.selectAccountPrompt")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: accountButtons,
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === t(lang, "wizard.goal.disableAutoDeposit")) {
    // Disable auto-deposit
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    await goalRepo.update(
      { id: goal.id, userId },
      { autoDeposit: undefined as any }
    )

    await wizard.sendMessage(
      chatId,
      t(lang, "autoDeposit.disabledMessage", { name: goal.name }),
      { parse_mode: "Markdown" }
    )

    await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
    wizard.clearState(userId)
    return true
  }

  return false
}

/**
 * Handle account selection for auto-deposit
 */
export async function handleAutoDepositAccountSelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false
  const lang = state?.lang || "en"
  const goal = state?.data?.goal as Goal

  // Extract account name from "AccountName (CURRENCY)"
  const match = text.match(/^(.+?)\s*\(([A-Z]{3})\)$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidAccountFormat"),
      wizard.getBackButton(lang)
    )
    return true
  }

  const [, accountId] = match

  // Store selected account and ask for amount
  wizard.setState(userId, {
    ...state,
    lang: state.lang,
    step: "AUTO_DEPOSIT_ENTER_AMOUNT",
    data: {
      ...state?.data,
      autoDepositAccountId: accountId?.trim() || "",
    },
  })

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoDeposit.amountTitle")}\n\n` +
      `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n` +
      `${t(lang, "autoDeposit.fromLine", {
        account: accountId?.trim() || t(lang, "common.notAvailable"),
      })}\n\n` +
      `${t(lang, "autoDeposit.amountPrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
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
 * Handle amount input for auto-deposit
 */
export async function handleAutoDepositAmountInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal || !state?.data?.autoDepositAccountId) return false

  const lang = state?.lang || "en"
  const goal = state?.data?.goal as Goal
  const accountId = state?.data?.autoDepositAccountId as string

  const amount = parseFloat(text)
  if (isNaN(amount) || amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidAmount"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Store amount and ask for frequency
  wizard.setState(userId, {
    ...state,
    lang: state.lang,
    step: "AUTO_DEPOSIT_SELECT_FREQUENCY",
    data: {
      ...state?.data,
      autoDepositAmount: amount,
    },
  })

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoDeposit.frequencyTitle")}\n\n` +
      `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n` +
      `${t(lang, "autoDeposit.fromLine", { account: accountId })}\n` +
      `${t(lang, "autoDeposit.amountLine", {
        amount,
        currency: goal.currency,
      })}\n\n` +
      `${t(lang, "autoDeposit.frequencyPrompt")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [
            { text: t(lang, "buttons.weekly") },
            { text: t(lang, "buttons.monthly") },
          ],
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
 * Handle frequency selection for auto-deposit
 */
export async function handleAutoDepositFrequencySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (
    !state?.data?.goal ||
    !state?.data?.autoDepositAccountId ||
    !state?.data?.autoDepositAmount
  )
    return false

  const lang = state?.lang || "en"
  const goal = state?.data?.goal as Goal
  // const accountId = state?.data?.autoDepositAccountId as string
  const amount = state?.data?.autoDepositAmount as number

  if (text === t(lang, "buttons.weekly")) {
    // Ask for day of week
    wizard.setState(userId, {
      ...state,
      lang: state.lang,
      step: "AUTO_DEPOSIT_SELECT_DAY_WEEKLY",
      data: {
        ...state?.data,
        autoDepositFrequency: "WEEKLY",
      },
    })

    await wizard.sendMessage(
      chatId,
      `${t(lang, "autoDeposit.selectDayOfWeekTitle")}\n\n` +
        `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n` +
        `${t(lang, "autoDeposit.amountLine", {
          amount,
          currency: goal.currency,
        })}\n\n` +
        `${t(lang, "autoDeposit.selectDayOfWeekPrompt")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [
              { text: t(lang, "wizard.days.Monday") },
              { text: t(lang, "wizard.days.Tuesday") },
            ],
            [
              { text: t(lang, "wizard.days.Wednesday") },
              { text: t(lang, "wizard.days.Thursday") },
            ],
            [
              { text: t(lang, "wizard.days.Friday") },
              { text: t(lang, "wizard.days.Saturday") },
            ],
            [{ text: t(lang, "wizard.days.Sunday") }],
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

  if (text === t(lang, "buttons.monthly")) {
    // Ask for day of month
    wizard.setState(userId, {
      ...state,
      lang: state.lang,
      step: "AUTO_DEPOSIT_SELECT_DAY_MONTHLY",
      data: {
        ...state?.data,
        autoDepositFrequency: "MONTHLY",
      },
    })

    await wizard.sendMessage(
      chatId,
      `${t(lang, "autoDeposit.selectDayOfMonthTitle")}\n\n` +
        `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n` +
        `${t(lang, "autoDeposit.amountLine", {
          amount,
          currency: goal.currency,
        })}\n\n` +
        `${t(lang, "autoDeposit.selectDayOfMonthPrompt")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "1" }, { text: "5" }, { text: "10" }],
            [{ text: "15" }, { text: "20" }, { text: "25" }],
            [{ text: "28" }],
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

  return false
}

/**
 * Handle day of week selection
 */
export async function handleAutoDepositDayWeeklySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false

  const lang = state?.lang || "en"
  const goal = state?.data?.goal as Goal
  const accountId = state?.data?.autoDepositAccountId as string
  const amount = state?.data?.autoDepositAmount as number

  const dayMap: Record<string, number> = {
    [t(lang, "wizard.days.Monday")]: 1,
    [t(lang, "wizard.days.Tuesday")]: 2,
    [t(lang, "wizard.days.Wednesday")]: 3,
    [t(lang, "wizard.days.Thursday")]: 4,
    [t(lang, "wizard.days.Friday")]: 5,
    [t(lang, "wizard.days.Saturday")]: 6,
    [t(lang, "wizard.days.Sunday")]: 0,
  }

  const dayOfWeek = dayMap[text]
  if (dayOfWeek === undefined) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidDay"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Save auto-deposit configuration
  await saveAutoDepositConfig(
    userId,
    goal.id,
    accountId,
    amount,
    "WEEKLY",
    undefined,
    dayOfWeek
  )

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoDeposit.enabledTitle")}\n\n` +
      `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n` +
      `${t(lang, "autoDeposit.amountLine", {
        amount,
        currency: goal.currency,
      })}\n` +
      `${t(lang, "autoDeposit.fromLine", { account: accountId })}\n` +
      `${t(lang, "autoDeposit.frequencyLine", {
        frequency: t(lang, "autoDeposit.frequencyWeekly", { day: text }),
      })}\n\n` +
      `${t(lang, "autoDeposit.noteWeekly", { day: text })}`,
    { parse_mode: "Markdown" }
  )

  await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
  wizard.clearState(userId)
  return true
}

/**
 * Handle day of month selection
 */
export async function handleAutoDepositDayMonthlySelect(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data?.goal) return false

  const lang = state?.lang || "en"
  const goal = state?.data?.goal as Goal
  const accountId = state?.data?.autoDepositAccountId as string
  const amount = state?.data?.autoDepositAmount as number

  const dayOfMonth = parseInt(text)
  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.invalidDay"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Save auto-deposit configuration
  await saveAutoDepositConfig(
    userId,
    goal.id,
    accountId,
    amount,
    "MONTHLY",
    dayOfMonth,
    undefined
  )

  await wizard.sendMessage(
    chatId,
    `${t(lang, "autoDeposit.enabledTitle")}\n\n` +
      `${t(lang, "autoDeposit.goalLine", { name: goal.name })}\n` +
      `${t(lang, "autoDeposit.amountLine", {
        amount,
        currency: goal.currency,
      })}\n` +
      `${t(lang, "autoDeposit.fromLine", { account: accountId })}\n` +
      `${t(lang, "autoDeposit.frequencyLine", {
        frequency: t(lang, "autoDeposit.frequencyMonthly", {
          day: dayOfMonth,
        }),
      })}\n\n` +
      `${t(lang, "autoDeposit.noteMonthly", { day: dayOfMonth })}`,
    { parse_mode: "Markdown" }
  )

  await showGoalsMenu(wizard.getBot(), chatId, userId, lang)
  wizard.clearState(userId)
  return true
}

/**
 * Save auto-deposit configuration to database
 */
async function saveAutoDepositConfig(
  userId: string,
  goalId: string,
  accountId: string,
  amount: number,
  frequency: "WEEKLY" | "MONTHLY",
  dayOfMonth?: number,
  dayOfWeek?: number
): Promise<void> {
  const goalRepo = AppDataSource.getRepository(GoalEntity)

  await goalRepo.update(
    { id: goalId, userId },
    {
      autoDeposit: {
        enabled: true,
        amount,
        accountId,
        frequency,
        dayOfMonth,
        dayOfWeek,
      },
    }
  )
}
